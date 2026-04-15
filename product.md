# HK-Skills 设计文档（交付 Claude 执行版）

> 项目代号：HK-Skills
> 定位：面向 Agent 生态的 Skill 生命周期管理系统
> 目标：让 Skill 的安装、适配、启用、更新、隔离、治理形成标准化体系，而不是靠手工维护文件夹。

---

# 1. 项目目标

当前 Skill 使用模式存在五个核心问题：

1. **全局污染**：全局安装过多 Skill，占用上下文与认知带宽。
2. **项目失控**：不同项目 Skill 混杂，缺少隔离。
3. **第三方不兼容**：外部 Skill 为其他 Agent 设计，无法直接使用。
4. **更新脆弱**：本地修改与上游更新互相覆盖。
5. **无法治理**：不知道有哪些 Skill、谁在用、是否重复、是否过时。

HK-Skills 要解决的不是“如何多装几个 Skill”，而是：

> 如何让 10 个 Skill、100 个 Skill、1000 个 Skill 仍然可管理。

---

# 2. 核心设计原则

## 2.1 安装 ≠ 启用

Skill 存在于仓库，不代表进入运行环境。
只有启用中的 Skill 才参与上下文。

---

## 2.2 项目优先，全局极简

* 高频通用能力放全局
* 专用能力跟项目走

---

## 2.3 原始与适配分离

远程 Skill 必须保留原始副本。
适配后的版本单独输出，避免污染源代码。

---

## 2.4 元数据驱动，而非目录驱动

系统依赖 manifest + registry 管理状态，目录只是存储介质。

---

## 2.5 生命周期可追踪

每个 Skill 必须知道：

* 从哪来
* 当前状态
* 改过什么
* 被谁启用
* 是否可更新

---

# 3. 系统架构总览

```text
                    ┌─────────────────────┐
                    │   Remote Repos      │
                    └─────────┬───────────┘
                              │
                           Fetcher
                              │
                              ▼
                    ┌─────────────────────┐
                    │ warehouse/remote    │
                    └─────────┬───────────┘
                              │
                            Vetter
                              │
                            Adapter
                              │
                              ▼
                    ┌─────────────────────┐
                    │ warehouse/adapted   │
                    └─────────┬───────────┘
                              │
                           Registry
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
        runtime/global             runtime/projects/*
                 │                         │
              Agent Run              Project Run
```

---

# 4. 目录结构

```text
hk-skills/
├── registry/
│   ├── skills.json
│   ├── sources.json
│   └── projects.json
│
├── manifests/
│   └── *.yaml
│
├── warehouse/
│   ├── remote/
│   ├── adapted/
│   └── local/
│
├── runtime/
│   ├── global/
│   └── projects/
│
├── patches/
│
├── docs/
│
├── logs/
│
└── bin/
    └── hk-skill
```

---

# 5. 数据模型设计

---

# 5.1 Skill Manifest

每个 Skill 一个 manifest 文件。

示例：

```yaml
name: repo-analyzer
display_name: Repo Analyzer

source:
  type: remote
  repo: https://github.com/example/skills
  ref: main
  commit: abc123

status:
  stage: adapted
  quality: stable

scope:
  recommended: project

capabilities:
  - repo-read
  - dependency-analysis

triggers:
  - repo
  - codebase

dependencies:
  tools:
    - git
    - node>=20

adapter:
  target: hk-agent
  adapted_from: claude-code

localization:
  zh_cn: true

conflicts_with:
  - repo-reader

entry:
  file: SKILL.md
```

---

# 5.2 Registry：skills.json

负责系统级索引。

```json
{
  "repo-analyzer": {
    "manifest": "manifests/repo-analyzer.yaml",
    "installed": true,
    "enabled_global": false,
    "enabled_projects": ["my-app"],
    "updated_at": "2026-04-14T10:00:00Z"
  }
}
```

---

# 5.3 Registry：projects.json

```json
{
  "my-app": {
    "path": "/Users/me/projects/my-app",
    "skills": [
      "repo-analyzer",
      "git-helper"
    ]
  }
}
```

---

# 6. 生命周期状态机

```text
draft
↓
fetched
↓
vetted
↓
adapted
↓
installed
↓
enabled
↓
disabled / updated / deprecated
```

---

## 状态说明

| 状态         | 含义    |
| ---------- | ----- |
| draft      | 新建中   |
| fetched    | 已拉取   |
| vetted     | 已检查   |
| adapted    | 已适配   |
| installed  | 已纳入系统 |
| enabled    | 已启用   |
| disabled   | 禁用    |
| updated    | 已更新   |
| deprecated | 废弃    |

---

# 7. 核心模块设计

---

# 7.1 Fetcher

负责远程获取 Skill。

## 输入

```bash
hk-skill fetch <repo-url>
```

## 输出

* clone 到 `warehouse/remote/<skill>`
* 写入 sources.json
* 记录 commit / branch / tag

## 要求

* 支持重复执行（幂等）
* 已存在则 pull 更新
* 失败可回滚

---

# 7.2 Vetter

负责质量检查。

## 检查项

### 结构检查

* 是否存在入口文件
* 是否符合目录规范

### 冲突检查

* Skill 名冲突
* Trigger 冲突
* Capability 重复

### 安全检查

* 危险 shell 命令
* 删除系统目录
* 未声明依赖执行

### 环境检查

* 缺少工具链
* 版本不满足

## 输出

```json
{
  "passed": true,
  "warnings": [],
  "errors": []
}
```

---

# 7.3 Adapter

负责兼容转换。

## 典型场景

### Claude Code Skill → HK Skill

转换内容：

* Prompt 格式
* 文件结构
* 路径引用
* 命令执行方式
* Tool 声明方式

## 输出目录

```text
warehouse/adapted/<skill>
```

---

# 7.4 Localizer

负责增强可读性。

生成：

* 中文介绍
* 使用示例
* 标签
* 场景说明

---

# 7.5 Activator

控制运行态输出。

---

## 全局启用

```bash
hk-skill enable repo-analyzer --global
```

输出到：

```text
runtime/global/
```

---

## 项目启用

```bash
hk-skill enable repo-analyzer --project /path/to/app
```

输出到：

```text
runtime/projects/my-app/
```

---

## 技术实现

使用 symlink：

```bash
ln -s source target
```

---

# 7.6 Planner

根据项目上下文推荐 Skill 编排。

输入：

```bash
hk-skill plan ./my-project
```

输出：

* 推荐安装 Skill
* 缺失能力
* Skill 组合建议
* 可清理冗余 Skill

---

# 8. CLI 设计

---

# 初始化

```bash
hk-skill init
```

创建目录结构与默认配置。

---

# 安装远程 Skill

```bash
hk-skill install <repo-url>
```

执行：

```text
fetch → vet → adapt → register
```

---

# 安装本地 Skill

```bash
hk-skill add ./my-skill
```

---

# 查询

```bash
hk-skill list
hk-skill info <name>
hk-skill search <keyword>
```

---

# 启用 / 禁用

```bash
hk-skill enable <name>
hk-skill disable <name>
```

---

# 更新

```bash
hk-skill update <name>
hk-skill update --all
```

---

# 清理

```bash
hk-skill remove <name>
hk-skill prune
```

---

# 诊断

```bash
hk-skill doctor
```

检查：

* 软链接失效
* registry 异常
* 缺失 manifest
* 冲突 Skill
* 环境依赖缺失

---

# 9. 更新机制设计

禁止粗暴删除重装。

采用增量策略：

```text
pull upstream
↓
compare diff
↓
apply local patch
↓
re-vet
↓
re-adapt
↓
hot replace
```

---

## Patch 机制

本地修改统一存放：

```text
patches/<skill>/*.patch
```

更新时自动重放。

---

# 10. Catalog 文档系统

命令：

```bash
hk-skill catalog
```

生成：

```text
docs/catalog.md
```

字段：

| 名称 | 来源 | 状态 | 能力 | 作用域 | Trigger |
| -- | -- | -- | -- | --- | ------- |

---

# 11. 配置系统

---

# config.yaml

```yaml
paths:
  root: ~/.hk-skills

defaults:
  enable_scope: project

runtime:
  symlink: true

language:
  default: zh-CN
```

---

# 12. MVP 开发计划（建议执行顺序）

---

# Phase 1：基础可用版

目标：先跑起来。

## 任务

* CLI 骨架
* init
* install
* list
* enable
* disable
* symlink runtime
* registry 持久化

---

# Phase 2：治理能力

* manifest 校验
* vetter
* doctor
* catalog

---

# Phase 3：高级能力

* adapter
* update
* patch
* planner

---

# Phase 4：产品化

* Web UI
* Marketplace
* 使用统计
* 推荐系统

---

# 13. 技术选型建议

## 推荐语言

TypeScript（CLI + 文件系统生态成熟）

---

## 依赖库

```text
commander      CLI
fs-extra       文件操作
yaml           配置解析
chalk          输出美化
ora            loading
execa          shell 执行
zod            数据校验
sqlite(optional)
```

---

# 14. 工程要求（给 Claude）

## 代码结构必须模块化

```text
src/
├── commands/
├── core/
├── services/
├── models/
├── utils/
└── index.ts
```

---

## 必须满足

* 幂等执行
* 可测试
* 可扩展
* 错误信息清晰
* 日志完整
* 支持 Mac/Linux

---

# 15. 成功标准

当以下场景成立，项目算成功：

### 场景一

用户安装 50 个 Skill，仍能清楚知道：

* 装了什么
* 谁启用了
* 哪些过期了

### 场景二

切换项目时，Skill 自动隔离。

### 场景三

第三方 Skill 可自动适配本地环境。

### 场景四

更新上游 Skill 时，本地修改不丢失。

---

# 16. 一句话定义

> HK-Skills 不是 Skill 文件夹管理器，而是 Agent Skill 的操作系统级基础设施。

---

# 17. 最终指令

请基于本设计文档输出：

1. 技术实施方案
2. 项目目录结构
3. Phase 1 开发任务拆解
4. CLI 命令实现清单
5. 数据结构定义
6. 关键代码文件模板
7. 直接开始编码

不要重写需求文档，直接进入工程执行。