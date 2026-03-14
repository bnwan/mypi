/**
 * Main entry point for mypi CLI
 *
 * Orchestrates CLI parsing, Docker management, config resolution and token
 * lookup into a single cohesive flow.  The `run()` function is exported for
 * testability — it accepts optional dependency overrides so tests can inject
 * mocks without touching the module registry.  `main()` is the thin top-level
 * caller that maps the return code to `process.exit()`.
 */

import * as path from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "./cli/parseArgs";
import { DockerManager } from "./docker/DockerManager";
import type { ContainerInfo, RunOptions } from "./docker/DockerManager";
import { resolveConfigDir } from "./config/paths";
import { resolveToken } from "./config/tokens";

// ── Constants ──────────────────────────────────────────────────────────────

const IMAGE_NAME = "mypi-dev";

/** Absolute path to the project root (one level above src/) */
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const DOCKERFILE_PATH = path.join(PROJECT_ROOT, "Dockerfile");

// ── Help text ──────────────────────────────────────────────────────────────

const HELP_TEXT = `
mypi - Run the pi coding agent in a Docker container

USAGE
  mypi [options] [-- <pi-args>...]

OPTIONS
  --name <name>        Named container instance (persists between runs)
  --workspace <path>   Workspace path to mount (default: current directory)
  --build              Rebuild the Docker image before running
  --list               List running mypi containers
  --stop <name>        Stop and remove a named container
  --help, -h           Show this help text

EXAMPLES
  mypi                              Run with current directory as workspace
  mypi --name dev                   Run as a named (persistent) container
  mypi --workspace ~/projects/foo   Run with a specific workspace
  mypi --build                      Rebuild image then run
  mypi --list                       List running containers
  mypi --stop dev                   Stop the "dev" container
  mypi -- --provider anthropic      Pass flags through to pi
`.trim();

// ── Dependency injection interface ─────────────────────────────────────────

/** Subset of DockerManager used by run() — allows test injection */
export interface DockerManagerLike {
  build(dockerfilePath: string): Promise<void>;
  imageExists(): Promise<boolean>;
  run(options: RunOptions): Promise<void>;
  list(): Promise<ContainerInfo[]>;
  stop(nameOrId: string): Promise<void>;
}

export interface RunDeps {
  /** DockerManager instance (or mock) */
  docker?: DockerManagerLike;
  /** Token resolver (or mock) */
  getToken?: () => Promise<string>;
}

// ── Core run function (exported for tests) ─────────────────────────────────

/**
 * Execute the mypi CLI logic.
 *
 * @param argv - Argument list (e.g. process.argv.slice(2))
 * @param deps - Optional dependency overrides for testing
 * @returns Exit code: 0 for success, 1 for any error
 */
export async function run(
  argv: string[],
  deps: RunDeps = {}
): Promise<number> {
  // 1. Parse arguments — invalid combinations throw synchronously
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : String(err)}`
    );
    return 1;
  }

  // 2. Help
  if (args.help) {
    console.log(HELP_TEXT);
    return 0;
  }

  const docker: DockerManagerLike =
    deps.docker ?? new DockerManager(IMAGE_NAME);
  const getToken = deps.getToken ?? resolveToken;

  // 3. List
  if (args.list) {
    try {
      const containers = await docker.list();
      if (containers.length === 0) {
        console.log("No mypi containers running.");
      } else {
        console.log("Running mypi containers:");
        for (const c of containers) {
          console.log(`  ${c.name}  (${c.id.slice(0, 12)})  ${c.state}`);
        }
      }
      return 0;
    } catch (err) {
      console.error(
        `Error listing containers: ${err instanceof Error ? err.message : String(err)}`
      );
      return 1;
    }
  }

  // 4. Stop
  if (args.stop !== undefined) {
    try {
      await docker.stop(args.stop);
      console.log(`Stopped container: ${args.stop}`);
      return 0;
    } catch (err) {
      console.error(
        `Error stopping container "${args.stop}": ${err instanceof Error ? err.message : String(err)}`
      );
      return 1;
    }
  }

  // 5. Run (default flow)
  try {
    // 5a. Build if forced (--build) or image is absent
    const needsBuild = args.build || !(await docker.imageExists());
    if (needsBuild) {
      console.log("Building Docker image…");
      await docker.build(DOCKERFILE_PATH);
      console.log("Build complete.");
    }

    // 5b. Resolve GH_TOKEN
    const ghToken = await getToken();

    // 5c. Resolve config dir for volume mount
    const configDir = resolveConfigDir();

    // 5d. Launch container
    await docker.run({
      name: args.name,
      workspace: args.workspace,
      volumes: [`${configDir}:/root/.mypi/agent`],
      env: {
        ...(ghToken ? { GH_TOKEN: ghToken } : {}),
      },
      additionalArgs: args.piArgs.length > 0 ? args.piArgs : undefined,
    });

    return 0;
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : String(err)}`
    );
    return 1;
  }
}

// ── Top-level entry point ──────────────────────────────────────────────────

async function main(): Promise<void> {
  const exitCode = await run(process.argv.slice(2));
  process.exit(exitCode);
}

// Only run when this file is the entry point, not when imported (e.g. by tests)
if (import.meta.path === Bun.main) {
  main();
}
