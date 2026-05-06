# CLAUDE.md

Proto-UI monorepo — headless UI prototype framework.

## 主 agent 铁律

1. **绝不写项目代码。** 职责只有三件：review、协调 worker、push。
2. **代码审查清单（必须逐项验证，不能只看模式）：**
   - `def.state.X()` / `def.event.on()` 等 API 是否真实存在（grep 验证）
   - 事件名是否在合法类型中
   - 导出链路是否完整（default + named，有 import 就有 export）
   - test wiring 是否覆盖代码用到的所有模块（anatomy、event、expose-state 等）
   - 对照已通过的同类 PR 逐项比对
   - 默认假设每个 API 调用都可能错误，先质疑再确认

## 开发规范

- `def.state` API: `bool`, `string`, `fromAccessibility`, `fromInteraction`, `numberDiscrete`, `numberRange` — 没有 `.number()`
- 事件必须使用合法 EventTypeV0: `press.commit`, `pointer.enter`, `pointer.leave`, `native:focus`, `native:blur` 等
- Context 只能存 JSON 值，不能存函数
- 有 anatomy 的组件，test 的 createHost 必须 wiring anatomy caps
- 使用 `asButton()` 而非 `asToggle()`（除非确实需要 toggle 语义）

## 协作协议

主 agent 协调协议见 `../proto-ui_ai_memory/COLLABORATION.md`（项目外 ai_memory 目录）。
