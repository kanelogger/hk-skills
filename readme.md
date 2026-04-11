# hk-skills




## 技能管理
帮我安装skill，仓库地址是 https://github.com/JimLiu/baoyu-skills。这个 skill 原为 claude code 设计，安装前请先理解其核心原理和工作逻辑，再结合你的 Agent 架构与电脑环境进行适配，使其真正融入当前环境，而非生硬移植。

先说一下我的想法：
我希望用好 Symlink。不要把 Skills 整个拷贝到 .agents/skills，而是通过 Symlink 直接链接到原始 Skills 的 Repo。大部分 Skills 应该跟着项目走（放项目目录下的 .agents/skills），不要放全局（~/.agents/skills）。

先说说你的方案和设计思路，最好有多个让我参考。

好处有两个：
一是版本控制更干净；
二是使用中遇到问题，Agent 定位后可以直接在 Repo 里改，改完就能 Review 提 PR。
我日常维护 skills 就是这么干的，用的时候发现问题，让 Agent 在当前会话改，改的就是 Repo 本身，流程非常顺。
最后提醒一下：大部分 Skills 应该跟着项目走（放项目目录下的 .agents/skills），不要放全局（~/.agents/skills）。
即使是渐进式加载，meta 信息累积起来也会占不小的上下文空间。

## 设计


## 新增

## 更新

## 查询

## 删除




