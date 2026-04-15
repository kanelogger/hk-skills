export interface Rule {
  id: string;
  description: string;
  pattern: RegExp;
  severity: "warning" | "error";
  fileFilter?: string[];
}

export const rules: Rule[] = [
  {
    id: "curl-pipe-shell",
    description: "Detects curl piped directly to bash/sh",
    pattern: /curl\s+[^\n]*\|\s*(ba)?sh\b/i,
    severity: "error",
  },
  {
    id: "wget-pipe-shell",
    description: "Detects wget piped directly to bash/sh",
    pattern: /wget\s+[^\n]*\|\s*(ba)?sh\b/i,
    severity: "error",
  },
  {
    id: "rm-rf-root",
    description: "Detects dangerous rm -rf / commands",
    pattern: /rm\s+-rf\s+\//i,
    severity: "error",
  },
  {
    id: "eval-usage",
    description: "Detects eval() usage",
    pattern: /\beval\s*\(\s*[^.\)\s]/i,
    severity: "error",
  },
  {
    id: "new-function",
    description: "Detects new Function() dynamic code execution",
    pattern: /\bnew\s+Function\s*\(/i,
    severity: "error",
  },
  {
    id: "child-process",
    description: "Detects child_process imports or usage",
    pattern: /['"]child_process['"]/,
    severity: "error",
  },
  {
    id: "ssh-directory",
    description: "Detects access to ~/.ssh directory",
    pattern: /~\/\.ssh/i,
    severity: "error",
  },
  {
    id: "aws-directory",
    description: "Detects access to ~/.aws directory",
    pattern: /~\/\.aws/i,
    severity: "error",
  },
  {
    id: "config-directory",
    description: "Detects access to ~/.config directory",
    pattern: /~\/\.config/i,
    severity: "error",
  },
  {
    id: "atob-decode",
    description: "Detects atob() base64 decoding",
    pattern: /\batob\s*\(/i,
    severity: "error",
  },
  {
    id: "buffer-base64",
    description: "Detects Buffer.from with base64 encoding",
    pattern: /Buffer\.from\s*\([^)]*,\s*['"]base64['"]\s*\)/i,
    severity: "error",
  },
  {
    id: "hardcoded-secret",
    description: "Detects hardcoded secrets (API_KEY, TOKEN, PASSWORD, SECRET)",
    pattern: /\b(API_KEY|ACCESS_KEY|AUTH_TOKEN|TOKEN|PASSWORD|SECRET|PRIVATE_KEY)\s*=\s*['"][^'"]+['"]/i,
    severity: "warning",
  },
  {
    id: "process-env",
    description: "Detects process.env reads",
    pattern: /process\.env\b/,
    severity: "warning",
  },
  {
    id: "dotenv-access",
    description: "Detects .env file access",
    pattern: /(^|\/)\.env\b/,
    severity: "warning",
  },
];

export const stopwords: string[] = [
  "example",
  "test",
  "placeholder",
  "dummy",
  "fake",
  "mock",
  "your_key_here",
  "sample",
  "template",
  "xxx",
];
