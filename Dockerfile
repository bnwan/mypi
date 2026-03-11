FROM oven/bun:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    curl \
    gpg \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

RUN bun install -g @mariozechner/pi-coding-agent

# Copy pi config
RUN mkdir -p /root/.pi/agent
COPY .pi/agent/models.json /root/.pi/agent/models.json
COPY .pi/agent/settings.json /root/.pi/agent/settings.json

# Copy prompt templates
COPY .pi/agent/prompts/ /root/.pi/agent/prompts/

# Copy skills
COPY .pi/agent/skills/ /root/.pi/agent/skills/

# Copy extensions
COPY .pi/agent/extensions/ /root/.pi/agent/extensions/

ENV PI_CODING_AGENT_DIR=/root/.pi/agent
VOLUME ["/root/.pi/agent"]

WORKDIR /workspace

ENTRYPOINT ["pi"]
