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
  /** Read file contents */
  readFile: (p: string) => Promise<string>;
  /** Write file contents */
  writeFile: (p: string, content: string) => Promise<void>;
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
  readFile: (p: string) => fs.promises.readFile(p, "utf-8"),
  writeFile: (p: string, content: string) => fs.promises.writeFile(p, content, "utf-8"),
  log: console.log,
};

/**
 * Rewrites local-only hostnames in a models.json string so they resolve
 * correctly from inside a Docker container.
 *
 * Replaces:
 *  - `127.0.0.1`  → `host.docker.internal`
 *  - `localhost`  → `host.docker.internal`
 *
 * The `localhost` match uses negative lookbehind/lookahead for `[a-zA-Z0-9-]`
 * so that hyphenated strings like `"my-localhost-model"` are left untouched
 * while URL hostnames like `http://localhost:11434` are rewritten correctly.
 * (`\b` alone is insufficient because hyphens are not word characters.)
 *
 * @param content - Raw string contents of models.json
 * @returns Transformed string (identical to input if no replacements made)
 */
export function rewriteLocalHosts(content: string): string {
  return content
    .replace(/127\.0\.0\.1/g, "host.docker.internal")
    .replace(/(?<![a-zA-Z0-9-])localhost(?![a-zA-Z0-9-])/g, "host.docker.internal");
}

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

  // Transform models.json for Docker: replace local addresses with host.docker.internal
  const modelsPath = path.join(dest, "agent", "models.json");
  if (await deps.exists(modelsPath)) {
    try {
      const content = await deps.readFile(modelsPath);
      const transformed = rewriteLocalHosts(content);
      if (content !== transformed) {
        await deps.writeFile(modelsPath, transformed);
        deps.log("Transformed models.json for Docker container access");
      }
    } catch (err) {
      // Log a warning — silently ignoring I/O errors here would leave the
      // container running with 127.0.0.1 addresses with no indication of failure.
      deps.log(
        `Warning: could not transform models.json: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
