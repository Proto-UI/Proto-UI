# 2026-08-14 Expose Event Module、signal sink 与 official Adapter 审查

> Internal record. Not normative. 本记录保存 Expose Event 首轮编目对 semantic ownership、physical co-location、shared namespace、host-cap 与 official Adapter mapping 的审查。稳定语义由 `C-EXPOSE-EVENT-*`、`M-EXPOSE-EVENT-0001`、`HC-EXPOSE-EVENT-SINK-0001`、`A-*` 与 `T-EXPOSE-EVENT-*` 实体拥有。

## Semantic Module 与 physical package

Expose Event 是 Component → App Maker outward channel 的独立 semantic Module slice，但当前没有独立 package 或 ModuleDef：`registerExposeEvent`、`emit` 与 sink cap 物理共置在 `@proto.ui/module-event`，runtime 再把它们投影为 `def.expose.event` 与 `run.expose.emit`。

该共置是 implementation placement，不改变信息方向。User → Component Event Module 的 author facade 仍只有 `def.event.on/onGlobal/off`，普通作者不存在 `run.event`。本轮在类型层增加 `EventChannelFacade` 与 `ExposeEventFacade`，同时保留兼容的 composite `EventFacade`，以免 package 形状继续掩盖两个语义 owner。

## Shared key 与 leaked marker 偏移

`def.expose.event` 先在 Expose core registry 写入一个 declaration marker，以便 value、method、state、signal 共享同一个 key namespace，再在 co-located outward registry 注册可 emit key。这一设计能让 cross-classification duplicate 立即失败。

审查发现旧 marker 只是普通 `{ __pui_expose: 'event', spec }`，因此 Adapter 无法可靠地区分 runtime declaration 与结构相似的 author value。React、Vue 与 Web Component 的 public types 已明确从 `getExposes()` 排除 `ExposeEvent`，但既有分类契约又要求 outward signal 继续占用逻辑 exposes record。两者并不要求在 Module 层提前删除 declaration：正确边界是 classified translation record 可以携带 descriptor，Adapter 完成宿主 outward-carrier mapping 后再从 App Maker public record 删除。

本轮由 Expose core 创建 branded declaration metadata，Expose State compositor 将它与其它 classified entry 一起保留到 host-cap boundary；Adapter base public-record reader 只剔除带 brand 的真实 runtime declaration，结构相似的 author value 保持不变。这样 outward signal 继续占用 shared namespace、可被 Adapter translation 识别，但不会作为 App Maker record value 出现。

## Host capability 与命名

旧 `EVENT_EMIT_CAP` 语义上不是 Event input capability，而是一次 Expose Event outward emission sink。本轮引入 canonical `EXPOSE_EVENT_SINK_CAP`，保留原 token id，并让旧常量成为同一 token 的 deprecated source-compatible alias。

`HC-EXPOSE-EVENT-SINK-0001` 定义：

- Module validation 后传递 `(key, payload?, options?)`；
- 每次调用是即时 outward emission，不是 registration、record、subscription 或 replay；
- Adapter 保持 Component → App Maker 方向，并选择宿主惯例 carrier；
- capability 不包含 DOM、EventTarget、framework instance 或 listener naming；
- `options` 仍是 opaque host-local 扩展，不形成 portable guarantee。

缺失 sink 时当前实现为兼容性 no-op，但这种 Adapter 不得宣称支持 standard outward-signal surface。未来 configurable runtime 仍需要 feature-use validation。

## Official Adapter mapping

- React 将 key 映射到当前 props 中的 `onXxx` callback；listener props 由 Adapter classification 剥离，不进入 Proto raw props；options 当前忽略。
- Vue 通过 component emit/listener 映射 key，并把 options 作为第二参数传递；listener attrs 不进入 Proto raw props。
- Web Component 在 persistent Custom Element owner 上 dispatch 同名 `CustomEvent`，payload 进入 `detail`，当前 options 参与 host-local event init。

三个 profile 都提供同一个 host-neutral sink，但上述 shape 只属于各自 Adapter translation。声明 registry 与 emit authority 属于 instance lifetime：repeatable view detach/remount 保留，terminal disposal 清理并使残留 run authority 失败。

## 保留债务

- 是否以及何时把 Expose Event 从 Event package 拆为独立 package/ModuleDef；
- Expose State 已同时承担 State attenuation 与 classified translation record composition，通用 outward projector/compositor 的命名与 ownership 需要后续设计；
- `payload: 'json'` 尚未执行完整 validation，`any` 与 host-local escape hatch 未定；
- React、Vue、Web Component 对 options 的行为不等价；portable allowlist 未定；
- sink callback 抛错的传播策略、调度与 batching 尚未成为跨宿主保证；
- missing sink 的 adapt-time/runtime validation 尚未实现。
