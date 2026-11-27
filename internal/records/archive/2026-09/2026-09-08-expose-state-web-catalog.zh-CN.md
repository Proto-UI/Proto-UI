# Expose State Web 有界编目

日期：2026-09-08。基线 `70612955`，分支 `codex/module-host-adapter-catalog-batch`；承接 Collection 本地候选。本文是实施记录，不替代 spec。

## 边界

新增 draft `M-EXPOSE-STATE-WEB-0001`、`HC-EXPOSE-STATE-WEB-TARGETS-0001`、`T-EXPOSE-STATE-WEB-0001`，补全 React、Vue3、Vue2、Web Component 的支持、能力和证据关系。依据 `M-EXPOSE-STATE-0001-I` 的既有 Web extension 分界、`C-LIFECYCLE-0006/0007`、`C-HOST-SURFACE-PROJECTION-0001-G` 与未编目部分的旧 Web extension contract。

Module 拥有 semantic name 与类型驱动的 attribute/CSS variable 映射，host 提供 canonical boundary 与可选 presentation mirror。Mode/name map 为既有配置能力，不拆成独立 HC。external State 的只读语义与 instance lifetime 仍由 Expose State 管理；Web subscription/target binding 为 view 资源。Rule optimization、native variant policy 与默认 Plan 等价性留给下一个 slice。

## 回归修复

直接 Module 测试先复现三个失败：

1. refresh 先置 active，再被 clearBindings 清回 false，导致特权 port 误报。
2. host capability 消失或变为 null 时，旧 subscription 仍存活并继续写旧节点。
3. unmounting 期间仍接受 State 事件并写入 DOM。

修复在订阅重建后设置 active；host 缺失和 unmounting 撤销绑定；每次重建增加 generation，使已排队的旧回调也无法写入先前 target。未改变公开 API、State authority 或 Rule lowering。

## Evidence

- 直接 Module 验证 active、重复 commit 订阅去重、host 缺失/null/重绑、旧回调失效、detach/remount/dispose、custom name map 和 mirror 去重。
- 实际 Runtime 验证两个 view epoch 中 State 与 external handle identity 保留，detach 停止 Web 写入、remount 重放。
- 四个真实 Adapter journey 验证 bool/string/enum/discrete/range 默认及 mode override、更新与回退、DOM attribute/CSS variable、无额外 Proto structural render 和 fresh-owner baseline。
- Web Component 的真实 Text Control 验证 canonical custom element 与内部 textarea 的 selector context 同步，以及 identity 不复制。
- CLI semantic-name 表一致性及既有 Rule、Text Control 等消费者通过后续比例验证覆盖。DOM 值与 token evidence 不等于真实浏览器 computed CSS、几何或视觉验收。

## 保留问题

`M-EXPOSE-STATE-WEB-0001-Q-OWNERSHIP` 记录：当前 cleanup 撤销订阅与后续写入，旧 target 上已经输出的属性/变量仍可能残留；mapping/mode 变化也未恢复旧值。与 consumer 的同名值覆盖、归一化冲突/空名称、自定义映射校验与失败事务性，需要专门决定，不能在编目中擅自引入归属策略。

特权 map 的 cssVar 是候选名称，不保证 bool 或默认 string 实际输出该变量。此限制已明确写入 M，后续 Rule Expose State Web 应按 kind 与支持条件审查消费者，不能把 metadata 误作完整 emission guarantee。

下一步按整体路线推进 Rule Expose State Web；本轮不提交、推送或发布 PR。
