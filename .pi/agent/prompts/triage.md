# Triage Backlog

Analyze all open issues and PRs to provide a prioritized view of work items.

## Steps

1. Fetch all open issues and PRs using `gh`:
   - `gh issue list --state open --limit 100 --json number,title,labels,assignees,createdAt`
   - `gh pr list --state open --limit 100 --json number,title,labels,reviewStatus`

2. Categorize each item:
   - **Bugs**: labels containing "bug", "fix", "crash", "error"
   - **Features**: labels containing "feature", "enhancement"
   - **Improvements**: labels containing "improvement", "refactor", "perf"
   - **Chores**: labels containing "chore", "docs", "ci", "deps"

3. Estimate effort based on labels (if available) or title/description:
   - **Small**: < 2 hours — cosmetic fixes, typos, config changes
   - **Medium**: 2-8 hours — isolated feature additions, bug fixes
   - **Large**: > 8 hours — multi-file refactors, architectural changes

4. Determine status:
   - **Unstarted**: no assignee, no PR
   - **In Progress**: has assignee, no PR yet
   - **Has PR**: linked PR exists
   - **Stale**: no activity >14 days

## Output Format

```
# Backlog Triage — {{date}}

## 🐛 Bugs ({{count}})
| # | Title | Effort | Status | Priority |
|---|-------|--------|--------|----------|
| N | {{title}} | small/medium/large | unstarted/in-progress/has-pr | high/normal |

## ✨ Features ({{count}})
[table format as above]

## 🔧 Improvements ({{count}})
[table format as above]

## 🧹 Chores ({{count}})
[table format as above]

---

## 🎯 Suggested Next 3

1. **Issue #N**: {{title}} ({{effort}}) — {{reason}}
2. **Issue #N**: {{title}} ({{effort}}) — {{reason}}
3. **Issue #N**: {{title}} ({{effort}}) — {{reason}}

Reasoning: Prioritize blocking bugs, then high-impact features, then quick wins.
```

If backlog is empty, suggest: "Backlog clear! Use `/new-issue` to capture new work."
