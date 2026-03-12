/**
 * DockerManager - Manages Docker operations for running containers
 * Handles building images, running containers, listing and stopping
 */

import { exec } from "../utils/exec";
import * as path from "path";

export class DockerManager {
  private readonly imageName: string;

  constructor(imageName: string = "mypi-agent") {
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
}
