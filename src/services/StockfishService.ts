import { sanitizeFen } from "../utils/inputValidator";

const DEFAULT_ENGINE_PATH = "/stockfish/stockfish-windows-x86-64.exe";
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 10_000;

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
  private process: EngineProcess | null = null;
  private initialized = false;
  private pendingWaiters: Array<{
    predicate: (line: string) => boolean;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  private readonly onStdoutData = (chunk: unknown): void => {
    const text = String(chunk ?? "");
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const line of lines) {
      this.resolveWaiters(line);
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
  };

  constructor(options?: {
    spawnEngine?: SpawnEngine;
    handshakeTimeoutMs?: number;
  }) {
    this.spawnEngine = options?.spawnEngine ?? this.defaultSpawnEngine;
    this.handshakeTimeoutMs =
      options?.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
  }

  async initialize(enginePath: string = DEFAULT_ENGINE_PATH): Promise<void> {
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
      );
      this.sendCommand("uci");
      await waitForUciOk;

      const waitForReadyOk = this.waitForLine(
        (line) => line === "readyok",
        this.handshakeTimeoutMs,
      );
      this.sendCommand("isready");
      await waitForReadyOk;

      this.initialized = true;
    } catch (error) {
      this.detachProcessListeners(engine);
      this.process = null;
      this.initialized = false;
      throw error;
    }
  }

  async analyzePosition(_fen: string, _depth: number): Promise<never> {
    throw new Error("analyzePosition is not implemented yet");
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  shutdown(): void {
    if (!this.process) {
      this.initialized = false;
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
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const waiter = { predicate, resolve, reject };
      this.pendingWaiters.push(waiter);

      const timeout = setTimeout(() => {
        this.pendingWaiters = this.pendingWaiters.filter((w) => w !== waiter);
        reject(new Error(`Stockfish handshake timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const wrappedResolve = (): void => {
        clearTimeout(timeout);
        resolve();
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
    matching.resolve();
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
