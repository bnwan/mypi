/**
 * CLI argument parser for mypi
 * Parses argv into a strongly-typed ParsedArgs object.
 */

import * as path from "path";

/** Result of parsing mypi CLI arguments */
export interface ParsedArgs {
  /** Named container instance (--name NAME) */
  name?: string;
  /** Workspace path to mount, resolved to absolute (default: cwd) */
  workspace: string;
  /** Rebuild the Docker image before running (--build) */
  build: boolean;
  /** List running mypi containers (--list) */
  list: boolean;
  /** Stop a named container (--stop NAME) */
  stop?: string;
  /** Show help text (--help | -h) */
  help: boolean;
  /** Remaining arguments passed through to pi */
  piArgs: string[];
}

/**
 * Parse mypi command-line arguments.
 *
 * @param argv - Raw argument list (e.g. process.argv.slice(2))
 * @param cwd  - Working directory used to resolve relative workspace paths
 *               (defaults to process.cwd())
 * @returns Parsed argument object
 * @throws {Error} On unknown flags, missing values, or invalid combinations
 */
export function parseArgs(
  argv: string[],
  cwd: string = process.cwd()
): ParsedArgs {
  const result: ParsedArgs = {
    build: false,
    list: false,
    help: false,
    workspace: cwd,
    name: undefined,
    stop: undefined,
    piArgs: [],
  };

  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    // -- separator: everything after goes to piArgs
    if (arg === "--") {
      result.piArgs = argv.slice(i + 1);
      break;
    }

    // Boolean flags
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

    // --name NAME | --name=NAME
    if (arg === "--name" || arg.startsWith("--name=")) {
      const value = extractValue(arg, "--name", argv, i);
      if (value.consumed) i++;
      result.name = value.str;
      i++;
      continue;
    }

    // --workspace PATH | --workspace=PATH
    if (arg === "--workspace" || arg.startsWith("--workspace=")) {
      const value = extractValue(arg, "--workspace", argv, i);
      if (value.consumed) i++;
      // Resolve relative paths against cwd
      result.workspace = path.isAbsolute(value.str)
        ? value.str
        : path.resolve(cwd, value.str);
      i++;
      continue;
    }

    // --stop NAME | --stop=NAME
    if (arg === "--stop" || arg.startsWith("--stop=")) {
      const value = extractValue(arg, "--stop", argv, i);
      if (value.consumed) i++;
      result.stop = value.str;
      i++;
      continue;
    }

    // Unknown flags
    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    // Non-flag args: collect as piArgs (stop scanning for mypi flags)
    result.piArgs = argv.slice(i);
    break;
  }

  // Validate combinations
  if (result.list && result.name !== undefined) {
    throw new Error("--list cannot be combined with --name");
  }
  if (result.list && result.stop !== undefined) {
    throw new Error("--list cannot be combined with --stop");
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ExtractedValue {
  str: string;
  /** true when the value was taken from the next argv token (i needs an extra increment) */
  consumed: boolean;
}

/**
 * Extract a required string value for a flag, supporting both
 * `--flag value` and `--flag=value` forms.
 */
function extractValue(
  arg: string,
  flag: string,
  argv: string[],
  i: number
): ExtractedValue {
  // --flag=value form
  if (arg.startsWith(`${flag}=`)) {
    const str = arg.slice(flag.length + 1);
    if (!str) {
      throw new Error(`${flag} requires a value`);
    }
    return { str, consumed: false };
  }

  // --flag value form: peek at next token
  const next = argv[i + 1];
  if (!next || next.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return { str: next, consumed: true };
}
