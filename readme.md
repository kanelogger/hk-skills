# hk-skills

## 思路
我想解决的最主要的问题：
Skill 越装越多，特别是全局安装的技能，元信息占用了过多的上下文空间。
为了解决这个问题，我相应的对策就是全局只装必要的插件，其他的就具体到项目里安装。
但是如果仅仅是这样，依旧没有办法解决集中管理Skill这个需求。

然后网上看到宝玉老师通过 symbolic link 去管理 Skill，通过 Symlink 直接链接到原始 Skills 的 Repo，大部分 Skills 应该跟着项目走，感觉是个法子，就开始动手实践。

整体的结构是这样的：
- custom 我自定义的skill文件夹，状态为完成的skill才会放到skills中。
- remote 远程拉取的skill，因为远程skill需要根据Agent架构与电脑环境进行适配，所以需要放到remote文件夹下。
  - menu.md 通过该文档维护远程skill，因为远程skill更新需要通过这里拉取最新的更新，然后根据Agent架构与电脑环境进行适配之后再放入 skills 文件夹中。
- skills 最终的skill文件夹，所有skill都会放到这里。

然后到具体项目中引用这个结构，就可以在项目中使用这些skill了。

## 技能管理
原始 Skills 的 Repo 集中管理。

自定义（custom）和 远程加载（remote）经过检查、处理之后放入 Skills 中。

### 搜索
- interview: 项目需要维护一个概览页面，内容是 skills 已经安装的技能，涵盖 技能名称、触发方式、功能、完成度、来源。

### 工作流
- workflow: 根据已有的技能，给出自定义编排工作流建议。

### 安装
如果是远程的技能，需要先进行技能 Vetter 检查，重复冲突，下载的时候提醒，安装记录来源。如果是全英文技能，需要同级下生成一份中文的介绍。

再统一安装到 remote 文件夹中，根据原有的设计进行本地化适配，再安装到skills文件夹里。

``` 
帮我安装skill，仓库地址是 {repo}。这个 skill 原为 {claude code} 设计，安装前请先理解其核心原理和工作逻辑，再结合你的 Agent 架构与电脑环境进行适配，使其真正融入当前环境，而非生硬移植。
```

如果是本地自己设计的技能，可以直接放进skills文件夹里。

### 更新
一般出现在远程获取的skill,简单粗暴，卸载删除skill/中的技能，查询remote中维护的来源，重新获取，重新安装。

### 使用
大部分 Skills 跟着项目走，在项目中（放项目目录下的 .agents/skills），通过 Symlink 直接链接到原始 Skills 的 Repo（例如本机就是：/Users/kanehua/project/hk-skills/skills）。



