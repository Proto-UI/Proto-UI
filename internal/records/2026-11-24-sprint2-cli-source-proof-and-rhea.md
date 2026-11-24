# Sprint 2：CLI 来源证明、正式预设与 Rhea Accordion 布局后继

本记录是实现与实测记录，不是整个 Sprint 2、Hook 契约或全库存接受决定。

## 已完成的有界结果

原 `5cb80eb937f20982dd7dc8cbc93a90e91d665c31` 的完整 Web 消费队列为 302/304；两个失败均是实际 Rhea 首页的 Shadcn WC Accordion Content。在 1180px / 100% 字号及 390px / 200% 字号下，原测试读到 `display: inline`，而原组件已经作者声明 open 时应使用 `block`。

本候选从真实 Hook capture 的 source proof 修复来源丢失，经正常预设生成、公共 CLI 构建及网站自己的正常 CSS 生成，再运行**未修改的原 8 个 Rhea 用例**：四个 Web 宿主 × 两种几何，8/8 通过。每个用例均保留原 90 秒期限、初开与关闭后重开、实际 Content 几何、profile padding 和 pageerror 断言。共保存 16 份布局 JSON 与 16 张截图。

WC 原两个失败点的后继读回是：1180 / 100% 的 display 为 block、左右与底部 padding 为 16px；390 / 200% 为 block、padding 为 32px。初开和重开均通过原内容流断言。未修改 Accordion 原型、网页样式或浏览器断言来迁就结果。

原 Shadcn Button ghost 文件也完整执行为 **2/2 通过**。其中第一例仍比较整个 Shadcn + Base 实际来源闭包与正式生成预设，保留原 180 秒限；第二例仍检查真实 Button host 的主题与 props 变化中的生成 selector/declaration。第二例使用既有 HappyDOM 断言，不外推为浏览器像素或原生 cascade-layer 接受。

## 源版本和精确补丁

基础提交：`5cb80eb937f20982dd7dc8cbc93a90e91d665c31`。

本次可整合补丁包含 7 个 CLI 文件：两个服务、两个测试文件及三份正常生成的 preset。标准化 full-index 补丁为 `accordion-cli-source-and-presets-candidate04-full-index.patch`，64,983 bytes，SHA256：

`9fb330a84d11993d495cf894512a5e440959cc2757831a4d5941af175395dcbf`

四个实现与测试文件的 candidate04 补丁独立保留，58,784 bytes，SHA256：

`8521bff1e774f20cb24c75ef43815d5ef92682899826382a56c23128f0d1d306`

正常生成的三份 preset 差异独立保留，5,773 bytes，SHA256：

`dd2f8b9afbed70f867d1e02310c5e4a4e1f075ab62f835b72e8d6c2c2dfe0624`

远端浏览器实际候选还包含先前独立接受的 6 个 Transition receipt / GPUI 边界修复文件。浏览器 `receipt.json` 完整记录实际 13 个修改文件的 hash、base tree、dirty 列表与整个差异 hash；不能只用基础提交名把它描述为洁净 5cb。其源码差异 SHA256 为：

`e007474a5a06992d17d589bbcc102221c2ce9c291cd0ae16b2a767f911c38a3b`

本地与远端 7 个 CLI 文件逐项 SHA256 相同。两地 Git 默认短 index 长度不同，曾产生字节不同但源内容相同的组合 patch；故交付使用上述 full-index 版本，旧短 index 文件仍保留。

采集阶段由子代理交付源文件与原件，不自行提交。后继经仓库支持的 publisher 提交为 `4805115a13039cb8694da4d2113bf4d700b58050`（树 `5c2d10607bfb388995871b4e485fc932fd88d546`），已推到 PR #1761；原件的 source hash 与实际提交七份文件逐项相同。此提交不表示平台独立审查或 main 整合已经完成。

## 实现修复

### Capture result 的真实 own-member spread

原 Accordion Hook 的 `projectHandle` 返回 `{ ...result, bindPresence }`。Runtime capture result 的实际 own enumerable `stateHandles` 和 `getState` 存在，但静态解释器将整个 capture result spread 视为 unknown，导致公开 `open` 的来源丢失。网站正常 CSS 收集没有为这个真实条件生成 block 规则。

候选只传递由实际 capture 证明的 own member：有已知 state 时的 `stateHandles` 和 `getState`。未模拟的 raw key 会使旧同名事实失效；后续未知 spread、计算 key 或显式写入仍按 JS 顺序覆盖。不会把 named child 扁平化，也不会制造额外 API。

独立审查进一步复现了 projection 副作用的假证明，均保留红原件并修复：

- spread 读取本地 getter 后，getter 改写 raw result 的 stateHandles/getState；
- getter 或 method 的 computed name 在对象构造时已经执行，而不是等函数体调用；
- 普通 property/element getter 读取在后续 result spread 前改写 capture；
- 未读取的普通 getter、deferred callback body 保留正例，不无差别视为已执行。

### Helper 的实际参数与原 source key

来源库存现在沿稳定、同步 helper 的实际调用闭包观察 Rule：保留原 entry 文件、实际 Rule 所在文件、call path、声明来源和该次调用的参数。Brutalist Textarea root → setupTextareaVisual → visual.ts 的原 source key 保留；未知调用与已知调用分开，不用一个调用的证明覆盖另一调用。

条件 child registration 支持有限的直接新建 literal record 参数/default，以覆盖真实 Field Textarea 的 fieldBinding 组合。边界是可证明的只读 member 使用。记录 spread、getter、未知值、逃逸、别名、赋值、增减、delete、destructuring / for-in / for-of 写入和隐式 arguments alias 均保守退出证明。没有按组件名、状态名或源路径添加例外。

真实 Textarea / Field Textarea 小闭包读回为 5 个 Rule、5 个 usage、0 unresolved；Field invalid 追到 Base Field control binding 的实际 State declaration。这是对应闭包的证明，不是全库接受。

### 不让已知调用抹掉未知调用债务

独立检查发现，旧候选在某 helper 有一个已知直接调用时，会全局消掉该 helper 的 declaration-only debt；另一个 `forward(def, external, paint)` 或 `external(paint, def)` 因而消失。

candidate04 按 resolved source identity 检查函数值引用。稳定直接调用、const alias、静态 import/re-export 转发可以保留；高阶传参、return、record 存储、borrowed call、mutable alias 以及未建模的 namespace / dynamic import 保持 unresolved。声明、正常静态转发与同名参数遮蔽不会自行构成逃逸。

独立、冻结快照的 14 个引用边界对照实际 14/14 匹配，并复核普通 getter 读取、eager spread getter 与原高阶调用漏口。该检查不借用生产 collector 的“已经证明”布尔作为独立结论。

## 实际执行结果

| 执行 | 实际结果 | 范围说明 |
| --- | --- | --- |
| 两个完整 CLI 文件 | 343 pass / 1 fail / 0 pending，344 总数，163.53s | 唯一失败是下节的完整来源库存门；没有删掉断言 |
| 正常 styles:preset:generate 03 | exit 0，288.5s | Shadcn 960、Brutalist 560；draft-family 与 motion palette 正常生成 |
| 公共 CLI build | 1/1，exit 0 | 62 files，1,223,099 bytes，CLI producer 4.025s |
| 正常 website CSS | exit 0，127.353s | 1462 package + website tokens，使用本候选自己的 CLI 和源 |
| 原 Rhea browser 8 例 | 8 pass / 0 fail | 文件总注册 28；另 20 例因明确 filter 未执行，不算通过 |
| 原 Button ghost whole file | 2/2，83.91s | 闭包比较 79.949s，未更改原 180s limit |
| 4 个 CLI 实现/测试 Prettier | exit 0 | 未产生格式修改 |
| git diff --check | exit 0 | 实现文件无 whitespace 错误 |

Browser harness 使用已存在的 `PROTO_UI_BROWSER_BASE_URL` 分支。外置 wrapper 沿原完整 Web 队列的 own-server 模式，先独立记录正常生成耗时，再起同一候选自己的 Astro，最后执行原测试。此执行证明布局成功后继，**没有声称满足 150 秒冷启动接受条件**。没有借别棵树的 CSS。用例结束后 own process group 已退休。

浏览器回执对三份 CSS 记录了 before/after hash 且一致。两个 Shadow companion 文件在事后另作只读 hash 与 mtime 记录；原 wrapper 没有对它们记录成对 hash，这个界限在独立 addendum 中明确保留，没有改写原回执。

## 仍未完成：完整来源库存

完整清单使用与生产 extractor 相同的 source-file 枚举分母，5000 个文件全部保留。candidate04 实际结果为：

- 3483 observations；
- 2996 evaluated rows；
- 1418 usages；
- **947 unresolved**；
- 独立库存枚举 100.809s，读回 heap 585,275,840 bytes / RSS 941,346,816 bytes。

所有 5000 个输入 SHA、观察行、原 entry key、实际 Rule 文件、call path 和 unresolved 内容均完整归档。完整 CLI 门因此仍为红。947 是尚无法证明的分析记录数，不等于 947 个已知产品 bug。

分类只帮助后续处置，不构成接受：常见剩余包含普通 helper 返回的 private Style State、module 常量/token map 与数组、条件 callback 形状、以及部分函数值尚未闭合的引用。不能以这次 Rhea 或 Form hover 消费成功清掉这些记录；也没有将未知项删掉、改成允许列表或伪造 accepted baseline。

该库存与 S1 #1178 的 lowered-hook 完整检查存在交叉。当前有界 S2 修复已恢复实际 Textarea 参数来源和浏览器 CSS 失败；没有据此宣称 S1 全库存或 Sprint 2 全部条款完成。

## 原始失败与载体

所有旧红保留：原 Rhea WC 的两份 JSON/截图、原 302/304 浏览器报告；capture spread 原失败；两个完整 CLI 早期 317/318、323/324；普通 getter / computed name / destructuring / arguments / escape 反例；有问题的早期 inventory caller 过滤；以及 source probe 的 circular-JSON driver 故障。后继绿不改写旧结果。

本地原件包 `accordion-cli-local-evidence-candidate04/receipts.tar.xz`：785,720 bytes，SHA256 `3d7640ab0fe174171986766c12d513528542f3930c02e63f5ccb4738d6d97e6b`，53 个外层成员逐项解包验证；其中包括独立 review 的 112 个原件内包。该包产生于最后 Button / browser 归档前，后两者另作后继载体，不修改它。

主要远端原件路径：

- `results/accordion-rhea-layout-candidate04-01/`：真实浏览器回执、原 Vitest JSON、正常生成日志、own Astro 日志、16 份布局事实及截图；
- `evidence/accordion-cli-public-build-5cb80-01/`：公共 producer 原始 JSON 与 launcher 回执；
- `evidence/accordion-style-presets-generate-5cb80-03/`：正常预设生成的原始日志与回执；
- `transition-types-tools/`：使用过的 source probe、原候选 patch、实际浏览器 wrapper。

本轮开始前已通过的 5cb 十组分发/成本门仍绑定原 5cb。它们不被改写成此候选或后续整合 HEAD 的重新执行；新整合接受由其真实后续执行另行绑定。

## 发布载体与原范围对账

本目录的三个原件包保存浏览器/正常生成（142 成员）、本地实现与独立反例（53 个外层成员，内含 112 份独立 review 原件）、最后 Button 与补丁（8 成员）。`complete-delivery.original.json` 和各 manifest 保留采集时的完整 hash；原作者 Markdown 另存 gzip，维护中的公开叙述仅补实际提交身份并格式化。

按 #1458 原文，F11/F13 接受生成文件旅程与父目录/不覆盖保护，F12 接受固定分发、声明依赖、profile/version 与可复现消费。5000 文件的全 lowered Rule 库存仍属于 #1178 原 S1 分母，不能作为 #1458 新增条件；本轮 Rhea、Textarea/Field 和 Button 的真实 S2 来源/CSS 缺口仍须修复并接受。#732/#1145 保留自己的完整 library × profile 分母，不能用本 CSS 库存替代。
