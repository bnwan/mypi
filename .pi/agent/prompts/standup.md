# Standup Report

Generate a daily standup report by analyzing recent GitHub activity in this repository.

## Steps

1. Check the current git remote to identify the GitHub repo
2. Use `gh` CLI to fetch:
   - Merged PRs from the last 24-48 hours (author:@me)
   - Closed issues from the last 24-48 hours (author:@me or assignee:@me)
   - Open PRs and their review status
   - Failing CI checks on open PRs
   - Stale PRs (no activity >7 days)
   - Highest priority open issues (label:priority/high or label:bug with no assignee)

## Output Format

```
# Daily Standup — {{date}}

## ✅ Done (Last 24-48h)
- PR #N: {{title}} ({{repository}}) — merged {{date}}
- Issue #N: {{title}} — closed {{date}}

## 🔄 In Progress
- PR #N: {{title}} — {{status}} ({{review_state}})
- Issue #N: {{title}} — assigned, {{progress_notes}}

## 🚨 Blocked / Needs Attention
- PR #N: {{title}} — {{blocker_reason}}
- PR #N: {{title}} — CI failing ({{failed_check}})

## 📋 Up Next (Suggested)
1. Issue #N: {{title}} ({{effort_estimate}}) — {{reasoning}}
2. Issue #N: {{title}} ({{effort_estimate}}) — {{reasoning}}
3. Issue #N: {{title}} ({{effort_estimate}}) — {{reasoning}}
```

If no activity found, report: "No recent activity detected. Use `/triage` to see open work."
