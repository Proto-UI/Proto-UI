# 2026-07-21 Adapter 公共类型投影与 RC 试用发现

> Internal record. Not normative. 本文记录 `0.2.0-rc.0` 仓库外 React 试用发现的类型擦除、跨 Adapter 决策与验证结果。规范方向已编目为 draft `C-ADAPTER-TYPES-0001` / `T-ADAPTER-TYPES-0001`；在对应 release train 稳定前仍应按 draft 语义理解。

## 1）外部观察

CLI 生成的 React facade 本身只执行 `adapt(shadcnButton)`，Shadcn Button 的 `variant`、`size`、基础 props 与 exposes 类型在 Prototype package 中也均存在；但 `@proto.ui/adapter-react@0.2.0-rc.0` 的公开声明将 `createReactAdapter(...)(proto)` 返回为 `any`。因此编辑器无法提供 props 补全，非法值与 unknown props 也不会被 TypeScript 拒绝。

原有源码测试只验证了 `ProtoReactProps<TProto>` / `ProtoVueProps<TProto>` 等辅助类型，没有检查实际 `adapt(proto)` 的返回值。release consumer smoke 虽执行 `tsc --noEmit`，但 `any` 能接受全部调用，因此“类型检查通过”没有覆盖类型精度。

Vue Adapter 的 `defineComponent` 结果同样通过 `any` 返回。Web Component Adapter 有明确构造器类型，但构造器没有携带 Prototype identity，`getExposes()` 也只返回 `Record<string, unknown>`。因此问题属于跨 Adapter 公共边界，而不是 Shadcn Button 或 CLI 的孤立缺陷。

## 2）稳定方向

共享 Adapter 类型层负责两种基础投影：

- 从完整 `TProto` 提取 Prototype props，不在 Adapter 入口只保留一个会丢失 identity 的宽泛 `Props`。
- 将 expose value、method 与 state 分别投影为 value、callable method 与只读 external state handle；outward event 不作为可读取 handle value，而由宿主 listener / emit surface 承载。

各宿主只负责增加其真实支持的形态：

- React 返回带精确 props 与 ref handle 的 `ForwardRefExoticComponent`。
- Vue 返回带精确 `$props` 与 exposed handle 的 `DefineComponent`。
- Web Component 返回携带 Prototype identity 的 element constructor，并提供可复用 props utility。

CLI 继续生成薄 facade，不生成或复制 `ShadcnButtonProps`。这样 Prototype TypeScript public surface 与 Spec 保持唯一事实来源，所有组件在通用 Adapter 修正后自动受益。

本轮不为了接近原生组件体验而直接加入完整 `ButtonHTMLAttributes`、任意 Vue attrs 或 DOM property map。只有运行时已消费或转发的 host props 才进入公共类型；native prop forwarding 仍需按 Prototype compatibility 与 Adapter runtime 一并治理。

## 3）发布与验证

该修正影响已发布 Adapter 声明与 CLI 生成组件体验，进入 `0.2.0-rc.1` 未发布更新日志，不覆盖 `0.2.0-rc.0`。

验证分三层：

1. Adapter Base 类型测试验证 props 与 expose 分类投影。
2. React、Vue、Web Component Adapter 测试验证实际 `adapt(proto)` / constructor 不为 `any`，并检查 props、event 与 handle 类型。
3. release CLI consumer 从 37 个 staged package tarball 安装后，生成三个宿主 facade，并使用负向 `@ts-expect-error` 同时验证非法 variant 与 unknown prop 必须失败。若组件再次退化为 `any`，这些 directive 会因未使用而使发布检查失败。

## 4）后续边界

- 为 Web Component 的 `setElementProps` 与 `CustomElementConstructor` registry augmentation 设计更宿主惯用且可推断的 props 写入 surface。
- 在 native props/runtime forwarding 稳定后，再扩展 React/Vue 宿主原生属性类型；不得先声明后实现。
- API 文档生成应同时读取 Prototype public type、Adapter projection 与对应 P/C/T 实体，避免只展示运行时示例。
