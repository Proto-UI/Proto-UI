# E1 实测结果与 Shadow companion 公共交付决策

日期：2026-09-13。状态：implementation checkpoint + maintainer decision packet，non-normative。

承接用户确认的 E1 与 D1 连续实施授权。本轮继续使用 `codex/shadow-dom-style-role-record`，逐节点本地提交；未 push、merge、release，未改变任何 draft lifecycle。人工/demo-matrix 验证保持为真实集成检测点，不另建演示路径。

## 已完成的 checkpoint

| Commit | 内容 |
| --- | --- |
| `fc06f835` | E1 draft 规则、同源生成式尺寸贡献与 7 组浏览器 geometry 对照 |
| `e2f18f2b` | private split effects、WC session inner commit seam、实际 Runtime/view owner 集成、14 组动态浏览器对照 |
| `295861bd` | 完整 Badge/Checkbox Root 的 8 组浏览器对照，以及完整 Dialog Mask 的负向准入测试 |
| `2ca75b45` | 回写受限 passing evidence，协调 B1 renderer 文案与 E1 sizing decomposition |
| `baff4cc9` | private 同闭包 document CSS + Shadow ESM/declaration delivery，JS/TS/Vite/SSR consumer 测试 |
| `84e2c67c` | 保持单次 projection snapshot 一致，并保留 DOM write 中重入的 flush request |

相关实现入口：

- `packages/cli/src/services/proto-style-css.ts`
- `packages/adapters/web-component/src/shadow-split-effects.ts`
- `packages/adapters/web-component/src/runtime/session.ts`
- `packages/cli/src/services/shadow-style-delivery.ts`

上述服务均未接入新的公共选项。`AdaptToWebComponent` 仍只接受原有 boolean `shadow`；omitted/false 与 true 的 Root target、DOM、slot、资源、公共类型和 exports 不变。没有新的作者 role syntax，`tw(...)` 仍是原写法。

## E1 recipe 的实际边界

Surface painting 留在 Shadow 内，host 持有合并后的 Root token membership 和必要的非绘制性尺寸贡献。Host 用单格 grid/inline-grid；padding extent、透明 border extent 与 font metrics 从同一 token declaration 生成。Inner surface 使用 stretch 与负边缘补偿，避免重复计算 decoration 或把百分比约束在新 containing block 中再次求值。

`block`、`flex`、`grid`、`inline-flex` 按已批准的 composite plan 分解。Canonical classifier 未改变；known unresolved、未实现的 composite、缺失的 compiled Root token、`transition-all` 均 fail closed。Unknown extension 仍带 fallback provenance 投到 surface；fallback 不构成 renderer support 或任意尺寸等价承诺。当前 padding recipe 拒绝 percentage、var/calc 等未验证形式。

所有 Root entries 在写任一 target 前先验证；失败保留上一份完整样式投影。DOM write 异常另有 best-effort 双目标回滚；宿主连 rollback 写入都拒绝时，不承诺能修复损坏的 DOM。Cleanup 只撤销 owned contributions，清理单项失败仍尝试其它项。

E1 artifact 内也包含 host placement/metrics rules。Document CSS 仍与它来自相同 closure，服务 collapsed consumers 与现有 document style 路径；theme declarations 仍只在 document/host 侧，CSS custom properties 继承进入 Shadow。没有 runtime closure digest 或两份文件同代验证。

### 浏览器证据，不仅是字符串或 DOM snapshot

本机 Chrome `152.0.7977.83`，通过已有 playwright-core 与本地 Chrome 运行，无新依赖、server 或外部页面。

```sh
node --import tsx scripts/analysis/shadow-split-sizing-browser.mjs
node --import tsx scripts/analysis/shadow-split-runtime-browser.mjs
node --import tsx scripts/analysis/shadow-split-prototypes-browser.mjs
```

- 7 组静态 geometry：修复了旧方案的 decoration flex 分配反例（130/110，而非 120/120）、percent max-width（180，而非 inner 135）和 `2em + text-xs`（24，而非 32）。
- 14 组实际 Runtime 动态对照：首次 commit、mounted、state update、dark update、font patch、clear、detach/remount，比较 host、surface 和同父 sibling 的尺寸。另检查主题继承、document selector 无法直接绘制 inner、host 背景和 border 不重复绘制、失败投影与 terminal cleanup。
- 完整 Brutalist Badge：正文 inline baseline、92.25×24 的尺寸、原生 slot consumer text、accent/info/danger/default 恢复，以及背景/前景/阴影保持一致。
- 完整 Shadcn Checkbox Root：16×16 的占位和 surface、checked/uncheck/disabled props 驱动的 visual output 与 host ARIA 属性保持一致。没有把 Indicator composition、native input router、keyboard focus journey 或 screen-reader 测试算进此证据。

实际测试发现 dark selector 搬到 `:host` 后若增加 specificity，会颠倒它与 state 条件的优先级。Private split renderer 现用 zero-specificity dark context 保持 document cascade；相关 state/dark 竞争已纳入动态样本。

首次 Template commit 与整个 mount turn 的完成不能混为一谈。当前两个对照路径在首个 commit callback 内可能都只有基础样式，随后在同一次 mount 中完成 Rule/selector 投影；该样本证明两者时序与最终 geometry 一致，不证明全部 Rule 样式在第一个 callback 前就已出现，也不替代公共 Adapter 的 reveal barrier 验证。

### Dialog Mask：完整组合仍明确拒绝

`packages/prototypes/shadcn/src/dialog/overlay.proto.ts` 调用 `asDialogMask()`；Base Mask 在 `packages/prototypes/base/src/dialog/overlay.proto.ts` 中根据 `transition.isPresent` 产生 Root `hidden`。它是 canonical unresolved，不能默认投到 surface，更不能以只测试 styled 文件中的 `fixed inset-0` 来宣布完整 Mask 可用。

`packages/adapters/web-component/test/shadow-split-prototype-admission.test.ts` 使用真实 Dialog parent/provider 和完整 styled Mask，验证出现包含 prototype、`rule`、`hidden`、修复方向的错误，并清理 view projection。

本轮不改变 Mask presence/visibility 语义，不削除 Base hook，不增加显式 role API。其负向结果不阻塞已经获得证据的 Badge/Checkbox Root 或 ESM 格式实验；但完整 Mask 仍不能列为 split support。

## ESM delivery 实验已经验证什么

`renderShadowStyleDelivery(tokens, exportName)` 是内部实验服务，不由 CLI command 或 package root 公开。它从一次 closure snapshot 同步返回 document CSS、frozen v1 ESM value 与对应 literal/readonly declaration，名字由测试 caller 提供，没有固定公共路径。

`packages/cli/test/shadow-style-delivery.test.ts` 已验证：

- Shadcn 250-token 与 Brutalist 249-token preset closure 的 deterministic generation；可生成不代表其中全部 Root effect 都获得 split 准入。
- 纯 Node ESM 静态 import，无 DOM 或 runtime renderer 依赖；引号、反斜杠、模板样式字符串、`</script>`、Unicode line separator 保持为数据。
- TypeScript NodeNext 和 Bundler resolution 能从 `.js` 找到 `.d.ts`，保留 ABI literal types 与 readonly 约束。
- 使用仓库已安装 Vite 的 browser 和 SSR build，两个 consumer import 共享同一 frozen artifact；产物可在无 DOM 的 Node 中读取。
- 非法 export identifier 与未验证 recipe 在返回 delivery 前失败。

尚未验证或实现：真实 CLI 成对写盘、路径冲突、已有文件更新失败恢复、`init`/preset/tokens 启用策略、公共默认文件名/导出名、consumer regeneration 命令旅程。不能把内部 serializer 测试说成这些命令已交付。

## 验证记录与未覆盖项

Node 22.23.2，pnpm 10.32.1：

- Runtime、WC、React、Vue、Vue 2、Web Rule、Core feedback 扩展回归：223 files passing / 831 tests passing，3 files / 34 todo。此轮在 `84e2c67c` 的单项新增回归前完成；之后 13 项 effects/runtime focused tests、workspace types 和动态/原型浏览器重新通过。
- 上述广泛回归排除了 `packages/adapters/vue2/test/catalog-conformance.test.ts`。此前已在旧基线独立复现其 keep-alive exposed method identity 失败，详见 `2026-09-13-root-role-transport-and-shadow-geometry-boundary.zh-CN.md`；本轮未修改该用户原有 staged 文件。
- CLI：8 files / 217 tests passing；CLI package build 通过。
- Spec relations/evidence integrity 与 renderer：31 tests passing；workspace generation、Agent snapshot、prototype catalog、workspace types 通过。
- 全部 repository `test`、docs 类型检查、strict CSP、其它浏览器引擎、vertical writing、任意 consumer CSS 环境、通用 sizing animation 与 public split reveal/slot/focus/event/a11y journey 未完成。

不把以上分组相加成全仓测试数量；它们存在重复路径。原有 staged 与 untracked 用户文件均保留，不包含在这些 checkpoint commit 中。

## 下一项人工决策 F：公共 companion 如何启用

D1 固定了 generated ESM + declaration 的方向，但明确保留 exact spelling；`D-WEB-COMPONENT-SHADOW-STYLE-0001-Q-PUBLIC-DELIVERY` 仍未关闭。下一步会改变用户可见的 CLI output contract，而不只是继续内部代码，因此在此确认。

### F1：显式成对生成（推荐）

为 `proto-ui tokens`、`proto-ui shadcn`、`proto-ui brutalist` 增加 `--shadow-out <file.js>`。未传参数时，输出与行为保持现状；传入时，在同一次 closure generation 中产生 document CSS、指定 `.js` 和同 stem `.d.ts`。不接受 Promise/lazy artifact 或 JSON import。

- 固定公共 named export 为 `protoShadowStyleArtifact`。
- 推荐文档示例路径为 `./src/styles/proto-ui-shadow-style.generated.js`；因为参数必填路径，这不是一个隐式额外输出位置。
- 同路径 `.d.ts` 替换 `.js` suffix 派生；拒绝非 `.js`、与 CSS/theme/entry 的目标冲突等情况。
- 输出先统一 preflight、完整生成再写盘；补齐失败与 regeneration evidence，不能先覆盖 CSS 再发现 Shadow artifact 无法生成。
- `init`、`add`、既有无参数 preset 路径不自动写 companion，不顺带选择 split Adapter。
- 没有新 CLI/runtime builder package-root API；消费者 import 生成的 plain value。

示例仅是待确认的提案：

```sh
proto-ui shadcn --styles-dir ./src/styles \
  --shadow-out ./src/styles/proto-ui-shadow-style.generated.js

proto-ui tokens --input ./proto-ui/prototypes \
  --out ./src/styles/proto-ui-tokens.generated.css \
  --shadow-out ./src/styles/proto-ui-shadow-style.generated.js
```

这保持“同一闭包成对交付”，同时避免让只使用 collapsed Adapter 的项目立刻增加两份输出。代价是消费者需要显式选择，且在 public split object 开放前该文件仍只供受控集成使用。

### 其它可选方向

- F2：所有 preset/tokens 默认额外生成 companion。配置更少，但需要立即固定自定义 CSS output 的派生命名及 `init` 自动生成行为，并改变现有命令的文件足迹。
- F3：等待 public split object 一次性公开 CLI output。减少中间状态，但会把文件交付 contract 与剩余 Adapter reveal/input/customization 验证合并到一个更大的节点。

推荐 F1，不建议为了通过 Mask pilot 改变 `hidden` 的 canonical role，也不建议此时公开作者前缀语法。

## F1 授权后的推进顺序与边界

1. 在既有 `D-WEB-COMPONENT-SHADOW-STYLE-0001` / `T-WEB-COMPONENT-SHADOW-STYLE-0001` 治理 exact output contract，保留 draft。
2. 接入 CLI style command，与现有 help/docs 同步；验证 opt-in/omitted compatibility、文件冲突、失败与 regeneration，并独立提交。
3. 继续 private Adapter 的真实 Custom Element reveal、slot composition、focus/event/a11y/customization 检测，完成后再回到 public `shadow` object gate；demo-matrix 在真实接通时作为检测点。

F1 不批准公共 `shadow` object 的字段或启用，不批准所有原型/所有 CSS recipe support、`hidden` 重新分类、新 author role API、strict CSP、draft promotion 或外部写入。当前最小决定是：是否接受 F1 的显式 `--shadow-out` 成对交付策略与 `protoShadowStyleArtifact` 导出名。
