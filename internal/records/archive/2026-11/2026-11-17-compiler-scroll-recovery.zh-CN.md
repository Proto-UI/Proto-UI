# Compiler Scroll 恢复：按当前源码重建请求结果与宿主证据

本次工作从 `385d7c706c9e4c35280878efbb6e42d63d7df786` 的独立工作树开始。旧临时候选 `fe001` 的源码和执行材料已经丢失；本记录不复用它的源码身份、Dart 数量或 native 通过数。`e11e2fc9b` 后来只增加了站点测试，本次结果仍绑定自己的原始 base 与实际候选补丁。

## 合同与拥有层

`packages/core/src/scroll.ts` 已定义 `ScrollSurfaceRequest` 和 `ScrollSurfaceRequestOutcome`。请求结果是 `dispatched`、`queued` 或带 `not-mounted` / `not-declared` / `unavailable` 原因的 `rejected`。`C-SCROLL-0001-C` 的 `to.position` 是归一化位置；`C-SCROLL-0001-AVAILABILITY` 禁止把不可用请求缓存到未来 view；`queued` 只属于同步 attachment transaction。`dispatched` 表示送到当前宿主引擎，不保证用户最终看到目标。

`C-SCROLL-TARGET-REVEAL-0001` 与 `HC-SCROLL-SURFACE-0001-TARGET-REVEAL` 分别拥有逻辑身份准入和宿主几何。当前 family、part、nearest same-role surface 与 view authority 必须持续有效；Web 宿主只移动自己的 vertical offset，保留 focus、horizontal offset 和 ancestor offset。有效的 reveal（包括 no-op）可以取代旧 pending end 请求，无效 reveal 不可以取消它。reveal 不排队或重放。

现行 `T-SCROLL-TARGET-REVEAL-0001` 只记录 Runtime / model 证据，明确不能认证 Compiler 或非 Web；native Search 的独立未完成条件保持不变。本修复不修改这些实体的生命周期或扩充语义豁免。

## 第一检查点：请求类型与 Web position 消费

Compiler 的原 `scroll.request` 规则只接受粗粒度 `record` 并返回 `void`。生成的 DOM helper 把 `to.position` 当作像素，也把 view 不可用时的请求写入 `pendingScroll`，随后在另一个 view 上重放。普通 React、Vue 3、Vue 2 和 Web Component 消费者均实际重现了这些行为。

修复在 Core 类型映射中保留请求的 discriminant 与 Anatomy 名义字段；operation 现在产生结构化结果。Scroll 参数单独使用有限的 `valueSchema`，没有放宽其他 operation 的 `types` 或 `module-config` 规则。DOM helper 的 position 路径以同一 physical root 与 generation 计算、写入和检查结果；`to` 与 `control-drag` 使用归一化范围；不可用请求不再进入跨 view 缓存。

普通 record 的 string 字段默认会被扩宽，已有 `argumentData` 只能证明纯数据。新增 `argumentValue` 在 source / IR 表达式完整验证之后重建 literal、record 和 conditional 的事实，并保留已经检查的名义字段。reference 只使用它当前的 checked type，不读取历史 initializer。`valueAssignable` 的 authority-erasure 检查、parser 的独立前置拒绝，以及全局 `canNarrowValue` 均保留。IR annotation 只有在先递归验证完整源表达式及其 recorded types 后，才可使用这份值事实；未验证 metadata 不能授予 Anatomy 或 callable 权限。

## 执行记录与夹具修正

所有执行均使用 Node 24.22.1、pnpm 10.32.1、Vitest 2.1.9，单 worker 并关闭 file parallelism。运行有独立超时、原始日志、JSON、命令和输入 SHA-256；首次失败不会被候选通过结果覆盖。

| 输入 / 测试边界 | 实际结果 | 归因 |
| --- | --- | --- |
| 原始 base，19 source / portable IR cases | 19 failed | 5 个 void 结果、Core alias 缺失、合法 nominal reveal 被拒、8 个畸形请求被接受、4 个伪造 IR 被接受 |
| 原始 base，首个 12 Web 消费夹具 | 12 failed | 4 个 undefined outcome 可直接观察；8 个 offset 断言最初选错模板节点，不能单独作为位置实现证据 |
| 原始 base，修正后的同 12 Web cases | 12 failed，0 skipped | 4 目标均实际移动 by(80) 但返回 undefined；to(0.5) 得到 0.5px 而非 400px；detach 后的 to(0.75) 在新 view 重放 0.75px |
| 首候选 31 cases | 8 passed / 23 failed | 直接用 widened record type 匹配包含 nominal 的 union 过严，合法输入被 source intake 阻断；据此增加 checked value schema |
| 修订候选 31 cases | 31 passed，0 skipped | source / IR 契约与四 Web position 消费均通过；合法 reveal 此时仅证明类型准入 |
| 旧 annotation proof，额外 10 cases | 5 passed / 5 failed | 2 个真实 annotation 缺口；另 3 个负例的合法前提依赖该 annotation，未执行到伪造断言 |
| 修订 proof，额外 10 cases 首次执行 | 9 passed / 1 failed | 1 个测试 walker 把 DataType record 误当 ExpressionIR record，未执行到 nominal 拒绝断言 |
| walker 修正后的定点 nominal 负例 | 1 passed / 9 明确过滤 | 未验证的普通 record 不能通过伪造 nominal metadata 获得 Anatomy part 身份 |
| 独立合法前提、旧 annotation proof，同 10 cases | 8 passed / 2 failed，0 skipped | 仅真实 mixed annotation 与 nominal reveal alias 被旧 proof 拒绝；全部七个负控都执行到自身拒绝断言 |
| 独立合法前提、候选 proof，同 10 cases | 10 passed，0 skipped | 三个正控与七个负控通过 |
| 既有 authority 子集 | 87 passed，0 skipped | `control-label-callable-context` 57、`structural-authority` 13、`nominal-flow-normalization` 17 |

物理宿主夹具修正依据生成物的真实边界：React / Vue / Vue 2 使用外层 `[data-pui-root]`；Web Component 使用 custom element host。`section` 是作者模板节点。Web Component 可以保留宿主并替换 view，所以测试区分逻辑 view 与 DOM element 身份。几何是明确注入的 Happy DOM model 输入，不代表浏览器布局、原生输入或视觉验收。

额外 10 项中的三个 IR 负例改用旧 proof 也能准入的独立合法前提，保留相同的伪造和拒绝断言。两次临时恢复旧 proof 均在 `finally` 中恢复文件，并逐文件核对候选 SHA-256。第一检查点共 128 项候选通过（31 + 10 + 87），不包含被过滤、仅检查或尚未执行的路径。生成物严格类型与完整 reveal 行为仍是后续检查点。

审查另发现非 finite 位置的边界：本批位置消费者只证明有限数及有限越界值。现行 Module 的 `clampRatio`（`packages/modules/scroll/src/impl.ts`）与 Web host 的同名函数均将非 finite 值转换为 0；第一检查点生成 helper 对 `+Infinity` 会得到 1，对 `NaN` 会抛错。相关 catalog 目前只有 normalized position 要求，没有指定这两种输入的映射或拒绝结果，因此该实现差分不能伪装成已确定的规范结论。需要从作者内部算术（例如 `1/0`）触发的普通消费者或直接 emitted closure 取得事实，不能用 public 参数的 finite guard 拦截来替代该路径。处置与新增证据另记，冻结件仍是 draft 检查点。

## 第二检查点：Web reveal、同步 attachment 与当前 view

第二检查点使用四目标真实 `compileProject` / writer 图：root、surface 和 item 是三个独立 entry，共享同一个 family 模块和生成 support 图。普通 React、Vue 3、Vue 2 和 Web Component 消费者挂载 direct、nested 和 sibling 组合。销毁通过框架 parent 移除子组件或 Web Component 的正常 owner 接口完成。直接 emitted host closure 模型补充受控 ResizeObserver、RAF 和同步通知重入；它不替代普通消费者的阶段或框架证据。

Reveal 消费者的早期运行必须逐层归因，不能把 intake 拒绝写成几何红：

| 实际运行 | 结果与边界 |
| --- | --- |
| 首轮 24 ordinary + 12 emitted host model | ordinary 24 均被共享 family 模块的顶层数据 alias 准入规则阻断；model 2 passed / 10 failed，其中两项 attachment 请求错误地直接 dispatched，八项 reveal 在已进入宿主路径后抛 invalid request kind |
| family declaration 内联后的 ordinary 24 | 24 均因 fixture 调用了不存在的 `Run.lifecycle.dispose` 被拒；Core Run 只有 setPresent / captureViewOperation，不能据其他 owner 的销毁入口推导作者 API |
| 改为正常 framework / native owner 卸载后的首 case × 4 | 4 failed / 20 明确过滤，均在合法类型化 `()=>ScrollSurfaceRequestOutcome` 初始化闭包的返回对象 widening 处被拒；这是 Compiler 上下文返回类型的准入/覆盖缺口，不能因缩小 fixture 而标成无产品问题 |
| 保存 request 的最小已准入 ordinary fixture，React 一项 / 四目标首项 | 分别 1 failed / 23 明确过滤、4 failed / 20 明确过滤，均到达生成宿主并抛 invalid request kind |
| 同一 request fixture 的完整 ordinary 24 | 4 passed / 20 failed，0 skipped；detach / no-replay 控制通过，20 项实际宿主 reveal 未实现 |

为隔离几何，消费者保存已准入的 `ScrollSurfaceRevealRequest | null`，保留原 family / part 身份，并在调用时请求。前述合法闭包及原失败记录保留；这次缩小输入没有修复该语言覆盖缺口。

`native-scroll-reveal.ts` 保存独立生成 helper 的源码，不调用 Runtime 或 Adapter，不引入 IR 解释层。几何算法依据 `packages/modules/scroll/src/web/target-reveal.ts`，本次参考文件 SHA-256 为 `20024a50985ab85f364bcf1bab78ffafa89f443a8453d538ca47289b35d5c92c`。已有 support specialization 继续裁剪未到达 Scroll 的代码。helper 处理当前同文档 rendered descendant、resolved inset、最近边缘、原生范围及覆盖 viewport 的 no-op，并在测量、写入前后重新检查当前目标与绑定。临时覆盖的 `scroll-behavior` 只在自身值仍有效时恢复，不覆盖重入产生的新值。

DOM helper 用 `{surface, epoch}` 的同一 binding 拥有 attachment、观察者、位置事实与 end-follow work。position 请求只可在该次同步 attachment 中排队；reveal 在 attachment 中拒绝。替换 view 使旧队列和旧工作失效。end-follow work 在发布 pending 通知前取得自己的身份；旧 RAF 即使迟到也不能清除新 work。有效 reveal 包括 no-op 会取消当前同轴 end work，无效 reveal 保留它。

### 重入、时序与生成类型的实际结果

| 运行标识 | 实际结果 | 结论与限制 |
| --- | --- | --- |
| `reveal-candidate-v1-green` | 35 passed / 1 failed，0 skipped | 原 24 ordinary 中 React retained-part 的 after-act offset 为 300，断言预期 50；原 12 emitted host cases（含 1 support strict）通过 |
| `reveal-v1-retirement-and-reentry-probes` | 3 passed / 3 failed / 35 明确过滤 | React 时序 probe 保留原失败；新增 5 个重入 case 中 3 通过、2 个 projection observer 抛错变成双项 AggregateError |
| `reveal-candidate-v2-green45` | 44 passed / 1 failed，0 skipped | 24 ordinary 行为、16 emitted host model 行为与 1 support strict 全部通过；4 个 ordinary 完整生成图 strict 中 Vue 2 失败，其余 3 通过 |
| `reveal-candidate-v3-strict4-green` | 4 passed，0 skipped | 同 fixture、同 strict 选项、同完整生成图，加入有限 Vue 2 nominal JSDoc 映射后全部通过 |
| `scroll-web-v3-related46-green` | 46 passed，0 skipped | `native-support-plan` 25、`native-support-capabilities` 9、`scroll-position-consumers` 12；实际 before / after 输入散列一致 |

React retained-part probe 的四点分别是卸载后 50、request 前 50、request 同步后 50、act 完成后 300。请求结果一直是 `rejected/unavailable`。唯一 300 写入的调用栈来自已存在的 end-follow RAF，阶段为 act flush。最终测试据此比较请求自身的同步前后 offset，仍要求 unavailable；无效 reveal 保留旧 end work 的合同另有直接 host case。原 after-act 失败、四点采样和写栈均保留，未把它改写成产品已吞掉移动。

projection 通知的真实问题是不同 physical view 共享同一 generation：unmount 已增加 generation、清空 root，然后发出的 unresolved 通知可能排在新 mount 的 system 通知之后。原 watcher 抛 `undefined` 或真实 `Error` 时，旧 unresolved 会再次调用 watcher，产生额外错误。两行修复同时记录通知的 `viewRoot`，只在非空且仍与当前 root 相同、generation 相同、原本 ready-gated 条件成立时交付。listener Set、owner State 和 Anatomy 订阅通道不变；同一逻辑 watcher 接受两个有效 view 的 system 通知作为保留订阅的正控。旧 listener 清理、当前新 view 可继续请求和原始错误身份均有断言。

Vue 2 的四条 strict 诊断来自已检查的 Anatomy nominal type 在 JSDoc 中仍输出为 `unknown`：三条 `unknown` 不能赋给 `NativeAnatomyPart`，一条 reveal request 的 family / part 不兼容。修复只在已到达 `usesInteraction` 的分支映射 `anatomy-family` 与 `anatomy-part` 两个既有 atom，不放宽类型、不丢弃 support 文件、不改变 strict 选项。

早期 v2 / v3 strict 收据只记录了运行前的输入散列。之后的冻结快照与这些散列相符，但这不能追认为当时的 after 输入。`scroll-web-v3-related46-green` 起的运行才同时实际记录 before 与 after；每轮事实按各自收据报告，不补写历史散列。

### 独立复核发现的严格祖先边界

只读复核核对了 [身份合同](../../spec/contracts/C-SCROLL-TARGET-REVEAL-0001.yaml) 与 `packages/modules/anatomy/src/impl.ts` 的 `resolveAncestorInstance`：Runtime 从 part 的 parent 开始找同角色祖先，Compiler 候选却调用了包含自身的 `ancestor(participant, ...)`。当 target 本身是后代 surface 时，当前外层 surface 是它最近的严格同角色祖先，合法请求会被候选错误拒绝。内层 surface 下的 item 仍归内层，这是另一个判断，原负控保持。

`scroll-strict-ancestor-four-red` 在冻结 v3 产品上执行四目标普通消费者：4 failed / 24 明确过滤。四项均已真实编译、挂载并调用；实际 `unavailable`、外层 offset 50 → 50，预期 dispatched、50 → 70，内层自身 offset 23 保持。7 个产品文件和 2 个 fixture 的 before / after 散列实际一致。最小修复经本地 source review 后，只在当前 reveal 的 surface-role predicate 排除 participant 自身，保留 domain 查找、self 拒绝和其他 ancestor 使用。

| 最后两轮定点执行 | 实际结果 | 输入绑定 |
| --- | --- | --- |
| `scroll-strict-ancestor-eight-green` | 8 passed / 20 明确过滤；14.96 秒 | 四个新增合法后代 surface 正例与四个既有 nested-item / sibling / self / other-family 负控；实际 before / after 散列一致 |
| `scroll-strict-ancestor-expanded-strict4-green` | 4 passed，0 skipped；19.06 秒 | 增加 revealSurface 方法后的三个 entry 完整生成图，四目标均 strict；实际 before / after 散列一致 |

这次修复后的四个正例均观察到 dispatched、外层 50 → 70、内层自身 23 不变。最后一轮没有重跑其余 20 个 ordinary case、16 个 emitted host model 行为或相关 46 项；它们的通过结果分别绑定前述 v2 / v3 输入，不能写成最新 v4 的一次全量执行。最终 v4 只比冻结 v3 产品增加这个已审阅的一行严格祖先修复。

## 冻结输入与复现范围

最终 Web v4 候选相对 base `385d7c706c9e4c35280878efbb6e42d63d7df786` 修改 7 个产品文件，另有 7 个测试 / 共享消费者文件与本记录。root 后续集成分支在本地工作的同时已经前进，必须按 hunk 保留该分支的 default、Every、callback 和 owner 边界修复；这些分支的新结果不能归到本候选 base。

| 产品文件 | 最终 SHA-256 |
| --- | --- |
| `packages/compiler/src/core-value-types.ts` | `ad7ec0bec9b0ed2fcba0e74fe845fdff08b4a0bdb859b2e22a7b725920bcba9f` |
| `packages/compiler/src/operations.ts` | `5d51df1e742e59c3d9dacaa04ab90e80762d9a8469485d6034622694829c843c` |
| `packages/compiler/src/parser.ts` | `2a6ea40575822ae8851c451f863fa6b1ee7c9ece1de2a50c78f0eda358a2e525` |
| `packages/compiler/src/ir-validation.ts` | `d5a4dfe968bff6f36917276d15340076c8d1f132f325df8430fc63460219f166` |
| `packages/compiler/src/native-support/dom-modules.template.ts` | `eee4559c9be5af0f412370cc5f4501c4bff5297ac9d5c72153160f150952550f` |
| `packages/compiler/src/native-scroll-reveal.ts` | `74743c0ee766c9e70dcfd221f1809a5ee54cb0fd54c616586e56cbf3ad5954d5` |
| `packages/compiler/src/vue2-source.ts` | `db6c6d7f39be8fa9e63d4655ea169f5d7db9b5839dcbb4d51eddf4f4a4af7df8` |

最终两条实际测试命令的核心参数如下；每次执行的绝对 cwd、独立 outputFile、起止时间、180 秒上界、完整前后输入散列见同名 receipt。

```sh
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/scroll-reveal-consumers.test.ts -t 'reveals a descendant surface part|rejects an item owned by another surface' --maxWorkers=1 --minWorkers=1 --no-file-parallelism --reporter=default --reporter=json
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/scroll-reveal-types.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism --reporter=default --reporter=json
```

原始 red、首次失败、修正夹具及每轮 report / receipt 分别保存，冻结包提供它们的内容散列。它们是本地执行证据，不是正式 catalog activation、APPROVED 或 native completion。

## 保留的未完成边界

Core 导出 `AnatomyPartView`，Compiler 的 Core 类型表尚未映射到既有 `anatomy-part` 名义类型。这是静态确认但尚未运行的 alias 覆盖缺口，需要独立 source / IR 正反控。上述合法 mutable typed callable initializer 的返回上下文缺口已有实际准入红，也未在本 Web 检查点修复。

Dart union / shared shape 仍需要新的实际多 entry writer 消费者；Flutter 与 GPUI 的结构化 outcome 和各自原生入口仍未验收。PATH 中未找到 Dart、Flutter、Cargo 或 Rustc，仅凭这一点不作原生执行结论。非 Web reveal 按现行明确准入和 availability 边界报告，不能通过新增豁免消除未完成条件。

本批 Web 几何是 Happy DOM 的显式尺寸模型，不是浏览器 layout 或 native input。没有完成完整 Scroll conformance、四 Adapter Search 短视口旅程、横向 reveal 或外部 clipping 多 surface 认证。非 finite 归一化差分仍按前述未定语义处理。Box 不可用，正常沙箱 Chromium 启动被环境阻断；没有换凭据、充值或降低沙箱。

这是一份本地修复与证据记录，既不是正式 APPROVED，也不是发布批准或完整 Compiler / native 接受结论。

## 当前集成分支的组合验证

root 将上述冻结 v4 补丁按 hunk 应用到已发布的 `7d0e2dfcaffcdf60075166df8cb04662baeba187`，保留该分支的 Every、非末尾默认参数、外送 callback 与 owner 边界修复。重叠的 parser、IR validation 与 Vue 2 JSDoc 差异已逐段核对。

在这份真实组合源码上，一条新的 12 文件命令执行了 **150 / 150**：Scroll 请求／证明／position／reveal／host model／strict 共 90，Every 35，非末尾默认参数 25。运行耗时 94.349 秒，exit 0，0 skipped，0 unhandled；455 个明确枚举的 compiler、core、test helper 与配置输入在运行前后散列一致。这里枚举的是记录所列目录，未冒称自动收集了所有动态依赖。

之后的格式检查指出六个文件的排版差异。首次格式备份因环境 ENOSPC 失败，尚未执行 formatter 或改变源码；清理三个已结束工作树的可重建依赖后，455 个输入仍与成功运行完全一致。格式修复只改变排版：六文件的 TypeScript AST、literal／raw template 内容与声明标志均逐一等价。150 项结果仍绑定格式化前的实际输入，此处记录这次机械转换，没有伪称格式化后重新执行了整轮测试。最终 diff 检查另行保留。

[机器证据](./evidence/2026-11-17-compiler-scroll-recovery.json) 保存冻结补丁、19 轮历史记录的原 JSON 内容、独立审查及严格祖先闭环、组合命令的实际 receipt／JSON 和格式转换证明。历史失败与各阶段的 before-only 限制保持，不用本次组合通过改写旧记录。

组合验证后的有界诊断还复现了既有 `to-end` 尾部重入缺陷：两个新增 emitted host case 为 1 passed / 1 failed、原 17 项明确过滤。普通 to-end 正控得到 300 / atEnd / following / applied；applied watcher 内新的合法 reveal 返回 150 / 非 atEnd / paused 后，旧 outer 尾部仍把 state 写回 following。requestStatus 保持 applied，未发生第二次即时位移。该尾部在 base `385d7c` 已存在；本检查点记录真实失败和独立后续修复，不将 150 项通过扩充为此场景已通过，也不把模型的 no-op phase guard 冒充普通 framework 证明。

## 第三检查点：reveal 请求身份与同步通知重入

PR 1490 的独立审查 thread（`discussion_r4601575108`）指出：emitted helper `packages/compiler/src/native-scroll-reveal.ts` 的 `beforeApply` 会调用 `cancelScrollEnd` 并同步发布 `rejected` 状态，该通知里的观察者可以再发出一次 reveal。较新的 reveal 完成后，较旧请求的 `current()` 仍然通过——它此前只检查 mount、owner、document 与后代关系——于是较旧请求继续写入自己测量阶段算出的旧 `next`（审查报告中的 emitted helper 执行写入 `[320,70]`）。

首轮修复在 helper 内按 surface 记录请求身份：每次进入 `revealNativeScrollTarget` 先自增并登记身份，`current()` 追加“本请求身份仍是最新”的判断。身份在较新的请求完成后仍然保留，因此较旧的请求不能恢复自己的旧位移；已有的 mount、owner、document 与后代关系检查全部保留。独立复核 F1 随后指出，这个过早的身份登记也会使隐藏、零高度或 inset 未解析的嵌套无效请求取消有效的外层 reveal。

当前修订改为记录已接受请求的 generation：入口只捕获当前值（缺省为 0），不自增；`current()` 同时检查原有 authority 与捕获值是否仍等于 surface 的已接受 generation。所有宿主有效性检查、再次检查 `current()` 和计算 `next` 完成后，才自增并登记 generation，然后调用 `beforeApply`。同一个局部可变捕获值更新为自己的已接受 generation，不增加逐请求对象。测量中的较新有效 reveal 会先登记并使较旧请求失效；无效 reveal 不登记，外层有效请求仍可继续。移动与 no-op 都在通知前登记，已接受身份在完成后保留。

`packages/compiler/test/native-scroll-reveal.test.ts` 增加两个行为用例：在 `rejected` 通知的观察者里发出较新的 reveal（一个移动到 220，一个是无位移 no-op），断言较旧 reveal 返回 rejected、只有较新的请求写入 offset、无位移的较新请求同样不让较旧请求补写 70。两个用例都只观察真实写入与请求结果，不做源码文本断言。

F1 修订另增加五项行为覆盖：取消通知中的隐藏、零高度、未解析 inset 请求均被拒绝，但外层仍移动到 70；既有 `geometry.onMeasure` hook 中较新有效请求独占 220 写入并拒绝外层；同一测量 hook 中零高度请求被拒绝，恢复尺寸后的外层仍移动到 70。保留前述移动与 no-op 重入用例及全部原 27 项，没有新增 fixture scaffold。补丁准备阶段未执行测试、构建或格式化；后续集成定点验证的 300 秒超时与 32 项通过结果见本节末段，两次运行的边界分别保留。

一致性说明：helper 与 Runtime Web 的 `packages/modules/scroll/src/web/target-reveal.ts` 仅对齐宿主几何算法。本次 generation 防护对应 Compiler 的同步状态发布边界。按源码推断，Runtime 的 `create-web-scroll-host.ts` 在 `beforeApply` 内只赋值 status，没有发布该状态；目前没有证明它有等价的可重入缺陷，也没有 Runtime 执行证据。本修订不修改 Runtime，不能将相似回调结构表述为已证明的 Runtime 缺陷。

首轮身份修复集成到 `96a83383719cbe316ad585052010a341a8e41b5e` 的工作树后，root 实际执行 `corepack pnpm@10.32.1 exec vitest run packages/compiler/test/native-scroll-reveal.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism`：**27 / 27 passed**，包含两个新重入用例与 reached standalone support graph 的严格类型检查；Vitest duration 21.92 秒，命令 wall time 34.01 秒。这份历史收据仅绑定 F1 修订前的候选，不表示当前 generation 准入修订或新增五项已执行通过。此为 Happy DOM emitted host closure／生成图证据，不替代真实浏览器或四框架普通消费者验收。原有 ES2024 与缺失 Astro base config 警告保留，未改配置或屏蔽警告。

F1 修订后的首次定点命令在 300 秒预算内仅打印 Vitest 启动信息并超时，未得到测试结论；该失败保留。随后核对未发现该工作树遗留的自有 Vitest 进程；当时宿主 swap 已满，I/O full avg10 为 29.51%，但这些观测不能证明超时原因。对相同产品／测试源码，第二次显式使用 900 秒命令资源预算及 JSON reporter：**32 / 32 passed**，Vitest duration 28.42 秒，命令 wall time 49.30 秒。实际 JSON 收据为 `/tmp/pr1490-validity-resource-900s-1118.json`；产品源码 SHA-256 为 `ea2c8f357eadb0bb011a88c2a235a359ab1db77250a1ab780ac0ac1ada056603`，测试源码为 `b46e4710d14a01cfbc6953811f37b7192615b0d2e1c4603641e98fad668c64e8`。这轮覆盖新增五项及此前全部 27 项，仍是 Happy DOM emitted host closure 与生成图严格类型证据；它不将前一次 300 秒超时改写为通过，也不证明真实浏览器布局或普通框架消费者。
