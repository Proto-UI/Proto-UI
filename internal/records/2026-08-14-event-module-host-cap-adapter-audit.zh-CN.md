# 2026-08-14 Event Module、host-cap 与 official Adapter 审查

> Internal record. Not normative. 本记录保存 Event 首轮编目对 facade、port、host capability、official Adapter translation 与当前实现债务的审查。稳定语义由对应 `C-EVENT-*`、`M-EVENT-0001`、`HC-EVENT-BINDING-0001`、`HC-DEFAULT-ACTION-0001`、`A-*` 与 `T-EVENT-0003` 实体拥有。

## 本轮边界

Event Module 的 prototype-author facade 是 setup-time `def.event.on`、`onGlobal` 与 `off`。注册 callback 在 runtime callback phase 收到 runtime 绑定的 `run handle` 与 event payload；Module 不理解或构造 `run handle`，也不提供普通 `run.event` surface。

Event port 面向 runtime、其它 Module 与特权 asHook，当前包括：

- module-facing `on` / `onGlobal`；
- runtime-owned `bind` / `unbind` / `dispatchInternal`；
- target redirect、semantic-only root redirect 与 diagnostics；
- host-mediated default-action cancellation request。

`registerExposeEvent`、`emit` 与 `EVENT_EMIT_CAP` 当前物理上共置于 Event package，但语义属于 Expose Event outward channel。它们不是 Event 信息通路的 facade 或 host-cap baseline，等 Expose 编目时再迁移或建立明确 bridge entity。

## Host capability 结论

Event Module 真正需要的是“为一个 logical instance 的 root/global scope 建立 Event registration，并返回可释放 binding”的能力，而不是 Web `EventTarget` 对象。因此首轮建立 `HC-EVENT-BINDING-0001`：

- Adapter 负责把宿主输入翻译为声明的 Proto event type 与 payload；
- Module 按 registration scope 请求 binding，不读取具体 DOM node、window、document、Flutter controller 或其它宿主对象；
- 没有 registration 时不要求任何 target/binding；只有实际使用的 scope 才必须可用；
- 每个 registration 独立绑定、独立释放；target replacement、view epoch、unmount 与 terminal disposal 不得留下旧 listener；
- root semantic event ownership、global routing 与 portal/compound surface mapping属于 Adapter，不由 prototype author 读取 host containment 决定。

当前 `EVENT_ROOT_TARGET_CAP` / `EVENT_GLOBAL_TARGET_CAP` 返回 `EventTarget | null`，Event kernel 再直接调用 `addEventListener`。这能作为三个 official Web Adapter 的实现证据，但不是跨宿主 baseline 的理想形状。后续实现应评估把它们收敛为 host-owned subscription lease；在迁移完成前，`M-EVENT-0001` 与 `HC-EVENT-BINDING-0001` 保持 draft，并明确这项 portability debt。

Default Action 保持独立的 `HC-DEFAULT-ACTION-0001`。它只接收“取消当前 interaction sample 默认动作”的请求，不拥有 Event routing、inside/outside classification 或 native event exposure。Web profile 将它翻译为可取消 DOM Event 的 `preventDefault()`；不支持等价控制的宿主必须显式 no-op 或诊断，不得伪造成功。

## Official Adapter 现状

React、Vue 与 Web Component profile 均固定安装 Event Module，并通过共用 Web router：

- 把 DOM input 翻译为 root/global Proto event buses；
- 为 `host:*` 保留 host-bound escape hatch；
- 把 click、keyboard、pointer 与 context-menu 等输入翻译为当前支持的 semantic event；
- 根据 logical instance 与 trigger surface 决定 root semantic owner；
- 在 view commit 后启用，在 detach/unmount/dispose 时禁用并释放 native listeners；
- 以 translated capability 提供 default-action cancellation。

React 与 Vue 使用相同 router 与 Event wiring，差异主要在 view commit/gate 时机；Web Component 还拥有最完整的 router mapping、ownership、dispose 与 host-bound contract tests。当前证据足以把三个 official Web profile 的 Event slice 记录为 required Module support，但不能据此宣称任意非 Web Adapter 都必须提供 DOM 风格 target。

## 当前断口

1. `EventListenerOptions` 直接来自 DOM lib，尚未定义 portable options subset；非 Web profile 不应被迫实现 capture/passive 等 Web 细节。
2. `EventTarget`-returning cap tokens 需要迁移到 host-neutral subscription lease，或被明确降级为 Web-only realization helper。
3. Event Module 当前同时承载 Expose Event registry/emit bridge，所有权需要在 Expose 编目阶段收敛。
4. Runtime 固定安装 Event Module，但缺 host binding 时仅在 registration 真正使用后失败。未来可配置 Module set 需要定义静态/早期诊断与 non-interactive Adapter 的合法 omission profile。
5. Global scope 目前是单一 adapter-defined target；多 window、scene、document、isolate 或 portal environment 是否需要更明确的 scope identity 尚未定案。
6. 当前 Module contract test 能证明 default-action request 进入注入的 cap，但尚无 official Adapter test 直接断言该 cap 对可取消 DOM Event 调用 `preventDefault()`；`T-EVENT-0003` 将这项证据标为 planned，而不把 source inspection 当作 passing conformance。

## 首轮完成标准

- `M-EVENT-0001` 明确 facade、port、required profile support、Expose boundary 与 lifecycle ownership；
- `HC-EVENT-BINDING-0001` 与 `HC-DEFAULT-ACTION-0001` 保持原子且不把 DOM 对象写成 portable guarantee；
- 三个 official Adapter profile 显式 `supports` Event Module，并 `provides` 两个 Event host capabilities；
- `T-EVENT-0003` 把 Module、runtime、Adapter base、React、Vue、Web Component 与 Adapter profile schema evidence 映射到相应 criteria；
- 当前 Web-only cap shape 与 options portability debt 保持可见，不以通过现有 Web tests 冒充跨宿主完成。
