import { describe, it, expect } from "bun:test";
import { parseArgs } from "./parseArgs";
import * as path from "path";

// Use a fixed cwd for predictable absolute path resolution in tests
const TEST_CWD = "/test/workspace";

describe("parseArgs", () => {
  // ── Defaults ──────────────────────────────────────────────────────────────

  describe("defaults", () => {
    it("returns default values when no args provided", () => {
      const result = parseArgs([], TEST_CWD);
      expect(result).toEqual({
        build: false,
        list: false,
        help: false,
        workspace: TEST_CWD,
        name: undefined,
        stop: undefined,
        piArgs: [],
      });
    });
  });

  // ── --build ───────────────────────────────────────────────────────────────

  describe("--build flag", () => {
    it("sets build to true", () => {
      const result = parseArgs(["--build"], TEST_CWD);
      expect(result.build).toBe(true);
    });

    it("can be combined with other flags", () => {
      const result = parseArgs(["--build", "--name", "mydev"], TEST_CWD);
      expect(result.build).toBe(true);
      expect(result.name).toBe("mydev");
    });
  });

  // ── --name ────────────────────────────────────────────────────────────────

  describe("--name flag", () => {
    it("parses --name NAME (space form)", () => {
      const result = parseArgs(["--name", "mydev"], TEST_CWD);
      expect(result.name).toBe("mydev");
    });

    it("parses --name=NAME (equals form)", () => {
      const result = parseArgs(["--name=mydev"], TEST_CWD);
      expect(result.name).toBe("mydev");
    });

    it("throws when --name is missing its value", () => {
      expect(() => parseArgs(["--name"], TEST_CWD)).toThrow(
        "--name requires a value"
      );
    });

    it("throws when --name value looks like another flag", () => {
      expect(() => parseArgs(["--name", "--build"], TEST_CWD)).toThrow(
        "--name requires a value"
      );
    });
  });

  // ── --workspace ───────────────────────────────────────────────────────────

  describe("--workspace flag", () => {
    it("parses absolute path unchanged", () => {
      const result = parseArgs(["--workspace", "/home/user/project"], TEST_CWD);
      expect(result.workspace).toBe("/home/user/project");
    });

    it("parses relative path resolved against cwd (space form)", () => {
      const result = parseArgs(["--workspace", "./myproject"], TEST_CWD);
      expect(result.workspace).toBe(path.resolve(TEST_CWD, "./myproject"));
    });

    it("parses relative path resolved against cwd (equals form)", () => {
      const result = parseArgs(["--workspace=./myproject"], TEST_CWD);
      expect(result.workspace).toBe(path.resolve(TEST_CWD, "./myproject"));
    });

    it("throws when --workspace is missing its value", () => {
      expect(() => parseArgs(["--workspace"], TEST_CWD)).toThrow(
        "--workspace requires a value"
      );
    });

    it("throws when --workspace value looks like another flag", () => {
      expect(() => parseArgs(["--workspace", "--build"], TEST_CWD)).toThrow(
        "--workspace requires a value"
      );
    });
  });

  // ── --list ────────────────────────────────────────────────────────────────

  describe("--list flag", () => {
    it("sets list to true", () => {
      const result = parseArgs(["--list"], TEST_CWD);
      expect(result.list).toBe(true);
    });
  });

  // ── --stop ────────────────────────────────────────────────────────────────

  describe("--stop flag", () => {
    it("parses --stop NAME (space form)", () => {
      const result = parseArgs(["--stop", "mydev"], TEST_CWD);
      expect(result.stop).toBe("mydev");
    });

    it("parses --stop=NAME (equals form)", () => {
      const result = parseArgs(["--stop=mydev"], TEST_CWD);
      expect(result.stop).toBe("mydev");
    });

    it("throws when --stop is missing its value", () => {
      expect(() => parseArgs(["--stop"], TEST_CWD)).toThrow(
        "--stop requires a value"
      );
    });

    it("throws when --stop value looks like another flag", () => {
      expect(() => parseArgs(["--stop", "--list"], TEST_CWD)).toThrow(
        "--stop requires a value"
      );
    });
  });

  // ── --help ────────────────────────────────────────────────────────────────

  describe("--help / -h flag", () => {
    it("sets help to true for --help", () => {
      const result = parseArgs(["--help"], TEST_CWD);
      expect(result.help).toBe(true);
    });

    it("sets help to true for -h", () => {
      const result = parseArgs(["-h"], TEST_CWD);
      expect(result.help).toBe(true);
    });
  });

  // ── piArgs (passthrough) ──────────────────────────────────────────────────

  describe("piArgs passthrough", () => {
    it("collects bare trailing args as piArgs", () => {
      const result = parseArgs(["--build", "some-task", "another"], TEST_CWD);
      expect(result.piArgs).toEqual(["some-task", "another"]);
    });

    it("collects everything after -- as piArgs", () => {
      const result = parseArgs(
        ["--build", "--", "--some-pi-flag", "value"],
        TEST_CWD
      );
      expect(result.piArgs).toEqual(["--some-pi-flag", "value"]);
    });

    it("collects nothing when no trailing args", () => {
      const result = parseArgs(["--build"], TEST_CWD);
      expect(result.piArgs).toEqual([]);
    });

    it("treats args before -- as mypi flags and after as piArgs", () => {
      const result = parseArgs(
        ["--name", "dev", "--", "--model", "gpt4"],
        TEST_CWD
      );
      expect(result.name).toBe("dev");
      expect(result.piArgs).toEqual(["--model", "gpt4"]);
    });
  });

  // ── Invalid combinations ──────────────────────────────────────────────────

  describe("invalid combinations", () => {
    it("throws when --list and --name are combined", () => {
      expect(() => parseArgs(["--list", "--name", "dev"], TEST_CWD)).toThrow(
        "--list cannot be combined with --name"
      );
    });

    it("throws when --list and --stop are combined", () => {
      expect(() => parseArgs(["--list", "--stop", "dev"], TEST_CWD)).toThrow(
        "--list cannot be combined with --stop"
      );
    });

    it("throws on unknown flags", () => {
      expect(() => parseArgs(["--unknown"], TEST_CWD)).toThrow(
        "Unknown flag: --unknown"
      );
    });
  });

  // ── Combined real-world scenarios ─────────────────────────────────────────

  describe("real-world combinations", () => {
    it("parses a typical named run with workspace and piArgs", () => {
      const result = parseArgs(
        ["--name", "dev", "--workspace", "/projects/foo", "--", "implement", "#42"],
        TEST_CWD
      );
      expect(result).toEqual({
        name: "dev",
        workspace: "/projects/foo",
        build: false,
        list: false,
        stop: undefined,
        help: false,
        piArgs: ["implement", "#42"],
      });
    });

    it("parses build + named run", () => {
      const result = parseArgs(["--build", "--name", "fresh"], TEST_CWD);
      expect(result.build).toBe(true);
      expect(result.name).toBe("fresh");
    });

    it("parses stop command standalone", () => {
      const result = parseArgs(["--stop", "dev"], TEST_CWD);
      expect(result.stop).toBe("dev");
      expect(result.list).toBe(false);
    });
  });
});
