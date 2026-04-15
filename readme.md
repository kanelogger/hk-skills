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

全局启用（所有项目可用）：

```bash
./bin/hk-skill enable vetter --global
```

这会在 `runtime/global/vetter` 创建一条软链接，指向 `warehouse/local/vetter`。

全局禁用：

```bash
./bin/hk-skill disable vetter --global
```

为特定项目启用：

```bash
./bin/hk-skill enable vetter --project ./my-project
```

链接会创建在 `runtime/projects/my-project/vetter`。

### 4. 手动安全检查（Vet）

对已安装的技能重新执行安全扫描：

```bash
./bin/hk-skill vet vetter
```

会检测敏感信息泄露、危险命令（如 `curl | bash`、`eval()`）、环境变量读取等风险。

### 5. 安装新技能

从远程仓库安装（自动 git clone）：

```bash
./bin/hk-skill install https://github.com/user/some-skill
```

执行流程：`fetch → vet → adapt → register`。如果检查失败，会自动回滚并清理已下载的目录。

从本地路径安装：

```bash
./bin/hk-skill install ./local/path/to/my-skill --local
```

### 6. 适配技能 (Adapt)

手动对指定技能执行适配重写：

```bash
./bin/hk-skill adapt vetter
```

会根据当前 Agent 架构与操作系统重写 `SKILL.md` 中的 prompt，并将适配结果写入 `warehouse/adapted/<name>/SKILL.md`。

### 7. 在项目中使用

在你的 Agent 或项目配置里，引用 `runtime/` 下的软链接路径即可读取已启用的技能：

- 全局技能：`runtime/global/<skill-name>/SKILL.md`
- 项目技能：`runtime/projects/<project-name>/<skill-name>/SKILL.md`

例如，让 Agent 读取：

```
/Users/kanehua/project/hk-skills/runtime/global/vetter/SKILL.md
```

### 8. 查看帮助

```bash
./bin/hk-skill --help
```

### 注意事项

- `.gitignore` 已配置：`registry/`、`manifests/`、`warehouse/`、`runtime/` 等运行时生成的目录不会被提交到 Git。这样每台机器可以独立维护自己的启用状态。
- `init` 命令是幂等的，重复执行不会重复注册已有的技能。
- 当前已实现 Phase 1 核心功能（安装、列出、启用/禁用、迁移、更新）以及 P1 Advanced Vetter 和 P2 Adapter Prompt Rewriting。

---

## Phase 1 TODO / Deferred Features

以下功能在 Phase 1 中尚未实现，按优先级排列，计划后续迭代逐步补齐：

### P1 - 安全与开发者体验
- ✅ **Advanced Vetter**：增强安全检查（如敏感信息、环境变量泄露检测）。通过 `warehouse/local/advanced-vetter/` skill 实现，并新增 `./bin/hk-skill vet <name>` 命令支持手动复查。

### P2 - 适配与本地化
- ✅ **Adapter Prompt Rewriting**：已实现。通过 `warehouse/local/adapter/` skill 自动根据当前 Agent 架构与操作系统重写 skill prompt，`init` 时会自动扫描并注册该 skill。
```
帮我安装 skill，仓库地址是 {} 。这个 skill 原为 {Claude Code} 设计，安装前请先理解其核心原理和工作逻辑，再结合你的 Agent 架构与电脑环境进行适配，使其真正融入当前环境，而非生硬移植。
```

### P3 - 生态与高级功能
- Catalog：可搜索的 skill 目录。
