# 2026-07-26：Trigger group 合并语义与 surface hit 收敛

> Internal record. Not normative. 本文记录 `0.2.0-rc.6` 人工试用暴露的 Dialog Close 空白命中问题及本轮方向；稳定规则见 `C-AS-TRIGGER-0001`、`D-TRIGGER-GROUP-SURFACE-0001` 与相关 `P-*`、`T-*` 实体。

## 外部观察

`ShadcnDialogClose > ShadcnButton` 在 React 中形成外层无样式 `div` 与内层 Button surface。外层盒可能宽于 Button；点击 Button 旁边的外层空白仍被 Web event router 归一化为内层 surface activation，导致 Dialog 关闭。Vue 的默认 `div` 与 Web Component 的默认 block host 也具有相同风险。

## 模型修订

连续 trigger 不再描述为把全部事件单向代理到最外层或最内层实例，而是合并为一个 trigger group：

- 默认最外层 member 是稳定 anchor；
- 默认最内层 member 是 interaction surface；
- 所有 members 保留自身 behavior declarations；
- semantic activation registrations 汇聚到 surface 上的共享 target；
- `host:*` events 留在各实例自己的 host root；
- Event、Focus 与 A11y 独立消费 domain-neutral 的 anchor、members 与 surface roles。

anchor 不代表物理交互范围，surface 也不吞并其他成员 behavior。pointer input 只有在 native hit origin 位于当前 surface root 或其内容中时才能进入 group semantic route；命中非 surface member 自身的额外宿主盒必须拒绝。

## 实现方向

adapter-base 将 `route owner` 数据与 capability 词汇收敛为 trigger-group anchor/members/surface 与 group semantic target，并为 Web router 提供可以显式接受或拒绝 native origin 的 resolution。旧 capability 名称保留为 deprecated alias，以避免无关的宿主集成破坏。

验收使用官网 Shadcn Dialog demo 的真实 `DialogClose > Button` composition，并要求 WC、React、Vue 同时满足：点击外层 Close 空白不关闭，点击内层 Button 正常关闭，keyboard/focus loop 与 restored focus 不回归。相同规则也覆盖 `DialogTrigger > Button` 的外层空白命中。
