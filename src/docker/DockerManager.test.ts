/**
 * Tests for DockerManager - Docker operations manager
 * Covers: build, image existence, run, list, stop, volume mounts, env vars
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import * as execModule from "../utils/exec";
import { DockerManager } from "./DockerManager";

describe("DockerManager", () => {
  let manager: DockerManager;
  let execSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    manager = new DockerManager();
    execSpy = spyOn(execModule, "exec");
  });

  afterEach(() => {
    execSpy.mockRestore();
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
        "mypi-dev",
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

      await expect(manager.build("/path/to/dockerfile")).rejects.toThrow();
    });
  });

  describe("imageExists", () => {
    it("should return true when image exists", async () => {
      execSpy.mockResolvedValue({
        stdout: "IMAGE ID\nabc123",
        stderr: "",
        exitCode: 0,
      });

      const exists = await manager.imageExists();

      expect(exists).toBe(true);
      expect(execSpy).toHaveBeenCalledWith("docker", [
        "images",
        "-q",
        "mypi-dev",
      ]);
    });

    it("should return false when image does not exist", async () => {
      execSpy.mockResolvedValue({
        stdout: "",
        stderr: "",
        exitCode: 0,
      });

      const exists = await manager.imageExists();

      expect(exists).toBe(false);
    });

    it("should check for custom image name", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      const customManager = new DockerManager("custom-image");
      await customManager.imageExists();

      expect(execSpy).toHaveBeenCalledWith("docker", [
        "images",
        "-q",
        "custom-image",
      ]);
    });
  });

  describe("run", () => {
    it("should run container without name (includes --rm)", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      await manager.run({
        workspace: "/host/workspace",
        additionalArgs: ["--flag", "value"],
      });

      expect(execSpy).toHaveBeenCalledWith("docker", [
        "run",
        "--rm",
        "-it",
        "-v",
        "/host/workspace:/workspace",
        "mypi-dev",
        "--flag",
        "value",
      ]);
    });

    it("should run container with name (no --rm, foreground)", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      await manager.run({
        name: "my-container",
        workspace: "/host/workspace",
        additionalArgs: [],
      });

      expect(execSpy).toHaveBeenCalledWith("docker", [
        "run",
        "-it",
        "--name",
        "my-container",
        "-v",
        "/host/workspace:/workspace",
        "mypi-dev",
      ]);
    });

    it("should pass environment variables", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      await manager.run({
        workspace: "/host/workspace",
        env: { API_KEY: "secret123", DEBUG: "true" },
      });

      expect(execSpy).toHaveBeenCalledWith("docker", [
        "run",
        "--rm",
        "-it",
        "-e",
        "API_KEY=secret123",
        "-e",
        "DEBUG=true",
        "-v",
        "/host/workspace:/workspace",
        "mypi-dev",
      ]);
    });

    it("should pass multiple volume mounts", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      await manager.run({
        workspace: "/host/workspace",
        volumes: ["/extra/data:/data", "/cache:/cache:ro"],
      });

      expect(execSpy).toHaveBeenCalledWith("docker", [
        "run",
        "--rm",
        "-it",
        "-v",
        "/host/workspace:/workspace",
        "-v",
        "/extra/data:/data",
        "-v",
        "/cache:/cache:ro",
        "mypi-dev",
      ]);
    });
  });

  describe("list", () => {
    it("should list running containers", async () => {
      execSpy.mockResolvedValue({
        stdout: JSON.stringify([
          {
            ID: "abc123",
            Names: "mypi-container",
            State: "running",
            Image: "mypi-dev",
          },
        ]),
        stderr: "",
        exitCode: 0,
      });

      const containers = await manager.list();

      expect(execSpy).toHaveBeenCalledWith("docker", [
        "ps",
        "--filter",
        "ancestor=mypi-dev",
        "--format",
        "json",
      ]);
      expect(containers).toHaveLength(1);
      expect(containers[0].id).toBe("abc123");
      expect(containers[0].name).toBe("mypi-container");
      expect(containers[0].state).toBe("running");
      expect(containers[0].image).toBe("mypi-dev");
    });

    it("should return empty array when no containers running", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      const containers = await manager.list();

      expect(containers).toEqual([]);
    });

    it("should filter for custom image name", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      const customManager = new DockerManager("custom-image");
      await customManager.list();

      expect(execSpy).toHaveBeenCalledWith("docker", [
        "ps",
        "--filter",
        "ancestor=custom-image",
        "--format",
        "json",
      ]);
    });

    it("should parse newline-delimited JSON output", async () => {
      // Docker outputs one JSON object per line
      execSpy.mockResolvedValue({
        stdout: '{"ID":"abc123","Names":"mypi-container","State":"running","Image":"mypi-dev"}\n{"ID":"def456","Names":"another-container","State":"exited","Image":"mypi-dev"}',
        stderr: "",
        exitCode: 0,
      });

      const containers = await manager.list();

      expect(containers).toHaveLength(2);
      expect(containers[0].id).toBe("abc123");
      expect(containers[0].name).toBe("mypi-container");
      expect(containers[0].state).toBe("running");
      expect(containers[1].id).toBe("def456");
      expect(containers[1].name).toBe("another-container");
      expect(containers[1].state).toBe("exited");
    });
  });

  describe("stop", () => {
    it("should stop and remove container by name", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      await manager.stop("my-container");

      expect(execSpy).toHaveBeenCalledWith("docker", ["rm", "-f", "my-container"]);
    });

    it("should stop and remove by container ID", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      await manager.stop("abc123");

      expect(execSpy).toHaveBeenCalledWith("docker", ["rm", "-f", "abc123"]);
    });

    it("should throw error when stop fails", async () => {
      execSpy.mockImplementation(() => {
        throw new Error("Container not found");
      });

      await expect(manager.stop("nonexistent")).rejects.toThrow();
    });
  });
});
