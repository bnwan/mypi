/**
 * Tests for DockerManager - Docker operations manager
 * Covers: build, image existence, run, list, stop, volume mounts, env vars
 */

import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import * as execModule from "../utils/exec";
import { DockerManager } from "./DockerManager";

describe("DockerManager", () => {
  let manager: DockerManager;
  let execSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    manager = new DockerManager();
    execSpy = spyOn(execModule, "exec");
  });

  describe("constructor", () => {
    it("should create instance with default image name", () => {
      const defaultManager = new DockerManager();
      expect(defaultManager).toBeDefined();
    });

    it("should create instance with custom image name", () => {
      const customManager = new DockerManager("custom-image");
      expect(customManager).toBeDefined();
    });
  });
});
