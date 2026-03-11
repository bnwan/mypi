/**
 * Shell execution utilities
 * Provides safe command execution with error handling, timeout support,
 * stdin input, and maxBuffer protection
 */

export interface ExecOptions {
  /** Timeout in milliseconds (default: no timeout) */
  timeout?: number;
  /** Current working directory for command execution */
  cwd?: string;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Data to write to stdin (string, Buffer, or null) */
  stdin?: string | Buffer | null;
  /** Maximum stdout/stderr size in bytes (default: 10MB) */
  maxBuffer?: number;
}

export interface ExecResult {
  /** Standard output from command */
  stdout: string;
  /** Standard error from command */
  stderr: string;
  /** Exit code from command */
  exitCode: number;
}

/** Default maxBuffer size: 10MB */
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

/** Exit code indicating timeout */
const EXIT_CODE_TIMEOUT = 124;

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
      EXIT_CODE_TIMEOUT,
      "",
      `Command timed out after ${timeoutMs}ms`
    );
    this.name = "TimeoutError";
  }
}

export class MaxBufferError extends ExecError {
  constructor(command: string, bufferType: "stdout" | "stderr") {
    super(
      `${bufferType} exceeded maxBuffer: ${command}`,
      command,
      -5,
      "",
      `${bufferType} exceeded maxBuffer`
    );
    this.name = "MaxBufferError";
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
 * @throws {MaxBufferError} When stdout/stderr exceeds maxBuffer
 */
export async function exec(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const { 
    timeout, 
    cwd, 
    env, 
    stdin,
    maxBuffer = DEFAULT_MAX_BUFFER 
  } = options;

  // Build full command for error messages
  const fullCommand = [command, ...args].join(" ");

  // Create abort controller for timeout
  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  if (timeout && timeout > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, timeout);
  }

  try {
    const proc = Bun.spawn([command, ...args], {
      cwd: cwd || undefined,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"],
      signal: abortController.signal,
    });

    // Write stdin if provided
    if (stdin !== undefined && stdin !== null) {
      const inputData = Buffer.from(stdin);
      if (inputData.length > 0) {
        await proc.stdin.write(inputData);
      }
      proc.stdin.end();
    } else {
      // Close stdin immediately if no input
      proc.stdin.end();
    }

    // Collect stdout and stderr with maxBuffer checks
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    // Helper to collect from a reader
    async function collectStream(
      stream: ReadableStream<Uint8Array>, 
      chunks: Buffer[],
      currentLen: { value: number }
    ): Promise<void> {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          currentLen.value += value.length;
          if (currentLen.value > maxBuffer) {
            proc.kill();
            throw new Error("__MAXBUFFER_EXCEEDED__");
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
    }

    const stdoutLenRef = { value: 0 };
    const stderrLenRef = { value: 0 };

    await Promise.all([
      collectStream(proc.stdout, stdoutChunks, stdoutLenRef),
      collectStream(proc.stderr, stderrChunks, stderrLenRef),
    ]);

    // Wait for process to complete
    const exitCode = await proc.exited;

    // Clear timeout if set
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Check for timeout first (exit code 143 = SIGTERM from abort)
    if ((exitCode === 143 || exitCode === 128 + 15 || (exitCode === 15 && timedOut)) && timedOut) {
      throw new TimeoutError(fullCommand, timeout || 0);
    }

    const stdoutBuf = stdoutChunks.length > 0 ? Buffer.concat(stdoutChunks) : Buffer.alloc(0);
    const stderrBuf = stderrChunks.length > 0 ? Buffer.concat(stderrChunks) : Buffer.alloc(0);

    const result: ExecResult = {
      stdout: stdoutBuf.toString("utf-8").trimEnd(),
      stderr: stderrBuf.toString("utf-8").trimEnd(),
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

    // Handle maxBuffer exceeded
    if (error instanceof Error && error.message === "__MAXBUFFER_EXCEEDED__") {
      throw new MaxBufferError(fullCommand, "stdout");
    }

    // Handle timeout (AbortError from signal)
    if (error instanceof Error && error.name === "AbortError" && timedOut) {
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

    // Re-throw known error types
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
 * @throws {MaxBufferError} When stdout/stderr exceeds maxBuffer
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

/**
 * Execute a shell command with piped stdin
 * @param command - Command to execute
 * @param args - Arguments for the command
 * @param input - Input string to write to stdin
 * @param options - Execution options
 * @returns Promise resolving to execution result
 * @throws {CommandNotFoundError} When command executable is not found
 * @throws {ExecError} When command exits with non-zero code
 * @throws {TimeoutError} When command exceeds timeout
 * @throws {MaxBufferError} When stdout/stderr exceeds maxBuffer
 */
export async function execWithInput(
  command: string,
  args: string[],
  input: string,
  options: Omit<ExecOptions, "stdin"> = {}
): Promise<ExecResult> {
  return exec(command, args, { ...options, stdin: input });
}
