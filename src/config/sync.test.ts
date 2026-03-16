/**
 * Unit tests for src/config/sync.ts
 *
 * All filesystem operations are injected so no real disk I/O occurs.
 */

import { describe, it, expect, mock } from "bun:test";
import { syncPiConfig, rewriteLocalHosts, type SyncDeps } from "./sync";

function makeDeps(overrides: Partial<SyncDeps> = {}): {
  deps: SyncDeps;
  logSpy: ReturnType<typeof mock>;
  copySpy: ReturnType<typeof mock>;
  rmSpy: ReturnType<typeof mock>;
  readFileSpy: ReturnType<typeof mock>;
  writeFileSpy: ReturnType<typeof mock>;
} {
  const logSpy = overrides.log ?? mock((_msg: string) => {});
  const copySpy = overrides.copy ?? mock(async (_src: string, _dest: string) => {});
  const rmSpy = overrides.rm ?? mock(async (_p: string) => {});
  const readFileSpy = overrides.readFile ?? mock(async (_p: string) => "{}");
  const writeFileSpy = overrides.writeFile ?? mock(async (_p: string, _content: string) => {});

  const deps: SyncDeps = {
    homedir: overrides.homedir ?? (() => "/home/testuser"),
    exists: overrides.exists ?? (async (_p: string) => true),
    copy: copySpy as SyncDeps["copy"],
    rm: rmSpy as SyncDeps["rm"],
    readFile: readFileSpy as SyncDeps["readFile"],
    writeFile: writeFileSpy as SyncDeps["writeFile"],
    log: logSpy as SyncDeps["log"],
  };

  return {
    deps,
    logSpy: logSpy as ReturnType<typeof mock>,
    copySpy: copySpy as ReturnType<typeof mock>,
    rmSpy: rmSpy as ReturnType<typeof mock>,
    readFileSpy: readFileSpy as ReturnType<typeof mock>,
    writeFileSpy: writeFileSpy as ReturnType<typeof mock>,
  };
}

describe("syncPiConfig", () => {
  describe("when ~/.pi exists", () => {
    it("calls copy with the correct source and destination", async () => {
      const { deps, copySpy } = makeDeps({
        homedir: () => "/home/testuser",
        exists: async () => true,
      });

      await syncPiConfig("/project/.pi", deps);

      expect(copySpy).toHaveBeenCalledTimes(1);
      const [src, dest] = copySpy.mock.calls[0] as [string, string];
      expect(src).toBe("/home/testuser/.pi");
      expect(dest).toBe("/project/.pi");
    });

    it("removes dest before copying (true overwrite)", async () => {
      const order: string[] = [];
      const { deps } = makeDeps({
        exists: async () => true,
        rm: mock(async () => { order.push("rm"); }),
        copy: mock(async () => { order.push("copy"); }),
      });

      await syncPiConfig("/project/.pi", deps);

      expect(order).toEqual(["rm", "copy"]);
    });

    it("calls rm with the dest path", async () => {
      const { deps, rmSpy } = makeDeps({ exists: async () => true });

      await syncPiConfig("/project/.pi", deps);

      expect(rmSpy).toHaveBeenCalledTimes(1);
      expect(rmSpy.mock.calls[0][0]).toBe("/project/.pi");
    });

    it("logs the copy message before rm and copy", async () => {
      const order: string[] = [];
      const { deps } = makeDeps({
        exists: async () => true,
        log: mock((msg: string) => { order.push(`log:${msg}`); }),
        rm: mock(async () => { order.push("rm"); }),
        copy: mock(async () => { order.push("copy"); }),
      });

      await syncPiConfig("/project/.pi", deps);

      expect(order[0]).toMatch(/^log:/);
      expect(order[1]).toBe("rm");
      expect(order[2]).toBe("copy");
    });

    it("log message mentions ~/.pi and destination", async () => {
      const { deps, logSpy } = makeDeps({ exists: async () => true });

      await syncPiConfig("/project/.pi", deps);

      const msg: string = logSpy.mock.calls[0][0];
      expect(msg).toContain("~/.pi");
      expect(msg).toContain(".pi");
    });
  });

  describe("when ~/.pi does not exist", () => {
    it("skips the copy step", async () => {
      const { deps, copySpy } = makeDeps({ exists: async () => false });

      await syncPiConfig("/project/.pi", deps);

      expect(copySpy).not.toHaveBeenCalled();
    });

    it("skips the rm step", async () => {
      const { deps, rmSpy } = makeDeps({ exists: async () => false });

      await syncPiConfig("/project/.pi", deps);

      expect(rmSpy).not.toHaveBeenCalled();
    });

    it("logs a skip message containing 'skipping'", async () => {
      const { deps, logSpy } = makeDeps({ exists: async () => false });

      await syncPiConfig("/project/.pi", deps);

      expect(logSpy).toHaveBeenCalledTimes(1);
      const msg: string = logSpy.mock.calls[0][0];
      expect(msg).toContain("~/.pi");
      expect(msg).toContain("skipping");
    });
  });

  describe("dest parameter", () => {
    it("uses the provided dest path as the copy destination", async () => {
      const { deps, copySpy } = makeDeps({ exists: async () => true });

      await syncPiConfig("/custom/dest/.pi", deps);

      const [, dest] = copySpy.mock.calls[0] as [string, string];
      expect(dest).toBe("/custom/dest/.pi");
    });
  });

  describe("models.json transformation", () => {
    it("transforms 127.0.0.1 to host.docker.internal in models.json", async () => {
      const modelsContent = JSON.stringify({
        providers: {
          ollama: {
            baseUrl: "http://127.0.0.1:11434/v1",
          },
        },
      });

      const { deps, readFileSpy, writeFileSpy, logSpy } = makeDeps({
        // Both ~/.pi (src) and models.json exist
        exists: async () => true,
        readFile: mock(async (p: string) => {
          if (p.includes("models.json")) return modelsContent;
          return "{}";
        }),
      });

      await syncPiConfig("/project/.pi", deps);

      expect(readFileSpy).toHaveBeenCalledWith("/project/.pi/agent/models.json");
      expect(writeFileSpy).toHaveBeenCalled();
      const [writtenPath, writtenContent] = writeFileSpy.mock.calls[0] as [string, string];
      expect(writtenPath).toBe("/project/.pi/agent/models.json");
      expect(writtenContent).toContain("host.docker.internal");
      expect(writtenContent).not.toContain("127.0.0.1");
      expect(logSpy.mock.calls.some((call) =>
        (call[0] as string).includes("Transformed models.json")
      )).toBe(true);
    });

    it("transforms localhost to host.docker.internal in models.json", async () => {
      const modelsContent = JSON.stringify({
        providers: {
          ollama: {
            baseUrl: "http://localhost:11434/v1",
          },
        },
      });

      const { deps, writeFileSpy } = makeDeps({
        exists: async () => true,
        readFile: mock(async (p: string) =>
          p.includes("models.json") ? modelsContent : "{}"
        ),
      });

      await syncPiConfig("/project/.pi", deps);

      const [, writtenContent] = writeFileSpy.mock.calls[0] as [string, string];
      expect(writtenContent).toContain("host.docker.internal");
      expect(writtenContent).not.toContain("localhost");
    });

    it("does not write models.json if no transformation needed", async () => {
      const modelsContent = JSON.stringify({
        providers: {
          openai: {
            baseUrl: "https://api.openai.com/v1",
          },
        },
      });

      const { deps, writeFileSpy } = makeDeps({
        exists: async () => true,
        readFile: mock(async (p: string) =>
          p.includes("models.json") ? modelsContent : "{}"
        ),
      });

      await syncPiConfig("/project/.pi", deps);

      expect(writeFileSpy).not.toHaveBeenCalled();
    });

    it("handles missing models.json gracefully", async () => {
      const { deps, readFileSpy } = makeDeps({
        exists: mock(async (p: string) => !p.includes("models.json")),
      });

      await syncPiConfig("/project/.pi", deps);

      expect(readFileSpy).not.toHaveBeenCalled();
    });

    it("logs a warning when writeFile throws instead of silently failing", async () => {
      const modelsContent = JSON.stringify({
        providers: { ollama: { baseUrl: "http://127.0.0.1:11434/v1" } },
      });

      const { deps, logSpy } = makeDeps({
        exists: async () => true,
        readFile: mock(async (p: string) =>
          p.includes("models.json") ? modelsContent : "{}"
        ),
        writeFile: mock(async () => { throw new Error("EACCES: permission denied"); }),
      });

      // Must not throw
      await expect(syncPiConfig("/project/.pi", deps)).resolves.toBeUndefined();

      // Must log a warning containing the error message
      expect(logSpy.mock.calls.some((call) =>
        (call[0] as string).toLowerCase().includes("warning") &&
        (call[0] as string).includes("EACCES")
      )).toBe(true);
    });
  });
});

// ── rewriteLocalHosts unit tests ──────────────────────────────────────────

describe("rewriteLocalHosts", () => {
  it("replaces 127.0.0.1 with host.docker.internal", () => {
    expect(rewriteLocalHosts('{"baseUrl":"http://127.0.0.1:11434/v1"}')).toBe(
      '{"baseUrl":"http://host.docker.internal:11434/v1"}'
    );
  });

  it("replaces localhost with host.docker.internal", () => {
    expect(rewriteLocalHosts('{"baseUrl":"http://localhost:11434/v1"}')).toBe(
      '{"baseUrl":"http://host.docker.internal:11434/v1"}'
    );
  });

  it("replaces all occurrences in the same string", () => {
    const input = '{"a":"http://127.0.0.1:1234","b":"http://localhost:5678"}';
    const result = rewriteLocalHosts(input);
    expect(result).not.toContain("127.0.0.1");
    expect(result).not.toContain("localhost");
    expect(result.match(/host\.docker\.internal/g)?.length).toBe(2);
  });

  it("returns the string unchanged when no local addresses are present", () => {
    const input = '{"baseUrl":"https://api.openai.com/v1"}';
    expect(rewriteLocalHosts(input)).toBe(input);
  });

  it("does not corrupt a model id that contains 'localhost' as a substring", () => {
    // e.g. a provider or model name that happens to include "localhost"
    const input = '{"id":"my-localhost-model","baseUrl":"http://localhost:11434"}';
    const result = rewriteLocalHosts(input);
    // The URL should be rewritten
    expect(result).toContain("host.docker.internal");
    // But the model id must NOT be touched — "localhost" inside a word boundary
    // should not be replaced
    expect(result).toContain("my-localhost-model");
  });
});
