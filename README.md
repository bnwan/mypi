# mypi

A minimal Docker-based wrapper for the [`@mariozechner/pi-coding-agent`](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) npm package. It builds and runs the agent in an isolated container, mounting your current working directory and persisting agent config on the host.

## Requirements

- [Docker](https://www.docker.com/)
- [gh CLI](https://cli.github.com/) (optional — used to auto-resolve a GitHub token)

## Installation

1. Clone the repo:
   ```sh
   git clone <repo-url> ~/projects/pi
   ```

2. Make the script executable:
   ```sh
   chmod +x ~/projects/pi/mypi
   ```

3. Add a symlink so `mypi` is available system-wide:
   ```sh
   sudo ln -sf ~/projects/pi/mypi /usr/local/bin/mypi
   ```

## Usage

```sh
mypi [options]
```

On first run (or when `--build` is passed), the Docker image is built automatically.

```sh
# Force a rebuild of the Docker image
mypi --build
```

## Configuration

Agent config is persisted at `~/.mypi/agent` on the host and mounted into the container at `/root/.mypi/agent`.

## Environment Variables

The following environment variables are forwarded into the container if set on the host:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google API key |
| `OPENROUTER_API_KEY` | OpenRouter API key (for Ollama and other open-source models) |
| `GH_TOKEN` / `GITHUB_TOKEN` | GitHub token (also auto-resolved via `gh auth token`) |
