import { afterEach, describe, it, expect, vi } from "vitest";
import { StockfishService } from "./StockfishService";

type DataHandler = (chunk: unknown) => void;
type ExitHandler = (code: number | null, signal: string | null) => void;

class TestStream {
  private readonly listeners = new Set<DataHandler>();

  on(_event: "data", handler: DataHandler): void {
    this.listeners.add(handler);
  }

  off(_event: "data", handler: DataHandler): void {
    this.listeners.delete(handler);
  }

  emit(chunk: unknown): void {
    for (const handler of this.listeners) {
      handler(chunk);
    }
  }
}

class FakeProcess {
  readonly stdout = new TestStream();
  readonly stderr = new TestStream();
  readonly commands: string[] = [];

  private readonly exitListeners = new Set<ExitHandler>();
  private readonly onCommand?: (command: string, process: FakeProcess) => void;

  constructor(onCommand?: (command: string, process: FakeProcess) => void) {
    this.onCommand = onCommand;
  }

  readonly stdin = {
    write: (data: string): void => {
      const command = data.trim();
      this.commands.push(command);

      this.onCommand?.(command, this);

      if (command === "uci") {
        this.stdout.emit("id name Stockfish\nuciok\n");
      }

      if (command === "isready") {
        this.stdout.emit("readyok\n");
      }
    },
  };

  on(_event: "exit", handler: ExitHandler): void {
    this.exitListeners.add(handler);
  }

  off(_event: "exit", handler: ExitHandler): void {
    this.exitListeners.delete(handler);
  }

  kill(): boolean {
    this.emitExit(0, null);
    return true;
  }

  emitExit(code: number | null, signal: string | null): void {
    for (const handler of this.exitListeners) {
      handler(code, signal);
    }
  }
}

describe("StockfishService", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("initializes with UCI handshake and marks service ready", async () => {
    const process = new FakeProcess();
    const spawnEngine = vi.fn().mockReturnValue(process);

    const service = new StockfishService({ spawnEngine });
    await service.initialize("C:/stockfish.exe");

    expect(spawnEngine).toHaveBeenCalledWith("C:/stockfish.exe", []);
    expect(process.commands).toEqual(["uci", "isready"]);
    expect(service.isInitialized()).toBe(true);
  });

  it("shuts down cleanly and sends quit to engine", async () => {
    const process = new FakeProcess();
    const service = new StockfishService({ spawnEngine: () => process });

    await service.initialize();
    service.shutdown();

    expect(process.commands).toContain("quit");
    expect(service.isInitialized()).toBe(false);
  });

  it("fails initialization when handshake times out", async () => {
    vi.useFakeTimers();

    const process = new FakeProcess();
    process.stdin.write = (data: string): void => {
      process.commands.push(data.trim());
      // Do not emit uciok/readyok -> timeout path
    };

    const service = new StockfishService({
      spawnEngine: () => process,
      handshakeTimeoutMs: 25,
    });

    const initPromise = service.initialize();
    const rejection = expect(initPromise).rejects.toThrow(
      "Stockfish handshake timed out after 25ms",
    );
    await vi.advanceTimersByTimeAsync(30);

    await rejection;
    expect(service.isInitialized()).toBe(false);
  });

  it("resets state when process exits unexpectedly", async () => {
    const process = new FakeProcess();
    const service = new StockfishService({ spawnEngine: () => process });

    await service.initialize();
    process.emitExit(1, null);

    expect(service.isInitialized()).toBe(false);
  });

  it("analyzes a position and parses bestmove, cp score, and principal variation", async () => {
    const process = new FakeProcess((command, p) => {
      if (command.startsWith("go depth 18")) {
        p.stdout.emit("info depth 18 score cp 47 pv e2e4 e7e5 g1f3\n");
        p.stdout.emit("bestmove e2e4 ponder e7e5\n");
      }
    });

    const service = new StockfishService({ spawnEngine: () => process });
    await service.initialize();

    const result = await service.analyzePosition(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      18,
    );

    expect(result.bestMove).toBe("e2e4");
    expect(result.evaluation).toBe(47);
    expect(result.depth).toBe(18);
    expect(result.principalVariation).toEqual(["e2e4", "e7e5", "g1f3"]);
    expect(result.engineVersion).toBe("Stockfish");
  });

  it("parses mate score from engine output", async () => {
    const process = new FakeProcess((command, p) => {
      if (command.startsWith("go depth 12")) {
        p.stdout.emit("info depth 12 score mate 3 pv h7h8q\n");
        p.stdout.emit("bestmove h7h8q\n");
      }
    });

    const service = new StockfishService({ spawnEngine: () => process });
    await service.initialize();

    const result = await service.analyzePosition(
      "7k/7P/7K/8/8/8/8/8 w - - 0 1",
      12,
    );

    expect(result.bestMove).toBe("h7h8q");
    expect(result.mate).toBe(3);
    expect(result.evaluation).toBe(10000);
  });

  it("fails analysis when bestmove is not returned before timeout", async () => {
    vi.useFakeTimers();

    const process = new FakeProcess((command, p) => {
      if (command.startsWith("go depth 10")) {
        p.stdout.emit("info depth 10 score cp 15 pv e2e4 e7e5\n");
      }
    });

    const service = new StockfishService({
      spawnEngine: () => process,
      analysisTimeoutMs: 25,
      maxRestartAttempts: 0,
    });
    await service.initialize();

    const analysisPromise = service.analyzePosition(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      10,
    );

    const rejection = expect(analysisPromise).rejects.toThrow(
      "Stockfish analysis timed out after 25ms",
    );
    await vi.advanceTimersByTimeAsync(30);
    await rejection;
  });

  it("automatically restarts engine after unexpected exit", async () => {
    const first = new FakeProcess();
    const second = new FakeProcess();
    const spawnEngine = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    const service = new StockfishService({ spawnEngine });
    await service.initialize("C:/stockfish.exe");

    first.emitExit(1, null);
    await Promise.resolve();
    await Promise.resolve();

    expect(spawnEngine).toHaveBeenCalledTimes(2);
    expect(second.commands).toEqual(["uci", "isready"]);
    expect(service.isInitialized()).toBe(true);
  });

  it("retries analysis after crash and succeeds on restarted engine", async () => {
    const first = new FakeProcess((command, p) => {
      if (command.startsWith("go depth 16")) {
        p.emitExit(1, null);
      }
    });

    const second = new FakeProcess((command, p) => {
      if (command.startsWith("go depth 16")) {
        p.stdout.emit("info depth 16 score cp 88 pv e2e4 e7e5\n");
        p.stdout.emit("bestmove e2e4\n");
      }
    });

    const spawnEngine = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    const service = new StockfishService({ spawnEngine });
    await service.initialize();

    const result = await service.analyzePosition(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      16,
    );

    expect(spawnEngine).toHaveBeenCalledTimes(2);
    expect(result.bestMove).toBe("e2e4");
    expect(result.evaluation).toBe(88);
    expect(result.depth).toBe(16);
  });
});
