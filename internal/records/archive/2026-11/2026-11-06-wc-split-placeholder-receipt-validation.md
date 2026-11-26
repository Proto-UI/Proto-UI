# 2026-11-06：WC private split placeholder receipt 修复验证

本次修复基于 `c8a006403f4dfc850ee3cec5633c17f394ccd308`，对应 Issue [#947](https://github.com/Proto-UI/Proto-UI/issues/947)。`C-PLACEHOLDER-COLOR-0001` 与 `T-PLACEHOLDER-COLOR-0001` 仍为 draft；本记录只保留实际观察，不改变定义、词汇或生命周期。

`shadow-split-effects.ts` 现在按既有静态 `selection` 路径消费单一 `placeholder` variant，并要求编译 companion 的精确内层 `::placeholder` selector。host/wrapper pseudo、错误 surface、过期 receipt 和 fallback-role 绕过继续拒绝。Core 的四 token 白名单与 CLI 发射逻辑未改。

新增的 `placeholder-color.split.integration.test.ts` 使用真实 `AdaptToWebComponent` private split profile 和 Base Textarea，验证实际 surfaced editor、编译目标以及颜色规则替换和撤回时 editor 身份、编辑值、选区的保留。它使用 DOM 测试环境，不能证明原生 placeholder 像素或完整 Shadcn Textarea 支持。

## 已执行结果

环境为 Node.js 24.21.0、pnpm 10.32.1、Vitest 2.1.9。独立工作区使用 frozen lockfile、offline、ignore-scripts 安装，557 个包全部复用缓存，无下载。

| 执行范围 | 实际结果 | 观察 |
| --- | --- | --- |
| 干净主线原始 `shadow-text-control.test.ts` | 11 pass / 1 fail，共 12 项 | split 分支在 `placeholder:text-muted-foreground` receipt 准入失败。 |
| 修复后 14 个相关测试文件 | 119 pass / 2 fail，共 121 项 | 新增 split Base Textarea 消费者、四种 placeholder 颜色、四个 document Adapter placeholder 套件、CLI 与 Core 检查通过；两个失败见下文。 |
| 干净主线 `shadow-split-prototype-admission.test.ts` | 1 fail，共 1 项 | 与修复后相同的 Dialog Mask `mount.mounted` 断言失败，属于现存主线失败。 |

修复后原 Shadcn Textarea split 用例已越过 placeholder receipt，随后在 disabled/readOnly 变更时拒绝缺失的 cursor companion。独立 collector/emitter 观察得到 59 个 token，包含原始 `cursor-not-allowed`，其真实 CSS 具有合法 compiled receipt。临时错误诊断捕获的实际运行时条目为：

```json
{
  "token": "data-[disabled]:cursor-not-allowed",
  "role": "surface",
  "roleSource": "canonical",
  "authorToken": "cursor-not-allowed",
  "origin": "rule"
}
```

collector 的 59 个 token 不含这个完整的条件投影 token。严格 companion 准入因此拒绝该条目；本次未手工补 token、放宽 receipt、改写 authored State Rule 或宣称完整 Shadcn Textarea 已支持。临时诊断已移除；其后只由 formatter 调整实现与新用例的排版。

## 证据边界

三个变更 TS 入口及其实际依赖已通过继承仓库 workspace 编译选项的局部类型检查；这不等于完整 workspace 或文档应用类型检查。四个变更文件也已通过 Prettier 检查。

修改前后的消费者结果、collector/emitter 观察与条件条目诊断分别保留，未将窄范围诊断重标为整套测试通过。原生 computed placeholder color、像素、完整 Shadcn 消费者、workspace 类型检查、hosted CI、DCO 和新 head 的集成证据仍需各自实际产物；本记录不代替这些检查，也不据此关闭 Issue 或提升 draft 实体。
