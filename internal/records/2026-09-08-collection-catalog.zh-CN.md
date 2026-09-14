# Collection 有界编目与阶段漂移修复

日期：2026-09-08。基线 `70612955`，分支 `codex/module-host-adapter-catalog-batch`。本文记录本轮实现观察与证据边界，不替代 spec。

## 范围与权威

依据 `C-AS-COLLECTION-0001`、`C-AS-COLLECTION-ITEM-0001`、`C-AS-HOOK-PRIVILEGED-0001`、既有 Lifecycle 与 Anatomy 契约，补全既有 `M-COLLECTION-0001`，新增 `T-COLLECTION-0002` 并连接四个 Adapter profile。保持 draft，不新建 Collection HC。

Module 拥有实例 provider/item 配置，委托 Anatomy 完成 domain、order 查询与订阅。asCollection/asCollectionItem 组合 State、Expose 和生命周期；不纳入 selection、focus、keyboard 或 A11y policy。内部 mounted subscription/unmounted disposer 是 view 生命周期资源，不受作者 setup-only cancellation 的阶段规则替代。

## 已修复漂移

`asCollectionItem().configure()` 原本在调用 Module 的 setup guard 前写入 metadata getter。runtime 调用虽然抛错，后续 provider/item snapshot 却读取被拒绝的新 getter。实际 Runtime 回归先复现该问题，再将 getter 赋值移到 `collection.configureItem()` 成功之后；现在拒绝不会改变既有 metadata。此修复不承诺 setup 配置失败的事务性回滚。

## 证据边界

- 直接 Module：配置拷贝、setup guard、默认空读取、当前位置、结构字段覆盖且不修改 metadata、内部订阅取消。
- 实际 Runtime：handle 复用、被拒绝 configure 的完整性、两次 detach/remount 的 State 恢复和 watcher 去重、terminal owner 清理。
- React、Vue3、Vue2：真实 framework keyed composition 的插入、移除、重排，provider 渲染顺序、位置与 metadata live read、嵌套同 family domain 排除。
- Web Component：真实 custom element 的结构组合与 terminal teardown；每次结构更新使用 fresh owners，不据此声称验证 retained-owner keyed reorder。保留 owner 的合成 order 变化与 view epoch 由其他 Runtime 证据分别覆盖。
- 既有 `use-collection.test.ts` 继续覆盖 no-arg hooks、兼容 wrapper、Expose 与 live position。暂时缺失 domain 时的 hook last-known position 是保留的实现行为，本轮没有新增专门的缺失/恢复旅程。

共享 Adapter fixture 重复执行 fresh-owner journey；不构成真实浏览器几何、焦点或全量 Prototype 审计。测试入口及关系见 `T-COLLECTION-0002`。

## 留待后续

Core 类型仍声明 count/index/total/first/last 的 State-name option，当前 no-arg hooks 在 configure 前已经以固定语义名称创建 State，未消费这些命名选项。重复配置、冲突、这些旧选项的迁移和 setup 配置错误后的恢复统一记入 `M-COLLECTION-0001-Q-CONFIGURATION`，本轮不擅自修改 API。

后续按 `2026-09-08-catalog-roadmap.zh-CN.md` 推进 Expose State Web，再推进 Rule Expose State Web。Collection 是同一批量分支的独立 slice。
