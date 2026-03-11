/**
 * Shell execution utilities
 * Provides safe command execution with error handling and timeout support
 */

export interface ExecOptions {
  /** Timeout in milliseconds (default: no timeout) */
  timeout?: number;
  /** Current working directory for command execution */
  cwd?: string;
  /** Environment variables to set */
  env?: Record<string, string>;
}

export interface ExecResult {
  /** Standard output from command */
  stdout: string;
  /** Standard error from command */
  stderr: string;
  /** Exit code from command */
  exitCode: number;
}

export class ExecError extends Error {
  public readonly exitCode: number;
  public readonly stdout: string;
  public readonly stderr: string;
  public readonly command: string;

  constructor(
    message: string,
    command: string,
    exitCode: number,
    stdout: string,
    stderr: string
  ) {
    super(message);
    this.name = "ExecError";
    this.command = command;
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export class CommandNotFoundError extends ExecError {
  constructor(command: string) {
    super(
      `Command not found: ${command}`,
      command,
      -1,
      "",
      `Command not found: ${command}`
    );
    this.name = "CommandNotFoundError";
  }
}

export class TimeoutError extends ExecError {
  constructor(command: string, timeoutMs: number) {
    super(
      `Command timed out after ${timeoutMs}ms: ${command}`,
      command,
      -2,
      "",
      `Command timed out after ${timeoutMs}ms`
    );
    this.name = "TimeoutError";
  }
}

/**
 * Execute a shell command and capture output
 * @param command - Command to execute
 * @param args - Arguments for the command
 * @param options - Execution options
 * @returns Promise resolving to execution result
 * @throws {CommandNotFoundError} When command executable is not found
 * @throws {ExecError} When command exits with non-zero code
 * @throws {TimeoutError} When command exceeds timeout
 */
export async function exec(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const { timeout, cwd, env } = options;

  // Build full command for error messages
  const fullCommand = [command, ...args].join(" ");

  // Create abort controller for timeout
  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  if (timeout && timeout > 0) {
    timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);
  }

  try {
    const proc = Bun.spawn([command, ...args], {
      cwd: cwd || undefined,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ["inherit", "pipe", "pipe"],
      signal: abortController.signal,
    });

    // Read stdout and stderr
    const stdoutBuf = await proc.stdout.text();
    const stderrBuf = await proc.stderr.text();

    // Wait for process to complete
    const exitCode = await proc.exited;

    // Clear timeout if set
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const result: ExecResult = {
      stdout: stdoutBuf.trimEnd(),
      stderr: stderrBuf.trimEnd(),
      exitCode,
    };

    if (exitCode !== 0) {
      throw new ExecError(
        `Command failed with exit code ${exitCode}: ${fullCommand}`,
        fullCommand,
        exitCode,
        result.stdout,
        result.stderr
      );
    }

    return result;
  } catch (error) {
    // Clear timeout if set
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Handle timeout (Bun gives exit code 143 for aborted processes)
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError(fullCommand, timeout || 0);
    }

    // Bun.spawn may exit with 143 when aborted instead of throwing AbortError
    if (error instanceof ExecError && error.exitCode === 143) {
      throw new TimeoutError(fullCommand, timeout || 0);
    }

    // Handle command not found (ENOENT)
    if (
      error instanceof Error &&
      (error.message.includes("ENOENT") || 
       error.message.includes("No such file") ||
       error.message.includes("Executable not found in $PATH"))
    ) {
      throw new CommandNotFoundError(command);
    }

    // Re-throw ExecError instances
    if (error instanceof ExecError) {
      throw error;
    }

    // Wrap other errors
    throw new ExecError(
      error instanceof Error ? error.message : String(error),
      fullCommand,
      -3,
      "",
      ""
    );
  }
}

/**
 * Execute a shell command and return stdout as string
 * @param command - Command to execute
 * @param args - Arguments for the command
 * @param options - Execution options
 * @returns Promise resolving to stdout string
 * @throws {CommandNotFoundError} When command executable is not found
 * @throws {ExecError} When command exits with non-zero code
 * @throws {TimeoutError} When command exceeds timeout
 */
export async function execText(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<string> {
  const result = await exec(command, args, options);
  return result.stdout;
}

/**
 * Execute a shell command silently (ignores output, only checks success)
 * @param command - Command to execute
 * @param args - Arguments for the command
 * @param options - Execution options
 * @returns Promise resolving to boolean indicating success
 */
export async function execSilent(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<boolean> {
  try {
    await exec(command, args, options);
    return true;
  } catch {
    return false;
  }
}
