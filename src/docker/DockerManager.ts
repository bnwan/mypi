/**
 * DockerManager - Manages Docker operations for running containers
 * Handles building images, running containers, listing and stopping
 */

import { exec } from "../utils/exec";
import * as path from "path";

/** Options for running a Docker container */
export interface RunOptions {
  /** Container name (optional - if provided, container persists) */
  name?: string;
  /** Host workspace path to mount */
  workspace: string;
  /** Additional volume mounts (host:container[:mode]) */
  volumes?: string[];
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Additional arguments to pass to the container */
  additionalArgs?: string[];
}

/** Information about a running container */
export interface ContainerInfo {
  id: string;
  name: string;
  state: string;
  image: string;
}

export class DockerManager {
  private readonly imageName: string;

  constructor(imageName: string = "mypi-dev") {
    this.imageName = imageName;
  }

  /**
   * Build Docker image from Dockerfile
   * @param dockerfilePath - Path to Dockerfile
   * @returns Promise resolving when build completes
   */
  async build(dockerfilePath: string): Promise<void> {
    const dir = path.dirname(dockerfilePath);

    await exec("docker", [
      "build",
      "-t",
      this.imageName,
      "-f",
      dockerfilePath,
      dir,
    ]);
  }

  /**
   * Check if Docker image exists locally
   * @returns Promise resolving to true if image exists
   */
  async imageExists(): Promise<boolean> {
    try {
      const result = await exec("docker", ["images", "-q", this.imageName]);
      return result.stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Run Docker container
   * @param options - Run configuration options
   * @returns Promise resolving when container starts
   * @remarks Named containers run in foreground (interactive), unnamed containers
   * are removed on exit (--rm). The `additionalArgs` are passed to the container
   * entrypoint, not as `docker run` options.
   */
  async run(options: RunOptions): Promise<void> {
    const args: string[] = ["run"];

    // Named containers persist (no --rm), unnamed containers are removed on exit
    if (options.name) {
      args.push("-it");
      args.push("--name", options.name);
    } else {
      args.push("--rm", "-it");
    }

    // Environment variables
    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        args.push("-e", `${key}=${value}`);
      }
    }

    // Volume mounts
    args.push("-v", `${options.workspace}:/workspace`);
    if (options.volumes) {
      for (const vol of options.volumes) {
        args.push("-v", vol);
      }
    }

    // Image name
    args.push(this.imageName);

    // Additional arguments to pass to container
    if (options.additionalArgs && options.additionalArgs.length > 0) {
      args.push(...options.additionalArgs);
    }

    await exec("docker", args);
  }

  /**
   * List running containers for this image
   * @returns Promise resolving to array of container info
   */
  async list(): Promise<ContainerInfo[]> {
    const result = await exec("docker", [
      "ps",
      "--filter",
      `ancestor=${this.imageName}`,
      "--format",
      "json",
    ]);

    const output = result.stdout.trim();
    if (!output) {
      return [];
    }

    // Docker outputs one JSON object per line for --format json
    const lines = output.split("\n").filter((line) => line.trim());
    const containers: ContainerInfo[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        // Handle both single object and potential array wrapping
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const c of items) {
          containers.push({
            id: c.ID || "",
            name: c.Names || "",
            state: c.State || "",
            image: c.Image || "",
          });
        }
      } catch {
        // Skip lines that aren't valid JSON rather than fabricating data
        continue;
      }
    }

    return containers;
  }

  /**
   * Stop and remove a container
   * @param nameOrId - Container name or ID to stop
   * @returns Promise resolving when container is stopped and removed
   */
  async stop(nameOrId: string): Promise<void> {
    // Use rm -f to atomically stop and remove the container
    // This avoids leaving zombie containers if stop succeeds but rm fails
    await exec("docker", ["rm", "-f", nameOrId]);
  }
}
