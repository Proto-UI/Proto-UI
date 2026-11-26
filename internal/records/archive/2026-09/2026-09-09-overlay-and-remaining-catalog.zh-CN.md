# Overlay 与普通编目收尾批次

日期：2026-09-09。基线：PR #632 合入后的 `839a6143`。用户要求更新为：Overlay 边界清理与已接受的 Escape 仲裁完成后，继续 Text Control、Image View、Scroll；各语义切片独立 commit，共用一个 PR，随后停顿。此安排更新此前 Escape 独立 PR 的交付顺序，不重新打开已经接受的策略。

## Overlay

新增 draft `M-OVERLAY-0001` 与 Portal、modal、layer 三个 HC，四 Adapter profile 和 `T-OVERLAY-CATALOG-0001`。Event 只补 privileged opaque input identity，Overlay 拥有候选和单 sample 仲裁。author payload 不携带这些 identity 或 host reference。

四 Adapter 模拟 DOM 集成覆盖嵌套 Escape、受控同步 reopen、两个 modal 按两种关闭顺序释放；Runtime 覆盖 scope 隔离、detach/reenter、重复 open 和 callback 内 metadata 窗口。嵌套 Dialog／Dropdown consumer 测试证明请求只到达选中 Root。Chrome 四 Adapter Brutalist Dialog 几何测试通过；首次执行套件清理超时，使用 60 秒 hook timeout 重跑整套通过。这项浏览器证据证明 Portal／几何回归，不能代替嵌套受控请求证据或完整 modal 认证。

局部漂移已有失败到通过证据：多 modal 覆盖 body overflow 快照；Overlay 替换 host provider 后旧资源未释放；layer disposer 重复执行且丢失 inline priority。修复保持既有 API 与责任分配。

## 保留边界与独立事项

- 通用 entry/restore、anchor/trigger press dismissal 只是配置；focus-outside deferred。消费者 Focus/Root request 不迁入 Overlay。
- modal 当前只提供 Web scroll lock，不承诺 inert、focus trap、backdrop 或 A11y。
- layer 使用 sequence + role offset 算式，长序列不保证绝对 role hierarchy；多 owner 同一 layer target 不在当前保证中。
- Presence legacy compatibility 仍是独立清单，不因为 Transition 使用 ViewIntent 就新建 Presence M/HC。
- `registerContent(null)` 会回退当前 host capability；无 host 时的旧 Portal/layer 生命周期仍按 view detach 清理，不将该调用推断为新的通用 target-detach API。
- Event sample identity 基于同一宿主输入对象；人工重复派发同一个 native Event 对象不构成经过认证的新输入 generation。
- A11y asHook/API 重设计、Rule Meta 稳定化、deprecated State module 清理及其它架构演进不进入本批次。

## 后续队列

依次对 Text Control、Image View、Scroll 做既有实体补全和实际 Adapter evidence 审查；不按 package 数创建占位实体。完成后更新本记录的后续进展记录，并提交一个批次 PR。
