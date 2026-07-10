---
name: probepilot-flash
description: 使用 ProbePilot Studio MCP 对目标板执行受控固件选择、SWD 烧录、校验与复位。
---

# ProbePilot 固件烧录

## 适用场景

- 用户要求给目标板烧录、更新或校验固件。
- 调试流程已有明确的固件路径和目标板 profile。

## 必要输入

- 用户选择或明确配置的固件绝对路径。
- 当前设备能力和目标板 profile。

## 自动探测

- 先调用 `health`、`get_current_device` 与 `get_current_device_capabilities`。
- 只使用 Studio 当前会话，不直接发现或连接 ProbePilot-S3。

## 执行步骤

1. 检查 `capabilities.actions` 是否允许 flash、reset 和必要的 power 动作。
2. 调用 `target_status`，确认 VTref、电流和目标状态安全。
3. 调用 `select_firmware`，不得猜测固件路径。
4. 调用 `flash_all`，使用 `job_status` 等待结束。
5. 校验成功后复位运行，读取启动串口日志并保存动作证据。

## 失败分流

- 设备不可用：停止并返回 `device_not_found`。
- 目标掉电：停止 SWD，返回 `target_power_missing`。
- 过流：立即停止自动恢复并保留现场，返回 `over_current`。
- 校验失败：仅按 profile 限次重试，返回 `verify_failed`。

## 平台说明

- Windows、macOS、Linux 均通过 Studio MCP 使用同一套动作语义；USB/TCP 通道由 Studio 选择。

## 安全边界

- power cycle、power off 与批量重试必须由 profile 显式允许。
- 自动动作必须写入操作日志。

## 输出约定

- 返回状态、固件摘要、job_id、烧录/校验结果、串口证据和推荐下一步。

## 交接关系

- 成功后交给 `probepilot-serial-diagnosis`；失败时交给 `probepilot-debug-workflow`。
