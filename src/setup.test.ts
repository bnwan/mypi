import { describe, it, expect } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

describe("Project Setup", () => {
  it("should run tests with bun:test", () => {
    expect(true).toBe(true);
  });

  it("should have TypeScript support", () => {
    const value: string = "typescript works";
    expect(typeof value).toBe("string");
  });
});

describe("Migration Cleanup", () => {
  it("old shell script at repo root should not exist", () => {
    const rootScript = join(import.meta.dir, "..", "mypi");
    expect(existsSync(rootScript)).toBe(false);
  });

  it("bin/mypi should be the only entry point", () => {
    const binScript = join(import.meta.dir, "..", "bin", "mypi");
    expect(existsSync(binScript)).toBe(true);
  });
});
