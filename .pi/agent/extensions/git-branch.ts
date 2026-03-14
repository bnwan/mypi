import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { basename } from "node:path";

export default function (pi: ExtensionAPI) {
  let requestRender: (() => void) | undefined;

  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRender = () => tui.requestRender();

      const unsubBranch = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: () => {
          unsubBranch();
          requestRender = undefined;
        },
        invalidate() {},
        render(width: number): string[] {
          const fmt = (n: number) => {
            if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
            if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
            return `${n}`;
          };

          // ── Left: project name + git branch ──────────────────────────────
          const branch = footerData.getGitBranch();
          const projectName = basename(ctx.cwd);
          const leftParts: string[] = [];
          if (projectName) leftParts.push(projectName);
          if (branch) leftParts.push(branch);
          const leftStr =
            leftParts.length > 0
              ? theme.fg("accent", "  " + leftParts.join("  "))
              : "";

          // ── Center: model name + context usage ───────────────────────────
          const model = ctx.model;
          const usage = ctx.getContextUsage();

          const centerParts: string[] = [];
          if (model) centerParts.push(model.id);
          if (usage) {
            const tokStr = usage.tokens !== null ? fmt(usage.tokens) : "?";
            const pctStr =
              usage.percent !== null ? ` (${Math.round(usage.percent)}%)` : "";
            centerParts.push(`${tokStr}/${fmt(usage.contextWindow)}${pctStr}`);
          }

          const centerStr =
            centerParts.length > 0
              ? theme.fg("muted", centerParts.join("  "))
              : "";

          // ── Right: session cost + thinking level + turn count ─────────────
          let cost = 0;
          let turns = 0;
          for (const e of ctx.sessionManager.getBranch()) {
            if (e.type === "message" && e.message.role === "assistant") {
              const m = e.message as AssistantMessage;
              cost += m.usage.cost.total;
              turns++;
            }
          }

          const rightParts: string[] = [];
          rightParts.push(`$${cost.toFixed(3)}`);
          const thinking = pi.getThinkingLevel();
          if (thinking !== "off") rightParts.push(`think:${thinking}`);
          rightParts.push(`${turns}t`);

          const rightStr = theme.fg("dim", rightParts.join("  ") + "  ");

          // ── Three-column layout ───────────────────────────────────────────
          const leftWidth = visibleWidth(leftStr);
          const centerWidth = visibleWidth(centerStr);
          const rightWidth = visibleWidth(rightStr);

          // Center anchored at true horizontal midpoint
          const centerStart = Math.max(
            leftWidth + 1,
            Math.floor((width - centerWidth) / 2)
          );
          // Right flush to the right edge
          const rightStart = Math.max(
            centerStart + centerWidth + 1,
            width - rightWidth
          );

          const line =
            leftStr +
            " ".repeat(Math.max(0, centerStart - leftWidth)) +
            centerStr +
            " ".repeat(Math.max(0, rightStart - centerStart - centerWidth)) +
            rightStr;

          return [truncateToWidth(line, width)];
        },
      };
    });
  });

  // Re-render when the active model changes
  pi.on("model_select", () => {
    requestRender?.();
  });

  // Re-render after each agent run so cost / turns / context stay fresh
  pi.on("agent_end", () => {
    requestRender?.();
  });
}
