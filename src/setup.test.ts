import { describe, it, expect } from "bun:test";

describe("Project Setup", () => {
  it("should run tests with bun:test", () => {
    expect(true).toBe(true);
  });

  it("should have TypeScript support", () => {
    const value: string = "typescript works";
    expect(typeof value).toBe("string");
  });
});
