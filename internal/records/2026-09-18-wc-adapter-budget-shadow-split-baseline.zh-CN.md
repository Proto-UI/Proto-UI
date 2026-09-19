# WC adapter 预算基线：shadow split 能力归因（#654 流程）

## 背景

#654 的维护者决定要求：数值上限调整必须是一笔可评审的事务——指明需要它的已接受能力、给出 canonical 前后测量、归因主要增长、说明调整后余量，并区分产品增长与工具链/压缩漂移；优先消除意外闭包、重复运行时副本、死代码或可避免的急切包含。#652 已在 PR 内完成过一次经评审的基线移动（76,000 → 84,000），不得在同一 PR 内第二次抬升上限；若确有必要，以独立 PR（回到 #654）单独评审。

本 PR 即该独立事务。

## Canonical 前后测量

测量形状不变：esbuild bundle + minify + tree-shaking，browser ESM/ES2020，同一 external 边界，gzip level 9。

| 对象           | head     | CI run      | 测量值      | 当时上限 |
| -------------- | -------- | ----------- | ----------- | -------- |
| main（before） | ddac15da | 34950254347 | 75,664 gzip | 76,000   |
| #652（after）  | dd820b30 | 35283455803 | 84,683 gzip | 84,000   |

after 的 minified 产物为 317,103 bytes，SHA-256 `953610ab9ad75ef188b01ff60ccfc24e9e1e226f7476de0c0f34094ffd9074c3`；环境为 Node v22.23.2、zlib 1.3.1-e00f703、esbuild 0.25.12、linux/x64。before/after 使用同一 pinned 工具链；两个工作区（macOS arm64 官方 Node 与 Windows x64）的本地测量均与 CI 逐字节一致，无工具链/压缩漂移成分。

## 增长归因（+9,019 gzip）

对两份 canonical 产物做文件级对比（esbuild per-file minified 尺寸）：

- 全部增量来自 shadow split / 组合树焦点能力族：15 个新文件（shadow-split-effects、focus-scope-targets、shadow-style-artifact、portal-mount、portal-conceal、shadow-owner-shell、shadow-split-resources、shadow-color-scheme-environment、application-role/root-effect 分类器等）合计约 16.9 KB minified；共享文件增长约 9.6 KB minified（adapt、runtime/modules、web-event-router、instance-tree、focus/create 等）。
- 无意外包含：文件级 diff 中不存在测试工具、重复运行时副本或与该能力无关的模块。
- 已消除的重复：shadow 颜色方案环境改为复用 base 的每文档共享 source（−207 gzip）；自定义元素升级观察折叠进既有树遍历（−42）；deepestActiveElement 去重（−12）。诊断字符串即便全部删除也只能回收约 355 gzip（实测：20 条消息全部替换后 84,340），不构成真实余量。
- 增长中约 830 gzip 来自 main 自身颜色方案能力落地（74,834 → 75,664），经 merge 进入 #652，不是 #652 的代码。

结论：余量缺口是已接受能力及其评审修正的产物增长，不是可消除的额外开销；按 #654 第 5 条，不为保住旧数字而对正确架构做有害压缩。

## 上限与余量

`adapter-web-component root` 上限 76,000 → 86,000。相对 after 测量 84,683 的余量为 1,317 bytes（约 1.5%），与既往约 1 KB 的余量惯例一致；这不是对未来增长的普遍授权。

## 诊断性 consumer 测量层（不阻断）

按 #654 批准的方向新增第二测量层：固定的小集合 consumer profile（Light DOM、direct Shadow，各一个已发布 primitive），与 whole-entry 门共用 bundle 设置，报告 minified、gzip 与产物 SHA-256，仅作诊断、不参与 pass/fail。split profile 的 fixture 随引入该能力的 #652 一并落地（main 上尚无该 API）。

首组诊断基线（main@ddac15da）：consumer light-dom button 79,754 gzip（minified 306,929），consumer direct-shadow button 79,758 gzip（minified 306,940）。两者都高于 whole-entry adapter root（75,664），说明 adapter 当前为单体式急切包含——任何使用 adapter 的 consumer 都支付全部 module 闭包，primitive 自身（shadcn button）的增量约 4.1 KB gzip。该观察供后续拆分测量形状参考，本 PR 不改变包含结构。同时为 blocking 报告补齐环境（Node/zlib/esbuild/平台/架构）与 minified SHA-256 provenance，JSON 输出新增 `environment` 与 `diagnostics` 键，`.results` 形状不变。

## 边界

本变更不解除 whole-entry anti-regression 门的阻断性，不扩张公共 API 或运行时语义，不修改 spec 实体。#654 保持打开，直到本策略/证据切片经评审落地。
