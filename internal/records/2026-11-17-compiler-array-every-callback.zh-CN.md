# Array.every 的实参、可达能力与默认参数修复

## 问题与责任层

本记录回应 [PR #1479 的 callback 实参审查](https://github.com/Proto-UI/Proto-UI/pull/1479#discussion_r4586811122)。复现基线是 `385d7c706c9e4c35280878efbb6e42d63d7df786`；未提交候选的具体身份由同行的 [机器证据](evidence/2026-11-17-compiler-array-every-callback.json) 中源码、夹具和命令的摘要共同确定。

ECMAScript 的 [`Array.prototype.every`](https://tc39.es/ecma262/2025/multipage/indexed-collections.html#sec-array.prototype.every) 向 callback 传入当前值、数值索引与正在遍历的数组。Compiler 的既有原生执行路径已经如此调用，但源码上下文、`intrinsicResult` 的校验和 callable flow 只描述了第一个实参。由此产生四种可观察的不一致：合法的第二、第三参数被拒绝；不匹配的可选参数类型漏过校验；根据索引或数组可达的交互能力被漏裁；实际已经提供的索引仍被分析成缺省，误认为需要执行默认表达式。

修复归属 Compiler 的 intrinsic 调用契约和编译期可达性分析。它遵循 `internal/compiler/source-language.md` 的既有私有语言入口、`internal/compiler/atomic-lowering-completion.md` 的目标原生输出方向，以及 draft `C-COMPILER-OBSERVABLES-0001-EVIDENCE` 的证据边界；没有提升该 draft 的生命周期。

## 为什么这样修

`arrayEveryCallbackParameters` 在一个位置描述三个已校验的实参类型，源码上下文、源码/序列化 IR 共用的 intrinsic 校验和 callable flow 共同使用它。只在这个 intrinsic 的校验处按 callback 声明的形参数量取实参，允许普通 JavaScript callback 忽略尾部参数；通用 `checkedCall` 的参数策略不变，必需的第四形参仍然被拒绝，已声明的第二、第三参数仍接受完整类型检查。

callable flow 将实际提供的三个值作为已检查的纯数据事实传入，保留当前执行阶段。未知值仍保守检查默认表达式；已证明存在的数值或数组不再伪造一次默认调用；顶层类型可能包含 `void` 的数据仍保留默认表达式及其副作用。这里不从数组元素内部的 `void` 推导数组对象本身缺失，也不改 callable、capture、cell 或 nominal authority 的擦除边界。

新的严格产物检查还暴露了 Vue 2 的一个相关输出错误：一个有真实默认初始化器的参数，在后面还有必需参数时又被 JSDoc 标成 `[name]`，导致 TS1016。Vue 2 现在只为无默认初始化器的 optional 参数输出该 JSDoc 标记；真实 JavaScript `= expression` 及其调用时行为保持不变。测试中的必需第三参数和严格检查选项均保留。

## 执行证据与夹具校正

| 检查 | 实际结果与绑定范围 |
| --- | --- |
| 最初 30 项基线 | 2 通过、28 失败；之后增加了一个 `void` 默认副作用负控 |
| 31 项完整基线 | 3 通过、28 失败；12 个源码/IR 失败、8 个 consumer 准入失败、8 个实际能力输出失败 |
| 第一版候选 | 25 通过、6 失败；六个剩余失败来自夹具选中了内部 button，未选取物理交互根 |
| 校正物理根后的同一组 31 项基线 | 3 通过、28 失败；只恢复产品代码后实跑，并在 finally 按摘要恢复候选 |
| 校正后的 31 项候选 | 31 通过、0 失败、0 跳过，退出码 0 |
| 五个既有受影响文件与四个严格产物检查 | 123 项中 122 通过、1 失败；119 个既有用例全部通过，失败为 Vue 2 TS1016 |
| Vue 2 JSDoc 修复后的同一四个严格产物检查 | 4 通过、0 失败、0 跳过，退出码 0；四个完整 supporting-file graph 均纳入检查 |

物理根校正只改变观测目标：React、Vue 与 Vue 2 使用 `[data-pui-root]`，Web Component 使用实际 host 子根；`tabindex`、聚焦效果和销毁后节点断开断言没有删除。完整红/绿命令、前后输入摘要和原始失败均保留。Vue 2 的原始空根观测也与日志中的缺失 `asFocusable` 能力错误分开记账，不把夹具错误归到产品。

15 项源码与 IR 检查覆盖零到三个形参、上下文推断、可选第四参数、错误的索引/数组类型、必需第四参数、回调阶段副作用、实际已提供参数的默认表达式，以及序列化 IR 的参数类型伪造。16 项真实编译、写出、导入与挂载的 DOM consumer 检查覆盖四个目标的索引/数组分支交互、数组同一性、短路、零形参与默认表达式次数。默认表达式例子的观测值为索引默认调用 0 次、第四参数默认调用 2 次、合计 28。

四个 strict 检查覆盖 React、Vue、Vue 2 和 Web Component 的完整产物图；Vue 2 使用自己的 Vue 2 类型入口。未过滤 TS1016、未删除 supporting files，也未将 `checkJs` 或 `strict` 关闭。之前的 31 项、119 项和之后的 4 项来自不同已明确绑定的执行，不能合写成同一次最终源码的 154 项运行。

## 验收边界与后续

独立静态复核检查了三个调用分析文件及 Vue 2 单行输出改动，并核对红/绿记录和实际输入摘要。该复核不是 GitHub formal approval。随后在已发布父提交 `54e37f37beed260996d598423637f251140bbec0` 上按原补丁合并，本修复与 callback owner、terminal disposal 的六个文件共 113 项实际全部通过，0 失败、0 跳过、退出码 0，用时 36.140 秒。16 个产品及夹具输入在运行前后摘要一致；该次执行包含本修复 35 项、外部回调 44 项及其严格产物 4 项、终态销毁 30 项。组合日志 SHA-256 为 `3de98bc47e64b928aca647e8e188a4cf08e8977add5a4e80c66072d7da10768c`。

这些 consumer 通过测试 DOM 环境执行目标框架产物，不是原生浏览器或 macOS、Flutter、GPUI SDK 验收。本机没有 Rust/Dart/Flutter SDK。本修复未增加 `thisArg`、其他数组方法、稀疏数组模型或新的公开 profile；也没有改原生 `every` 迭代算法、引入 IR 解释器或放宽 e46 authority 边界。

共享 callable type formatter 与未调用函数的 JSDoc 中还有非尾部默认参数的相邻输出路径，本次未执行其独立反例，未将它们计为已修。全量 Compiler、全仓类型检查和最终原生矩阵仍需各自的真实运行证据。

## 发布后整合复核补记

在 `e329c21ef07a5e7d05b093250ee5ae2be80a3eed` 发布后，另一代理从父 `54e37f37beed260996d598423637f251140bbec0` 重建已复核的四文件产品补丁，结果与整合源码逐字节一致；九个先前已整合的其他产品及夹具文件与父提交保持一致。复核还独立读取了同一次 113 项的原始日志和 JSON，并检查全部 16 个输入摘要。格式化后的 consumer fixture 经 TypeScript AST token kind/text 比较，只有 trivia 差异。

完整复核已追加到机器证据的 `postPublicationIntegrationReview`。这是对既有执行的独立检查，没有新增一轮测试，也不增加通过数量。
