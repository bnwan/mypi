/**
 * Token resolution utilities
 * Provides GitHub token resolution with precedence handling:
 * GH_TOKEN > GITHUB_TOKEN > gh auth token > empty string
 */

import { execText } from "../utils/exec";

/**
 * Resolves a GitHub token following precedence order:
 * 1. GH_TOKEN environment variable
 * 2. GITHUB_TOKEN environment variable
 * 3. Output of `gh auth token` CLI command
 * 4. Empty string if none available
 *
 * @returns Promise resolving to the resolved token or empty string
 *
 * @example
 * ```typescript
 * const token = await resolveToken();
 * // Returns GH_TOKEN if set, else GITHUB_TOKEN, else gh CLI output, else ""
 * ```
 */
export async function resolveToken(): Promise<string> {
  // Priority 1: GH_TOKEN
  const ghToken = process.env.GH_TOKEN;
  if (ghToken && ghToken.trim() !== "") {
    return ghToken.trim();
  }

  // Priority 2: GITHUB_TOKEN
  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken && githubToken.trim() !== "") {
    return githubToken.trim();
  }

  // Priority 3: gh CLI
  try {
    const cliToken = await execText("gh", ["auth", "token"]);
    const trimmed = cliToken.trim();
    return trimmed;
  } catch {
    // gh CLI failed or not available, return empty string
    return "";
  }
}
