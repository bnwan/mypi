/**
 * Integration tests for src/main.ts
 *
 * Tests the `run()` function which orchestrates all components.
 * Docker and token calls are injected via the `deps` parameter so no
 * real Docker daemon or gh CLI is required, and no module-level mocks
 * bleed into other test files.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test";
import { run } from "./main";
import type { DockerManagerLike } from "./main";
import type { ContainerInfo, RunOptions } from "./docker/DockerManager";

// ── Mock factory ───────────────────────────────────────────────────────────

function makeDockerMock(overrides: Partial<DockerManagerLike> = {}): {
  mock: DockerManagerLike;
  spies: {
    build: ReturnType<typeof mock>;
    imageExists: ReturnType<typeof mock>;
    run: ReturnType<typeof mock>;
    list: ReturnType<typeof mock>;
    stop: ReturnType<typeof mock>;
  };
} {
  const spies = {
    build: mock(async (_path: string) => {}),
    imageExists: mock(async () => true),
    run: mock(async (_opts: RunOptions) => {}),
    list: mock(async (): Promise<ContainerInfo[]> => []),
    stop: mock(async (_name: string) => {}),
  };

  return {
    spies,
    mock: {
      build: overrides.build ?? spies.build,
      imageExists: overrides.imageExists ?? spies.imageExists,
      run: overrides.run ?? spies.run,
      list: overrides.list ?? spies.list,
      stop: overrides.stop ?? spies.stop,
    },
  };
}

const defaultGetToken = mock(async () => "test-gh-token");

function resetTokenMock() {
  defaultGetToken.mockReset();
  defaultGetToken.mockImplementation(async () => "test-gh-token");
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("main > --help", () => {
  it("returns exit code 0 for --help", async () => {
    const { mock: docker } = makeDockerMock();
    const code = await run(["--help"], { docker, getToken: defaultGetToken });
    expect(code).toBe(0);
  });

  it("returns exit code 0 for -h", async () => {
    const { mock: docker } = makeDockerMock();
    const code = await run(["-h"], { docker, getToken: defaultGetToken });
    expect(code).toBe(0);
  });

  it("does not call DockerManager for --help", async () => {
    const { mock: docker, spies } = makeDockerMock();
    await run(["--help"], { docker, getToken: defaultGetToken });
    expect(spies.run).not.toHaveBeenCalled();
    expect(spies.list).not.toHaveBeenCalled();
    expect(spies.stop).not.toHaveBeenCalled();
    expect(spies.build).not.toHaveBeenCalled();
  });
});

describe("main > --list flow", () => {
  beforeEach(resetTokenMock);

  it("returns exit code 0 when no containers are running", async () => {
    const { mock: docker } = makeDockerMock({
      list: mock(async () => []),
    });
    const code = await run(["--list"], { docker, getToken: defaultGetToken });
    expect(code).toBe(0);
  });

  it("calls DockerManager.list()", async () => {
    const { mock: docker, spies } = makeDockerMock();
    await run(["--list"], { docker, getToken: defaultGetToken });
    expect(spies.list).toHaveBeenCalledTimes(1);
  });

  it("returns exit code 0 with running containers", async () => {
    const { mock: docker } = makeDockerMock({
      list: mock(async (): Promise<ContainerInfo[]> => [
        { id: "abc123", name: "my-container", state: "running", image: "mypi-dev" },
      ]),
    });
    const code = await run(["--list"], { docker, getToken: defaultGetToken });
    expect(code).toBe(0);
  });

  it("returns exit code 1 when list throws", async () => {
    const { mock: docker } = makeDockerMock({
      list: mock(async () => { throw new Error("docker ps failed"); }),
    });
    const code = await run(["--list"], { docker, getToken: defaultGetToken });
    expect(code).toBe(1);
  });

  it("does not call run or stop for --list", async () => {
    const { mock: docker, spies } = makeDockerMock();
    await run(["--list"], { docker, getToken: defaultGetToken });
    expect(spies.run).not.toHaveBeenCalled();
    expect(spies.stop).not.toHaveBeenCalled();
  });
});

describe("main > --stop flow", () => {
  beforeEach(resetTokenMock);

  it("returns exit code 0 on successful stop", async () => {
    const { mock: docker } = makeDockerMock();
    const code = await run(["--stop", "my-container"], { docker, getToken: defaultGetToken });
    expect(code).toBe(0);
  });

  it("calls DockerManager.stop() with the container name", async () => {
    const { mock: docker, spies } = makeDockerMock();
    await run(["--stop", "my-container"], { docker, getToken: defaultGetToken });
    expect(spies.stop).toHaveBeenCalledTimes(1);
    expect(spies.stop).toHaveBeenCalledWith("my-container");
  });

  it("returns exit code 1 when stop throws", async () => {
    const { mock: docker } = makeDockerMock({
      stop: mock(async () => { throw new Error("docker rm -f failed"); }),
    });
    const code = await run(["--stop", "my-container"], { docker, getToken: defaultGetToken });
    expect(code).toBe(1);
  });

  it("does not call run or list for --stop", async () => {
    const { mock: docker, spies } = makeDockerMock();
    await run(["--stop", "my-container"], { docker, getToken: defaultGetToken });
    expect(spies.run).not.toHaveBeenCalled();
    expect(spies.list).not.toHaveBeenCalled();
  });
});

describe("main > run flow (image already exists)", () => {
  beforeEach(resetTokenMock);

  it("returns exit code 0 on successful run", async () => {
    const { mock: docker } = makeDockerMock({ imageExists: mock(async () => true) });
    const code = await run([], { docker, getToken: defaultGetToken });
    expect(code).toBe(0);
  });

  it("does not build when image exists and --build is not set", async () => {
    const { mock: docker, spies } = makeDockerMock({ imageExists: mock(async () => true) });
    await run([], { docker, getToken: defaultGetToken });
    expect(spies.build).not.toHaveBeenCalled();
  });

  it("calls DockerManager.run() with workspace and env", async () => {
    const { mock: docker, spies } = makeDockerMock({ imageExists: mock(async () => true) });
    await run([], { docker, getToken: defaultGetToken });
    expect(spies.run).toHaveBeenCalledTimes(1);
    const opts = spies.run.mock.calls[0][0] as RunOptions;
    expect(opts).toHaveProperty("workspace");
    expect(opts).toHaveProperty("env");
  });

  it("passes GH_TOKEN from getToken into run env", async () => {
    const getToken = mock(async () => "ghp_secret");
    const { mock: docker, spies } = makeDockerMock({ imageExists: mock(async () => true) });
    await run([], { docker, getToken });
    const opts = spies.run.mock.calls[0][0] as RunOptions;
    expect(opts.env!["GH_TOKEN"]).toBe("ghp_secret");
  });

  it("passes --name to DockerManager.run()", async () => {
    const { mock: docker, spies } = makeDockerMock({ imageExists: mock(async () => true) });
    await run(["--name", "my-instance"], { docker, getToken: defaultGetToken });
    const opts = spies.run.mock.calls[0][0] as RunOptions;
    expect(opts.name).toBe("my-instance");
  });

  it("passes piArgs to DockerManager.run() as additionalArgs", async () => {
    const { mock: docker, spies } = makeDockerMock({ imageExists: mock(async () => true) });
    await run(["--", "--provider", "anthropic"], { docker, getToken: defaultGetToken });
    const opts = spies.run.mock.calls[0][0] as RunOptions;
    expect(opts.additionalArgs).toEqual(["--provider", "anthropic"]);
  });

  it("returns exit code 1 when DockerManager.run() throws", async () => {
    const { mock: docker } = makeDockerMock({
      imageExists: mock(async () => true),
      run: mock(async () => { throw new Error("docker run failed"); }),
    });
    const code = await run([], { docker, getToken: defaultGetToken });
    expect(code).toBe(1);
  });
});

describe("main > run flow (image missing — auto build)", () => {
  beforeEach(resetTokenMock);

  it("builds before running when image does not exist", async () => {
    const { mock: docker, spies } = makeDockerMock({ imageExists: mock(async () => false) });
    await run([], { docker, getToken: defaultGetToken });
    expect(spies.build).toHaveBeenCalledTimes(1);
    expect(spies.run).toHaveBeenCalledTimes(1);
  });

  it("build is called before run (ordering)", async () => {
    const order: string[] = [];
    const buildSpy = mock(async () => { order.push("build"); });
    const runSpy = mock(async () => { order.push("run"); });
    const { mock: docker } = makeDockerMock({
      imageExists: mock(async () => false),
      build: buildSpy,
      run: runSpy,
    });
    await run([], { docker, getToken: defaultGetToken });
    expect(order).toEqual(["build", "run"]);
  });

  it("returns exit code 1 when build fails", async () => {
    const { mock: docker } = makeDockerMock({
      imageExists: mock(async () => false),
      build: mock(async () => { throw new Error("docker build failed"); }),
    });
    const code = await run([], { docker, getToken: defaultGetToken });
    expect(code).toBe(1);
  });

  it("does not run when build fails", async () => {
    const { mock: docker, spies } = makeDockerMock({
      imageExists: mock(async () => false),
      build: mock(async () => { throw new Error("docker build failed"); }),
    });
    await run([], { docker, getToken: defaultGetToken });
    expect(spies.run).not.toHaveBeenCalled();
  });
});

describe("main > run flow (--build flag forces rebuild)", () => {
  beforeEach(resetTokenMock);

  it("builds even when image already exists if --build is passed", async () => {
    const { mock: docker, spies } = makeDockerMock({ imageExists: mock(async () => true) });
    await run(["--build"], { docker, getToken: defaultGetToken });
    expect(spies.build).toHaveBeenCalledTimes(1);
  });

  it("still runs after a forced build", async () => {
    const { mock: docker, spies } = makeDockerMock({ imageExists: mock(async () => true) });
    await run(["--build"], { docker, getToken: defaultGetToken });
    expect(spies.run).toHaveBeenCalledTimes(1);
  });

  it("returns exit code 1 when forced build fails", async () => {
    const { mock: docker } = makeDockerMock({
      imageExists: mock(async () => true),
      build: mock(async () => { throw new Error("build error"); }),
    });
    const code = await run(["--build"], { docker, getToken: defaultGetToken });
    expect(code).toBe(1);
  });
});

describe("main > error handling", () => {
  it("returns exit code 1 on invalid arg combinations (--list + --name)", async () => {
    const { mock: docker } = makeDockerMock();
    const code = await run(["--list", "--name", "foo"], { docker, getToken: defaultGetToken });
    expect(code).toBe(1);
  });

  it("returns exit code 1 on --list + --stop combination", async () => {
    const { mock: docker } = makeDockerMock();
    const code = await run(["--list", "--stop", "foo"], { docker, getToken: defaultGetToken });
    expect(code).toBe(1);
  });

  it("returns exit code 1 on --stop + --name combination", async () => {
    const { mock: docker } = makeDockerMock();
    const code = await run(["--stop", "foo", "--name", "bar"], { docker, getToken: defaultGetToken });
    expect(code).toBe(1);
  });
});
