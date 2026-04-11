---
name: prompt-optimizer
description: |
  Optimize and improve LLM conversation prompts for better results. Analyze prompt weaknesses, add structured formatting, and apply model-specific best practices.
  Use when user says: "优化提示词", "调整提示词", "优化这个提示词", "帮我改进这个prompt", "improve this prompt", "optimize prompt".
---

# Prompt Optimizer

Optimize LLM prompts by analyzing issues, providing multiple optimization options, and delivering a final refined version.

## Workflow

### Step 1: Analyze the Original Prompt

Identify issues in these dimensions:

| Dimension | Check Points |
|-----------|--------------|
| **Clarity** | Vague terms? Ambiguous instructions? |
| **Structure** | Missing role/context/task/format? |
| **Specificity** | Lacks concrete examples or constraints? |
| **Output Control** | No format specification? Length undefined? |
| **Context** | Missing background or audience info? |

### Step 2: Select Appropriate Framework

Choose based on the prompt's purpose. See [references/frameworks.md](references/frameworks.md) for details.

| Scenario | Recommended Framework |
|----------|----------------------|
| General tasks | CO-STAR |
| Creative writing | RISEN |
| Complex reasoning | Chain-of-Thought |
| Role-based tasks | CRISPE |

### Step 3: Apply Gemini-Specific Optimizations

See [references/gemini-tips.md](references/gemini-tips.md) for Gemini model best practices.

### Step 4: Generate Output

Produce output in this structure:

```markdown
## 原始提示词分析

**存在的问题：**
1. [问题1]
2. [问题2]
...

## 优化方案

### 方案一：[框架名称] 风格
[优化后的提示词]

**优化要点：** [简述改进点]

### 方案二：[框架名称] 风格
[优化后的提示词]

**优化要点：** [简述改进点]

## 最终推荐版本

[综合最佳实践的最终优化版本]

**核心改进：**
- [改进点1]
- [改进点2]
```

## Quick Reference

### Essential Prompt Elements

```
[角色设定] 你是一位...
[背景上下文] 当前情况是...
[具体任务] 请帮我...
[约束条件] 需要注意...
[输出格式] 请以...格式输出
[示例] 例如...
```

### Common Issues → Fixes

| Issue | Fix |
|-------|-----|
| "帮我写个邮件" | Add recipient, purpose, tone, length |
| "解释一下X" | Specify audience level, depth, examples needed |
| "翻译这段话" | Define style, formality, preserve/adapt choices |
