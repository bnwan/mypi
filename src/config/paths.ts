/**
 * Path resolution utilities
 * Provides safe path resolution for config directories, workspaces,
 * and script directories with proper home directory expansion.
 */

import * as os from "os";
import * as path from "path";
import * as process from "process";
import { fileURLToPath } from "url";

/**
 * The name of the agent configuration directory relative to user's home
 * This directory stores agent-specific configuration files.
 */
export const CONFIG_DIR_NAME = ".mypi/agent";

/**
 * Expands a tilde (~) in a path to the user's home directory
 *
 * @param inputPath - Path that may contain a tilde to expand
 * @returns The path with tilde expanded to home directory, or original path if no tilde
 *
 * @note Only expands standalone `~` or `~/path`, not `~username` syntax for other users
 *
 * @example
 * ```typescript
 * expandHomeDir("~/config")     // → "/home/user/config"
 * expandHomeDir("~")              // → "/home/user"
 * expandHomeDir("/absolute/path") // → "/absolute/path"
 * expandHomeDir("./relative")    // → "./relative"
 * ```
 */
export function expandHomeDir(inputPath: string): string {
  if (inputPath === "") {
    return "";
  }

  if (inputPath === "~") {
    return process.env.HOME ?? os.homedir();
  }

  if (inputPath.startsWith("~/")) {
    const homeDir = process.env.HOME ?? os.homedir();
    const remainder = inputPath.slice(2); // remove leading "~/"
    return path.join(homeDir, remainder);
  }

  return inputPath;
}

/**
 * Resolves the agent configuration directory path
 * Returns ~/.mypi/agent with expanded home directory
 *
 * @returns Absolute path to the agent configuration directory
 * @throws {Error} If home directory cannot be determined
 *
 * @example
 * ```typescript
 * resolveConfigDir() // → "/home/user/.mypi/agent"
 * ```
 */
export function resolveConfigDir(): string {
  const home = expandHomeDir("~");
  if (!home) {
    throw new Error(
      "Could not determine home directory. HOME environment variable and os.homedir() both returned empty."
    );
  }
  return path.join(home, CONFIG_DIR_NAME);
}

/**
 * Resolves a workspace path to an absolute path
 *
 * - Expands tildes (~) to home directory
 * - Converts relative paths to absolute (relative to current working directory)
 * - Preserves already-absolute paths
 *
 * @param workspacePath - The workspace path to resolve (can be absolute, relative, or tilde-prefixed)
 * @returns Absolute path to the workspace
 *
 * @example
 * ```typescript
 * resolveWorkspacePath("~/projects")      // → "/home/user/projects"
 * resolveWorkspacePath("./my-workspace") // → "/current/working/dir/my-workspace"
 * resolveWorkspacePath("/absolute/path") // → "/absolute/path"
 * resolveWorkspacePath("")               // → "/current/working/dir"
 * ```
 */
export function resolveWorkspacePath(workspacePath: string): string {
  if (workspacePath === "") {
    return process.cwd();
  }

  const expandedPath = expandHomeDir(workspacePath);

  // If already absolute, return as-is
  if (path.isAbsolute(expandedPath)) {
    return expandedPath;
  }

  // Convert relative to absolute
  return path.resolve(expandedPath);
}

/**
 * Resolves the directory containing the current script file
 *
 * Uses import.meta.url for ESM compatibility (works in Bun and Node)
 *
 * @returns Absolute path to the directory containing the current script
 *
 * @example
 * ```typescript
 * resolveScriptDir() // → "/project/src/config"
 * ```
 */
export function resolveScriptDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}
