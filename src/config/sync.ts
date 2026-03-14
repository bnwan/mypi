/**
 * Pi config sync utility
 *
 * Copies the user's global ~/.pi directory into the local .pi/ directory
 * before a Docker image build, so the image always reflects the current
 * host pi configuration.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/** Dependency injection interface — makes the function fully unit-testable */
export interface SyncDeps {
  /**
   * Returns the current user's home directory.
   * Called lazily at runtime (not captured at import time).
   */
  homedir: () => string;
  /** Returns true if the given path exists */
  exists: (p: string) => Promise<boolean>;
  /** Removes the given path recursively (no-op if it doesn't exist) */
  rm: (p: string) => Promise<void>;
  /** Recursively copies src into dest (dest must not exist beforehand) */
  copy: (src: string, dest: string) => Promise<void>;
  /** Log output function */
  log: (msg: string) => void;
}

/** Production implementations of SyncDeps */
const defaultDeps: SyncDeps = {
  // homedir is a function reference — called lazily each time syncPiConfig
  // runs, so it always reflects the real home dir at call time.
  homedir: os.homedir,
  exists: async (p: string) => {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  },
  rm: (p: string) => fs.promises.rm(p, { recursive: true, force: true }),
  copy: (src: string, dest: string) =>
    fs.promises.cp(src, dest, { recursive: true }),
  log: console.log,
};

/**
 * Syncs ~/.pi into the given dest directory before a Docker build.
 *
 * Performs a true overwrite: removes dest first, then copies src in full,
 * so the result exactly mirrors ~/.pi with no stale files left behind.
 *
 * - If ~/.pi exists: removes dest, copies src → dest (global wins)
 * - If ~/.pi does not exist: logs a skip message and returns without error
 *
 * Note: dest is the project-local .pi/ directory. Syncing here is
 * intentional — it's the Docker build context that the Dockerfile COPYs
 * from. The runtime config mount (~/.mypi/agent) is a separate concern
 * handled by the volume binding in DockerManager.run().
 *
 * @param dest  - Destination path (typically <project>/.pi)
 * @param deps  - Optional dependency overrides (for testing)
 */
export async function syncPiConfig(
  dest: string,
  deps: SyncDeps = defaultDeps
): Promise<void> {
  const src = path.join(deps.homedir(), ".pi");

  if (!(await deps.exists(src))) {
    deps.log("~/.pi not found, skipping config sync");
    return;
  }

  deps.log(`Copying ~/.pi → ${dest}...`);
  await deps.rm(dest);
  await deps.copy(src, dest);
}
