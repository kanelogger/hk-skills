---
title: AgentSkill学习笔记
date: 2024-01-01
tags: [Agent, Skills, AI架构, 学习笔记]
---

# AgentSkill学习笔记

![Agent\_Skills\_Progressive\_Capability\_Encapsulation-图片-0.jpg](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/64133b5a33e94c4cbd00e99de984ec98~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgS2FuZUxvZ2dlcg==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzY1MDAzNDMzMzkxNzAzMSJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1773915158&x-orig-sign=MVQN%2BS3V5ndcOMrEMgy4LFv8Ahs%3D)

## Agent Skills 是什么？

Agent Skills 本质上是一种渐进式披露的提示词机制。
我理解 Skills 其实是一种上下文工程。Skills 只是把垂直领域的知识、脚本调用方法等挂载到 Agent 的上下文窗口。

Skills 将提示词拆解为三个层级，通过“按需加载”降低 Token 消耗与复杂度：

*   元数据： 必须加载。类似书的“目录”。让 Agent 知道有哪些技能可用。
*   指令： 按需加载。类似书的“正文”。具体的执行步骤和 SOP。
*   资源： 按需加载。类似书的“附录”。模板、案例、规范文档。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/49ad196cfc8a485b9f3f47bc5a87c0c8~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgS2FuZUxvZ2dlcg==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzY1MDAzNDMzMzkxNzAzMSJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1773915158&x-orig-sign=ngoBANfm2iBYcjWWb6geqcHHD58%3D)
Skill 文件结构：

```sh
/.claude/skills/skill-name
    ├── SKILL.md    # 元数据+指令
    ├── scripts/    # 可执行脚本
    │   └── main.py
    ├── references/ # 补充文档（可选）
    │   └── doc.md
    └── assets/     # 素材资源
        └── pic.jpg
```

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/c0e569d5c6304cf196f1aae1187fcb85~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgS2FuZUxvZ2dlcg==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzY1MDAzNDMzMzkxNzAzMSJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1773915158&x-orig-sign=z9irFUV4tkTSs1tLkWUIE4KPNLk%3D)

### SKILL.md 分析

meta-data 元数据。最重要的部分。
描述部分这块最重要是写清楚 AI 应该在什么时机来调用这个 Skill。

```text
---
name: { { 技能名称 } }
description: { { 描述部分 } }
---

{{ 指令部分 }}
```

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/71c918dcbb2a4348ad4bf490b00384fb~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgS2FuZUxvZ2dlcg==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzY1MDAzNDMzMzkxNzAzMSJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1773915158&x-orig-sign=ojBU9rYe2hFOyzRlgCxzzCuTnCY%3D)

### 调用过程

1.  用户 → Claude Code（agent）: {task}-结合材料写作、校对文章用词。
2.  Claude Code（agent）→ 大模型：User{task};Available Skills: ....
3.  大模型 → Claude Code（agent）: Choose Skill: 写作
4.  【指令层 按需加载】Claude Code（agent）→ 大模型：SKILL.md
5.  【资源层 按需加载】大模型 → Claude Code（agent）：Read references/\*.md
6.  Claude Code（agent）→ 大模型：提供references/\*.md 中的内容
7.  大模型 → 用户：最终回答

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/9314764b2dc2441c870c468c20ecfbd8~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgS2FuZUxvZ2dlcg==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzY1MDAzNDMzMzkxNzAzMSJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1773915158&x-orig-sign=szcEKgavf0MNZpHiWrWP%2BSPSByk%3D)

### Agent Skills vs MCP vs Prompt

|         | Agent Skills |   MCP  |
| :-----: | :----------: | :----: |
|   侧重点   |      提示词     |  工具调用  |
|    类比   |    带目录的说明书   | 标准化工具箱 |
| Token消耗 |       低      |    高   |
|   核心主体  |   SKILL.md   |   软件包  |
|   编写难度  |       低      |    高   |

Skills 和 MCP 有什么区别？

1.  MCP 是一种开放标准的协议，关注的是 AI 如何以统一方式调用外部的工具、数据和服务，本身不定义任务逻辑或执行流程。
2.  Skill 则教 Agent 如何完整处理特定工作，它将执行方法、工具调用方式以及相关知识材料，封装为一个完整的「能力扩展包」，使 Agent 具备稳定、可复用的做事方法。

### Agent Skills vs. Workflow 工作流

两种不同的系统设计哲学：

*   Workflow (刚性系统)： “预设路径”。在设计时枚举所有节点与连接。稳定性高，但脆弱，一旦遇到未知情况容易崩溃。类似于传统的工业流水线、财务审批流程。
*   Agent + Skills (柔性系统)： “涌现路径”。设计时只定义原子能力（Skills），运行时由 Agent 根据上下文动态决策执行路径。具有极强的适应性和进化能力，类似于生物生态系统。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/021bca619e144483aa2d307734bffa3c~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgS2FuZUxvZ2dlcg==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzY1MDAzNDMzMzkxNzAzMSJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1773915158&x-orig-sign=E3trF3upqBO%2BqfI3bxpBi56EMEQ%3D)

## 技术实现

标准目录结构：在 `/.claude/skills` 下创建项目：

```sh
/.claude/skills/skill-name
    ├── SKILL.md        # 核心：元数据 + 指令
    ├── scripts/        # 可选：可执行脚本 (如 main.py)
    ├── references/     # 可选：补充文档 (如 规范.md)
    └── assets/         # 可选：素材资源 (如 模板.jpg)
```

SKILL.md 编写规范

```text
---
name: 文案大师 # 技能名称
description: 用于根据提供的材料撰写、校对和润色文章 # 描述（决定 AI 何时调用）
---

# 指令部分

这里写详细的 SOP、步骤要求、注意事项...
```

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/3a165a4668394e1aa6f8476f0388d750~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgS2FuZUxvZ2dlcg==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzY1MDAzNDMzMzkxNzAzMSJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1773915158&x-orig-sign=s%2BBAMneMXVUcg90V2LVylL%2FwlFU%3D)

## 实战指南：从安装到构建

### 1.环境准备

*   安装 Claude Code：
    *   macOS: `brew install --cask claude-code`
    *   Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`

### 2. 配置模型

推荐使用 [CC Switch](https://github.com/farion1231/cc-switch) 管理模型版本。

### 3. 创建 Skill

如何将一个任务转化为高质量的 Skill？
先判断是否是需要反复做的任务？如果只是一次就没必要做成Skill。因为 Skill 的核心价值在于复用。
再动手做几遍，沉淀最佳实践。思考记录哪些步骤是固定的？哪些地方容易出问题？什么样的输出质量最好？
具体操作：
让 Agent 帮你创建 Skill。新开一个会话，在支持 Skills 的 Agent 里把任务完整做一遍，做完后告诉它：把刚才的操作创建成一个 Skill，方便以后复用。
用 Skill 做任务，持续迭代优化。以后都用这个 Skill 来执行任务。每次完成后检查输出，哪里不满意就告诉 Agent，让它改进并更新 Skill。

简单来说就是：先人工跑通一遍任务，确认 SOP 无误后，告诉 Agent：“把刚才的操作创建成一个 Skill，方便以后复用。”

**快速创建技巧**

*   交互式创建： 使用 `/skill-creator` 工具辅助创建。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/a30dc7c610da48faa46a3fc755bcf245~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgS2FuZUxvZ2dlcg==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzY1MDAzNDMzMzkxNzAzMSJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1773915158&x-orig-sign=FrKuoOmwP5gT5sb8mV%2FLtlqge6s%3D)

## 深度思考：Skills 的长期价值

其实在写这篇文章的时候我心里就在想：随着模型变强，Skills 会过时吗？
写完之后我得到了一个答案是：肯定会过时。Skills 只是短期红利，随着模型变强，好的Skills会内置进模型里面。
![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/502239323741415fad63937c8b9fb8e3~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgS2FuZUxvZ2dlcg==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzY1MDAzNDMzMzkxNzAzMSJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1773915158&x-orig-sign=xiv1OUSb7fZkN8nQ8FtJWKVcKd8%3D)
**Skills 是短期的红利，但“能力”是长期的壁垒。**

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/a43faa1bbd774400a5d1e87dd1257755~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgS2FuZUxvZ2dlcg==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzY1MDAzNDMzMzkxNzAzMSJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1773915158&x-orig-sign=swxx2QPmQ6OSUr7Tb4hoE5jMv40%3D)

*   当下红利（效率）： Skills 是当前技术阶段的“最优解”，它是封装特定工作流的产品，能直接带来生产力提升。
*   真正壁垒（认知）： Skills 的具体形式可能会变（未来模型可能不需要这么显式的 Skill），但你在这个过程中练就的问题拆解能力、流程设计能力、人机协同经验，是不会贬值的资产。

所以我不应该只关注制作 Skill 这个动作，而要通过制作 Skill，**沉淀自己解决复杂问题**的思维模型，投资自己跨越周期的“问题解决能力”。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/9a5fc99919b844f1ab08d200ff54fc63~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgS2FuZUxvZ2dlcg==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzY1MDAzNDMzMzkxNzAzMSJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1773915158&x-orig-sign=7Gp8bBPZ6Df8GW%2FXv6BEwrmX8pI%3D)
