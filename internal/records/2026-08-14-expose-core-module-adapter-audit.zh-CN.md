# 2026-08-14 Expose core Module 与 official Adapter 审查

> Internal record. Not normative. 本记录保存 Expose core 首轮编目对 facade、port、registry、Lifecycle、official Adapter support 与 composition ownership 的审查。稳定语义由对应 `C-EXPOSE-*`、`M-EXPOSE-0001`、`A-*` 与 `T-EXPOSE-*` 实体拥有。

## Core Module 边界

Expose core 是 Component → App Maker 信息通路的 instance registry。prototype-author facade 只有 setup-only `expose(key, value)`；runtime 再把它投影为：

- `def.expose(key, value)`；
- `def.expose.value(key, value)`；
- `def.expose.state(key, handle)`；
- `def.expose.method(key, fn)`；
- `def.expose.event(key, spec?)`。

这些入口共享一个 key namespace，runtime 期间不存在增删改 registry 的普通作者 surface。Expose port 的 `get`、`getAll`、`has`、`keys` 与 diagnostics 面向 runtime、dependent Module 与特权 asHook，不应因可读能力较强而直接暴露给普通作者。

Core 拥有 base registration、value/method promise 与 shared namespace。Expose State 负责把 internal State handle 转换为 App-Maker-facing external handle；Expose Event 负责 outward signal declaration 与 emit bridge。首轮只编目 core，不把两类 specialized semantics 折入 `M-EXPOSE-0001`。

## Host capability 与 Adapter 结论

Expose core kernel 只保存 instance memory，不读取 host object，也不直接投射宿主效果，因此没有 core Expose host-cap。三个 official Adapter 仍必须通过 standard Runtime 支持 required `M-EXPOSE-0001`，并以宿主惯例提供 `getExposes()`：React 使用 forwarded ref handle，Vue 使用 component public instance，Web Component 使用 Custom Element method。

JavaScript Adapter 返回 detached record snapshot，并递归包装其中的 callable，使 App Maker 的直接调用自动进入所属 instance callback scope。这个 callback-scope bridge 是 Adapter translation responsibility，但不需要把 callback invoker 建模成 Expose host-cap。

当前完整 record 的宿主发布实际上由 `ExposeStateModule` 与 `EXPOSE_STATE_SET_EXPOSES_CAP` 承接：普通 value/method 与转换后的 state handle 一起经该 sink 发布。首轮保持事实，不创建会泄漏 raw State handle 的 core sink；这项 naming/layering debt 留给 Expose State 编目独立处理。

## Lifecycle 偏移与修正

`C-EXPOSE-0008` 的旧表述把 “unmount/dispose” 合并为同一个失效点，`ExposeModuleImpl` 与 `ExposeStateModuleImpl` 也保留了 `onProtoPhase('unmounted') -> dispose()` wiring。这与 `C-LIFECYCLE-0006` 的 dual-axis 模型冲突：repeatable view detach 不应终止 instance-owned outward promises。

本轮将边界改为：

- registry entry、value identity 与 shared namespace 跨 repeatable view detach/remount 保留；
- Expose State projection 在 detached epoch 暂停 host publishing，但 underlying handle 与最新 state 保留，remount 后重新发布；
- 只有 terminal module disposal 才清空 registry、subscription 与 host projection，并使 internal port 失效；
- 旧 Adapter snapshot 即便仍被持有，也不再代表当前 live instance registry。

对应实现移除了两个 Module 的旧 `onProtoPhase('unmounted')` 自行销毁逻辑，统一依赖 Runtime 的 terminal module `dispose` hook。

## 任意合法 key 的 record 安全偏移

契约允许任意非空 string key，但 core `toRecord()` 与 Adapter recursive wrapper 曾用普通 `out[key] = value` 赋值。对于 `__proto__`，这会改变目标对象 prototype，而不是创建 ordinary own entry，导致合法 registry entry 丢失并破坏 snapshot 语义。

本轮改为用 own data property 定义每个 entry，并增加 Module 与 Adapter-base tests，验证：

- `__proto__` 仍是 enumerable own entry；
- snapshot prototype 保持 `Object.prototype`；
- 特殊 key 下的 nested callable 仍自动进入 callback scope。

## 保留债务

- 完整 Adapter-facing record 的 publication ownership 与 `EXPOSE_STATE_SET_EXPOSES_CAP` 命名需要在 Expose State pass 处理；
- Expose Event 当前物理依赖 Event Module 的声明与 emit bridge，需要在 specialized pass 重新确认 owner；
- expose value 的 portable boundary 与 method 的跨宿主 invocation shape 仍由现有 open question 管理；
- required Module 的未来可配置缺失检查尚无通用 runtime/schema 机制。

## 首轮完成标准

- `M-EXPOSE-0001` 明确 setup facade、privileged read port、shared registry、specialized composition 与 no-direct-host-cap 边界；
- 三个 official Adapter profile 显式支持 required core Expose，并记录 App Maker record 与 callback-scope translation；
- `T-EXPOSE-0002` 连接 Module、Runtime、Adapter-base、三个 official Adapter 与 profile schema evidence；
- Expose resource ownership 对齐 repeatable Lifecycle，terminal disposal 有 executable evidence；
- `__proto__` snapshot safety 偏移已修正，projection ownership 与 specialized Module 继续作为可见债务。
