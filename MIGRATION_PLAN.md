# Mypi Bun Migration Plan

## Overview
Migrate the `mypi` shell script to a proper Bun/TypeScript codebase with modular architecture and TDD.

## Directory Structure

```
.
├── src/
│   ├── main.ts              # Entry point
│   ├── cli/
│   │   ├── parseArgs.ts     # CLI argument parser
│   │   ├── parseArgs.test.ts
│   │   └── index.ts         # Re-exports
│   ├── docker/
│   │   ├── DockerManager.ts # Docker operations
│   │   ├── DockerManager.test.ts
│   │   └── index.ts
│   ├── config/
│   │   ├── paths.ts         # Path resolution
│   │   ├── paths.test.ts
│   │   ├── tokens.ts        # GH_TOKEN resolution
│   │   ├── tokens.test.ts
│   │   └── index.ts
│   └── utils/
│       ├── exec.ts          # Shell execution helpers
│       ├── exec.test.ts
│       └── index.ts
├── bin/
│   └── mypi                 # Executable wrapper
├── package.json
├── tsconfig.json
└── README.md
```

## Component Breakdown

### 1. CLI Argument Parser (`src/cli/parseArgs.ts`)
**Responsibilities:**
- Parse command line arguments
- Handle `--name`, `--workspace`, `--build`, `--list`, `--stop`, `--help`
- Separate mypi options from passthrough args to pi
- Validate inputs

**Test Cases:**
- Parse named instance flag
- Parse workspace path (relative and absolute)
- Parse build flag
- Parse list command
- Parse stop command with name
- Handle help flag
- Reject invalid combinations
- Collect remaining args for pi

### 2. Docker Manager (`src/docker/DockerManager.ts`)
**Responsibilities:**
- Build Docker image
- Check if image exists
- Run container (named vs unnamed)
- List running containers
- Stop/remove container

**Test Cases:**
- Build image calls docker build with correct args
- Check image existence (mock docker)
- Run with name generates correct command
- Run without name includes --rm
- List calls docker ps with correct filter
- Stop calls docker stop and rm
- Mount volumes correctly formatted
- Environment variables passed correctly

### 3. Path Configuration (`src/config/paths.ts`)
**Responsibilities:**
- Resolve config directory (~/.mypi/agent)
- Resolve workspace path (absolute/relative)
- Resolve script directory

**Test Cases:**
- Expand home directory tilde
- Make relative paths absolute
- Handle already-absolute paths
- Handle edge cases (empty, special chars)

### 4. Token Resolver (`src/config/tokens.ts`)
**Responsibilities:**
- Resolve GH_TOKEN precedence (GH_TOKEN > GITHUB_TOKEN > gh cli)
- Execute gh auth token command

**Test Cases:**
- Return explicit GH_TOKEN if set
- Fall back to GITHUB_TOKEN
- Execute gh CLI when available
- Return empty string when none available
- Handle gh CLI command failure gracefully

### 5. Execution Utilities (`src/utils/exec.ts`)
**Responsibilities:**
- Execute shell commands
- Capture stdout/stderr
- Handle errors

**Test Cases:**
- Execute command returns stdout
- Handle command not found
- Handle non-zero exit codes
- Timeout handling

### 6. Main Entry Point (`src/main.ts`)
**Responsibilities:**
- Orchestrate components
- Handle errors
- Exit with appropriate codes

**Test Cases:**
- List flow calls DockerManager.list()
- Stop flow calls DockerManager.stop()
- Run flow builds if needed, then runs
- Handle errors gracefully

## Implementation Phases

### Phase 1: Project Setup
1. Create `package.json` with bun runtime
2. Add TypeScript configuration
3. Set up test runner (bun:test)
4. Create directory structure
5. Add `.gitignore` for node_modules, dist

### Phase 2: Utilities (Foundation)
1. Implement `src/utils/exec.ts` with tests
2. Implement `src/config/paths.ts` with tests

### Phase 3: Configuration
1. Implement `src/config/tokens.ts` with tests
2. All token resolution logic covered

### Phase 4: Docker Layer
1. Implement `src/docker/DockerManager.ts` with tests
2. Mock `$` for docker commands or use exec mock

### Phase 5: CLI Parser
1. Implement `src/cli/parseArgs.ts` with tests
2. Comprehensive argument handling

### Phase 6: Integration (main.ts)
1. Implement `src/main.ts`
2. Integration tests for full flows

### Phase 7: Wrapper & Finalization
1. Create `bin/mypi` wrapper script
2. Update README with new usage
3. Remove old shell script

## Testing Approach

**Test Framework:** `bun:test` (built-in)

**Structure:**
- Every implementation file has adjacent `.test.ts` file
- Tests co-located with source: `Component.ts` next to `Component.test.ts`

**Mocking Strategy:**
- Mock `$` template literal for shell commands using `mock.module` or dependency injection
- Use temp directories for file system tests
- Mock environment variables

**Coverage Goals:**
- 100% coverage for utils and config
- 90%+ coverage for DockerManager
- All edge cases tested

## Dependencies

**Runtime:**
- `bun` (no additional runtime deps needed)

**Development:**
- `@types/bun` (if needed)
- TypeScript

## Script Commands (package.json)

```json
{
  "scripts": {
    "build": "tsc",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "dev": "bun run src/main.ts",
    "lint": "tsc --noEmit",
    "install:global": "bun link"
  }
}
```

## Migration Checklist

- [x] Phase 1 complete - Project structure
- [x] Phase 2 complete - Utilities with tests
- [x] Phase 3 complete - Config with tests
- [x] Phase 4 complete - Docker with tests
- [x] Phase 5 complete - CLI with tests
- [x] Phase 6 complete - Main integration
- [x] Phase 7 complete - Wrapper & docs
- [x] All existing functionality preserved
- [x] Tests passing in CI
- [x] Old shell script removed
