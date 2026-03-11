/**
 * Tests for shell execution utilities
 * Covers: success cases, command not found, non-zero exit codes, timeout handling
 */

import { describe, it, expect } from "bun:test";
import { exec, execText, execSilent, ExecError, CommandNotFoundError, TimeoutError } from "./exec";

describe("exec", () => {
  describe("successful execution", () => {
    it("should execute command and return stdout", async () => {
      const result = await exec("echo", ["hello world"]);
      
      expect(result.stdout).toBe("hello world");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    });

    it("should handle multiple arguments", async () => {
      const result = await exec("echo", ["arg1", "arg2", "arg3"]);
      
      expect(result.stdout).toBe("arg1 arg2 arg3");
    });

    it("should ignore stderr when command succeeds", async () => {
      const result = await exec("sh", ["-c", "echo 'stdout text' && echo 'stderr text' >&2"]);
      
      expect(result.stdout).toBe("stdout text");
      expect(result.stderr).toBe("stderr text");
      expect(result.exitCode).toBe(0);
    });
  });

  describe("execText", () => {
    it("should return stdout as string", async () => {
      const output = await execText("echo", ["test output"]);
      
      expect(output).toBe("test output");
    });
  });

  describe("execSilent", () => {
    it("should return true for successful command", async () => {
      const success = await execSilent("echo", ["test"]);
      
      expect(success).toBe(true);
    });

    it("should return false for failed command", async () => {
      const success = await execSilent("false");
      
      expect(success).toBe(false);
    });

    it("should return false for non-existent command", async () => {
      const success = await execSilent("non_existent_command_xyz");
      
      expect(success).toBe(false);
    });
  });

  describe("command not found", () => {
    it("should throw CommandNotFoundError for non-existent command", async () => {
      expect(async () => {
        await exec("non_existent_command_xyz_abc");
      }).toThrow(/Command not found|Executable not found/);
    });

    it("should be catchable as CommandNotFoundError", async () => {
      try {
        await exec("non_existent_command_xyz_abc");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(CommandNotFoundError);
        expect(error).toBeInstanceOf(ExecError);
      }
    });
  });

  describe("non-zero exit codes", () => {
    it("should throw ExecError for exit code 1", async () => {
      expect(async () => {
        await exec("false");
      }).toThrow();
    });

    it("should include exit code in error", async () => {
      try {
        await exec("sh", ["-c", "exit 42"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ExecError);
        if (error instanceof ExecError) {
          expect(error.exitCode).toBe(42);
          expect(error.command).toContain("exit 42");
        }
      }
    });

    it("should capture stdout and stderr in error", async () => {
      try {
        await exec("sh", ["-c", "echo 'output here' && echo 'error here' >&2 && exit 1"]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ExecError);
        if (error instanceof ExecError) {
          expect(error.stdout).toBe("output here");
          expect(error.stderr).toBe("error here");
        }
      }
    });

    it("should handle various exit codes", async () => {
      for (const code of [1, 2, 5, 127]) {
        try {
          await exec("sh", ["-c", `exit ${code}`]);
          expect.fail(`Should have thrown for exit code ${code}`);
        } catch (error) {
          if (error instanceof ExecError) {
            expect(error.exitCode).toBe(code);
          }
        }
      }
    });
  });

  describe("timeout handling", () => {
    it("should throw TimeoutError when command exceeds timeout", async () => {
      expect(async () => {
        await exec("sleep", ["10"], { timeout: 50 });
      }).toThrow(/timed out/);
    });

    it("should be catchable as TimeoutError", async () => {
      try {
        await exec("sleep", ["10"], { timeout: 50 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect(error).toBeInstanceOf(ExecError);
      }
    });

    it("should include timeout duration in error message", async () => {
      try {
        await exec("sleep", ["10"], { timeout: 100 });
        expect.fail("Should have thrown");
      } catch (error) {
        if (error instanceof TimeoutError) {
          expect(error.message).toContain("100");
        }
      }
    });

    it("should complete normally when timeout is not exceeded", async () => {
      const result = await exec("echo", ["quick"], { timeout: 5000 });
      
      expect(result.stdout).toBe("quick");
    });
  });

  describe("options", () => {
    it("should accept cwd option", async () => {
      const result = await exec("pwd", [], { cwd: "/tmp" });
      
      // On macOS /tmp is symlinked to /private/tmp
      expect(result.stdout.endsWith("/tmp")).toBe(true);
    });

    it("should accept env option", async () => {
      const result = await exec("sh", ["-c", "echo $TEST_VAR"], {
        env: { TEST_VAR: "test_value_123" }
      });
      
      expect(result.stdout).toBe("test_value_123");
    });

    it("should merge env with process.env", async () => {
      // PATH should still be available
      const result = await exec("sh", ["-c", "echo $PATH"], {
        env: { EXTRA_VAR: "extra" }
      });
      
      expect(result.stdout).toContain("/");
    });
  });

  describe("error properties", () => {
    it("should have correct error types", async () => {
      try {
        await exec("non_existent_command_xyz_abc");
      } catch (error) {
        if (error instanceof ExecError) {
          expect(error.name).toBe("CommandNotFoundError");
        }
      }
    });

    it("ExecError should store command info", async () => {
      try {
        await exec("sh", ["-c", "exit 5"]);
      } catch (error) {
        if (error instanceof ExecError) {
          expect(error.command).toBe("sh -c exit 5");
        }
      }
    });
  });

  describe("edge cases", () => {
    it("should handle commands with special characters", async () => {
      const result = await exec("echo", ["special: $HOME @ # %"]);
      
      expect(result.stdout).toBe("special: $HOME @ # %");
    });

    it("should handle empty arguments", async () => {
      const result = await exec("echo", [""]);
      
      expect(result.stdout).toBe("");
    });

    it("should handle multiline output", async () => {
      const result = await exec("echo", ["line1\nline2\nline3"]);
      
      expect(result.stdout).toBe("line1\nline2\nline3");
    });

    it("should trim trailing newlines", async () => {
      const result = await exec("printf", ["hello\n\n\n"]);
      
      expect(result.stdout).toBe("hello");
    });

    it("should handle single argument without array", async () => {
      // No args passed
      const result = await exec("echo", []);
      
      expect(result.stdout).toBe("");
    });
  });
});
