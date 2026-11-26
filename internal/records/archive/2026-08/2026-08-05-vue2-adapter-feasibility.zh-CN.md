# 2026-08-05 Vue 2 Adapter 可行性记录

> Internal record. Not normative. 本文响应 `internal/issues/v0-good-first-issues.json` 中 `vue2-adapter-spike` 的探索任务，记录 Vue 2 Adapter 的最小可行边界、兼容性风险与后续验证路径。稳定语义仍以 `spec/**` 与适用 contract 为准。

## 1）参考入口

- 当前 Vue Adapter 实现：`packages/adapters/vue`
- Vue Adapter v0 约束：`internal/contracts/adapter-vue/adapter-vue.v0.md`
- 适配器贡献规划：`internal/issues/v0-good-first-issues.json` 的 `vue2-adapter-spike`
- Adapter guide 当前仍是占位文档：`apps/www/src/content/docs/en/build/adapter-guide.md`

## 2）当前 Vue Adapter 的关键假设

现有 `@proto.ui/adapter-vue` 面向 Vue 3，并通过 `createVueAdapter(runtime)` 注入最小 Vue runtime surface。这个工厂边界需要保留，因为 contract 要求 Adapter 包不得静态引入 `vue`，并允许宿主应用控制实际 Vue runtime。

实现中与 Vue 3 强相关的点主要集中在 `packages/adapters/vue/src/adapt.ts`：

- 使用 `defineComponent({ setup })` 作为组件入口。
- 通过 `ctx.attrs` 接收未声明的 Prototype props 与宿主 class/style。
- 通过 `ctx.slots.default()` 投射默认 slot。
- 通过 `ctx.expose()` 暴露 `update()`、`getExposes()` 与 `invokeInCallbackScope()`。
- 通过 `ref`、`shallowRef`、`watch`、`onMounted`、`onUpdated`、`onBeforeUnmount`、`onActivated`、`onDeactivated` 与 `nextTick` 管理提交、更新、KeepAlive 与清理。
- 通过 `provide` / `inject` 维护逻辑父子关系，使 context、anatomy、trigger route 等跨组件通路能在宿主树中恢复。
- 在 Vue commit 后打开 event gate，并在 view detach 或 unmount 时关闭 event gate。

其中 `src/runtime/session.ts`、`src/runtime/modules.ts`、`src/runtime/effects-port.ts`、`src/platform/meta.ts` 与 `src/template.ts` 大多是 Proto UI runtime / Web host 投射逻辑，理论上可以迁移到 Vue 2 包，再针对 Vue 2 VNode 与 lifecycle 差异做局部调整。

## 3）Vue 2 约束与建议支持范围

建议第一阶段只面向 Vue 2.6。该方向能验证最保守的 Vue 2 宿主边界：不依赖 Vue 2.7 内置 Composition API，也不把 Vue 3 Adapter 的 `setup` 形态当作前提。Vue 2.7 可作为第二阶段优化路径，在 Vue 2.6 基础通路成立后再评估是否引入更接近 Vue 3 的 runtime 注入模型。

Vue 2 Adapter 不应替换当前 `@proto.ui/adapter-vue`。建议新增独立包 `packages/adapters/vue2`，公开包名暂定 `@proto.ui/adapter-vue2`，避免与当前 Vue 3 peer dependency、测试 runtime 与 CLI 默认 host 产生混淆。

第一阶段需要重点确认的差异：

- Component authoring：Vue 2.6 第一阶段应基于 `Vue.extend` 或 options object，不依赖 `defineComponent` / `setup`。组件实例方法、`render(h)`、`data()` 与 options lifecycle 是主要承载方式。
- Public handle：Vue 2 没有 Vue 3 `ctx.expose()` 等价物。最小可行方式可以把 `update()`、`getExposes()`、`invokeInCallbackScope()` 挂到组件实例方法上，并用类型投影描述 App Maker 可取得的 instance surface。
- Props 与 attrs：Vue 2 的 `$attrs` 与 `inheritAttrs: false` 可承载未声明 props，但响应更新、class/style 合并和 watcher 行为需要单独验证。
- Slot：默认 slot 可从 `$slots.default` 或 render context 取得，但 VNode 形态与 Vue 3 slot function 不同，`renderTemplateToVue` 的 slot 输入需要拆成 Vue 2 专用分支。
- Lifecycle：Vue 2.6 使用 `mounted`、`updated`、`beforeDestroy` / `destroyed`。CP4 必须仍在 Vue commit 完成后触发，CP8 后 event dispatch 必须立即失效。Vue 2.7 composition lifecycle 不进入第一阶段设计输入。
- KeepAlive：Vue 2 存在 `activated` / `deactivated`，但 detach/re-attach 时 root element 与 watcher 状态是否与 Vue 3 等价，需要单独测试。
- Teleport / Portal：Vue 2 没有内置 Teleport。当前 overlay global mount 主要经由 module-overlay 的 Web host 能力表达，第一阶段可以先验证非 overlay 原型；Dialog / HoverCard 等 overlay 原型放到第二阶段。

## 4）最小 runtime surface 草案

第一阶段 `createVue2Adapter(runtime)` 建议只要求这些能力：

```ts
export type Vue2Runtime = {
  h?: (type: any, props?: any, children?: any) => any;
  extend?: (options: any) => any;
  nextTick: (fn?: () => void) => Promise<void> | void;
  set?: (target: object, key: string, value: unknown) => void;
  delete?: (target: object, key: string) => void;
};
```

Vue 2.7 后续可选路径可以扩展为：

```ts
export type Vue27Runtime = Vue2Runtime & {
  defineComponent?: (options: any) => any;
  ref: <T>(value: T) => { value: T };
  shallowRef: <T>(value: T) => { value: T };
  watch: (source: any, cb: (...args: any[]) => void | Promise<void>, options?: any) => unknown;
  provide?: (key: symbol, value: unknown) => void;
  inject?: <T>(key: symbol, defaultValue: T) => T;
};
```

Go/no-go 判定不应只看类型能否编过，而要确认 lifecycle、slot、event root 与 expose handle 的可观察行为都满足 contract。

## 5）最小验证 demo

推荐第一阶段用 Base Button 作为最小 demo：

- Button 使用单一 host root，适合验证 root token、默认 slot、host class/style 合并与 feedback style。
- Button 的交互路径足以验证 root event target 与 global event target 的基本可用性。
- Button 不依赖 overlay、复杂 collection、positioning 或 text-control host-owned control，可减少初始变量。

如果 Button 通过，再追加 Base Toggle：

- Toggle 可以验证 props update、state -> style、outward event 与 typed listener / instance handle。
- Toggle 仍不需要 overlay，因此适合作为第二个确认点。

Overlay、Select、Tabs、TextArea、ScrollArea 不建议进入第一阶段 demo。它们涉及 portal、collection、focus entry、host surface projection 或 host-owned control，适合在 Vue 2 基础通路稳定后逐个引入。

## 6）Go/no-go 条件

Go 条件：

- 新包可保持 factory 注入，不静态引入 Vue runtime。
- 能创建单一 host root，并把 `data-pui-root`、adapter instance token 与 event root 绑定到同一个边界 target。
- 默认 slot 可投射，且 named slot / multiple slot 仍按 v0 规则拒绝。
- `feedback.style` 可投射到 host root class list，且不删除宿主提供的 class。
- CP4 能稳定发生在 Vue commit 完成后，event gate 只在 CP4 后打开。
- Unmount / destroy 时 event gate 立即关闭，runtime session 进入清理流程。
- App Maker 可取得 `update()` 与 `getExposes()`，类型不退化为 `any`。

No-go 或暂缓条件：

- Vue 2 无法在不引入全局副作用的前提下表达实例 handle。
- Props / attrs 更新无法稳定通知 Proto UI runtime，导致 `autoUpdateOnPropsChange` 不可靠。
- Commit 完成时机无法可靠识别，导致 CP4 与 event gate 顺序不可验证。
- 默认 slot 在 Vue 2 VNode 形态下无法保持 v0 的错误边界。
- 基础 Button demo 无法通过 lifecycle、slot、event 与 feedback style 的最小测试。

## 7）建议后续步骤

1. 新建 `packages/adapters/vue2`，复制 Vue 3 Adapter 的包结构，但保持独立 package name 与 peer dependency。
2. 先实现 `createVue2Adapter(runtime)` 骨架、`renderTemplateToVue2` 与实例 handle 投影。
3. 添加 `framework-contract.test.ts`，确认 runtime 注入、组件选项、lifecycle 注册与 handle 暴露。
4. 添加 Button 最小 demo 测试，覆盖 host root、slot、event、feedback style 与 props update。
5. 通过后再扩展 Toggle，并把类型投影接入 `C-ADAPTER-TYPES-0001` / `T-ADAPTER-TYPES-0001` 的 implementation evidence。
6. 只有当 Vue 2 包的最小测试稳定后，再考虑 CLI registry 新增 `vue2` host 入口。
