# Compiler：外部 callback 实参的 owner 边界

日期：2026-11-17。基线：`bf8b1f55f93a89f3c689276d6e339d83891f4dba`。本记录说明一个局部 Compiler 修复及其实际执行证据；不提升 draft lifecycle，不代表整个 Compiler、0.3 发布或独立审批已经完成。

## WHY 与拥有层

`callable-effects.ts` 已把传入外部 callback 的 authored closure 作为 outward root 检查。可是四个 DOM source target 的普通 `call` 仍直接输出原始实参。消费者从 `send(accept)` 保留一个 State writer 后，React、Vue 2 和 Web Component 会在下一次调用时报 callback phase 错误；纯 lexical closure 没有 State 操作帮助拦截，因此还能在 owner 终止后继续执行。nested record、返回同一 callback 的 round trip 和第二 owner 转交也绕过了既有 public projection。

这个不一致的拥有层是共享 JavaScript value lowering 与生成 owner 接线。依据是 draft `C-EXPOSE-0007-F` 的 owner callback scope、draft `C-LIFECYCLE-0002-G` 的 terminal invalidation，以及 draft `C-COMPILER-OBSERVABLES-0001-LIFETIME` 的可观察 owner 行为。`internal/compiler/source-language.md` 和 `internal/compiler/atomic-lowering-completion.md` 同时要求内部 closure 的 transport 不等于 invocation，生成物必须继续是直接宿主程序。

对应已公开发现： [PR #1479 的 callback argument review](https://github.com/Proto-UI/Proto-UI/pull/1479#discussion_r4586811096)。

## 修复机制与保留的语义

- 在既有 callable flow traversal 增加可选 call provenance observer，复用实际 `native` / authored closure 来源。没有改 `dataFact`、native argument escape、宽窄 record fact 或 opaque admission 的判断。
- 只有可能调用外部 callback、且实际实参类型含 callable 的普通 call 才进入边界 lowering。所有原始实参先按原顺序求值，再投射 callback / nested record，保留后续实参对前一个 record 的修改。
- 保留 member receiver、callee/key 的单次求值、已准入 optional-call 的实参短路、原始返回值与抛出值。投射复用现有 `createNativePublicCalls` 的 owner guard、record cache、receiver cache 和返回投射；其原有 runtime 内容未改。
- 同一 call site 可以由 setup 的内部 helper 与外部消费者共同到达。仅为此混合情形发出 `authored-callables-v1.ts`：WeakSet 标记返回原始函数，不包装、不执行、不改变 identity 或 arity。混合调用遇到已证明的 authored 函数时继续传入原始实参；外部函数才收到 public projection。不存在按组件名或源码路径选择行为。
- 含新增边界的 module helper 放入当前生成 owner，并沿已有 helper dependencies 传播。参数 default 也是 callee 的可执行部分，partition 现在同时扫描 defaults 与 body。实际证据同时覆盖 default 中直接 operation、default 对 owned helper 的依赖，以及显式提供参数时不执行 default。
- React、Vue 3、Vue 2、Web Component 只增加必要 support 选择、导入、函数标记和 expression 上下文接线。此补丁没有改 disposal catch、`context.dispose()`、disconnect 或 error retirement 路径。

## 实际普通消费者证据

新增 `packages/compiler/test/external-callback-owner.test.ts` 使用现有 `mountNativeOwner`：真实 compile / artifact writer / ordinary generated imports，再由 React root、Vue 3 app、Vue 2 instance、Web Component 挂载。宿主环境是 HappyDOM；这是框架消费者执行证据，不是原生浏览器、布局或像素证据。

每个 target 执行 11 项：保留的 State writer；nested record / 重复投射身份；混合内部 setup 与外部 module helper；member receiver 与 optional-call；实参求值顺序；外部 falsy thrown value；recipient 返回同一个 callback 的身份；callback 位于 module default；default 直接 operation；default helper dependency；跨 owner 转交与双方终止。纯 lexical closure 的终止失效包含在多项检查中。

| Target                    | 原始基线通过 / 失败 | 候选通过 / 失败 |
| ------------------------- | ------------------: | --------------: |
| `react-dom-source-v1`     |              1 / 10 |          11 / 0 |
| `vue-source-v1`           |               4 / 7 |          11 / 0 |
| `vue2-source-v1`          |              1 / 10 |          11 / 0 |
| `web-component-source-v1` |              1 / 10 |          11 / 0 |
| 合计                      |              7 / 37 |          44 / 0 |

内部 setup 的 State 创建和函数身份控制、optional-call 的未执行实参、member 的 `this`、record 修改顺序，都有实际行为断言。没有通过匹配 helper 名称代替行为证据。原本通过的 Vue 路径和 direct-default 路径保留为控制。

扩展到 44 项以前，还保留了两个原始诊断过程：第一版 28 项包含 8 项前端/IR 阻断，不能算目标 bug 红例；使用已准入的 local module alias 与 optional 参数后，同一基线 28 项是 3 pass / 25 fail。产品修改前已取得该有效红例。完整 44 项基线使用精确基线源码再执行，随后在 `finally` 恢复全部八个候选源码文件，并逐文件校验 SHA-256 相等。

## 类型闭包与关联回归

`packages/compiler/test/external-callback-owner-types.test.ts` 对四个 target 的主文件及所有生成 support 文件创建真实 TypeScript Program：`strict: true`、`noEmit: true`、`allowJs: true`、`checkJs: true`；四项全部通过。使用锁定的宿主声明，Vue 2 指向自身声明。`skipLibCheck: true` 沿用既有 generated-consumer 的范围，不能把该结果说成所有第三方声明库的验收。

五个相关既有文件完整收集并全部通过：

| 文件 | 检查数 |
| --- | --: |
| `control-label-callable-context.test.ts`，含 checked-data / mixed record / narrowed view | 57 |
| `flutter-call.test.ts`，含 opaque authored hook admission | 23 |
| `module-owner-storage.test.ts` | 9 |
| `public-callable-consumer.test.ts` | 12 |
| `public-roundtrip-consumer.test.ts` | 9 |
| 合计 | 110 |

候选共 158 项通过：44 个普通消费者、4 个严格生成图、110 个关联回归；这三个运行各自保留命令和 JSON / log，没有把 skipped 当通过。环境为 Node `24.22.1`、pnpm `10.32.1`、TypeScript `5.9.3`，本树 offline frozen install，测试均为单 worker。三类候选测试实际分别运行：

```sh
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/external-callback-owner.test.ts --maxWorkers=1 --minWorkers=1
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/external-callback-owner-types.test.ts --maxWorkers=1 --minWorkers=1
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/public-callable-consumer.test.ts packages/compiler/test/public-roundtrip-consumer.test.ts packages/compiler/test/control-label-callable-context.test.ts packages/compiler/test/module-owner-storage.test.ts packages/compiler/test/flutter-call.test.ts --maxWorkers=1 --minWorkers=1
```

实际执行同时添加 verbose / JSON reporter，单条命令上限 180 秒。原始基线与候选日志分开保留。

## 与 terminal disposal 修复的组合验证

后续分支以 `385d7c706c9e4c35280878efbb6e42d63d7df786` 为父提交按 hunks 整合本候选，保留已发表的 falsy terminal error 修复。协调审查逐文件核验八个产品文件、两个新测试及六次原始运行的 JSON / log SHA-256；另将整合后 React / Vue 2 文件与本候选比较，确认差异恰好是原 terminal disposal 补丁的增删行。

在整合树中，`external-callback-owner.test.ts`、`external-callback-owner-types.test.ts` 与 `lifecycle-disposal-errors.test.ts` 再次单 worker 执行：**78 / 78 通过，0 skipped，exit 0，21.611 秒**。这是两项修复组合后的新证据，未把之前隔离树的 158 项结果改绑到整合树。完整输入 SHA-256、命令、每项结果和原始输出摘要保存于本记录相邻的 `2026-11-17-compiler-callback-owner-boundary.evidence.json`。这次协调审查是本地工程审查，不是 GitHub formal approval。

## 已核实的范围边界与剩余工作

审查提出的 `sink?.[key()](make())` 没有被当前前端准入：optional / nullable receiver 和本地条件选择均为 `PUI1006`；普通有限 callable record 的动态 key 也拒绝。`sink?.accept(...)` 与固定 optional index 同样在 callable 类型准入处拒绝。指定的另一候选 `sinks: ((step: () => number) => void)[]; sinks[key()]?.(make())` 实际得到 `PUI1020: Array elements must be data values.`。保留了 source、span 与诊断，没有扩展语法，也没有宣称这些路径已通过行为验收。

此外，直接在 callback 内使用 module helper-call 的 capture metadata 缺口，以及 nullable 外部 callable 的 provenance 缺口仍是独立问题。本测试使用正常 local alias / optional 参数来进入当前已接纳的语义，没有修正或豁免这些诊断。Array.every、直接 proto exports 和其它 Compiler 待办也没有被此记录关闭。

没有执行 Dart SDK、原生宿主、真实浏览器或完整集成回归；Flutter 23 项是现有 Node admission/emission tests，不能改称 Dart native 通过。未尝试改变 Chromium sandbox。合入其它候选后的联合验证和实际独立审查需要各自的新证据；此记录不产生 `APPROVED`。

## 证据绑定

八个产品文件与两个新测试文件的紧凑排序 JSON SHA-256 映射摘要是：

`92707d176626b4fd435da66cf91bd62fe7871c79f3845df34dc732a744bb6cfc`

映射定义：repo-relative path → 文件原始 bytes 的 SHA-256，按 key 排序，以 UTF-8 compact JSON 编码，再取 SHA-256。本记录本身不参与该摘要，避免循环绑定。原始运行包保存 `candidate-v1-manifest.json`、每条命令、全部 failed / passed JSON 与 log、恢复校验、源文件映射和未准入探针。后续源或 fixture 改动必须产生新绑定，不能沿用本记录的执行结论。
