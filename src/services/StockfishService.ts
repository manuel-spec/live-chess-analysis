import type { AnalysisResult } from "../types/AnalysisResult";
import { sanitizeFen } from "../utils/inputValidator";

const DEFAULT_ENGINE_PATH = "/stockfish/stockfish-windows-x86-64.exe";
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 10_000;
const DEFAULT_ANALYSIS_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESTART_ATTEMPTS = 3;

type DataHandler = (chunk: unknown) => void;
type ExitHandler = (code: number | null, signal: string | null) => void;

interface StreamLike {
  on(event: "data", handler: DataHandler): void;
  off?(event: "data", handler: DataHandler): void;
}

interface StdinLike {
  write(data: string): void;
}

interface EngineProcess {
  stdin: StdinLike;
  stdout: StreamLike;
  stderr: StreamLike;
  on(event: "exit", handler: ExitHandler): void;
  off?(event: "exit", handler: ExitHandler): void;
  kill(signal?: string): boolean;
}

type SpawnEngine = (command: string, args?: string[]) => EngineProcess;

export class StockfishService {
  private readonly spawnEngine: SpawnEngine;
  private readonly handshakeTimeoutMs: number;
  private readonly analysisTimeoutMs: number;
  private readonly maxRestartAttempts: number;
  private process: EngineProcess | null = null;
  private initialized = false;
  private isShuttingDown = false;
  private lastEnginePath = DEFAULT_ENGINE_PATH;
  private restartAttempts = 0;
  private restartInFlight: Promise<void> | null = null;
  private engineVersion: string | undefined;
  private readonly lineSubscribers = new Set<(line: string) => void>();
  private pendingWaiters: Array<{
    predicate: (line: string) => boolean;
    resolve: (line: string) => void;
    reject: (error: Error) => void;
  }> = [];

  private readonly onStdoutData = (chunk: unknown): void => {
    const text = String(chunk ?? "");
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const line of lines) {
      if (line.startsWith("id name ")) {
        this.engineVersion = line.slice("id name ".length).trim();
      }

      this.resolveWaiters(line);

      for (const subscriber of this.lineSubscribers) {
        subscriber(line);
      }
    }
  };

  private readonly onStderrData = (): void => {
    // Reserved for diagnostics/logging.
  };

  private readonly onExit = (): void => {
    this.initialized = false;
    this.process = null;

    for (const waiter of this.pendingWaiters) {
      waiter.reject(new Error("Stockfish process exited unexpectedly"));
    }
    this.pendingWaiters = [];

    if (!this.isShuttingDown) {
      void this.restartEngine().catch(() => {
        // Restart is best-effort here. Callers receive errors from their failed operations.
      });
    }
  };

  constructor(options?: {
    spawnEngine?: SpawnEngine;
    handshakeTimeoutMs?: number;
    analysisTimeoutMs?: number;
    maxRestartAttempts?: number;
  }) {
    this.spawnEngine = options?.spawnEngine ?? this.defaultSpawnEngine;
    this.handshakeTimeoutMs =
      options?.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
    this.analysisTimeoutMs =
      options?.analysisTimeoutMs ?? DEFAULT_ANALYSIS_TIMEOUT_MS;
    this.maxRestartAttempts =
      options?.maxRestartAttempts ?? DEFAULT_MAX_RESTART_ATTEMPTS;
  }

  async initialize(enginePath: string = DEFAULT_ENGINE_PATH): Promise<void> {
    this.lastEnginePath = enginePath;

    if (this.initialized && this.process) {
      return;
    }

    const engine = this.spawnEngine(enginePath, []);
    this.process = engine;
    this.attachProcessListeners(engine);

    try {
      const waitForUciOk = this.waitForLine(
        (line) => line === "uciok",
        this.handshakeTimeoutMs,
        "handshake",
      );
      this.sendCommand("uci");
      await waitForUciOk;

      const waitForReadyOk = this.waitForLine(
        (line) => line === "readyok",
        this.handshakeTimeoutMs,
        "handshake",
      );
      this.sendCommand("isready");
      await waitForReadyOk;

      this.initialized = true;
      this.restartAttempts = 0;
    } catch (error) {
      this.detachProcessListeners(engine);
      this.process = null;
      this.initialized = false;
      throw error;
    }
  }

  async analyzePosition(fen: string, depth: number): Promise<AnalysisResult> {
    if (!Number.isInteger(depth) || depth < 1 || depth > 30) {
      throw new Error("Analysis depth must be an integer between 1 and 30");
    }

    const safeFen = sanitizeFen(fen).trim();
    if (!safeFen) {
      throw new Error("Invalid FEN for analysis");
    }

    let attempt = 0;
    while (attempt <= this.maxRestartAttempts) {
      if (!this.initialized || !this.process) {
        await this.restartEngine();
      }

      try {
        return await this.analyzeOnce(safeFen, depth);
      } catch (error) {
        if (
          !this.isRecoverableEngineError(error) ||
          attempt === this.maxRestartAttempts
        ) {
          throw error;
        }

        attempt += 1;
        await this.restartEngine();
      }
    }

    throw new Error(
      "Failed to analyze position after engine recovery attempts",
    );
  }

  private async analyzeOnce(
    safeFen: string,
    depth: number,
  ): Promise<AnalysisResult> {
    if (!this.initialized || !this.process) {
      throw new Error("Stockfish is not initialized");
    }

    let latestInfoLine: string | undefined;
    const onLine = (line: string): void => {
      if (line.startsWith("info ") && line.includes(" score ")) {
        latestInfoLine = line;
      }
    };

    this.lineSubscribers.add(onLine);

    try {
      this.sendCommand(`position fen ${safeFen}`);
      const bestMovePromise = this.waitForLine(
        (line) => line.startsWith("bestmove "),
        this.analysisTimeoutMs,
        "analysis",
      );
      this.sendCommand(`go depth ${depth}`);
      const bestMoveLine = await bestMovePromise;

      const bestMove = this.getBestMove(bestMoveLine);
      const parsedEval = this.getEvaluation(latestInfoLine);
      const principalVariation = this.getPrincipalVariation(latestInfoLine);
      const parsedDepth = this.getDepth(latestInfoLine) ?? depth;

      return {
        fen: safeFen,
        bestMove,
        evaluation: parsedEval.evaluation,
        depth: parsedDepth,
        principalVariation,
        mate: parsedEval.mate,
        timestamp: Date.now(),
        engineVersion: this.engineVersion,
      };
    } finally {
      this.lineSubscribers.delete(onLine);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  shutdown(): void {
    this.isShuttingDown = true;

    if (!this.process) {
      this.initialized = false;
      this.isShuttingDown = false;
      return;
    }

    this.sendCommand("quit");
    this.detachProcessListeners(this.process);
    this.process.kill();
    this.process = null;
    this.initialized = false;

    for (const waiter of this.pendingWaiters) {
      waiter.reject(new Error("Stockfish service shutdown"));
    }
    this.pendingWaiters = [];
    this.isShuttingDown = false;
  }

  private async restartEngine(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error("Stockfish service is shutting down");
    }

    if (this.initialized && this.process) {
      return;
    }

    if (this.restartInFlight) {
      return this.restartInFlight;
    }

    if (this.restartAttempts >= this.maxRestartAttempts) {
      throw new Error(
        `Stockfish restart limit reached (${this.maxRestartAttempts})`,
      );
    }

    this.restartAttempts += 1;
    this.restartInFlight = this.initialize(this.lastEnginePath).finally(() => {
      this.restartInFlight = null;
    });

    return this.restartInFlight;
  }

  private isRecoverableEngineError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.message.includes("process exited unexpectedly") ||
      error.message.includes("Stockfish is not initialized") ||
      error.message.includes("analysis timed out")
    );
  }

  private sendCommand(command: string): void {
    if (!this.process) {
      throw new Error("Stockfish process is not running");
    }

    const safeCommand = sanitizeFen(command) || command;
    this.process.stdin.write(`${safeCommand}\n`);
  }

  private waitForLine(
    predicate: (line: string) => boolean,
    timeoutMs: number,
    context: "handshake" | "analysis",
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const waiter = { predicate, resolve, reject };
      this.pendingWaiters.push(waiter);

      const timeout = setTimeout(() => {
        this.pendingWaiters = this.pendingWaiters.filter((w) => w !== waiter);
        reject(
          new Error(`Stockfish ${context} timed out after ${timeoutMs}ms`),
        );
      }, timeoutMs);

      const wrappedResolve = (line: string): void => {
        clearTimeout(timeout);
        resolve(line);
      };

      const wrappedReject = (error: Error): void => {
        clearTimeout(timeout);
        reject(error);
      };

      waiter.resolve = wrappedResolve;
      waiter.reject = wrappedReject;
    });
  }

  private resolveWaiters(line: string): void {
    const matching = this.pendingWaiters.find((waiter) =>
      waiter.predicate(line),
    );
    if (!matching) {
      return;
    }

    this.pendingWaiters = this.pendingWaiters.filter(
      (waiter) => waiter !== matching,
    );
    matching.resolve(line);
  }

  private getBestMove(bestMoveLine: string): string {
    const match = /^bestmove\s+(\S+)/.exec(bestMoveLine);
    if (!match) {
      throw new Error("Failed to parse best move from Stockfish output");
    }

    return match[1];
  }

  private getEvaluation(infoLine?: string): {
    evaluation: number;
    mate?: number;
  } {
    if (!infoLine) {
      return { evaluation: 0 };
    }

    const mateMatch = /\bscore\s+mate\s+(-?\d+)\b/.exec(infoLine);
    if (mateMatch) {
      const mate = Number.parseInt(mateMatch[1], 10);
      return {
        evaluation: mate > 0 ? 10_000 : -10_000,
        mate,
      };
    }

    const cpMatch = /\bscore\s+cp\s+(-?\d+)\b/.exec(infoLine);
    if (cpMatch) {
      return { evaluation: Number.parseInt(cpMatch[1], 10) };
    }

    return { evaluation: 0 };
  }

  private getPrincipalVariation(infoLine?: string): string[] {
    if (!infoLine) {
      return [];
    }

    const match = /\bpv\s+(.+)$/.exec(infoLine);
    if (!match) {
      return [];
    }

    return match[1]
      .trim()
      .split(/\s+/)
      .filter((move) => move.length > 0);
  }

  private getDepth(infoLine?: string): number | undefined {
    if (!infoLine) {
      return undefined;
    }

    const match = /\bdepth\s+(\d+)\b/.exec(infoLine);
    if (!match) {
      return undefined;
    }

    const parsedDepth = Number.parseInt(match[1], 10);
    return Number.isFinite(parsedDepth) ? parsedDepth : undefined;
  }

  private attachProcessListeners(process: EngineProcess): void {
    process.stdout.on("data", this.onStdoutData);
    process.stderr.on("data", this.onStderrData);
    process.on("exit", this.onExit);
  }

  private detachProcessListeners(process: EngineProcess): void {
    if (process.stdout.off) {
      process.stdout.off("data", this.onStdoutData);
    }
    if (process.stderr.off) {
      process.stderr.off("data", this.onStderrData);
    }
    if (process.off) {
      process.off("exit", this.onExit);
    }
  }

  private defaultSpawnEngine = (
    _enginePath: string,
    _args: string[] = [],
  ): EngineProcess => {
    throw new Error(
      "No engine spawner provided. Inject spawnEngine when running outside Node.js.",
    );
  };
}
