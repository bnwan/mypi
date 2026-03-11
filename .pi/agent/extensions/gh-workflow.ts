import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * GitHub Workflow Extension
 * 
 * Provides slash commands for GitHub-based workflows:
 * - /standup — Daily activity summary
 * - /triage — Prioritized backlog view
 * - /new-issue <idea> — Create scoped issue
 * - /sync-docs [PR#] — Sync documentation
 * - /implement-issue <number> — Implement issue with TDD
 * - /address-pr-comments <number> — Fix review feedback
 */

export default function (pi: ExtensionAPI) {
  const { registerCommand } = pi;

  /**
   * /standup — Daily GitHub activity summary
   */
  registerCommand("standup", {
    description: "Generate daily standup report from GitHub activity",
    handler: async (ctx) => {
      await ctx.agent.prompt(`
Run the standup workflow:

1. Identify the current repository using git remote
2. Use gh CLI to fetch recent activity:
   - Merged PRs in last 48h (author:me)
   - Closed issues in last 48h
   - Open PRs with review status
   - Failing CI, stale PRs
3. Categorize into: Done, In Progress, Blocked, Up Next
4. Present in a clean markdown format

If no gh CLI available, report that GitHub CLI is required.
`);
    },
  });

  /**
   * /triage — Backlog prioritization
   */
  registerCommand("triage", {
    description: "Show prioritized backlog of open issues and PRs",
    handler: async (ctx) => {
      await ctx.agent.prompt(`
Run the triage workflow:

1. Fetch all open issues and PRs using gh
2. Categorize:
   - Bugs (label: bug)
   - Features (label: feature, enhancement)
   - Improvements (label: improvement, refactor)
   - Chores (label: docs, ci, chore)
3. Estimate effort (small/medium/large) based on titles/labels
4. Determine status (unstarted, in-progress, has-pr, stale)
5. Recommend next 3 items with reasoning

Present in a table format with suggested priority order.
`);
    },
  });

  /**
   * /new-issue <idea> — Create scoped issue
   */
  registerCommand("new-issue", {
    description: "Turn a rough idea into a properly scoped GitHub issue",
    args: [
      { name: "idea", description: "Short description of the idea", required: true },
    ],
    handler: async (ctx, args) => {
      const idea = args.idea || "";
      
      await ctx.agent.prompt(`
Create a properly scoped GitHub issue for this idea:

"""${idea}"""

Steps:
1. Search for duplicates: gh issue list --search "${idea.split(' ').slice(0, 5).join(' ')}"
2. Draft issue with:
   - Problem Statement
   - Proposed Solution
   - Out of Scope
   - Acceptance Criteria (3-5 checkboxes)
   - Effort Estimate (small/medium/large)
3. Show draft to user for review
4. If confirmed: gh issue create --title "..." --body "..." --label ...

Ask for confirmation before creating anything.
`);
    },
  });

  /**
   * /sync-docs [PR#]
   */
  registerCommand("sync-docs", {
    description: "Audit and update documentation against code changes",
    args: [
      { name: "pr", description: "PR number to scope to (optional)", required: false },
    ],
    handler: async (ctx, args) => {
      const pr = args.pr;
      const scope = pr ? `PR #${pr}` : "changes since main";
      
      await ctx.agent.prompt(`
Sync documentation for ${scope}:

1. Identify changed files:
   ${pr 
     ? `gh pr view ${pr} --json files`
     : "git diff --name-only main...HEAD"
   }
2. Find all docs (README.md, docs/, CHANGELOG.md, JSDoc)
3. Map changed code to affected docs
4. Update only stale sections:
   - New APIs need documentation
   - Changed behavior needs updated examples
   - Deprecated features should be noted
5. Present report: what changed, what was updated, what needs manual review
`);
    },
  });

  /**
   * /implement-issue <number>
   */
  registerCommand("implement-issue", {
    description: "Implement a GitHub issue with TDD workflow",
    args: [
      { name: "issue", description: "Issue number to implement", required: true },
    ],
    handler: async (ctx, args) => {
      const issueNumber = args.issue;
      
      await ctx.agent.prompt(`
Implement GitHub issue #${issueNumber}:

1. Load the implementer skill context
2. Read issue: gh issue view ${issueNumber}
3. Plan the implementation (show to user, wait confirmation)
4. Create worktree: git worktree add ../auto-pr-issue-${issueNumber}
5. Switch to worktree and checkout branch: auto-pr/issue-${issueNumber}-...
6. Implement with TDD (Red → Green → Refactor)
7. Run quality gate: tests, typecheck, lint
8. Commit and push: git push origin auto-pr/issue-${issueNumber}-...
9. The auto-pr/ prefix will auto-create a PR
10. Update issue with PR link

Use /skill:implementer for detailed guidance.
`);
    },
  });

  /**
   * /address-pr-comments <number>
   */
  registerCommand("address-pr-comments", {
    description: "Fix review comments on a PR",
    args: [
      { name: "pr", description: "PR number to address", required: true },
    ],
    handler: async (ctx, args) => {
      const prNumber = args.pr;
      
      await ctx.agent.prompt(`
Address review comments on PR #${prNumber}:

1. Fetch all review comments:
   - gh api repos/{owner}/{repo}/pulls/${prNumber}/comments
   - gh pr view ${prNumber} --json comments
2. Fetch PR branch and checkout
3. Group comments by file/area
4. Implement fixes for each batch
5. Test: run full test suite
6. Commit: git commit -m "fix: address PR review feedback"
7. Push to same branch
8. Comment on PR summarizing fixes

Be thorough — address every comment before marking as resolved.
`);
    },
  });

  /**
   * /review-pr <number> — Subagent-style review
   */
  registerCommand("review-pr", {
    description: "Review a PR using code-reviewer skill (read-only)",
    args: [
      { name: "pr", description: "PR number to review", required: true },
    ],
    handler: async (ctx, args) => {
      const prNumber = args.pr;
      
      await ctx.agent.prompt(`
Review PR #${prNumber} as a read-only code reviewer:

1. Get PR details: gh pr view ${prNumber} --json files,title,body
2. Read all changed files
3. Analyze for:
   - CRITICAL: bugs, security, crashes
   - MAJOR: design issues, test gaps
   - MINOR: style, minor improvements
   - SUGGESTION: nice-to-haves
4. Output: prioritized list with file:line references
5. Verdict: APPROVE / REQUEST CHANGES / COMMENT

DO NOT modify any files. This is review-only.

Use /skill:code-reviewer for guidance.
`);
    },
  });

  console.log("[gh-workflow] Loaded GitHub workflow commands");
}
