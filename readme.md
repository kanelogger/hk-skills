# hk-skills

## 快速开始

### 1. 初始化（只需执行一次）

```bash
./bin/hk-skill init
```

这会：
- 创建 `registry/`、`manifests/`、`warehouse/`、`runtime/` 等运行时目录
- 自动扫描并注册 `warehouse/local/` 中的本地技能

### 2. 查看已安装的技能

```bash
./bin/hk-skill list
```

示例输出：

```
NAME              SOURCE   STAGE    ENABLED
----------------------------------------------------
prompt-optimizer  local    adapted  no
frontend-skill    local    adapted  no
vetter            local    adapted  no
...
```

### 3. 启用 / 禁用技能

**全局启用**（所有项目可用）：

```bash
./bin/hk-skill enable vetter --global
```

这会在 `runtime/global/vetter` 创建一条**软链接**，指向 `warehouse/local/vetter`。

**全局禁用**：

```bash
./bin/hk-skill disable vetter --global
```

**为特定项目启用**：

```bash
./bin/hk-skill enable vetter --project ./my-project
```

链接会创建在 `runtime/projects/my-project/vetter`。

### 4. 安装新技能

**从远程仓库安装**（自动 git clone）：

```bash
./bin/hk-skill install https://github.com/user/some-skill
```

执行流程：`fetch → vet → adapt → register`。如果检查失败，会自动回滚并清理已下载的目录。

**从本地路径安装**：

```bash
./bin/hk-skill install ./local/path/to/my-skill --local
```

### 5. 在项目中使用

在你的 Agent 或项目配置里，引用 `runtime/` 下的软链接路径即可读取已启用的技能：

- **全局技能**：`runtime/global/<skill-name>/SKILL.md`
- **项目技能**：`runtime/projects/<project-name>/<skill-name>/SKILL.md`

例如，让 Agent 读取：

```
/Users/kanehua/project/hk-skills/runtime/global/vetter/SKILL.md
```

### 6. 查看帮助

```bash
./bin/hk-skill --help
```

### 注意事项

- `.gitignore` 已配置：`registry/`、`manifests/`、`warehouse/`、`runtime/` 等运行时生成的目录**不会被提交到 Git**。这样每台机器可以独立维护自己的启用状态。
- `init` 命令是**幂等**的，重复执行不会重复注册已有的技能。
- 当前为 **Phase 1**，核心聚焦在技能的安装、列出、启用/禁用、迁移和更新。高级适配等功能尚未实现。

---

## Phase 1 TODO / Deferred Features

以下功能在 Phase 1 中尚未实现，按优先级排列，计划后续迭代逐步补齐：

### P1 - 安全与开发者体验
- **Advanced Vetter**：增强安全检查（如敏感信息、环境变量泄露检测）。通过skill去实现。 `warehouse/local/vetter`

### P2 - 适配与本地化
- **Adapter Prompt Rewriting**：根据当前 Agent 架构与操作系统自动重写 skill prompt。写成一个本地skill通过skill去实现。
```
帮我安装 skill，仓库地址是 {} 。这个 skill 原为 {Claude Code} 设计，安装前请先理解其核心原理和工作逻辑，再结合你的 Agent 架构与电脑环境进行适配，使其真正融入当前环境，而非生硬移植。
```
- **Chinese Localization Generation**：为全英文 skill 自动生成中文介绍文档。

### P3 - 生态与高级功能
- **Catalog**：可搜索的 skill 目录与发现机制。
- **Planner**：工作流编排与自动化建议。
