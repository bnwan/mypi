/**
 * Unit tests for src/config/sync.ts
 *
 * All filesystem operations are injected so no real disk I/O occurs.
 */

import { describe, it, expect, mock } from "bun:test";
import { syncPiConfig, type SyncDeps } from "./sync";

function makeDeps(overrides: Partial<SyncDeps> = {}): {
  deps: SyncDeps;
  logSpy: ReturnType<typeof mock>;
  copySpy: ReturnType<typeof mock>;
  rmSpy: ReturnType<typeof mock>;
} {
  const logSpy = overrides.log ?? mock((_msg: string) => {});
  const copySpy = overrides.copy ?? mock(async (_src: string, _dest: string) => {});
  const rmSpy = overrides.rm ?? mock(async (_p: string) => {});

  const deps: SyncDeps = {
    homedir: overrides.homedir ?? (() => "/home/testuser"),
    exists: overrides.exists ?? (async (_p: string) => true),
    copy: copySpy as SyncDeps["copy"],
    rm: rmSpy as SyncDeps["rm"],
    log: logSpy as SyncDeps["log"],
  };

  return {
    deps,
    logSpy: logSpy as ReturnType<typeof mock>,
    copySpy: copySpy as ReturnType<typeof mock>,
    rmSpy: rmSpy as ReturnType<typeof mock>,
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
});
