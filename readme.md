# hk-skills

我看了下你的目录：/Users/kanehua/project/hk-skills 里已经有 skills/，/Users/kanehua/project/workarea 里目前还没有 .agents/。所以最自然的落法是把：
/Users/kanehua/project/hk-skills/skills
链接到：
/Users/kanehua/project/workarea/.agents/skills

在 macOS 上常用命令是这几个：

- 创建 symlink
  - `mkdir -p "/Users/kanehua/project/workarea/.agents"`
  - `ln -s "/Users/kanehua/project/hk-skills/skills" "/Users/kanehua/project/workarea/.agents/skills"`
- 查看 symlink
  - `ls -l "/Users/kanehua/project/workarea/.agents"`
  - `readlink "/Users/kanehua/project/workarea/.agents/skills"`
- 删除 symlink 这只会删链接，不会删原始 repo 里的 hk-skills/skills。
  - `rm "/Users/kanehua/project/workarea/.agents/skills"`

你可以这样理解这套 workflow：

- 维护仍然发生在 hk-skills/skills
- workarea/.agents/skills 只是一个入口
- Agent 在 workarea 里读到这个目录时，实际拿到的是 hk-skills 里的真实内容
- 你发现问题后，直接改 hk-skills 里的文件，就能立刻在当前项目里生效，然后正常 review / commit / PR

创建后建议马上验证一下：`ls -l "/Users/kanehua/project/workarea/.agents/skills"`
如果输出里有 -> `/Users/kanehua/project/hk-skills/skills`，就说明挂好了。




