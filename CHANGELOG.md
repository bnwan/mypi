# Changelog

## [Unreleased]

### Added — Bun/TypeScript migration (Phase 7 complete)

The `mypi` shell script has been fully migrated to a Bun/TypeScript codebase.

**New modules:**
- `src/utils/exec.ts` — Shell execution helpers with timeout/buffer protection
- `src/config/paths.ts` — Path resolution (home dir expansion, workspace resolution)
- `src/config/tokens.ts` — GitHub token resolution (GH_TOKEN > GITHUB_TOKEN > gh CLI)
- `src/docker/DockerManager.ts` — Docker build/run/list/stop operations
- `src/cli/parseArgs.ts` — CLI argument parser for all mypi flags
- `src/main.ts` — Orchestration entry point

**Installation change:**
- Old: `sudo ln -sf ~/projects/mypi/mypi /usr/local/bin/mypi`
- New: `bun install && bun link` (uses `package.json` bin field)

**All original shell script features preserved:**
- `--build`, `--name`, `--workspace`, `--list`, `--stop`, `--help` / `-h`
- Automatic image build on first run
- Named vs unnamed (ephemeral) containers
- Environment variable forwarding (API keys, GH_TOKEN)
- Passthrough args to the pi entrypoint



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
   sudo ln -sf ~/projects/pi/mypi /usr/local/bin/mypi
   sudo rm /usr/local/bin/pi
   ```
