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
}
