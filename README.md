# ProbePilotAI Skills

ProbePilotAI 官方技能仓库的内置离线副本。在线索引由 ProbePilot Studio 从
`https://github.com/kzzou/probepilotai-skills` 更新；远程不可用时回退到本目录清单。

每个技能至少包含一个带标准 frontmatter 的 `SKILL.md`。`registry.json` 为 Studio
安装器提供版本、文件摘要和社区评分基线；安装时会逐文件验证 SHA-256。

安装器会把完整技能目录同步到 Studio 用户数据目录，并复制到 Codex 的
`~/.codex/skills`、Claude Code 的 `~/.claude/skills`；其他 Agent 可通过
`PROBEPILOT_AGENT_SKILL_ROOTS` 配置技能目录。
