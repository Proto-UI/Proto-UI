# F1 交付、真实输入检测与 public split 边界决策

日期：2026-09-13。状态：implementation checkpoint + maintainer decision packet，non-normative。

承接用户明确选择 F1，以及按节点本地提交、继续到必须人工决策处的授权。本轮继续使用 `codex/shadow-dom-style-role-record`；未 push、merge、publish、release，未提升任何 draft lifecycle。原有 unrelated staged/untracked 文件保持原状，未包含在本轮提交中。

## 已提交的节点

| Commit | 内容 |
| --- | --- |
| `29776eda` | F1 CLI opt-in companion、固定 export、成组 preflight/staging/recovery、JS/TS/Vite consumer 与 help/README、D/T 同步 |
| `4dda2d6d` | private split display ownership 与既有 host fallback 分离，补真实 host-display 基础下的 geometry 对照 |
| `f531fbe6` | 真实 native router/CE Checkbox Root 输入与首次帧检测、slot/move/disposal/reconnect、补 CLI late-failure evidence |

## F1 现在可以做什么

```sh
proto-ui shadcn --styles-dir ./src/styles \
  --shadow-out ./src/styles/proto-ui-shadow-style.generated.js

proto-ui brutalist --styles-dir ./src/styles \
  --shadow-out ./src/styles/proto-ui-shadow-style.generated.js

proto-ui tokens --input ./proto-ui/prototypes \
  --out ./src/styles/proto-ui-tokens.generated.css \
  --shadow-out ./src/styles/proto-ui-shadow-style.generated.js
```

这是当前 source CLI 的实现，不代表先前发布的 CLI 已包含该选项。F1 使用同一 closure 生成 document CSS、指定 `.js` 与同 stem `.d.ts`，唯一 named export 为 `protoShadowStyleArtifact`。Artifact 保持 frozen v1 ABI；declaration 保留 literal/readonly。支持 `--shadow-out=...`，路径相对 cwd，而不是 `--styles-dir`。

未传 flag 时，既有命令不增加 companion；`init` / `add` 不自动生成或启用 split。Brutalist 底层 preset 原已存在，本轮补齐公共 dispatcher。没有 package-root runtime builder。

Preset 的 tokens/theme/entry 与 companion 属于同一待写集合。生成前检查 normalized/case-folded/ancestor、symlink-directory alias、hard-link alias 冲突，拒绝 file symlink、directory 等非普通文件目标；完整生成和同目录暂存成功后才替换文件。Caught failure 尝试恢复全部旧文件并删除新输出；恢复失败时保留 staging/backup 并报告目录。测试包含最后一个 entry replacement 失败、mkdir/mkdtemp/copy/write/chmod/rename 失败、rollback rename/unlink 失败。

不承诺断电、进程终止或 concurrent writer 下的跨文件原子性；失败后可能留下空 output parent。也没有 runtime generation digest 检查，消费者仍应成组重新生成文件。D/T 权威为 `D-WEB-COMPONENT-SHADOW-STYLE-0001` L–M；其 lifecycle 保持 draft。

## 本轮发现并修复的接线冲突

先前 private pilot 没有安装实际 `installDefaultHostDisplay`。将其直接组合后，document 中的 `.pui-host-root { display:block }` 即使 specificity 很低，也会在 host 的 Shadow cascade 边界压过内部 grid/inline-grid：

- Badge 尺寸仍为 92.25×24，但 baseline offset 从 -2 变成 18，段落高度从 24 变成 42，实际换行。
- Checkbox host 仍是 16×16，但 inner surface 高度缩成 2px，绘制表面不再覆盖占位。

`packages/adapters/web-component/src/host-display.ts` 现在提供非 package-root 的内部 `displayOwner: 'presentation'` 接线选项：保留 view visibility infrastructure，不安装竞争的 default host class。现有 `AdaptToWebComponent` 调用继续使用默认 fallback，boolean profile 未改变。Private runtime fixture 显式使用 presentation ownership；接入 public split 时仍必须在真实 Adapter owner 中选择该分支，不能把测试 fixture 当成 production activation。

修复后 8 组 Badge/Checkbox geometry 与 14 组动态对照通过；physical display 分别记录为 Badge collapsed inline-flex / split inline-grid、Checkbox collapsed block / split grid，而不是错误要求两者 CSS display 字符串相同。

## 真实输入与首次帧证据的范围

```sh
node --import tsx scripts/analysis/shadow-split-input-browser.mjs
node --import tsx scripts/analysis/shadow-split-prototypes-browser.mjs
node --import tsx scripts/analysis/shadow-split-runtime-browser.mjs
```

新增脚本使用 test-only Custom Element callbacks，复用实际 WC session、view owner、module builders、event gate、native router 和 logical target binding。没有新增 production Adapter identity，也没有修改公开 `shadow` 类型。

在本机 Chrome `152.0.7977.83`，完整 Shadcn Checkbox Root 与 collapsed 对照验证了：

- constructor 不订阅环境或生成 owner styles/surface；首次 Template callback 前 marker/style/surface 就绪；connection 后第一个 animation frame 为 16×16 的正确内外尺寸。
- 原生 Tab 焦点落在 host，focus-visible ring 在 surface 绘制；Space 切换且只发出一次 checkedChange，Enter 不切换，pointer click 不重复提交；disabled 阻止键盘与指针激活，opacity 同步。
- host role、checked、disabled 保持一致，inner surface 不取得 role/tabindex/aria-checked；浏览器 ARIA snapshot 显示来自内容的 `checkbox "Accept terms" [disabled]`。
- default slot 保留 consumer node 并响应替换；同步 DOM move 保留 generation，确认断开释放 resources/input，重新连接建立 fresh generation 并可再次点击。

这些是 bounded private evidence，不等于完整 production `AdaptToWebComponent` owner 接线、全部原型、Checkbox Indicator composition、named slot、portal/focus-scope、native text/image control 或 screen-reader conformance。首次帧样本不证明所有 Rule 在所有原型的首个 Template callback 前都已出现；异步 artifact/CSP/reveal policy 未由它获得授权。

## 实测 customization gap：为什么现在需要人工选择

脚本另外通过实际 `bindElementSurfaceProjection` / `setElementProps` 做了 isolated customization probe：

1. `surfaceClassName` 的类可正确投到 inner surface，但 document 同名 selector 不会匹配它。这不是 class forwarding 丢失，而是 Shadow isolation 的正常结果。
2. `surfaceStyle.backgroundColor` 能直接改色并恢复，内外仍为 16×16。
3. `surfaceStyle.padding = '32px'` 使 inner surface 变成 66×66，而 host 仍为 16×16；移除后恢复。生成的 token sizing recipe 不会自动理解任意 raw CSS override。

第三项是显式记录的缺口，不是“通过了 customization conformance”。`C-HOST-SURFACE-PROJECTION-0001` C/F 已治理 normalized surface target 与 native boundary escape，但任意 raw CSS 是否参与 split sizing parity 仍未治理。`D-WEB-COMPONENT-SHADOW-PROFILE-0001-Q-CUSTOMIZATION` 因此继续开放。若要让任意 CSS、变量、selector、动画都自动影响 host metrics，需要新的 stylesheet analysis / observation / precedence 设计，不能冒充一次普通接线修复。

## 下一项人工决策 G：有边界的 public split MVP

### G1：generated token 保证 + 显式 customization escape（推荐）

推荐把“受治理的生成式样式保证”和“消费者直接改 CSS”明确分开，并批准以下同一个 MVP packet；目前仅为提案：

```ts
AdaptToWebComponent(proto, {
  shadow: {
    mode: 'open',
    presentation: 'split',
    styleArtifact: protoShadowStyleArtifact,
    // colorSchemeSource: { get, subscribe }, // optional; default uses Web precedence
  },
});
```

- 沿用 A1 的 `mode: 'open'` + `presentation: 'split'` object discriminant；`styleArtifact` 必填且只接受同步 v1 plain value。将现有 `ShadowStyleArtifactV1` / `ShadowColorSchemeSource` 类型按此边界从 WC package root 导出，不公开 renderer/coordinator/builder。
- `shadow` omitted/false/true 完全保持既有语义；split 原子建立 environment、artifact stylesheet、surface 和 Root routing。`colorSchemeSource` 是 host marker 与 runtime colorScheme 的唯一 truth，其它 meta 继续委托原 getter。
- Inner surface 暴露 `part="surface"` 作为显式 CSS escape；复用既有 `surfaceStyle` 与 `surfaceClassName` target forwarding。类只保证投递，不承诺 document CSS 自动跨 boundary；不克隆整份 document stylesheet。Theme variables 继续继承。
- 自动 metrics/cascade parity 只覆盖已治理且生成的 token recipe；native host CSS、`::part(surface)`、raw `surfaceStyle` 及 Shadow-local consumer CSS 都是 host-specific escape。消费者覆盖 layout/font/padding/border/display 等后，不能继续依赖自动尺寸等价保证；不做 runtime 猜测、silent forwarding 或新增作者 token role syntax。
- 首版只接入普通 Root presentation，明确 fail closed 于尚未完成 split 设计的 text-control/image-view declarations，以及既有 unresolved/composite/缺闭包 recipe。不给任意 Prototype 列出凭空 support 保证；Badge/Checkbox Root 作为首批检测点，完整 Mask 的 hidden 继续拒绝。
- 首版保持 eager/synchronous delivery，不增加 async loader/reveal barrier；严格 CSP/nonce/constructable carrier 保证明确不在 MVP 中，不能在文档宣称支持。
- 在真实 `AdaptToWebComponent` owner 中复用现有 wiring，不复制 test-only CE callbacks。通过生产接线、原子失败回滚、props normalization、owner/view lifecycle、slot/input/focus/a11y/customization 与 boolean compatibility 检测后，才在 demo-matrix 接通作为人工检测点。

这是一个有意限制 guarantee 的实验性公共 profile，不是 draft promotion 或所有 CSS/原型兼容性的声明。

### G2：先解决任意 raw CSS 的自动尺寸同步，再公开

保持 public split object 关闭，另做 raw CSS precedence、geometry ownership、stylesheet analysis 或 observer-based synchronization 的设计。它可以追求更强的消费者透明性，但会显著扩大边界；不能承诺简单增加一个 observer 就与 Light DOM 等价。

推荐 G1：明确提供可用的改色/主题/显式 surface escape，同时不把任意 CSS 等价性暗中纳入生成器保证。若不接受这一限制，需要先选 G2 的设计方向，而不是继续扩大 private tests 来回避选择。

## G1 获批后的实施序列

1. 更新上述 D entities、`C-HOST-SURFACE-PROJECTION-0001` 必要的 profile-specific 边界和对应 T mappings，保持 draft；给出 exact type/options、unsupported declaration 与 raw customization 文档。
2. 在单一实际 Adapter owner 中接入 split 分支，复用资源与 layout ownership seams，补真实 connection/reconnect、view absence、失败清理、native control refusal、normalized props、part 与 event/focus 的正反向测试；分节点提交。
3. 跑跨 Adapter compatibility、CLI consumer、浏览器检测，再接 demo-matrix；发现必须新语义选择时再次停止，不静默扩大 support。

G1 不授权 release、lifecycle promotion、strict CSP、异步 artifact、通用 raw CSS metrics bridge、新作者前缀 API、hidden 重新分类、自动支持 native text/image、push/merge/publish 或其它外部写入。

## 本轮最终验证

Node 22.23.2 / pnpm 10.32.1：

- CLI + WC 全套 + spec relation/evidence integrity：85 files / 520 tests passing；包含工作区原有 WC context test，但该文件未修改或提交。
- Workspace TypeScript 检查通过；CLI command suites 构建真实 package 并从 bin 运行。
- 上述三条 Chrome 脚本通过：8 prototype pairs、14 dynamic pairs，以及一条 Checkbox Root native input/reveal/lifecycle journey。Customization gap 作为单独诊断输出，不算 parity passing。
- workspace dataset、Agent snapshot 重新生成，prototype catalog 与 Agent doc currentness 检查通过；生成投影不提交。
- Agent operations / contributor skills 检查通过，相关 58 项测试通过。
- CLI file-set 部分另经独立子 Agent 只读检查，未发现具体 correctness/data-loss bug；其建议的 late failure、rollback unlink 和缺值测试已补。该检查不是全分支独立 acceptance review。

未运行全仓 `test`、website/docs 类型检查、其它浏览器引擎或真实 screen reader。未声称 production split activation、demo-matrix 或 strict CSP 已通过。

当前最小决定：是否接受 G1 的 bounded public MVP（包括 exact object/API 与 customization escape 限制），还是先处理 G2 的任意 CSS 同步设计？
