---
name: release-manager
description: Full release process from version bump to GitHub release. Use when shipping releases, tagging versions, or managing changelogs. Interactive — always confirms before making changes.
---

# Release Manager

Manages the full release process from merged code to a tagged GitHub release. Interactive — confirms version number and changelog with user before making permanent changes.

## When to Use

- When shipping a new release
- After significant features are merged
- On a regular release cadence

## Process

### 1. Pre-Flight Checks
Before anything else, verify:

```bash
# Working directory clean
git status

# On main branch (or default)
git branch --show-current

# No open PRs blocking release
gh pr list --state open --label "blocking-release"

# CI passing on main
gh run list --branch main --limit 5
```

If any check fails, abort and report: "Release blocked: {{reason}}"

### 2. Version Calculation

```bash
# Detect current version
CURRENT=$(node -p "require('./package.json').version" 2>/dev/null || git describe --tags --abbrev=0)

# Calculate next version based on release type
# major: breaking changes → X.0.0
# minor: features → 0.X.0
# patch: fixes → 0.0.X
```

Ask user: **Major / Minor / Patch / Custom?**
Show: `Current: {{current}} → Next: {{calculated}}`

### 3. Changelog Generation

```bash
# Get merged PRs since last tag
gh pr list --state merged --search "merged:>{{last_tag_date}}" --json number,title,labels,mergedAt
```

Group by type:
- **Breaking** — label: `breaking`
- **Features** — label: `feature`, `enhancement`
- **Fixes** — label: `bug`, `fix`
- **Docs** — label: `docs`
- **Chores** — label: `chore`, `ci`, `deps`

### 4. User Confirmation

Show everything before writing:

```
# Release Preview

Version: {{current}} → {{next}}

## Changelog
### Breaking Changes
- {{pr}} — {{title}}

### Features
- {{pr}} — {{title}}

### Fixes
- {{pr}} — {{title}}

### Docs & Chores
- {{pr}} — {{title}}

Milestone to close: {{milestone_name or "None"}}

Confirm release? (yes/no)
```

**NEVER proceed without explicit "yes"**

### 5. Release Execution

Once confirmed:

```bash
# Update CHANGELOG.md
# Update package.json version ( Bun doesn't have 'bun version', use sed or manual edit)
sed -i 's/"version": ".*"/"version": "{{version}}"/' package.json

# Commit
# [skip ci] prevents infinite loop
git add CHANGELOG.md package.json
git commit -m "chore(release): {{version}} [skip ci]"

# Tag
git tag -a v{{version}} -m "Release {{version}}"

# Push
git push origin main
git push origin v{{version}}

# Create GitHub Release
gh release create v{{version}} --title "{{version}}" --notes "{{changelog}}"

# Close milestone if specified
gh api repos/{owner}/{repo}/milestones/{number} -X PATCH -f state=closed
```

## Hard Rules

- **NEVER** tag without user confirmation
- **NEVER** release from a branch (must be main)
- **NEVER** release with failing CI
- **ALWAYS** update both CHANGELOG.md and package.json
- **ALWAYS** create a GitHub release (not just a tag)
- **ALWAYS** include "[skip ci]" in release commits

## Output Format

On success:
```
✅ Released {{version}}

- Tag: https://github.com/{owner}/{repo}/releases/tag/v{{version}}
- Changelog updated in CHANGELOG.md
- Milestone {{name}} closed
```

On failure:
```
❌ Release failed: {{reason}}

Rollback steps (if needed):
{{steps}}
```
