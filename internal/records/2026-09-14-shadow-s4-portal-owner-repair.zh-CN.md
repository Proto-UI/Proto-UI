# S4：Portal 不再越过来源树的 owner lifetime

日期：2026-09-14。状态：bounded WC regression evidence，non-normative。

在受控关闭修复 `bf3e418f` 后，公开 Chrome 审计确认：打开普通 Dialog 再移除 Root，Mask/Content 已在 body，因此不会收到与 Root 相同的物理 disconnectedCallback；Root/Trigger 消失但弹窗、遮罩及 body overflow hidden 残留。Light/split 都可复现。

修复归属 WC portal projection，不改变 Overlay logical open 或 Prototype API。新的内部 `portal-mount.ts` 保留来源 parent/next 与 parentNode 原 descriptor，临时 getter 维持 portal 活跃时的逻辑 parent；来源树在 MutationObserver 交付时仍断开，则把临时投射放回来源，后续由既有 Custom Element owner lifecycle 完成终止。同步移动在交付时仍连接，保留 generation；观察覆盖来源所在 ShadowRoot 与其外层树，并在同步移动改变树时重绑。撤销同时 disconnect observer、恢复 descriptor 与物理位置，不删除消费者节点。

## 证据与边界

- WC integration 的普通/Shadow 来源两条用例先失败后通过；包括同一树移动、移动到另一 ShadowRoot、移除 Root、重连、移除来源 host，原有 Dialog/Overlay 22 项定向测试通过。
- `shadow-s4-portal-browser.mjs` 在 Chrome 152.0.7977.83 通过完整公开 Light/split/mixed Dialog：同步移动不增加 setup/mount/unmount/dispose；打开时移除 Root 后全部十个 part 脱离 document、各 dispose 一次，Shadow owner children 清空、滚动锁释放；重连可再次打开，再移除各 dispose 第二次。
- 使用缺失 K1 recipe 的旧 Content companion 时，错误仍明确报告且 Content 未投射；Maker 显式关闭可释放有效 Mask，之后移除整树无残留。未把错误转为自动 parent open 回滚，也未静默降级 profile。
- 该节点对应 `A-WEB-COMPONENT-0001` G、`C-LIFECYCLE-0008` F 与 `C-AS-OVERLAY-0001` F/K；`HC-PORTAL-0001` 保持简略 draft，不据此宣布任意 portal target、跨 document、嵌套弹窗或其它 renderer 的支持。

S4 下一步接入完整 Tabs 设置并测实际 AX/focus/dismissal。自动测试只证明所列路径，不等于人工验收通过。
