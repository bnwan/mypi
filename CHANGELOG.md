# Changelog

## [Unreleased]

### Changed — Rename CLI command from `pi` to `mypi`

The following changes were made across the repo:

- `pi` (shell script) renamed to `mypi`
- Docker image tag: `pi-dev` → `mypi-dev`
- Host config directory: `~/.pi/agent` → `~/.mypi/agent`
- Container volume mount: `/root/.pi/agent` → `/root/.mypi/agent`
- Dockerfile `ENV`: `PI_CODING_AGENT_DIR=/root/.pi/agent` → `PI_CODING_AGENT_DIR=/root/.mypi/agent`

> Note: `ENTRYPOINT ["pi"]` in the Dockerfile was left unchanged — it refers to the binary installed inside the container by the upstream `@mariozechner/pi-coding-agent` npm package.

### Migration

1. Rebuild the Docker image under the new tag:
   ```sh
   mypi --build
   ```
2. Update the system symlink:
   ```sh
   sudo ln -sf /Users/bnwaneampeh/projects/pi/mypi /usr/local/bin/mypi
   sudo rm /usr/local/bin/pi
   ```
