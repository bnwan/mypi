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
        "mypi-agent",
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
        "mypi-agent",
        "--flag",
        "value",
      ]);
    });

    it("should run container with name (no --rm)", async () => {
      execSpy.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      await manager.run({
        name: "my-container",
        workspace: "/host/workspace",
        additionalArgs: [],
      });

      expect(execSpy).toHaveBeenCalledWith("docker", [
        "run",
        "-d",
        "-it",
        "--name",
        "my-container",
        "-v",
        "/host/workspace:/workspace",
        "mypi-agent",
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
        "mypi-agent",
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
        "mypi-agent",
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
            Image: "mypi-agent",
          },
        ]),
        stderr: "",
        exitCode: 0,
      });

      const containers = await manager.list();

      expect(execSpy).toHaveBeenCalledWith("docker", [
        "ps",
        "--filter",
        "ancestor=mypi-agent",
        "--format",
        "json",
      ]);
      expect(containers).toHaveLength(1);
      expect(containers[0].id).toBe("abc123");
      expect(containers[0].name).toBe("mypi-container");
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

    it("should handle plain text output when json not available", async () => {
      execSpy.mockResolvedValue({
        stdout: "mypi-container\nanother-container",
        stderr: "",
        exitCode: 0,
      });

      const containers = await manager.list();

      expect(containers).toHaveLength(2);
      expect(containers[0].name).toBe("mypi-container");
      expect(containers[1].name).toBe("another-container");
    });
  });
});
