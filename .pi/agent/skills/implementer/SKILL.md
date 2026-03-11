---
name: implementer
description: Full implementation lifecycle with TDD. Use when implementing GitHub issues, writing features with tests, or pushing PRs. Includes workflow commands for /implement-issue and /address-pr-comments.
---

# Implementer

Handles the full implementation lifecycle: picking up a GitHub issue, writing code with TDD, running tests, pushing a PR, and addressing review comments.

## When to Use

- `/skill:implementer` before starting work
- When asked to implement an issue
- During any implementation task

## Commands

The implementer also provides these workflow commands:
- `/implement-issue {{number}}` — Full issue implementation
- `/address-pr-comments {{number}}` — Fix review feedback

## Process

### 1. Issue Analysis
- Read the GitHub issue: `gh issue view {{number}} --json number,title,body,labels,assignees`
- Check for linked PRs or existing work: `gh issue view {{number}} --json linkedPullRequests`
- Read AGENTS.md for project conventions

### 2. Planning Phase
Before writing code, create a brief plan:
```markdown
# Implementation Plan for Issue #N

## Approach
{{high-level approach — 2-3 sentences}}

## Files to Modify
- {{file1}} — {{reason}}
- {{file2}} — {{reason}}

## Files to Create
- {{file3}} — {{reason}}

## Test Strategy
- {{what to test and how}}

## Potential Risks
- {{risk1}} — {{mitigation}}
```
Show the plan to the user and wait for confirmation before proceeding.

### 3. Implementation (TDD Cycle)

#### Red Phase (Write failing test)
- Write a test that fails against current code
- Run test to confirm it fails
- Commit: `test: add failing test for {{feature}}`

#### Green Phase (Make it pass)
- Implement minimal code to pass the test
- Don't worry about elegance yet
- Run test to confirm it passes
- Commit: `feat: implement {{feature}}`

#### Refactor Phase (Clean up)
- Improve code quality without changing behavior
- Ensure tests still pass
- Commit: `refactor: {{description of improvements}}`

Repeat for each logical chunk of work.

### 4. Quality Gate
Before finishing, run:
1. Full test suite: `bun test` or check AGENTS.md for test command
2. Type check: `bun run typecheck` or `tsc --noEmit`
3. Lint: check AGENTS.md for lint command

If any fail, fix before pushing.

### 5. Push & PR

```bash
# Create isolated worktree
git worktree add ../auto-pr-issue-{{number}}
cd ../auto-pr-issue-{{number}}

# Push branch (auto-pr/ prefix triggers PR creation)
git checkout -b auto-pr/issue-{{number}}-{{short-description}}
git add .
git commit -m "feat: {{description}} [closes #{{number}}]"
git push origin auto-pr/issue-{{number}}-{{short-description}}

# Return to main worktree
git worktree remove ../auto-pr-issue-{{number}}
```

### 6. Update Issue
After PR is created, comment on the issue:
```
Implemented in PR #{{pr_number}}

Summary of changes:
- {{change1}}
- {{change2}}
- {{change3}}

Ready for review.
```

## Addressing Review Comments

When `/address-pr-comments {{number}}` is called:

1. Fetch all review comments:
   ```bash
   gh api repos/{owner}/{repo}/pulls/{{number}}/comments
   gh pr view {{number}} --json comments
   ```

2. Group by file/area and batch fixes

3. Make changes, test, commit: `fix: address PR review feedback`

4. Push and comment on PR:
   ```
   Addressed all review comments:
   - {{comment1}} → {{fix1}}
   - {{comment2}} → {{fix2}}
   ```

## Rules

- Always plan before implementing — prevents rework
- Never skip tests — TDD is enforced
- Branch must start with `auto-pr/` for auto-PR creation
- Quality gate must pass before pushing
- Update the issue with what was delivered
- One issue = one PR (don't batch multiple features)
