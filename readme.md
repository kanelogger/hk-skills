# HK-Skills

> 面向 Agent 生态的 Skill 生命周期管理系统。让 Skill 的安装、适配、启用、更新、隔离、治理形成标准化体系，而不是靠手工维护文件夹。

---

## 前置要求

- [Bun](https://bun.sh/) 运行时（本项目基于 Bun + TypeScript）

---

## 5 分钟快速开始：安装并使用一个远程 Skill

### 1. 初始化（只需执行一次）

进入项目目录，执行：

```bash
./bin/hk-skill init
```

这会自动创建以下目录结构：

```
.
├── registry/        # 技能注册表（JSON 格式）
├── manifests/       # 每个技能的元数据（YAML）
├── warehouse/       # 技能仓库
│   ├── remote/      # 从远程拉取的原始技能
│   ├── adapted/     # 适配后的技能副本
│   └── local/       # 本地技能
├── runtime/         # 运行时软链接
│   ├── global/      # 全局启用的技能
│   └── projects/    # 按项目隔离的技能
├── patches/         # 本地修改补丁（未来支持）
├── docs/            # 自动生成的文档
└── logs/            # 运行日志
```

同时，`init` 会扫描 `warehouse/local/`、`custom/`、`skills/` 中的已有技能并自动注册。

> **提示**：`init` 是幂等的，重复执行不会重复注册已有技能。

---

### 2. 安装远程 Skill

```bash
./bin/hk-skill install https://github.com/user/some-skill
```

执行流程：**fetch → vet → adapt → register**

1. **fetch**：从远程仓库 `git clone` 到 `warehouse/remote/some-skill`
2. **vet**：安全检查，扫描敏感命令、环境变量泄露等风险
3. **adapt**：自动适配到当前 Agent 架构和操作系统，生成副本到 `warehouse/adapted/some-skill`
4. **register**：写入 `registry/skills.json` 和 `manifests/some-skill.yaml`

如果检查失败，会自动回滚并清理已下载的目录。

---

### 3. 查看已安装的技能

```bash
./bin/hk-skill list
```

示例输出：

```
NAME              SOURCE   STAGE    ENABLED
----------------------------------------------------
frontend-skill    local    adapted  no
vetter            local    adapted  global
some-skill        remote   adapted  no
```

`ENABLED` 列显示该技能当前是否被启用：`no` 表示未启用，`global` 表示全局启用，其他值表示在特定项目中启用。

---

### 4. 启用 Skill

**全局启用**（当前机器所有项目都可用）：

```bash
./bin/hk-skill enable some-skill --global
```

这会在 `runtime/global/some-skill` 创建一条软链接，指向适配后的 `warehouse/adapted/some-skill`。

**为特定项目启用**（推荐，避免全局污染）：

```bash
./bin/hk-skill enable some-skill --project ./my-project
```

这会在项目本地创建一条可发现的技能链接：`./my-project/.agents/skills/some-skill/SKILL.md`（如果 `.agents/` 和 `.agents/skills/` 不存在会自动创建）。同时，系统会在内部 bookkeeping 路径 `runtime/projects/<canonical-id>/some-skill` 维护一条对应的软链接。

---

### 5. 在 Agent / 项目中使用

让你的 Agent 读取运行时路径中的 `SKILL.md`：

- 全局启用：`runtime/global/<skill-name>/SKILL.md`
- 项目启用：`<project>/.agents/skills/<skill-name>/SKILL.md`（用户可见的项目本地入口）

系统内部同时会在 `runtime/projects/<canonical-id>/<skill-name>` 维护 bookkeeping 软链接，但这不是面向用户的直接引用路径。

例如：

```
/Users/kanehua/project/hk-skills/runtime/global/some-skill/SKILL.md
/Users/me/my-app/.agents/skills/some-skill/SKILL.md
```

---

## 完整命令速查表

### 核心命令

| 命令 | 作用 | 示例 |
|---|---|---|
| `init` | 初始化目录结构并迁移已有技能 | `./bin/hk-skill init` |
| `install <source>` | 安装远程或本地技能 | `./bin/hk-skill install https://github.com/user/skill` |
| `install <path> --local` | 从本地路径安装 | `./bin/hk-skill install ./my-skill --local` |
| `list` | 列出所有已安装技能 | `./bin/hk-skill list` |
| `enable <name>` | 启用技能 | `./bin/hk-skill enable vetter --global` |
| `disable <name>` | 禁用技能 | `./bin/hk-skill disable vetter --global` |
| `remove <name>` | 移除技能 | `./bin/hk-skill remove vetter` |
| `remove --unused` | 移除所有未启用的技能 | `./bin/hk-skill remove --unused` |
| `reset` | 重置项目 managed 状态（保留本地来源） | `./bin/hk-skill reset --yes` |

### 高级命令

| 命令 | 作用 | 示例 |
|---|---|---|
| `vet <name>` | 手动对技能执行安全检查 | `./bin/hk-skill vet some-skill` |
| `adapt <name>` | 手动重新适配技能 | `./bin/hk-skill adapt some-skill` |
| `update <name>` | 更新远程技能 | `./bin/hk-skill update some-skill` |
| `update --all` | 更新所有远程技能 | `./bin/hk-skill update --all` |
| `catalog` | 生成可搜索的技能目录 `docs/catalog.md` | `./bin/hk-skill catalog` |

### 常用选项

- `--global`：全局启用/禁用（默认作用域）
- `--project <path>`：为指定项目启用/禁用
- `--local`：将 `install` 的源视为本地路径
- `--unused`：`remove` 时只清理未启用的技能
- `--all`：`update` 时更新所有远程技能
- `--yes, -y`：`remove` / `reset` 时跳过确认提示

---

## 常见工作流示例

### 工作流 A：新项目接入（推荐）

```bash
# 1. 初始化
./bin/hk-skill init

# 2. 安装需要的技能
./bin/hk-skill install https://github.com/user/repo-analyzer
./bin/hk-skill install https://github.com/user/frontend-skill

# 3. 为当前项目启用（隔离，不污染全局）
./bin/hk-skill enable repo-analyzer --project ./my-app
./bin/hk-skill enable frontend-skill --project ./my-app

# 4. 在 Agent 配置中引用项目本地路径
# my-app/.agents/skills/repo-analyzer/SKILL.md
```

### 工作流 B：全局共享高频技能

```bash
# 安装并全局启用（适合所有项目通用的基础能力）
./bin/hk-skill install https://github.com/user/vetter
./bin/hk-skill enable vetter --global
```

### 工作流 C：清理不再使用的技能

```bash
# 先禁用
./bin/hk-skill disable some-skill --global

# 再移除（会同时清理仓库、manifest、registry 记录）
./bin/hk-skill remove some-skill

# 或者批量清理所有未启用的技能
./bin/hk-skill remove --unused --yes
```

### 工作流 D：更新远程技能

```bash
# 更新单个
./bin/hk-skill update some-skill

# 更新全部远程技能
./bin/hk-skill update --all
```

更新过程会自动备份当前版本，如果 `vet` 或 `adapt` 失败则会自动回滚，已启用的技能软链接也会被刷新。

### 工作流 E：重置项目为干净状态

```bash
# 清空所有 managed 状态（registry、manifests、runtime、adapted/remote 等）
# 保留 warehouse/local/、custom/、skills/ 等本地来源
./bin/hk-skill reset --yes
```

重置后项目会回到 init 的目录骨架，但不会重新注册本地来源，适合需要彻底清理后重新安装的场景。

---

## 核心概念图解

```
Remote Repo
    │
    ▼  git clone
warehouse/remote/<skill>   ← 保留原始副本
    │
    ▼  vet + adapt
warehouse/adapted/<skill>  ← 适配后的可用版本
    │
    ▼  symlink (enable)
runtime/global/<skill>     ← 全局运行时入口
<project>/.agents/skills/<skill>   ← 项目本地运行时入口（用户可见）
runtime/projects/<canonical-id>/<skill>  ← 内部 bookkeeping（系统维护）
```

**关键原则**：
- **安装 ≠ 启用**：`install` 只是把技能纳入系统，`enable` 才让它进入运行环境
- **原始与适配分离**：远程代码保留在 `warehouse/remote/`，你实际使用的是 `warehouse/adapted/` 中的副本
- **项目优先**：推荐用 `--project` 启用，避免全局 Skill 过多导致上下文混乱

---

## 安全与适配

### Vet（安全检查）

每次 `install` 和 `update` 都会自动执行安全检查。你也可以手动复查：

```bash
./bin/hk-skill vet some-skill
```

检查内容包括：
- 是否存在入口文件 `SKILL.md`
- 是否包含危险命令（如 `curl | bash`、`eval()`）
- 是否读取敏感环境变量
- 是否尝试操作系统关键目录

### Adapt（适配重写）

如果某个 Skill 原本为其他 Agent（如 Claude Code）设计，安装时会自动根据当前环境重写 Prompt。你也可以手动触发：

```bash
./bin/hk-skill adapt some-skill
```

---

## 注意事项

1. **Git 忽略**：`.gitignore` 已配置 `registry/`、`manifests/`、`warehouse/`、`runtime/` 等目录不会被提交。这样每台机器可以独立维护自己的启用状态。
2. **幂等执行**：`init` 和 `enable` 都可以重复执行，不会重复创建或覆盖。
3. **本地修改**：目前直接修改 `warehouse/adapted/` 中的文件是可行的，但更新远程技能时可能会被覆盖。未来版本将支持 `patches/` 机制保留本地修改。
4. **不支持 Windows**：软链接机制目前仅支持 macOS / Linux。

---

## 查看帮助

```bash
./bin/hk-skill --help
```
