/**
 * Integration tests for src/main.ts
 *
 * Tests the `run()` function which orchestrates all components.
 * Docker, token, and fs calls are injected via the `deps` parameter so no
 * real Docker daemon, gh CLI, or filesystem writes are required, and no
 * module-level mocks bleed into other test files.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test";
import { run } from "./main";
import type { DockerManagerLike } from "./main";
import type { ContainerInfo, RunOptions } from "./docker/DockerManager";

// ── Mock factory ───────────────────────────────────────────────────────────

/**
 * Build a DockerManagerLike mock where every method can be individually
 * overridden. The returned `spies` object always references the *actual*
 * function wired into the mock — so asserting `spies.build.toHaveBeenCalled`
 * is always correct regardless of whether an override was supplied.
 */
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
  const merged = {
    build:       overrides.build       ?? mock(async (_path: string) => {}),
    imageExists: overrides.imageExists ?? mock(async () => true),
    run:         overrides.run         ?? mock(async (_opts: RunOptions) => {}),
    list:        overrides.list        ?? mock(async (): Promise<ContainerInfo[]> => []),
    stop:        overrides.stop        ?? mock(async (_name: string) => {}),
  };

  return { mock: merged, spies: merged };
}

/** A no-op mkdirp stub shared across all tests */
const mkdirpStub = mock((_dir: string) => {});

function makeDefaultDeps(dockerOverrides: Partial<DockerManagerLike> = {}, getToken = mock(async () => "test-gh-token")) {
  const { mock: docker, spies } = makeDockerMock(dockerOverrides);
  return { docker, spies, getToken, mkdirp: mkdirpStub };
}

beforeEach(() => {
  mkdirpStub.mockReset();
  mkdirpStub.mockImplementation((_dir: string) => {});
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("main > --help", () => {
  it("returns exit code 0 for --help", async () => {
    const { docker, getToken } = makeDefaultDeps();
    const code = await run(["--help"], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(0);
  });

  it("returns exit code 0 for -h", async () => {
    const { docker, getToken } = makeDefaultDeps();
    const code = await run(["-h"], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(0);
  });

  it("does not call DockerManager for --help", async () => {
    const { docker, spies, getToken } = makeDefaultDeps();
    await run(["--help"], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.run).not.toHaveBeenCalled();
    expect(spies.list).not.toHaveBeenCalled();
    expect(spies.stop).not.toHaveBeenCalled();
    expect(spies.build).not.toHaveBeenCalled();
  });
});

describe("main > --list flow", () => {
  it("returns exit code 0 when no containers are running", async () => {
    const { docker, getToken } = makeDefaultDeps({ list: mock(async () => []) });
    const code = await run(["--list"], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(0);
  });

  it("calls DockerManager.list()", async () => {
    const { docker, spies, getToken } = makeDefaultDeps();
    await run(["--list"], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.list).toHaveBeenCalledTimes(1);
  });

  it("returns exit code 0 with running containers", async () => {
    const { docker, getToken } = makeDefaultDeps({
      list: mock(async (): Promise<ContainerInfo[]> => [
        { id: "abc123", name: "my-container", state: "running", image: "mypi-dev" },
      ]),
    });
    const code = await run(["--list"], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(0);
  });

  it("returns exit code 1 when list throws", async () => {
    const { docker, getToken } = makeDefaultDeps({
      list: mock(async () => { throw new Error("docker ps failed"); }),
    });
    const code = await run(["--list"], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(1);
  });

  it("does not call run or stop for --list", async () => {
    const { docker, spies, getToken } = makeDefaultDeps();
    await run(["--list"], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.run).not.toHaveBeenCalled();
    expect(spies.stop).not.toHaveBeenCalled();
  });
});

describe("main > --stop flow", () => {
  it("returns exit code 0 on successful stop", async () => {
    const { docker, getToken } = makeDefaultDeps();
    const code = await run(["--stop", "my-container"], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(0);
  });

  it("calls DockerManager.stop() with the container name", async () => {
    const { docker, spies, getToken } = makeDefaultDeps();
    await run(["--stop", "my-container"], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.stop).toHaveBeenCalledTimes(1);
    expect(spies.stop).toHaveBeenCalledWith("my-container");
  });

  it("returns exit code 1 when stop throws", async () => {
    const { docker, getToken } = makeDefaultDeps({
      stop: mock(async () => { throw new Error("docker rm -f failed"); }),
    });
    const code = await run(["--stop", "my-container"], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(1);
  });

  it("does not call run or list for --stop", async () => {
    const { docker, spies, getToken } = makeDefaultDeps();
    await run(["--stop", "my-container"], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.run).not.toHaveBeenCalled();
    expect(spies.list).not.toHaveBeenCalled();
  });
});

describe("main > run flow (image already exists)", () => {
  it("returns exit code 0 on successful run", async () => {
    const { docker, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    const code = await run([], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(0);
  });

  it("does not build when image exists and --build is not set", async () => {
    const { docker, spies, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run([], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.build).not.toHaveBeenCalled();
  });

  it("calls DockerManager.run() with workspace and env", async () => {
    const { docker, spies, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run([], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.run).toHaveBeenCalledTimes(1);
    const opts = spies.run.mock.calls[0][0] as RunOptions;
    expect(opts).toHaveProperty("workspace");
    expect(opts).toHaveProperty("env");
  });

  it("passes a custom --workspace value to DockerManager.run()", async () => {
    const { docker, spies, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run(["--workspace", "/custom/path"], { docker, getToken, mkdirp: mkdirpStub });
    const opts = spies.run.mock.calls[0][0] as RunOptions;
    expect(opts.workspace).toBe("/custom/path");
  });

  it("passes GH_TOKEN from getToken into run env", async () => {
    const getToken = mock(async () => "ghp_secret");
    const { docker, spies } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run([], { docker, getToken, mkdirp: mkdirpStub });
    const opts = spies.run.mock.calls[0][0] as RunOptions;
    expect(opts.env!["GH_TOKEN"]).toBe("ghp_secret");
  });

  it("mirrors GH_TOKEN into GITHUB_TOKEN for compatibility", async () => {
    const getToken = mock(async () => "ghp_secret");
    const { docker, spies } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run([], { docker, getToken, mkdirp: mkdirpStub });
    const opts = spies.run.mock.calls[0][0] as RunOptions;
    expect(opts.env!["GITHUB_TOKEN"]).toBe("ghp_secret");
  });

  it("omits GH_TOKEN and GITHUB_TOKEN from env when token is empty", async () => {
    const getToken = mock(async () => "");
    const { docker, spies } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run([], { docker, getToken, mkdirp: mkdirpStub });
    const opts = spies.run.mock.calls[0][0] as RunOptions;
    expect(opts.env!["GH_TOKEN"]).toBeUndefined();
    expect(opts.env!["GITHUB_TOKEN"]).toBeUndefined();
  });

  it("passes --name to DockerManager.run()", async () => {
    const { docker, spies, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run(["--name", "my-instance"], { docker, getToken, mkdirp: mkdirpStub });
    const opts = spies.run.mock.calls[0][0] as RunOptions;
    expect(opts.name).toBe("my-instance");
  });

  it("passes piArgs to DockerManager.run() as additionalArgs", async () => {
    const { docker, spies, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run(["--", "--provider", "anthropic"], { docker, getToken, mkdirp: mkdirpStub });
    const opts = spies.run.mock.calls[0][0] as RunOptions;
    expect(opts.additionalArgs).toEqual(["--provider", "anthropic"]);
  });

  it("returns exit code 1 when DockerManager.run() throws", async () => {
    const { docker, getToken } = makeDefaultDeps({
      imageExists: mock(async () => true),
      run: mock(async () => { throw new Error("docker run failed"); }),
    });
    const code = await run([], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(1);
  });

  it("calls mkdirp on the config dir before docker.run()", async () => {
    const mkdirp = mock((_dir: string) => {});
    const { docker, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run([], { docker, getToken, mkdirp });
    expect(mkdirp).toHaveBeenCalledTimes(1);
    const dir = (mkdirp.mock.calls[0] as [string])[0];
    expect(dir).toContain(".mypi/agent");
  });

  it("returns exit code 1 when getToken throws", async () => {
    const getToken = mock(async () => { throw new Error("auth error"); });
    const { docker } = makeDefaultDeps({ imageExists: mock(async () => true) });
    const code = await run([], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(1);
  });
});

describe("main > run flow (image missing — auto build)", () => {
  it("builds before running when image does not exist", async () => {
    const { docker, spies, getToken } = makeDefaultDeps({ imageExists: mock(async () => false) });
    await run([], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.build).toHaveBeenCalledTimes(1);
    expect(spies.run).toHaveBeenCalledTimes(1);
  });

  it("build is called before run (ordering)", async () => {
    const order: string[] = [];
    const { docker, getToken } = makeDefaultDeps({
      imageExists: mock(async () => false),
      build: mock(async () => { order.push("build"); }),
      run: mock(async () => { order.push("run"); }),
    });
    await run([], { docker, getToken, mkdirp: mkdirpStub });
    expect(order).toEqual(["build", "run"]);
  });

  it("returns exit code 1 when build fails", async () => {
    const { docker, getToken } = makeDefaultDeps({
      imageExists: mock(async () => false),
      build: mock(async () => { throw new Error("docker build failed"); }),
    });
    const code = await run([], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(1);
  });

  it("does not run when build fails", async () => {
    const { docker, spies, getToken } = makeDefaultDeps({
      imageExists: mock(async () => false),
      build: mock(async () => { throw new Error("docker build failed"); }),
    });
    await run([], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.run).not.toHaveBeenCalled();
  });
});

describe("main > run flow (--build flag forces rebuild)", () => {
  it("builds even when image already exists if --build is passed", async () => {
    const { docker, spies, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run(["--build"], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.build).toHaveBeenCalledTimes(1);
  });

  it("does not call imageExists() when --build is set (short-circuit)", async () => {
    const { docker, spies, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run(["--build"], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.imageExists).not.toHaveBeenCalled();
  });

  it("still runs after a forced build", async () => {
    const { docker, spies, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run(["--build"], { docker, getToken, mkdirp: mkdirpStub });
    expect(spies.run).toHaveBeenCalledTimes(1);
  });

  it("returns exit code 1 when forced build fails", async () => {
    const { docker, getToken } = makeDefaultDeps({
      imageExists: mock(async () => true),
      build: mock(async () => { throw new Error("build error"); }),
    });
    const code = await run(["--build"], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(1);
  });

  it("build is called with a path ending in 'Dockerfile'", async () => {
    const { docker, spies, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run(["--build"], { docker, getToken, mkdirp: mkdirpStub });
    const dockerfilePath = (spies.build.mock.calls[0] as [string])[0];
    expect(dockerfilePath).toMatch(/Dockerfile$/);
  });

  it("calls syncConfig before build when --build is passed", async () => {
    const order: string[] = [];
    const syncConfig = mock(async () => { order.push("sync"); });
    const { docker, getToken } = makeDefaultDeps({
      imageExists: mock(async () => true),
      build: mock(async () => { order.push("build"); }),
    });
    await run(["--build"], { docker, getToken, mkdirp: mkdirpStub, syncConfig });
    expect(order).toEqual(["sync", "build"]);
  });

  it("calls syncConfig before auto-build when image is missing", async () => {
    const order: string[] = [];
    const syncConfig = mock(async () => { order.push("sync"); });
    const { docker, getToken } = makeDefaultDeps({
      imageExists: mock(async () => false),
      build: mock(async () => { order.push("build"); }),
    });
    await run([], { docker, getToken, mkdirp: mkdirpStub, syncConfig });
    expect(order).toEqual(["sync", "build"]);
  });

  it("does not call syncConfig when no build is needed", async () => {
    const syncConfig = mock(async () => {});
    const { docker, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    await run([], { docker, getToken, mkdirp: mkdirpStub, syncConfig });
    expect(syncConfig).not.toHaveBeenCalled();
  });

  it("returns exit code 1 when syncConfig throws", async () => {
    const syncConfig = mock(async () => { throw new Error("sync failed"); });
    const { docker, getToken } = makeDefaultDeps({ imageExists: mock(async () => true) });
    const code = await run(["--build"], { docker, getToken, mkdirp: mkdirpStub, syncConfig });
    expect(code).toBe(1);
  });
});

describe("main > error handling", () => {
  it("returns exit code 1 on invalid arg combinations (--list + --name)", async () => {
    const { docker, getToken } = makeDefaultDeps();
    const code = await run(["--list", "--name", "foo"], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(1);
  });

  it("returns exit code 1 on --list + --stop combination", async () => {
    const { docker, getToken } = makeDefaultDeps();
    const code = await run(["--list", "--stop", "foo"], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(1);
  });

  it("returns exit code 1 on --stop + --name combination", async () => {
    const { docker, getToken } = makeDefaultDeps();
    const code = await run(["--stop", "foo", "--name", "bar"], { docker, getToken, mkdirp: mkdirpStub });
    expect(code).toBe(1);
  });
});
