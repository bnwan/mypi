---
description: Turn a rough idea into a properly scoped GitHub issue
---

# Create New Issue

Turn this idea into a properly scoped GitHub issue: **$@**

## Steps

1. **Check for duplicates** — Search existing issues with similar keywords using:
   ```bash
   gh issue list --search "{{keywords from idea}}" --state all --limit 20
   ```
   If similar issues found, present them and ask if this is genuinely new.

2. **Clarify scope** — If unclear, ask 1-2 focused questions:
   - What does this cover?
   - What is explicitly out of scope?

3. **Draft the issue** with the following structure:

## Output Format

```markdown
## Problem Statement
{{clear description of what current state is and why it needs changing}}

## Proposed Solution
{{what the end state should look like}}

## Out of Scope
{{what this issue explicitly will NOT cover — prevents scope creep}}

## Acceptance Criteria
- [ ] {{measurable criterion 1}}
- [ ] {{measurable criterion 2}}
- [ ] {{measurable criterion 3}}

## Effort Estimate
{{small/medium/large}} — {{brief justification}}

## Related Issues/PRs
{{links to duplicates or dependencies}}
```

4. **Show for review** — Present the draft issue to the user and ask for confirmation before creating.

5. **Create issue** — Once confirmed:
   ```bash
   gh issue create --title "{{title}}" --body "{{body}}" --label "{{appropriate labels}}"
   ```

## Rules

- Never create an issue without user confirmation
- Always check for duplicates first
- Include at least 3 acceptance criteria
- Estimate effort conservatively (over-delivery is better than under-delivery)
- If the issue is a bug, add label "bug"
- If the issue is a feature, add label "feature" or "enhancement"
