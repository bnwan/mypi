# Parallel Issues

Given a target piece of functionality ($1), identify which open GitHub issues contribute to it and show how they can be worked in parallel.

## Steps

1. Check the current git remote to identify the GitHub repo
2. Determine the target functionality:
   - If `$1` is provided, use it as the goal
   - If not provided, infer the most significant in-progress or upcoming feature by scanning open issue titles, labels, and milestones
3. Fetch all open issues: `gh issue list --state open --limit 200 --json number,title,body,labels,assignees,milestone`
4. Filter issues relevant to the target functionality:
   - Match by keyword, label, milestone, or theme against the goal
   - Include issues that are prerequisites or enablers even if not directly named
5. Build a dependency graph:
   - Parse each issue body for "blocked by #N", "depends on #N", "after #N" language
   - Treat issues with no such references as independent
6. Group into parallel workstreams:
   - Issues with no dependencies on each other = can start immediately in parallel
   - Issues that depend on others = show after their blockers
7. Present as a workflow table followed by a sequencing note

## Output Format

```
# Parallel Issues — {{functionality_goal}}

> {{1-line description of the inferred or provided goal}}

## Workflow

| # | Issue | Title | Depends On | Can Start Now? |
|---|-------|-------|------------|----------------|
| 1 | #N    | {{title}} | —      | ✅ Yes         |
| 2 | #N    | {{title}} | —      | ✅ Yes         |
| 3 | #N    | {{title}} | #N     | ⏳ After #N    |
| 4 | #N    | {{title}} | #N, #N | ⏳ After #N, #N|

## Immediate Parallel Work
These issues have no blockers and can be picked up simultaneously right now:
- #N: {{title}}
- #N: {{title}}
- #N: {{title}}

## Sequenced Work
These issues must wait for dependencies to complete first:
- #N: {{title}} — waiting on #N
- #N: {{title}} — waiting on #N, #N
```

If no matching issues are found, report: "No open issues found matching '{{goal}}'. Use `/triage` to see all open work."
