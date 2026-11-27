# Control Label 编译回归修复与 0.3.0-alpha.2

本记录更新 [上一轮综合修复记录](2026-11-15-release03-comprehensive-repair.md) 的后续状态，保留旧记录中的真实失败和评审边界。观察日期使用 UTC。它是工程证据，不是新的语义规范、独立 GitHub approval 或发行凭证。

## 判断：编译器实现遗漏，组合验证未及时拦截

用户要求判断新回归属于定义还是编译器问题，自行修复、bump，并继续更新 PR #1460。Agent 的公开转述仅包含这项工程目标。

`b988fbf6b6acd9d167d43a55a12b70109e26d8ce` 为 Base Button、Toggle 与 ToggleGroup Item 补上共享定义允许的 ControlLabel target 参与。目标仍调用既有的 activation 操作，保留 disabled、controlled value、focus 与 callback lifetime 的判断。Button 的这项定义不需要撤销。

同一份 `ce56274971f51590c8bccb33c1a2763637a88fc5` 编译器读取变更前后的真实 Button 源码：旧源码在 React、Vue3、Vue2、Web Component 四个 Web source profile 中都成功，新源码都在 `asControlLabel` 处收到 `PUI1003`。编译器缺少对应的 admission、IR operation、关联输入与 host lowering；新增 Runtime 消费者覆盖没有覆盖实际编译消费者，因此这个缺口随上次接入变成了新回归。

旧 Toggle、Label 与 ToggleGroup 源码本来就存在独立的编译缺口。它们不应全部归咎于本次变更。本轮补齐真实 Toggle、Label 所需的已检查语法；ToggleGroup 的集合、函数队列与反射边界仍明确拒绝。

`C-CONTROL-LABEL-0001` 的关联、激活、命名与寿命职责没有因此改写。draft 定义补充了独立生成代码与 Runtime 同处一个 realm 时的引用、pair 和生成 ID 所有权边界；这些约束没有把普通对象认可为合法 ref，也没有把 draft 提升为 stable。

## 实现和兼容性

- 四个 Web emitter 实现通用 ControlLabel 操作及独立的 `instanceAssociations` 输入。最终产物执行原生 host helper，不按组件名字或文件路径分派，不解释 IR，不复制 Label 文本，也不合成 target click。
- Core、Runtime 和独立生成图共享版本化的 nominal ref、pair 与生成 ID 服务；派生命名由 target 所有，foreign Label 以实际节点进入 target 的 A11y 投影。重复参与、错误 scope、换绑、外部 ID/IDREF 改写与异常清理保留边界。
- 生成 ID 的 receipt 先于可重入的物理写入建立；同步后继可以 retain，旧代清理不能删去后继仍使用的 ID。Runtime dispose 尝试全部已取得资源的清理，并保留第一个抛出的值，包括 falsy 值。
- Vue2 只规范化真实 Observer 加入的非枚举元数据，保留原 wrapper 的响应式读取；伪造 Observer、外来 key/symbol 与结构化 ref 继续拒绝。
- IR 升为 **6**。已检查的 callable 参数、默认值、条件表达式和类型来源有独立 source/IR 校验；借用的 callable 不能通过延迟回调逃离已检查阶段。旧 IR 5 输入明确拒绝。
- 已编译目录迁移是独立的兼容路径：只识别真实 IR 5/6 provenance 与精确已知 helper 字节，保留原始 manifest 和历史捕获；Context 统一为当前 helper。未知或被修改的 helper 仍拒绝。没有重写旧 fixture 哈希使测试变绿。
- 原有私有 WC SSR 实验通过明确的 `controlLabelHydration: 'client-only'` 保留未关联 Button 的服务端行为，客户端 hydration 使用真实 helper。服务端 Props、options、属性和 carrier 不能传输关联；public SSR profile 及未选择该模式的入口继续拒绝。

## 版本决定

`VERSION`、全部 **47 个公开包**、BOM 与 package-local 投影统一为 **0.3.0-alpha.2**；私有 compiler 不进入公开包清单。`V-PROTO-UI-0011` 仍为 draft。Stable `0.2.0`、历史版本实体和旧产物捕获保持不变。

元数据同步保留 contributor-authored README 正文，并将当前 draft 版本的安装片段明确标为发布后的示例。重复同步保持幂等；发行状态转为 active 时只撤掉生成器拥有的提示。发行测试另发现已有的 npm 429 重试循环会在第一次失败后提前退出；已保留原有断言并修复成功/失败的停止条件和重试上限，测试仅运行受控假 npm 子进程。这次工作没有执行 npm publish、tag、dist-tag、GitHub Release 或合并。

## 最终候选和实测

产品提交：`b41273fdb264ffc5a4f29ecfa398aa5b6a319e26`。证据运行使用该提交或与其所覆盖源文件逐项 SHA-256 一致的本地候选。后续记录提交只增加本文件和证据索引，不改变已测产品源码。pnpm 为 10.32.1，Node 为本地 24.22.1、远端 24.21.0，TypeScript 为 5.9.3。

| 检查 | 实际结果和边界 |
| --- | --- |
| 完整非原生浏览器 compiler 集合 | 76 文件完整执行；1691 passed、1 个预期 capture-old skipped；10 个独立进程合计 199.91 秒，无遗漏/重复 |
| Core、ControlLabel、A11y、四 Adapter 所有层回归 | 18 文件、280/280 passed，0 skipped |
| 真实 Button/Toggle/Label source admission | 29/29；含 12 个真实源/profile 组合、4 个严格完整生成图、8 个原有 Group 拒绝和 5 个 IR schema/version 检查 |
| 普通框架 import 与 generated/Runtime consumer | 55/55；真实组件、四 Web 目标及 Vue2 响应式/非法 wrapper 边界 |
| 正常沙箱 Chromium 原生输入 | 24/24 passed，0 skipped；Chrome 157.0.8103.38，`chromiumSandbox: true`，干净产品提交；24 个四目标 × 两类 control × 三种执行组合，真实 pointer/keyboard、computed accessible name、focus、disabled/controlled、解绑/重绑和 focus reentry |
| SSR 兼容和新边界 | 原有 40 行为 + 8 server/type/evidence + 18 新 hydration/传输/类名冲突用例通过；仅私有 client-only 实验 |
| 历史 native support 迁移 | 76 passed、1 个仅 capture-old 阶段运行的用例按设计 skipped；历史 capture JSON 未修改 |
| 公开包构建 | 47/47 passed；79.15 秒 |
| 官方 workspace 与 docs 类型检查 | 官方 `check:types` passed；workspace 无错误，Astro 1226 文件，0 errors / 0 warnings / 30 hints，206.44 秒 |
| 完整 release 测试与版本/物料检查 | 完整原跑 23 文件、211/214 passed；3 个失败已修复，受影响两文件 26/26 复验通过。仅未修改且原跑已通过的 219.99 秒 authoring 用例未重复执行；version/assets/manifests 全部通过 |
| Spec catalog/schema/relations/authoring 与测试映射 | 1271 实体，schema/relations/evidence 与 active T mapping 均 0 issues；authoring 10 个变更输入通过 |

命令与文件摘要保存在[修复证据索引](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-15-control-label-alpha2.json)中。关键可复现入口为 `packages/compiler/test/control-label-*`、`packages/compiler/test/button-ssr*`、`packages/compiler/test/native-support-migration.test.ts`、Core/Modules/Adapter 的 ControlLabel/A11y 测试，以及官方 `check:types`、`build:packages`、release checks。Native suite 已登记在正式 Runtime test plan 中。

## 保留的失败与修复过程

最初完整 compiler 运行出现 6 个失败文件，16 个失败断言、109 个未执行或跳过的用例（包括 beforeAll 阻塞及 1 个仅 capture-old 阶段运行的用例）。它发现新检查误伤旧 GPUI optional 模板、Vue2 nullable 声明槽存在性推导丢失、过宽的 SSR guard、元素 child 的诊断变化，以及旧 Context 捕获重建假设失效。上述问题已按其真实职责修复；未删除旧行为断言、放宽 unknown-call admission 或修改历史快照。

本地完整 compiler 的后续单进程运行又被系统 SIGKILL，未被计为完成；最终改用 Vitest 实际发现的同一 76 文件集合，在独立环境中分成 10 个进程执行，逐批和最终核对无遗漏、无重复。

本地官方类型命令曾因内存退出 137；独立环境的受控复跑显示两个 Vue2 fixture 注入类型不匹配，已在局部声明边界修正。另一次整合 compiler 运行在独立复核发现同步 ID 重入问题后主动中断 130，未当作通过。原生测试的第一次启动误用了不适用于当前普通用户的 `runuser`，并未执行浏览器用例；随后以原用户正常启用 Chromium sandbox 的运行才计为原生证据。没有使用 `--no-sandbox`、放宽超时或删除测试。Spec authoring 的 `tsx` CLI 曾遇 Unix IPC `EPERM`，改用 `node --import tsx` 执行同一脚本后通过。Runtime runner Node 组首次 GC 子进程超时；保留失败后，原样隔离复验及完整 137/137 重跑都通过，没有修改超时。

## 已完成的修复与剩余验收

新增的真实 Button 编译回归以及本轮已复现的 Runtime/host 寿命缺陷已在上述有界范围内修复。独立子代理交叉复核发现的问题已回到实现和测试；它不构成 GitHub 独立 APPROVE。

以下边界继续可见：实际 ToggleGroup Root/Item 和 Input 的既有语言/模块声明覆盖；GPUI 的新增 IR 形式与 ControlLabel、Qt/Flutter 和 public SSR；跨 realm/跨物理 scope 的关联；完整 assistive-technology 验收；综合 PR 原先记录的全 family/host、网站 Search、官方 Calendar 与 hosted isolation 证据。它们没有被这次 bump 或 24 个原生用例标为完成。

原生 captures 使用 960×640、普通明亮的行为 fixture；已检查实际控件、可见 Label 与 focus ring。它们不是完整主题/视觉设计验收。PR 图片附件尚未公开上传；本地图片不是上传凭证。原始来源 PR、作者、历史失败和评审债务继续保留，自动 Codex review 的额度失败不等于 approval。
