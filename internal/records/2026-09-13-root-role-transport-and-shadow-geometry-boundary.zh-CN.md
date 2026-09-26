# D1 Root role transport 与 Shadow geometry 边界

日期：2026-09-13。状态：implementation checkpoint + maintainer decision packet，non-normative。

承接用户选择的 D1；人工/demo-matrix 验证作为真实集成检测点，不单独铺设演示捷径。本文不改变 spec，不激活 public split object，也不批准显式 role 语法、draft promotion 或外部写入。

## 已完成并提交

- `b93bfddf`：Core-owned Root effect entry 与 recorder transport；更新 `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` E–H 和对应测试计划。
- `9adb12b5`：Feedback effects、Web Rule lowering、真实 RuntimeSession Rule/patch/replay 与 collapsed compatibility evidence；对应 T entity 回写 passing。

内部 effect 保留 physical `token`、`authorToken`、`role`、`roleSource` 与 `origin`（setup/rule/runtime）。Core 内部 helper 通过既有 `@proto.ui/core/internal` 入口使用，未新增作者 role API。`tw(...)`、Template handle 和公共 token snapshot 保持原样。Merge 委托既有 `mergeTwTokensV0`，不改变 group、last-wins 或输出顺序。

已覆盖 setup、Rule activation/deactivation、state/meta Web lowering、patch/suppress/clear、additional base、换 EffectsPort 后的 view replay 和 dispose。裸 unsafe selector 没有 author provenance 时保持 unresolved；不能把 lowered `data-[...]:w-full` 当成 unknown author token 重新 fallback 到 surface。

React/Vue/Vue 2/WC EffectsPort 对 role-bearing effects 的物理 token 输出与原路径一致。WC omitted/false/true 三种既有 profile 继续把 Root 样式留在 host，保留 consumer token 并清理 owned token。WC Template style 仍走原来的 resolver 路径；未配置 resolver 时不应用，不因 Root transport 自动加入样式交付。

这不代表 private split translator、真实 split Runtime integration、完整 Prototype pilot、CLI ESM delivery 或 public object 已经完成。

## 验证与既有失败

本机 Node 22.23.2，pnpm 10.32.1：

- Core feedback tests：66 passing；spec relations/evidence integrity：6 passing。
- Runtime、WC、React、Vue、Vue 2 与 Web Rule lowering 广泛回归：排除下述独立复现的既有失败文件后，216 files / 752 passing，3 files / 34 todo。
- 新增 Web Rule lowering 测试包含真实 `data-pilot-checked` 状态切换和 dark lowering，不仅测试字符串 helper。
- `check:types:workspace`、WC package/dependency build、`workspace:generate`、`spec:docs:agent`、`check:prototype-catalog` 通过。
- 完整 repository `test` 与 docs 类型检查未执行；上述检查不构成全仓全绿声明。

用户原有 staged `packages/adapters/vue2/test/catalog-conformance.test.ts:89` 的 exposed `increment` 方法身份断言失败。在单独 detached worktree 的本轮基线 `2fc81d2a`，复制同一测试并复用安装依赖后，独立运行得到同一失败（2 passing / 1 failing）。它不是本轮 transport 引入的问题，未修改该测试或相关实现。

## 浏览器调查：role 不是独立的盒模型分桶

可复现实验：

```sh
node --import tsx scripts/analysis/shadow-split-geometry-probe.mjs
```

使用已有 `apps/www` 的 playwright-core 和本地 Chrome；默认 macOS Chrome 路径，可通过 `PUI_CHROME_EXECUTABLE` 指定。无 server、网络请求或生产 Adapter 改动。实验用 CLI 的同一 token closure 分别生成 document/Shadow CSS，在独立且相同的父布局中比较 collapsed 与 split。脚本是 non-normative proposal evidence，不是 Adapter conformance test。

Chrome 152.0.7977.83 的实测：

| 用法 | Collapsed | inherited-fill split | grid-fill split |
| --- | --- | --- | --- |
| `size-4 border` | 16×16 | host/surface 16×16 | host/surface 16×16 |
| Badge token subset：`inline-flex w-fit …` | 92.25×24 | host/surface 92.25×24 | host/surface 92.25×24 |
| `fixed inset-0` | 800×600 | host/surface 800×600 | host/surface 800×600 |
| `flex-1 min-w-0`，无装饰，与同权重 sibling 分配 240px | 120 / 120 | 120 / 120 | 120 / 120 |
| 上例加 `p-2 border-2` | **130 / 110** | **120 / 120** | **120 / 120** |
| `w-full max-w-[75%]`，父宽 240px | 180px | host 180px，surface **135px** | host/surface 180px |
| `w-[2em] h-[2em] text-xs` | **24×24** | **32×32** | **32×32** |

两种候选 recipe：

- inherited-fill：host 承担 placement，surface 使用 100% width/height 与 inherited min/max constraints。
- grid-fill：host 用 grid/inline-grid 包住唯一 surface，surface 使用 min-width/min-height 0 的 stretch 候选。

这些测量只覆盖表中环境与 token subset；不证明完整 Checkbox/Badge/Mask 原型、slot、baseline、focus、a11y、事件或多浏览器等价。尤其 Badge 样本位于 flex parent，不能拿它证明正文中的 inline baseline。

### 原因与 information path

1. `p-2` / `border-2` 是 surface 意图，但在 collapsed flex item 上，padding/border 参与外部尺寸分配；移到内部后，父 flex 算法只看到无装饰的 host。内部填满 host 只能填满已经分配好的盒，无法修复先前的分配。
2. 百分比 constraint 不能无条件 inherit：它可能在新的 containing block 中再次求值。Grid 修复了这个样本，但没有修复 flex allocation。
3. `em` geometry 的求值依赖 font metrics；`text-xs` 只在 surface 上时，host 的 `2em` 使用了另一个字号。

因此仅把所有 canonical role 正确送到两个 DOM target，还不足以宣称布局语义等价。这里不需要重新把 padding 定义成 placement；需要决定 semantic role 是否允许额外的、非绘制性的 host sizing contribution。

## 需要确认的边界 E

D1 明确批准了 geometry token 的 mirror/fill bridge 和四个 composite 的拆分，但没有固定：**surface token 引起的尺寸贡献能否额外送往 host，还是 split MVP 可以拒绝这类组合。** 前者扩展物理投影责任，后者收窄支持边界；不能用某个 DOM recipe 暗中决定。

### E1：保留布局语义，允许内部尺寸贡献桥接（推荐）

确认 role 是语义归属，不要求一条 intent 只能产生一个 target 的物理产物：surface 的可见绘制仍位于 Shadow 内，但 Adapter/生成样式可为 host 提供其布局计算所必需的尺寸贡献，例如 decoration extent 和 font-relative geometry 的求值依据。Prototype 作者保持无感，仍只写 `tw(...)`。

这批准的是后续治理和实验方向，不等于已经选定复制 padding、透明边框或 computed-style sampling 等具体方案。应优先研究同步、生成式桥接，避免额外测量循环；任何暂时无法证明等价的组合必须显式不支持，不得用 ResizeObserver 在首帧之后补齐来伪称同步正确。

后续依赖顺序：修订 D role resolution 与 `C-HOST-SURFACE-PROJECTION-0001-C` 的物理投影边界；建立 decoration/font/percentage/constraint 依赖与 token lowering 的同源生成；用上述反例、Rule 改变 padding/font 和首帧/更新/cleanup 测试验证；再恢复 translator 与三个 private pilot，随后 CLI ESM 与 public activation gate。

### E2：先固定受限的 split MVP 支持集

保持 surface 只在 inner、placement 只在 host 的简单物理模型，只支持已证明安全的组合。明确在 split 准入处拒绝尚未实现的组合，并在首次 view/更新前给出诊断。不能把它们伪标为 canonical unresolved，也不能偷偷忽略它们。

优点是较快完成受限 pilot；代价是“role 已知”不再意味着 split 可用，支持检查必须看完整组合而非单个 token。`shrink-0` 等安全样本也不能外推到全部 flex sizing 或 consumer 环境。

### E3：接受 split 改变外部尺寸分配

把 DOM shape 改变导致的差异定义为 profile-specific 行为，并明确告知消费者。实现较简单，但削弱作者透明性和跨 profile 的布局可预期性，不推荐。

## 最小人工决策

建议确认 E1：允许 surface intent 产生保持布局语义所必需的 host 尺寸贡献，可见样式仍留在 Shadow 内，作者 API 不变。

这不批准显式 role author syntax、known-unresolved 默认路由、宽泛的 DOM/CSS 测量 API、新的通用 placement Module、strict CSP、异步 reveal、公共 object 激活、draft promotion、push、merge 或 release。

在 E 未确认前，已完成的 transport 可独立保留；暂停固化 private split translator 的 geometry recipe。记录这个边界是为了避免把“两个盒相同”误当成“组件在父布局中的占位与以前相同”。
