/**
 * Migration cleanup guards — verifies the Phase 7 migration is complete.
 * These tests assert filesystem state rather than behaviour; they can be
 * removed once main has been updated and the migration is considered closed.
 */
import { describe, it, expect } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

describe("Migration Cleanup", () => {
  // src/ is one level below the repo root
  const repoRoot = join(import.meta.dir, "..");

  it("old shell script at repo root should not exist", () => {
    expect(existsSync(join(repoRoot, "mypi"))).toBe(false);
  });

  it("bin/mypi should be the only entry point", () => {
    expect(existsSync(join(repoRoot, "bin", "mypi"))).toBe(true);
  });
});
