export interface RewriteContext {
  agent: string;
  os: string;
  sourceType: "local" | "remote" | "adapted";
}

export function rewriteSkillMd(content: string, context: RewriteContext): string {
  let result = content;

  result = result.replace(/\bClaude Code\b/g, context.agent);
  result = result.replace(/\bCursor\b/g, context.agent);
  result = result.replace(/\bGitHub Copilot\b/g, context.agent);
  result = result.replace(/\bCopilot\b/g, context.agent);

  if (context.os === "darwin" || context.os === "win32") {
    result = result.replace(/\/home\/user/g, "/Users/user");
  }

  if (context.os === "linux") {
    result = result.replace(/\/Users\/user/g, "/home/user");
  }

  return result;
}

export function deriveAgent(content: string): string | undefined {
  if (/\bClaude Code\b/i.test(content)) {
    return "claude-code";
  }
  if (/\bCursor\b/i.test(content)) {
    return "cursor";
  }
  if (/\bGitHub Copilot\b/i.test(content) || /\bCopilot\b/i.test(content)) {
    return "copilot";
  }
  return undefined;
}
