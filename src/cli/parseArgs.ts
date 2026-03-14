/**
 * CLI argument parser for mypi
 * Parses mypi-specific flags and collects remaining args as passthrough to pi
 */

/** Parsed CLI arguments */
export interface ParsedArgs {
  /** Whether to rebuild the Docker image */
  build: boolean;
  /** Named container instance */
  name?: string;
  /** Workspace path to mount */
  workspace?: string;
  /** List running containers */
  list: boolean;
  /** Container name/id to stop */
  stop?: string;
  /** Show help text */
  help: boolean;
  /** Remaining args passed through to pi */
  extraArgs: string[];
}

/**
 * Parses process.argv-style arguments for mypi
 *
 * Recognised mypi flags:
 *   --build             Rebuild the Docker image
 *   --name NAME         Start a named container instance
 *   --name=NAME         (alternative syntax)
 *   --workspace PATH    Mount a different workspace directory
 *   --workspace=PATH    (alternative syntax)
 *   --list              List running mypi containers
 *   --stop NAME         Stop a named container
 *   --stop=NAME         (alternative syntax)
 *   --help / -h         Show help
 *   --                  All subsequent args are forwarded to pi
 *
 * Any unrecognised argument (and all args that follow it) are collected
 * into `extraArgs` and forwarded verbatim to the pi entrypoint.
 *
 * @param argv - Argument list (typically process.argv.slice(2))
 * @returns Parsed argument object
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    build: false,
    list: false,
    help: false,
    extraArgs: [],
  };

  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    // -- separator: everything after is forwarded to pi
    if (arg === "--") {
      result.extraArgs.push(...argv.slice(i + 1));
      break;
    }

    if (arg === "--build") {
      result.build = true;
      i++;
      continue;
    }

    if (arg === "--list") {
      result.list = true;
      i++;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      result.help = true;
      i++;
      continue;
    }

    // --name NAME or --name=NAME
    if (arg === "--name") {
      const val = argv[i + 1];
      if (!val || val.startsWith("--")) throw new Error("--name requires a value");
      result.name = val;
      i += 2;
      continue;
    }
    if (arg.startsWith("--name=")) {
      result.name = arg.slice("--name=".length);
      i++;
      continue;
    }

    // --workspace PATH or --workspace=PATH
    if (arg === "--workspace") {
      const val = argv[i + 1];
      if (!val || val.startsWith("--")) throw new Error("--workspace requires a value");
      result.workspace = val;
      i += 2;
      continue;
    }
    if (arg.startsWith("--workspace=")) {
      result.workspace = arg.slice("--workspace=".length);
      i++;
      continue;
    }

    // --stop NAME or --stop=NAME
    if (arg === "--stop") {
      const val = argv[i + 1];
      if (!val || val.startsWith("--")) throw new Error("--stop requires a value");
      result.stop = val;
      i += 2;
      continue;
    }
    if (arg.startsWith("--stop=")) {
      result.stop = arg.slice("--stop=".length);
      i++;
      continue;
    }

    // Unknown arg — collect this and all remaining args as passthrough
    result.extraArgs.push(...argv.slice(i));
    break;
  }

  return result;
}
