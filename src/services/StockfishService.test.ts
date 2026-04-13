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

  readonly stdin = {
    write: (data: string): void => {
      const command = data.trim();
      this.commands.push(command);

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
});
