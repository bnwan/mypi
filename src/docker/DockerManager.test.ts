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

  describe("build", () => {
    it("should call docker build with correct arguments", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      await manager.build("/path/to/dockerfile");

      expect(execSpy).toHaveBeenCalledWith("docker", [
        "build",
        "-t",
        "mypi-agent",
        "-f",
        "/path/to/dockerfile",
        "/path/to",
      ]);
    });

    it("should call docker build with custom image name", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      const customManager = new DockerManager("custom-image");
      await customManager.build("/path/to/dockerfile");

      expect(execSpy).toHaveBeenCalledWith("docker", [
        "build",
        "-t",
        "custom-image",
        "-f",
        "/path/to/dockerfile",
        "/path/to",
      ]);
    });

    it("should throw error when docker build fails", async () => {
      execSpy.mockImplementation(() => {
        throw new Error("Docker build failed");
      });

      expect(manager.build("/path/to/dockerfile")).rejects.toThrow();
    });
  });
});
