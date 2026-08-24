# ChatUI composition package ownership 决定（non-normative checkpoint）

日期：2026-08-24

状态：维护者在 #500 选择方案 A 后的 **design-only / implementation-readiness criteria checkpoint**。本文记录当前方向与未来实现就绪判定标准，不是 spec source of truth；它**不授权创建或实现 `@proto.ui/compositions-chatui` 或任何 Message/Code Block 实现**。它也不授权 public release、CLI `add`、stable lifecycle promotion 或把 #341 的旧代码整体迁移。任何后续实现仍须另行取得维护者授权。

设计/研究与实现授权在 `internal/governance/collaboration-model.md` 中明确分离：本 record 只捕获已选定的 ownership 边界与就绪门，不缩小、不推定、也不代理实现授权。

## 决定

采用 initially-private `@proto.ui/compositions-chatui`。

它是 composition layer，不是 neutral Base semantic family。package 可以内部使用 Proto UI Prototype authoring/runtime 作为三 Adapter 的组合载体，但 package 名称、文档、P/T graph 和 release surface 都不得因此推导同名 Base Message / Base Code Block subject。

## 两个独立 bounded entries

### Message

App Maker 继续拥有：message data、identity、sender、delivery/status、streaming、actions、content semantics 与 accessibility name/role 决定。

composition 首轮只可拥有：布局 slots、alignment/tone 输入与 design-language visual recipe。它不得建立第二套 state/event/a11y owner，也不得把 ChatUI 应用状态投射成 neutral Base contract。

### Code Block

App Maker 或既有能力继续拥有：code string、language、highlighter、copy command、Clipboard、async/highlight lifecycle。

composition 首轮只可拥有：Root/Header/Content 结构 slots 与 visual recipe。若 copy/highlight 需要能力，必须依赖已经批准的 Button/Clipboard/Async Region 等真实实体；不得在本 slice 内伪造。

Message 与 Code Block 可同处 package，但作为两个可独立否决、验证和后续实施的 entries；任一 entry 的阻塞不得被另一 entry 的完成掩盖。

## Package / release boundary

- initially private；无 registry/release identity；不计入 public BOM。
- 无 CLI `add`、无 public docs navigation、无 stable compatibility guarantee。
- private demo 只可在真实 package entry 与三 runtime evidence 已存在后恢复。
- Composer 继续 deferred。

## 从 #341 迁移的规则

#341 旧 branch 不 rebase、不 merge、不 wholesale copy。允许迁移的材料只有逐文件复核后仍成立的 visual token、slot anatomy 与 demo content；以下必须删除或重建：

- 全部 `packages/prototypes/base/src/{message,code-block}`；
- `P/T-BASE-MESSAGE` 与 `P/T-BASE-CODE-BLOCK-*`；
- Brutalist `inherits P-BASE-*` ownership chain；
- private/non-launch CLI entries；
- `any` tests、placeholder criteria、application semantics。

fresh implementation 必须从 current main 起 branch。

## Readiness evidence for later implementation

- `@proto.ui/prototypes-base` package exact surface 不含 Message/CodeBlock（negative gate）。
- package manifest private、release scan disabled、无 CLI entry。
- Message 与 Code Block 各有独立 direct entry / type surface / executable test case；不以另一 entry 代替。
- WC/React/Vue 使用真实 composition entry 渲染 App-owned content；测试证明 package 没有新增 state/event/a11y ownership。
- source、types、package exports、private Previewer registration、tests 与 bounded private docs 同步。
- no `any` / `as any` / `: any`，无 placeholder/TODO/no-op。

## 本 checkpoint 不决定

- 是否将 composition package 公开；
- 是否需要新的 spec entity 类型；
- Code Block 的 copy/highlight capabilities；
- Message streaming/status semantics；
- Composer；
- #377 排期。

以上项目必须各自再取得维护者授权。
