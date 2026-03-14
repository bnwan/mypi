/**
 * Main entry point for the mypi CLI.
 * Orchestrates argument parsing, token resolution, and Docker operations.
 */

import * as path from "path";
import * as fs from "fs";
import * as process from "process";
import { parseArgs } from "./cli/parseArgs";
import { resolveConfigDir, resolveWorkspacePath } from "./config/paths";
import { resolveToken } from "./config/tokens";
import { DockerManager } from "./docker/DockerManager";

const IMAGE_NAME = "mypi-dev";

/** Print help text to stdout */
function printHelp(): void {
  console.log(`Usage: mypi [options] [pi-args...]

Options:
  --build              Rebuild the Docker image
  --name NAME          Start a named instance (allows multiple instances)
  --workspace PATH     Mount a different workspace directory (default: current directory)
  --list               List running mypi containers
  --stop NAME          Stop a named mypi container
  --help, -h           Show this help

All other arguments are passed to pi`);
}

/** Resolve the Dockerfile path relative to this script's location */
function resolveDockerfilePath(): string {
  // Uses import.meta.dir (Bun ESM) which resolves to the src/ directory at runtime
  return path.resolve(import.meta.dir, "..", "Dockerfile");
}

/** Main function — exported for testability */
export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const docker = new DockerManager(IMAGE_NAME);

  // --help
  if (args.help) {
    printHelp();
    return;
  }

  // --list
  if (args.list) {
    const containers = await docker.list();
    if (containers.length === 0) {
      console.log("No running mypi containers.");
    } else {
      console.log("Running mypi containers:");
      for (const c of containers) {
        console.log(`  ${c.name}\t${c.state}\t${c.image}`);
      }
    }
    return;
  }

  // --stop
  if (args.stop) {
    console.log(`Stopping mypi container: ${args.stop}`);
    try {
      await docker.stop(args.stop);
      console.log(`Stopped and removed ${args.stop}`);
    } catch {
      console.error(`Failed to stop ${args.stop} (container may not exist)`);
      process.exit(1);
    }
    return;
  }

  // Resolve paths
  const workspace = resolveWorkspacePath(args.workspace ?? "");
  const configDir = resolveConfigDir();

  // Ensure config dir exists on the host before mounting — if Docker creates it,
  // it will be owned by root which breaks subsequent writes by the agent process.
  fs.mkdirSync(configDir, { recursive: true });

  // Build image if requested or not yet present
  if (args.build || !(await docker.imageExists())) {
    const dockerfilePath = resolveDockerfilePath();
    await docker.build(dockerfilePath);
  }

  // Resolve GitHub token
  const ghToken = await resolveToken();

  // Collect environment variables
  const env: Record<string, string> = {};
  const envVars = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_API_KEY",
    "OPENROUTER_API_KEY",
  ] as const;

  for (const key of envVars) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }

  if (ghToken) {
    env["GH_TOKEN"] = ghToken;
    env["GITHUB_TOKEN"] = ghToken;
  }

  // Run the container
  await docker.run({
    name: args.name,
    workspace,
    volumes: [`${configDir}:/root/.mypi/agent`],
    env,
    additionalArgs: args.extraArgs,
  });
}

// Run only when executed directly (not imported in tests)
if (import.meta.main) {
  main(process.argv.slice(2)).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  });
}
