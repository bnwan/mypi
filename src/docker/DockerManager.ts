/**
 * DockerManager - Manages Docker operations for running containers
 * Handles building images, running containers, listing and stopping
 */

export class DockerManager {
  private readonly imageName: string;

  constructor(imageName: string = "mypi-agent") {
    this.imageName = imageName;
  }
}
