# mypi

A minimal Docker-based wrapper for the [`@mariozechner/pi-coding-agent`](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) npm package. It builds and runs the agent in an isolated container, mounting your current working directory and persisting agent config on the host.

## Requirements

- [Docker](https://www.docker.com/)
- [Bun](https://bun.sh/) (runtime — used to execute the TypeScript CLI directly)
- [gh CLI](https://cli.github.com/) (optional — used to auto-resolve a GitHub token)

## Installation

1. Clone the repo:
   ```sh
   git clone <repo-url> ~/projects/mypi
   cd ~/projects/mypi
   ```

2. Install dependencies:
   ```sh
   bun install
   ```

3. Link globally so `mypi` is available system-wide:
   ```sh
   bun link
   ```

   This uses the `bin.mypi` entry in `package.json` to make the `mypi` command available in your shell.

   > To unlink: `bun unlink mypi`

## Usage

```sh
mypi [options] [pi-args...]
```

On first run (or when `--build` is passed), the Docker image is built automatically.

```sh
# Force a rebuild of the Docker image
mypi --build

# Start a named (persistent) container instance
mypi --name my-project

# Mount a specific workspace directory
mypi --workspace ~/projects/my-app

# List running mypi containers
mypi --list

# Stop a named container
mypi --stop my-project

# Show help
mypi --help
```

Any arguments not recognised by `mypi` are passed through to the `pi` agent inside the container.

## Configuration

Agent config is persisted at `~/.mypi/agent` on the host and mounted into the container at `/root/.mypi/agent`.

## Environment Variables

The following environment variables are forwarded into the container if set on the host:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google API key |
| `OPENROUTER_API_KEY` | OpenRouter API key (for open-source models) |
| `GH_TOKEN` / `GITHUB_TOKEN` | GitHub token (also auto-resolved via `gh auth token`) |
