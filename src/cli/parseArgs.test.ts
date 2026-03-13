import { describe, expect, it } from "bun:test";
import { parseArgs } from "./parseArgs";

describe("parseArgs", () => {
  describe("--build flag", () => {
    it("should default build to false", () => {
      const result = parseArgs([]);
      expect(result.build).toBe(false);
    });

    it("should set build to true when --build is passed", () => {
      const result = parseArgs(["--build"]);
      expect(result.build).toBe(true);
    });
  });

  describe("--name flag", () => {
    it("should default name to undefined", () => {
      const result = parseArgs([]);
      expect(result.name).toBeUndefined();
    });

    it("should parse --name with a space-separated value", () => {
      const result = parseArgs(["--name", "my-container"]);
      expect(result.name).toBe("my-container");
    });

    it("should parse --name=value syntax", () => {
      const result = parseArgs(["--name=my-container"]);
      expect(result.name).toBe("my-container");
    });
  });

  describe("--workspace flag", () => {
    it("should default workspace to undefined", () => {
      const result = parseArgs([]);
      expect(result.workspace).toBeUndefined();
    });

    it("should parse --workspace with a space-separated value", () => {
      const result = parseArgs(["--workspace", "/some/path"]);
      expect(result.workspace).toBe("/some/path");
    });

    it("should parse --workspace=value syntax", () => {
      const result = parseArgs(["--workspace=/some/path"]);
      expect(result.workspace).toBe("/some/path");
    });

    it("should accept relative paths", () => {
      const result = parseArgs(["--workspace", "./relative/path"]);
      expect(result.workspace).toBe("./relative/path");
    });
  });

  describe("--list flag", () => {
    it("should default list to false", () => {
      const result = parseArgs([]);
      expect(result.list).toBe(false);
    });

    it("should set list to true when --list is passed", () => {
      const result = parseArgs(["--list"]);
      expect(result.list).toBe(true);
    });
  });

  describe("--stop flag", () => {
    it("should default stop to undefined", () => {
      const result = parseArgs([]);
      expect(result.stop).toBeUndefined();
    });

    it("should parse --stop with a space-separated value", () => {
      const result = parseArgs(["--stop", "my-container"]);
      expect(result.stop).toBe("my-container");
    });

    it("should parse --stop=value syntax", () => {
      const result = parseArgs(["--stop=my-container"]);
      expect(result.stop).toBe("my-container");
    });
  });

  describe("--help / -h flag", () => {
    it("should set help to true when --help is passed", () => {
      const result = parseArgs(["--help"]);
      expect(result.help).toBe(true);
    });

    it("should set help to true when -h is passed", () => {
      const result = parseArgs(["-h"]);
      expect(result.help).toBe(true);
    });

    it("should default help to false", () => {
      const result = parseArgs([]);
      expect(result.help).toBe(false);
    });
  });

  describe("passthrough args", () => {
    it("should default extraArgs to empty array", () => {
      const result = parseArgs([]);
      expect(result.extraArgs).toEqual([]);
    });

    it("should collect unknown args as passthrough args", () => {
      const result = parseArgs(["--some-pi-flag", "value"]);
      expect(result.extraArgs).toEqual(["--some-pi-flag", "value"]);
    });

    it("should collect args after -- as passthrough args", () => {
      const result = parseArgs(["--", "--pi-flag", "value"]);
      expect(result.extraArgs).toEqual(["--pi-flag", "value"]);
    });

    it("should stop collecting mypi flags after -- separator", () => {
      const result = parseArgs(["--build", "--", "--build"]);
      expect(result.build).toBe(true);
      expect(result.extraArgs).toEqual(["--build"]);
    });

    it("should collect all args after a non-mypi flag", () => {
      const result = parseArgs(["--build", "--workspace", "/path", "some-task", "--pi-option"]);
      expect(result.build).toBe(true);
      expect(result.workspace).toBe("/path");
      expect(result.extraArgs).toEqual(["some-task", "--pi-option"]);
    });
  });

  describe("combined flags", () => {
    it("should parse multiple mypi flags together", () => {
      const result = parseArgs(["--build", "--name", "mybox", "--workspace", "/work"]);
      expect(result.build).toBe(true);
      expect(result.name).toBe("mybox");
      expect(result.workspace).toBe("/work");
      expect(result.extraArgs).toEqual([]);
    });

    it("should separate mypi flags from pi passthrough args", () => {
      const result = parseArgs(["--name", "box", "implement", "feature"]);
      expect(result.name).toBe("box");
      expect(result.extraArgs).toEqual(["implement", "feature"]);
    });
  });
});
