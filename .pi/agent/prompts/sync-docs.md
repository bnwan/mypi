# Sync Documentation

Audit documentation against recent code changes and update anything stale or missing.

## Usage

- `/sync-docs` — diffs against main, audits all docs
- `/sync-docs 99` — scopes audit to specific PR #99

## Steps

1. **Identify changed files**:
   - If PR# provided: `gh pr view {{number}} --json files`
   - If no PR: `git diff --name-only main...HEAD` or compare against default branch

2. **Find all docs** in the repo:
   - Root: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `AGENTS.md`
   - `docs/` directory and subdirectories
   - JSDoc/TSDoc comments in source files
   - Any `.md` files

3. **Map changes to docs**:
   - Changed source files → check if API docs/JSDoc need updates
   - New exported functions/classes → check if README/docs mention them
   - Changed behavior → check if examples/usage docs are current
   - Modified endpoints/configs → check if setup docs need refresh

4. **Update only what's stale** — don't rewrite working docs:
   - Update outdated sections
   - Add documentation for new public APIs with no docs
   - Mark deprecated features (preserve but note deprecation)
   - Update examples if the code changed

5. **Report findings**:

## Output Format

```
# Documentation Sync Report

## Changed Files Analyzed
- {{file1}} ({{change_type}})
- {{file2}} ({{change_type}})

## Docs Updated
| File | Section | Change |
|------|---------|--------|
| README.md | API Reference | Added `newFunction()` documentation |
| docs/setup.md | Configuration | Updated option names |

## Docs Skipped (Current)
| File | Reason |
|------|--------|
| CONTRIBUTING.md | No relevant changes |

## Requires Manual Review
- {{file_or_topic}} — {{reason}}
```

## Rules

- Do not change code that already works
- Preserve existing doc structure — just patch the stale parts
- If README >2000 words, consider linking to a detailed docs/ page
- Always note deprecated features rather than deleting entirely
- Run this after merging PRs that add user-facing changes
