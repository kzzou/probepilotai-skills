---
name: probepilot-debug-workflow
description: 编排 ProbePilot 能力检查、烧录、复位、串口诊断、受控恢复与 Markdown 报告。
---

# ProbePilot 自动调试工作流

## 适用场景

- 用户要求完成一轮端到端目标板调试或生成可审计报告。

## 必要输入

- 用户目标、目标板 profile，以及涉及烧录时的明确固件路径。

## 自动探测

- 通过 Studio MCP 读取当前设备和能力；传输通道选择由 Studio 管理。

## 执行步骤

1. 调用 `health`、`get_current_device`、`get_current_device_capabilities`。
2. 调用 `target_status` 建立电压、电流和目标状态基线。
3. 按用户目标调用 `probepilot-flash` 或直接复位。
4. 调用 `probepilot-serial-diagnosis` 采集运行证据。
5. 仅在能力与 profile 允许时调用 `probepilot-power-recovery`。
6. 调用 `create_report` 生成包含动作、证据和结论的 Markdown 报告。

## 失败分流

- 按 ProbePilot 失败分类保留首个根因，不用后续级联错误覆盖。
- 三次总重试上限仅是硬上限，profile 可设置更低值。

## 平台说明

- 工作流只依赖 Studio MCP 的稳定命令，不依赖宿主平台命令行或设备直连。

## 安全边界

- Agent 不直接发现、选择或连接 ProbePilot-S3。
- 固件路径必须来自用户选择或明确配置。
- 电流异常后停止自动恢复。

## 输出约定

- 返回统一状态、关键证据、操作日志、失败分类、报告路径和下一步。

## 交接关系

- 按流程调用本仓库其他 ProbePilot 技能，不把临时实现行为当作契约。
