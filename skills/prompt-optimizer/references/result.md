# 阅读文章提示词推荐方案

## 方案概述

采用**分层递进**策略，从宏观到微观、从内容到形式，逐步深化对文章的理解。

---

## 推荐顺序

### 第一层：建立全局认知（必选）
**1. `hardcore-supportor.md`**
- **作用**：设定整体交互风格
- **时机**：最先用，贯穿全程
- **理由**：建立"硬核、直接、不废话"的沟通基调，避免温和但无用的回应

**2. `content-analysis.md`**
- **作用**：系统性拆解文章骨架
- **时机**：放入文章后立刻使用
- **产出**：核心论点、作者背景、论证结构、批判性审视
- **核心价值**：一次性建立对文章的完整认知地图

---

### 第二层：深度提取（根据文章类型选择）

| 文章类型 | 推荐提示词 | 核心价值 |
|---------|-----------|---------|
| **学术论文/技术文章** | `paper-interpretation.md` | 提取核心贡献(Delta)、识别创新增量、找出逻辑边界 |
| **商业/管理类文章** | `business-structure.md` | 用"天-人-地"三才结构分析组织逻辑、竞争态势 |
| **论证/观点类文章** | `judicial-argument.md` | 六步解构协议：识别逻辑谬误、挖掘隐藏假设、评估证据效力 |
| **学科/领域介绍** | `explain-theorem.md` | 从第一性原理解构：根本问题(O)、系统架构、核心变量 |

---

### 第三层：本质升维（深度思考）
**3. `the-one.md`**
- **作用**：透过表象，提取本质公式
- **时机**：在第二层分析完成后使用
- **产出**：The One公式、跨领域迁移应用
- **适合**：任何有深层规律的文章

---

### 第四层：表达重构（输出优化）
**4. `reconstruction-text.md`**
- **作用**：将复杂的分析结果精炼为高密度表达
- **时机**：当你需要向他人转述或写笔记时使用
- **产出**：结论先行、穿透力强、无废话的精炼版本

---

### 第五层：可视化（可选增强）
**5. `article-infographic.md`**
- **作用**：生成文章的知识地图/信息图
- **时机**：需要将文章内容可视化记忆或分享时

---

## 完整流程示例

```
Step 1: 设定风格
→ 使用 hardcore-supportor.md 建立硬核交互基调

Step 2: 放入文章 + 全局分析
→ 使用 content-analysis.md 进行五维分析

Step 3: 类型化深度解读（根据文章性质3选1）
→ 学术类: paper-interpretation.md
→ 商业类: business-structure.md  
→ 论证类: judicial-argument.md

Step 4: 本质提取
→ 使用 the-one.md 提炼底层公式和跨域迁移

Step 5: 精炼输出
→ 使用 reconstruction-text.md 生成高密度笔记

Step 6: 可视化（可选）
→ 使用 article-infographic.md 生成知识地图
```

---

## 快速决策表

| 你的需求 | 推荐的提示词组合 |
|---------|----------------|
| **快速了解一篇文章** | hardcore + content-analysis |
| **深度研读论文** | hardcore + content-analysis + paper-interpretation + the-one |
| **分析商业案例** | hardcore + content-analysis + business-structure + the-one |
| **批判性阅读观点文** | hardcore + content-analysis + judicial-argument + reconstruction-text |
| **构建学科体系** | hardcore + explain-theorem + the-one |
| **做读书笔记/分享** | 上述任一层 + reconstruction-text + article-infographic |

---

## 不推荐的提示词（场景不匹配）

- `image-2-prompt.md`：用于图片反推，与阅读文章无关
- `text-image-creator.md`：用于生成图像提示词，与阅读无关
- `explain-formula.md`：用于解释具体数学/物理公式，除非文章的核心是一个公式

---

*方案生成时间：2026-03-22*
*基于文件夹内13个提示词分析整理*
