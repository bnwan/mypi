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
 * @throws {Error} On missing values or invalid flag combinations
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
      const value = extractValue(arg, "--name", argv[i + 1]);
      if (value.tookNextToken) i++;
      result.name = value.str;
      i++;
      continue;
    }

    // --workspace PATH | --workspace=PATH
    if (arg === "--workspace" || arg.startsWith("--workspace=")) {
      const value = extractValue(arg, "--workspace", argv[i + 1]);
      if (value.tookNextToken) i++;
      // Resolve relative paths against cwd
      result.workspace = path.isAbsolute(value.str)
        ? value.str
        : path.resolve(cwd, value.str);
      i++;
      continue;
    }

    // --stop NAME | --stop=NAME
    if (arg === "--stop" || arg.startsWith("--stop=")) {
      const value = extractValue(arg, "--stop", argv[i + 1]);
      if (value.tookNextToken) i++;
      result.stop = value.str;
      i++;
      continue;
    }

    // Unknown flags: forward to pi as passthrough args (consistent with legacy
    // mypi shell script, which passes unrecognized tokens straight to pi).
    // Use -- to explicitly separate mypi flags from pi flags if ambiguity arises.
    if (arg.startsWith("-")) {
      result.piArgs = argv.slice(i);
      break;
    }

    // Non-flag args: once a bare (non-flag) arg is seen, treat it and all
    // remaining args as piArgs (stop scanning mypi flags).
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
  if (result.stop !== undefined && result.name !== undefined) {
    throw new Error("--stop cannot be combined with --name");
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ExtractedValue {
  str: string;
  /** true when the value was taken from the next argv token (caller must advance i by one extra) */
  tookNextToken: boolean;
}

/**
 * Extract a required string value for a flag, supporting both
 * `--flag value` and `--flag=value` forms.
 *
 * @param arg      - The current argv token (e.g. "--name" or "--name=foo")
 * @param flag     - The flag name prefix (e.g. "--name")
 * @param nextArg  - The next argv token, if any (argv[i + 1])
 */
function extractValue(
  arg: string,
  flag: string,
  nextArg: string | undefined
): ExtractedValue {
  // --flag=value form
  if (arg.startsWith(`${flag}=`)) {
    const str = arg.slice(flag.length + 1);
    if (!str) {
      throw new Error(`${flag} requires a value`);
    }
    return { str, tookNextToken: false };
  }

  // --flag value form: use next token as the value.
  // Only reject a missing token — values starting with "-" are valid
  // (e.g. container names or paths like "-tmp").
  if (nextArg === undefined) {
    throw new Error(`${flag} requires a value`);
  }
  return { str: nextArg, tookNextToken: true };
}
