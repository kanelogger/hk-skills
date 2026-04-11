# hk-skills 技能清单

> 统计范围：当前仓库 `skills/` 下实际存在的技能目录。
>
> 完成度判定口径：
> - **高**：技能说明完整，且仓库内有明显配套资源/参考文件，基本可直接使用。
> - **中**：技能说明完整，但部分实现依赖、脚本或外部条件未在仓库内落地。
> - **低**：只有初步定义，缺少关键说明或关键资源。

| 技能名称 | 触发方式 | 功能 | 完成度 |
|---|---|---|---|
| 市值vs净利润 | 触发词见 `description`：如“市值与净利润”“净利润分析”“市值变化”“估值分析”“股票对比” | 分析股票市值、净利润、PE 变化及相关性，并生成交互式 HTML 报告。 | 中：说明很完整，但引用的 `scripts/fetch_data.py`、`scripts/analyze.py` 当前仓库内未找到，且文档明确写了“当前版本使用模拟数据”。 |
| 财务分析 | 触发词见 `description`：如“财务分析”“毛利率”“费用率”“净利率”“盈利能力对比” | 基于财务数据分析毛利率、各项费用率、净利率，并生成交互式 HTML 报告。 | 中：说明完整，但引用的 `scripts/fetch_financial.py`、`scripts/analyze_financial.py` 当前仓库内未找到。 |
| hk-skill-opencodeInsights | 从名字与描述触发：当用户要求分析 OpenCode session 历史、生成 insights / productivity report 时使用 | 分析 OpenCode 会话历史，抽取工作模式、工具使用、摩擦点，并生成 HTML 洞察报告。 | 高：除 `SKILL.md` 外，仓库内还存在 `cn.md` 和 `assets/template.html`，配套资源较完整。 |
| merge-drafts | 触发词见 `description`：如“合并稿子”“合稿”“merge drafts”“把这几篇合成一篇”“综合这几份稿子” | 读取多份草稿，选择最佳底稿，融合其他稿件亮点并输出统一风格的高质量文章。 | 高：这是纯提示型技能，输入、流程、输出目标都比较清楚，不依赖额外脚本。 |
| frontend-skill | 从描述触发：当任务要求高质量 landing page、网站、应用、原型、demo 或游戏 UI 时使用 | 约束前端视觉方向，强调构图、层级、图像叙事、克制的动效和高质感界面输出。 | 高：规则体系非常完整，且仓库内有 `references/` 参考资料辅助执行。 |
| autoresearch | 触发词见 `description`：如“optimize this skill”“improve this skill”“run autoresearch on”“benchmark skill”“eval my skill” | 对任意技能进行自动化迭代优化：跑多轮实验、二元评测、变异提示词、保留有效改动，并产出结果日志和 dashboard。 | 高：技能定义极完整，且仓库内有 `references/eval-guide.md` 支撑执行。 |

## 补充说明

- 当前仓库下共识别到 6 个技能目录：`economic-analysis`、`financial-analysis`、`Insights`、`merge-drafts`、`frontend`、`autoresearch`。
- “触发方式”优先采用各技能 `SKILL.md` 头部 `description` 中明确写出的典型触发词；没有明确列出触发词的，我按技能名和描述做了保守归纳。
- 如果你要，我下一步可以继续把这张表扩展成“技能名称 / 目录路径 / 输入 / 输出 / 依赖 / 完成度 / 风险”的更完整盘点版。
