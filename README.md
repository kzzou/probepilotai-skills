# ProbePilotAI Skills

ProbePilotAI 官方 Agent 技能仓库，供 ProbePilot Studio 发现、安装、更新和移除技能。

## 使用

- 索引：[`registry.json`](./registry.json)
- Studio 默认从 `https://raw.githubusercontent.com/kzzou/probepilotai-skills/main/registry.json` 同步。
- 每个技能文件在安装前按清单中的 SHA-256 摘要校验。

## 技能

- `probepilot-debug-workflow`：自动调试工作流
- `probepilot-flash`：固件烧录
- `probepilot-power-recovery`：受控供电恢复
- `probepilot-serial-diagnosis`：串口日志诊断

评分基线由仓库维护者审核后更新；Studio 中的用户评分保存在本机，不会直接修改公共清单。