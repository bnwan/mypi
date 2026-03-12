/**
 * Tests for token resolution utilities
 * Covers: GH_TOKEN precedence, GITHUB_TOKEN fallback, gh CLI execution,
 * and graceful failure handling
 */

import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { resolveToken } from "./tokens";

// Mock exec module
mock.module("../utils/exec.js", () => ({
  execText: mock(),
}));

import { execText } from "../utils/exec";

describe("tokens", () => {
  let originalGH_TOKEN: string | undefined;
  let originalGITHUB_TOKEN: string | undefined;
  let execTextMock: ReturnType<typeof execText>;

  beforeEach(() => {
    // Save original env vars
    originalGH_TOKEN = process.env.GH_TOKEN;
    originalGITHUB_TOKEN = process.env.GITHUB_TOKEN;

    // Clear env vars before each test
    delete process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;

    // Get the mocked function
    execTextMock = execText as unknown as ReturnType<typeof mock>;
    execTextMock.mockReset?.();
  });

  afterEach(() => {
    // Restore original env vars
    if (originalGH_TOKEN !== undefined) {
      process.env.GH_TOKEN = originalGH_TOKEN;
    } else {
      delete process.env.GH_TOKEN;
    }

    if (originalGITHUB_TOKEN !== undefined) {
      process.env.GITHUB_TOKEN = originalGITHUB_TOKEN;
    } else {
      delete process.env.GITHUB_TOKEN;
    }

    // Clear mocks
    execTextMock.mockClear?.();
  });

  describe("GH_TOKEN precedence", () => {
    it("should return GH_TOKEN when set", async () => {
      process.env.GH_TOKEN = "gh_token_value_123";

      const result = await resolveToken();

      expect(result).toBe("gh_token_value_123");
    });

    it("should return GH_TOKEN even when GITHUB_TOKEN is also set", async () => {
      process.env.GH_TOKEN = "gh_token_value";
      process.env.GITHUB_TOKEN = "github_token_value";

      const result = await resolveToken();

      expect(result).toBe("gh_token_value");
    });

    it("should not call gh CLI when GH_TOKEN is set", async () => {
      process.env.GH_TOKEN = "gh_token_value";

      await resolveToken();

      expect(execTextMock).not.toHaveBeenCalled();
    });
  });

  describe("GITHUB_TOKEN fallback", () => {
    it("should return GITHUB_TOKEN when GH_TOKEN is not set", async () => {
      process.env.GITHUB_TOKEN = "github_token_value_456";

      const result = await resolveToken();

      expect(result).toBe("github_token_value_456");
    });

    it("should not call gh CLI when GITHUB_TOKEN is set", async () => {
      process.env.GITHUB_TOKEN = "github_token_value";

      await resolveToken();

      expect(execTextMock).not.toHaveBeenCalled();
    });
  });

  describe("gh CLI execution", () => {
    it("should execute gh auth token when no env vars set", async () => {
      execTextMock.mockResolvedValue("gh_cli_token_789");

      const result = await resolveToken();

      expect(result).toBe("gh_cli_token_789");
      expect(execTextMock).toHaveBeenCalledWith("gh", ["auth", "token"]);
    });

    it("should trim whitespace from gh CLI output", async () => {
      execTextMock.mockResolvedValue("  token_with_whitespace_123  ");

      const result = await resolveToken();

      expect(result).toBe("token_with_whitespace_123");
    });

    it("should handle single line output", async () => {
      execTextMock.mockResolvedValue("ghp_singlelinetoken");

      const result = await resolveToken();

      expect(result).toBe("ghp_singlelinetoken");
    });
  });

  describe("gh CLI failure handling", () => {
    it("should return empty string when gh CLI fails", async () => {
      execTextMock.mockRejectedValue(new Error("gh not authenticated"));

      const result = await resolveToken();

      expect(result).toBe("");
    });

    it("should return empty string when gh CLI returns non-zero exit", async () => {
      const error = new Error("Command failed");
      (error as any).exitCode = 1;
      execTextMock.mockRejectedValue(error);

      const result = await resolveToken();

      expect(result).toBe("");
    });

    it("should return empty string when gh CLI command not found", async () => {
      const error = new Error("Command not found: gh");
      (error as any).name = "CommandNotFoundError";
      execTextMock.mockRejectedValue(error);

      const result = await resolveToken();

      expect(result).toBe("");
    });
  });

  describe("no token available", () => {
    it("should return empty string when no token source available", async () => {
      execTextMock.mockRejectedValue(new Error("gh not installed"));

      const result = await resolveToken();

      expect(result).toBe("");
    });
  });

  describe("precedence order", () => {
    it("should prefer GH_TOKEN > GITHUB_TOKEN > gh CLI", async () => {
      // Test 1: GH_TOKEN wins
      process.env.GH_TOKEN = "token_gh";
      process.env.GITHUB_TOKEN = "token_github";
      execTextMock.mockResolvedValue("token_cli");

      expect(await resolveToken()).toBe("token_gh");

      // Test 2: GITHUB_TOKEN wins when GH_TOKEN cleared
      delete process.env.GH_TOKEN;
      expect(await resolveToken()).toBe("token_github");

      // Test 3: gh CLI wins when both env vars cleared
      delete process.env.GITHUB_TOKEN;
      expect(await resolveToken()).toBe("token_cli");
    });
  });

  describe("edge cases", () => {
    it("should handle empty GH_TOKEN string as unset", async () => {
      process.env.GH_TOKEN = "";
      process.env.GITHUB_TOKEN = "fallback_token";

      const result = await resolveToken();

      // Empty string should be treated as unset, so fall back
      expect(result).toBe("fallback_token");
    });

    it("should handle empty GITHUB_TOKEN string as unset", async () => {
      process.env.GH_TOKEN = "";
      process.env.GITHUB_TOKEN = "";
      execTextMock.mockResolvedValue("gh_token");

      const result = await resolveToken();

      expect(result).toBe("gh_token");
    });

    it("should handle gh CLI returning empty string", async () => {
      execTextMock.mockResolvedValue("");

      const result = await resolveToken();

      expect(result).toBe("");
    });

    it("should handle whitespace-only gh CLI output as empty", async () => {
      execTextMock.mockResolvedValue("   \n\t  ");

      const result = await resolveToken();

      expect(result).toBe("");
    });
  });
});
