# Boundary 编目与同一 sample 的弱栈归属

日期：2026-09-08。基线：Focus commit `a723ecac`。非规范工程记录。

新增 draft `M-BOUNDARY-0001`、`HC-BOUNDARY-CLASSIFICATION-0001`、`T-BOUNDARY-0002`，补齐四 Adapter 有界关系。Module 拥有 regions、三态分类、outside subscription 与 weak stack；Event 拥有宿主采样、lifecycle gating 和 callback scope；HC 只提供宿主 membership 证据。Overlay/dismiss/modal 和 Hit Participation 不迁入 Boundary。

真实四 Adapter 测试复现 `C-BOUNDARY-0001-D` 漂移：当 top boundary 的 outside callback 同步执行 `setStackActive(false)`，同一 pointerdown 随后到达 lower listener，下层重新读取 live stack 并发布第二次 outside。一次交互可能关闭两层。

修复在首次 stack-active 观察时以 native sample identity（无 native identity 时以 sample 对象）保留 top owner。后续 listener 复用该归属；新 sample 可到达新 top。WeakMap 不强持有 sample，避免长期保留事件对象。不改变 unstacked observer 行为。

新增证据覆盖两种 listener 注册顺序、同步关闭后下一次 sample、implicit root 与 disjoint region、unknown region、重复 observe、region disposer 和 terminal Event 清理。共享 Web bridge 另验证 linked Proto parent、Shadow DOM 与 mixed opaque/known region 的正向 inside 证据。已存在 Runtime detach/terminal 用例继续治理生命周期。

后续为 Hit Participation，再按 roadmap 进入 Presence、Positioning、Overlay。多 document/global stack 的独立 domain 抽象和可复用同一 native Event 对象的人工 redispatch 不作为本次真实输入保证；本次以每次输入的 sample identity 为证据边界。
