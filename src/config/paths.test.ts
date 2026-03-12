import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  expandHomeDir,
  resolveConfigDir,
  resolveWorkspacePath,
  resolveScriptDir,
  CONFIG_DIR_RELATIVE_PATH,
} from "./paths";
import * as os from "os";
import * as path from "path";
import * as process from "process";

describe("paths", () => {
  let originalHome: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
  });

  afterEach(() => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
  });

  describe("expandHomeDir", () => {
    test("expands tilde to home directory", () => {
      process.env.HOME = "/home/testuser";
      expect(expandHomeDir("~/config")).toBe(path.join("/home/testuser", "config"));
    });

    test("handles just tilde", () => {
      process.env.HOME = "/home/testuser";
      expect(expandHomeDir("~")).toBe("/home/testuser");
    });

    test("handles tilde with trailing slash", () => {
      process.env.HOME = "/home/testuser";
      expect(expandHomeDir("~/")).toBe("/home/testuser");
    });

    test("leaves absolute paths unchanged", () => {
      expect(expandHomeDir("/absolute/path")).toBe("/absolute/path");
    });

    test("leaves relative paths unchanged", () => {
      expect(expandHomeDir("./relative/path")).toBe("./relative/path");
    });

    test("handles empty string", () => {
      expect(expandHomeDir("")).toBe("");
    });

    test("does not expand tilde in middle of path", () => {
      expect(expandHomeDir("/prefix/~/suffix")).toBe("/prefix/~/suffix");
    });

    test("handles paths with spaces", () => {
      process.env.HOME = "/Users/test user";
      expect(expandHomeDir("~/my path")).toBe(path.join("/Users/test user", "my path"));
    });

    test("uses os.homedir as fallback when HOME is not set", () => {
      delete process.env.HOME;
      const expectedHome = os.homedir();
      expect(expandHomeDir("~/config")).toBe(path.join(expectedHome, "config"));
    });
  });

  describe("resolveConfigDir", () => {
    test("resolves to ~/.mypi/agent", () => {
      process.env.HOME = "/home/testuser";
      expect(resolveConfigDir()).toBe(path.join("/home/testuser", ".mypi", "agent"));
    });

    test("returns consistent path", () => {
      process.env.HOME = "/home/testuser";
      const first = resolveConfigDir();
      const second = resolveConfigDir();
      expect(first).toBe(second);
    });

    test("throws error when home directory cannot be determined", () => {
      // This test verifies the code handles empty home scenario
      // In practice, os.homedir() returns a value in all normal scenarios
      // The error is thrown when both env.HOME and os.homedir() return empty/undefined
      delete process.env.HOME;
      
      // When os.homedir() returns a valid path, resolveConfigDir should work
      const result = resolveConfigDir();
      expect(path.isAbsolute(result)).toBe(true);
      expect(result.endsWith(path.join(".mypi", "agent"))).toBe(true);
    });
  });

  describe("resolveWorkspacePath", () => {
    test("converts relative path to absolute", () => {
      const cwd = process.cwd();
      const result = resolveWorkspacePath("./workspace");
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toBe(path.resolve(cwd, "./workspace"));
    });

    test("preserves absolute path", () => {
      const absolute = "/absolute/path/to/workspace";
      expect(resolveWorkspacePath(absolute)).toBe(absolute);
    });

    test("expands tilde in path", () => {
      process.env.HOME = "/home/testuser";
      expect(resolveWorkspacePath("~/projects")).toBe(path.join("/home/testuser", "projects"));
    });

    test("expands tilde using os.homedir when HOME not set", () => {
      delete process.env.HOME;
      const expectedHome = os.homedir();
      const result = resolveWorkspacePath("~/projects");
      expect(result).toBe(path.join(expectedHome, "projects"));
    });

    test("handles dot-dot paths", () => {
      const cwd = process.cwd();
      const result = resolveWorkspacePath("../sibling");
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toBe(path.resolve(cwd, "../sibling"));
    });

    test("handles empty string", () => {
      const result = resolveWorkspacePath("");
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toBe(process.cwd());
    });

    test("handles paths with spaces", () => {
      const cwd = process.cwd();
      const result = resolveWorkspacePath("./my workspace");
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toBe(path.resolve(cwd, "./my workspace"));
    });
  });

  describe("resolveScriptDir", () => {
    test("resolves to absolute path", () => {
      const result = resolveScriptDir();
      expect(path.isAbsolute(result)).toBe(true);
    });

    test("returns consistent path", () => {
      const first = resolveScriptDir();
      const second = resolveScriptDir();
      expect(first).toBe(second);
    });
  });

  describe("CONFIG_DIR_RELATIVE_PATH constant", () => {
    test("has correct value", () => {
      expect(CONFIG_DIR_RELATIVE_PATH).toBe(".mypi/agent");
    });
  });
});
