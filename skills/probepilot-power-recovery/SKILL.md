---
name: probepilot-power-recovery
description: 基于目标板 profile、VTref 与电流限制执行 ProbePilot 受控供电恢复。
---

# ProbePilot 受控供电恢复

## 适用场景

- 目标板无响应，且 profile 明确允许 reset 或 power cycle。

## 必要输入

- 当前设备能力、目标板 profile、电压/限流范围和失败现场。

## 自动探测

- 调用 `target_status` 读取 VTref、Current、RESET、BOOT 与 POWER 状态。

## 执行步骤

1. 检查 `capabilities.actions` 与 profile 双重门禁。
2. 电流异常时立即停止，不执行自动恢复。
3. 优先 reset；只有 profile 允许时才执行一次 power cycle。
4. 恢复后重新读取状态和串口启动日志。

## 失败分流

- 过流：返回 `over_current` 并保留现场。
- 电压越界：返回 `target_power_missing` 或 profile 约定分类。
- 恢复无效：停止重试并返回 `recovery_exhausted`。

## 平台说明

- Windows、macOS、Linux 使用相同的 profile 门禁；具体 USB/TCP 切换由 Studio 完成。

## 安全边界

- 禁止绕过 profile 进行 power off、power cycle 或批量重试。
- 每次动作都记录操作前后测量值。

## 输出约定

- 返回门禁结论、动作序列、前后测量值、日志证据与最终状态。

## 交接关系

- 恢复后交给 `probepilot-serial-diagnosis` 或 `probepilot-flash`。
