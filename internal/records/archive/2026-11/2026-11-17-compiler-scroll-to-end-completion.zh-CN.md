# Compiler Scroll completion：保留同 view 内较晚请求的状态

本记录是 2026-11-17 Scroll Web v4 之后的独立增量。工作树仍基于 `385d7c706c9e4c35280878efbb6e42d63d7df786`，增量基准是原 15 文件 v4 checkpoint；其 DOM support SHA-256 为 `eee4559c9be5af0f412370cc5f4501c4bff5297ac9d5c72153160f150952550f`。原 v4 patch、快照、归档及历史收据不改写。本记录的结果也不代表 root 后续整合 head 的一次执行。

## 问题与现行依据

原生成的 `to-end` 完成路径先发布 `requestStatus=applied`，再无条件写入 `followState=following`。通知同步交付时，合法的 applied watcher 可以在同一物理 view 请求 reveal；该 reveal 已把目标移入视口并使 state 变为 paused，外层旧请求的尾写却把这个较晚决定覆盖成 following。另一个入口是 `scrollFacts` 内的 following watcher：它可以请求 reveal，或者安排新的 pending end work；旧的 applied 尾写同样可能覆盖较新的 pending 状态。

依据是 [C-SCROLL-END-FOLLOW-0001](../../spec/contracts/C-SCROLL-END-FOLLOW-0001.yaml) 的 FACTS、RESUME、APPEND、REFLOW，以及 [Scroll Surface Host Capability](../../spec/host-caps/HC-SCROLL-SURFACE-0001.yaml) 的 end-follow/reveal 规则。现行 Runtime 的 `packages/modules/scroll/src/web/create-web-scroll-host.ts` 在 publish 前确定 completion state/status；`packages/modules/scroll/src/impl.ts` 的 `applySnapshot` 先发布 state，并用 snapshotEpoch 阻止较旧 snapshot 在重入后继续覆盖状态。catalog 没有单独命名 applied-watcher nested-reveal 顺序；最终 paused 的判断是从现有 atEnd/follow policy 与 Runtime 行为得到的推论。本增量没有新增或激活合同。

不能仅删除原尾部 following 写入：matching axis 的显式 to-end 在 reader contact 仍有效时，也必须保留明确 resume；普通 `scrollFacts` 会因 contact 选择 paused。也不能仅把尾部两个写入互换：following watcher 已可能在 `scrollFacts` 内执行，第二个 following 写入仍会覆盖它。

## 最小生成实现

`scrollFacts` 接收可选的显式 end axis。只有 policy 为 while-at-end、该 axis 与 follow axis 相同、实际已经 atEnd 时，才在原有唯一的 state 发布点恢复 following。普通位置事实路径保持原有分支；off policy 不再被旧尾写强行改成 following。实际测试同时保留 vertical/horizontal，以及有无 active contact 的 matching-axis resume 控制。

所有五个 request-status 写点通过 `setScrollRequestStatus`。它在调用 observed setter 之前增加内部版本，包含 setter 因同值而短路的情况。`applyScroll` 在物理写入与同步 fact 通知前保存版本，只在期间没有较新 status 决定时发布旧 completion 的 applied。已有 current binding/view 检查保留。这个单调版本用于避免把状态值相等误当成同一个决定；本批没有专门执行完整的同值 ABA 往返用例，不能把设计理由当成新增测试成绩。

guarded DOM 的最终 SHA-256 为 `4cc1d836904b75fb4fd9fb87d1b3b020dbbb7cc6b058eaf121415f0e52271215`。对应接受并实际应用的产品 patch SHA-256 为 `f07c1e350eb31b1cd12f48c9af7a78143f87241dcbd520b15845ac0861ec7734`。

## 真实诊断、普通消费者与边界

| 独立运行 | 实际结果 | 输入与含义 |
| --- | --- | --- |
| `to-end-applied-two-v4-red` | 1 passed / 1 failed / 原 17 filtered | v4 直接 emitted host：普通 following 正控通过，applied watcher 内 reveal 后旧尾写覆盖 paused |
| `to-end-eight-v4-baseline` | 4 passed / 4 failed / 原 17 filtered | 保留原 2 并增加 matching horizontal/contact、off、state watcher reveal、新 pending 控制；四个错误分别为 paused 被覆盖、off 被覆盖、重复 following、较新 pending 被 applied 覆盖 |
| `to-end-guarded-v1-full25-candidate` | 25 passed，0 skipped | 24 个直接 emitted host 行为与 1 个 support strict；包含新增 8 与原 17，不代表普通框架阶段验证 |
| `to-end-ordinary-four-v4-baseline` | 0 passed / 4 failed，0 skipped | 四目标普通 compileProject/writer/native owner；所有准入、挂载、watcher/partsOf/嵌套 reveal 及物理断言成功，仅最终 paused 断言失败 |
| `to-end-ordinary-four-guarded-candidate` | 4 passed，0 skipped | 与上轮同字节作者、helper 与 fixture；guarded DOM，Vue2 尚未增加 state-next 映射 |
| `to-end-ordinary-four-guarded-strict` | 3 passed / 1 failed，0 skipped | 检查上轮实际捕获的四套完整图；Vue2 有一条 TS2571，其他三目标通过 |
| `to-end-state-next-four-fresh-strict` | 4 passed，0 skipped；15.84 秒 | 同字节作者重新生成完整图，7,295 个仓内输入 before/after 一致；四套图均 0 诊断 |

普通消费者以合法 setup `scroll.endFollow.requestStatus.watch((run,event)=>...)` 注册，回调中使用 `run.anatomy.order.partsOf` 取得当前 part，再发送 semantic reveal。作者不获得 DOM、像素、假 Run 或测试 phase 能力。fixture 显式提供 viewport 100、extent 400、target start 150 的几何，并控制 RAF，把显式请求与 mount end work 分开。

四目标旧 v4 的共同观察为：applied watcher 入口 following/atEnd=true；nested reveal 返回 dispatched、paused/atEnd=false；外层旧请求返回 following/applied。物理写入仅 `[300,150]`，最终 offset 150。guarded 同 fixture 保留同样两次物理写入和 nested 结果，外层返回改为 paused/applied。这个场景没有尚未完成的旧 end work，故不能错误要求 requestStatus 变成 rejected。

旧 v4 ordinary baseline 临时恢复 DOM 后执行，并实际记录 before/after 都为 v4；`finally` 再恢复 guarded candidate，逐文件验证 candidateRestoredExactly。恢复后的候选不算基线执行输入。ordinary green 绑定 7,294 个仓内 package 源码、测试、配置及根配置文件；首次 strict 绑定 7,295 个。两轮输入 before/after 均一致。每套 ordinary 图包含作者、writer/compilation 结果、完整生成 source/support/provenance；四目标合计 98 个捕获文件，逐一留存 SHA。

首次 strict 复制实际捕获图的每个字节到仓内临时目录，以解析真实 framework 依赖；没有重新生成替代图。检查包含所有 TS/JS support root：React 12、Vue3 11、Vue2 11、Web Component 12。配置保持 strict、noEmit、allowJs、checkJs，skipLibCheck 与既有 strict harness 一致；Vue2 的 vue 类型仍解析到项目安装的 Vue2。原图与检查副本的前后哈希均核验。

## Vue2 输出类型缺口

首次 strict 的唯一诊断是 Vue2 `Surface.js` offset 56222、生成行 940 的 TS2571。作者 `surface.proto.ts` 行 43 使用合法的短路 guard：`event.type!=='next'||event.next!=='applied'||!completionArmed`。watch 参数已有正确的 `StateEvent<string>` 注释；右支的窄化 event 却被输出成 `/** @type {unknown} */ (event)`。

Parser 给 watcher 的 event `state-event:string`；`||` 右支使用左条件为 false 的 refinement；`expression-types.ts` 因此得到既有 `state-next:string` atom。共享 JavaScript lowering 对 narrow 调用目标的 typeName；Vue2 缺少 state-next 分支并落入 unknown。实际同作者 React/Vue3 输出已有 `Extract<StateEvent<string>, {type:'next'}>`，Web Component 也保留具体 next-event 结构。本轮没有序列化 raw IR dump；该 ValueType 链条是 checked refinement 与唯一 emitter 分支、实际输出的源级追踪。

最小修复只给 Vue2 typeName 增加与 React/Vue3 同义的 state-next → Extract 映射。没有改作者 guard、测试 cast、source/IR 准入权限、strict 选项或 support 文件。该失败属于真实 Vue2 输出类型缺口，与仍待补齐的 AnatomyPartView alias 无关。state-disconnect 等未触发分支不随带扩展。

接受并实际应用的两行 patch SHA-256 为 `8f91d355711aa84522cfc33a1165652f9785963870cfceba4a75743a34f28c09`，格式化后的 Vue2 source SHA-256 为 `d2b62301a7cb04b198be36d514e9add1d88636ee886177681bfca031186d177b`。作者/helper 字节保持原样；新 strict fixture 的 fresh-generation 分支仅传入既有可选 captureDirectory，以保存新的完整图。原 TS2571 图与收据不覆盖。

最后一轮 `to-end-state-next-four-fresh-strict` 在格式化后的候选上实际通过 4/4。16 个作者文件与 ordinary 旧红/绿完全同字节；旧 TS2571 图不变；新捕获副本逐文件等于严格检查实际读取的 before/after 文件。实际生成 TS/JS source 的对比只发现 Vue2 Surface.js 中该一个 JSDoc narrow 从 unknown 变成 Extract，其他三目标和全部 support source 字节不变。该轮是四套完整图严格检查，不把前一输入上的 ordinary 4/4 改写为新产品的一次行为执行。root 在组合 head 的行为与严格检查另行提供证据。

## 保留的未完成边界

本增量没有实现显式 to-end 的 pending/layout-ready 合同、nonmatching/disabled axis 准入、显式 end 后清除 readerIntent，也不声称更早 axis-fact 通知期间的整个 snapshot 已具备原子性。reader-input attribution、浏览器原生布局/输入、Dart/Flutter/GPUI 验收继续独立记账。Core AnatomyPartView alias 与 mutable typed callable initializer 的 source/portable IR 覆盖仍是后续独立检查点。

所有观察来自本次工作树和实际收据，不引用丢失候选的旧测试成绩。各轮 counts 分开列示，不相加成为最终 head 全量成绩。root 后续按 hunk 整合后的验证是另一个输入；本记录不是正式 APPROVED、catalog activation 或完整 Compiler/native 接受结论。

## 原始材料

本增量的可读结果见 [evidence summary](./evidence/2026-11-17-scroll-to-end-summary.json)。完整 raw log、Vitest JSON、实际 before/after receipts、原失败与修复后生成图、各次 fixture 和 source snapshot 保存在 [raw evidence archive](./evidence/2026-11-17-scroll-to-end-raw-evidence.tar.gz)；[member manifest](./evidence/2026-11-17-scroll-to-end-raw-evidence-manifest.json) 逐文件绑定散列。原 v4 记录和证据继续由 [前一记录](./2026-11-17-compiler-scroll-recovery.zh-CN.md) 引用，本增量不重复发布该大包。

## 当前组合分支的实际验证

root 将两个精确产品补丁按 hunk 合入已发布的 `9520b5adb6618bd558c2e2559f7db7135894d19e`，保留此前 Every、非尾默认参数、callback owner 与 Scroll checked-value 的其余源码。四个测试／共享 helper 与冻结件逐字节相同；Vue2 仅增加上述两行，未整文件覆盖。独立复核从该公开 base 在内存中重放补丁，精确复原两个受测产品文件。

最终整合输入在格式检查通过后实际执行五个文件：**73/73，0 skipped、0 unhandled、exit0，41.387 秒**。组成是 host/support 25、position consumer 12、既有 reveal consumer 28、新 to-end consumer 4、新 to-end strict graph 4。457 个明确枚举的 compiler/core/helper/config 输入在执行前后完全一致；新增证据记录后再次检查这些输入仍匹配。它们不是推导的完整动态依赖闭包，也没有把隔离七轮的数量相加为本次成绩。

原始命令、起止时间、完整 before/after hashes、原始 JSON/log 字节，以及两个独立工程复核记录保存在 [整合证据](./evidence/2026-11-17-scroll-to-end-integration.json)。root 同时独立重读并核对隔离 archive 的全部 378 个成员与七轮原始 artifact 引用。DCO 的错误 trailer 与第十六笔成功补救继续由[独立记录](./2026-11-17-scroll-dco-remediation.zh-CN.md)保留；本次产品回归不替代最终 CI、原生矩阵或正式批准。
