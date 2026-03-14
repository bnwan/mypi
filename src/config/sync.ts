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
  /** Returns the current user's home directory */
  homedir: () => string;
  /** Returns true if the given path exists */
  exists: (p: string) => Promise<boolean>;
  /** Recursively copies src into dest */
  copy: (src: string, dest: string) => Promise<void>;
  /** Log output function */
  log: (msg: string) => void;
}

/** Production implementations of SyncDeps */
const defaultDeps: SyncDeps = {
  homedir: os.homedir,
  exists: async (p: string) => {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  },
  copy: (src: string, dest: string) =>
    fs.promises.cp(src, dest, { recursive: true }),
  log: console.log,
};

/**
 * Copies ~/.pi into the given dest directory before a Docker build.
 *
 * - If ~/.pi exists: logs and copies (global wins, full overwrite)
 * - If ~/.pi does not exist: logs a skip message and returns without error
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
  await deps.copy(src, dest);
}
