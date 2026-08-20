# Issue #234 信息通路图调研与实现计划

日期：2026-08-02状态：已实施并验证；图中 `Maker` / 契约中 `App Maker` 的命名差异仍需在 PR 中明确披露。

## 1. Context

GitHub issue [Proto-UI/Proto-UI#234](https://github.com/Proto-UI/Proto-UI/issues/234) 要求在中英文 Information Flow Model 白皮书页加入一张清晰、可复用的图。该工作只投影既有语义，不新增协议、actor、channel、lifecycle 或 host claim。

仓库中的原始 issue seed `internal/issues/v0-good-first-issues.json` 仍写有 `intent`、`state` 与 `host rendering` 的旧摘要。2026-07-27 刷新后的 GitHub issue 已用当前 spec/whitepaper source map 取代该范围；实现不得从旧 seed 恢复这些过时关系。

## 2. Authority and source map

### 2.1 Normative/catalog sources

| Source | Status | Diagram responsibility |
| --- | --- | --- |
| `spec/knowledge/K-COMPONENT-INTERACTION-0001.yaml` | draft | Component 是与外部保持关系的交互主体 |
| `spec/knowledge/K-COMPONENT-ACTOR-0001.yaml` | draft | User、Maker、Other Component 的身份定义；host/environment 不属于默认核心主轴 |
| `spec/knowledge/K-INFORMATION-CHANNEL-0001.yaml` | draft | channel 先由 actor relationship 推导，再由 capability 表达 |
| `spec/contracts/C-CORE-CHANNEL-0001.yaml` | draft | 核心 channel 必须可追溯到稳定 actor identity / relationship direction |
| `spec/contracts/C-EVENT-0001.yaml` | draft | `event`: User → Component |
| `spec/contracts/C-FEEDBACK-0001.yaml` | draft | `feedback`: Component → User |
| `spec/contracts/C-PROPS-0001.yaml` | active | `props`: App Maker → Component |
| `spec/contracts/C-EXPOSE-0001.yaml` | draft | `expose`: Component → App Maker |
| `spec/contracts/C-CONTEXT-0001.yaml` | draft | `context`: Component ↔ Component |
| `spec/contracts/C-STATE-0001.yaml` | draft | `state` 是 Component 内部维度，不是 channel |

### 2.2 Public projections

- `apps/www/src/content/docs/en/whitepaper/information-flow-model.md`
- `apps/www/src/content/docs/zh-cn/whitepaper/information-flow-model.md`

两页都定义三类典型 relation target：`User`、`Maker`、`Other Component`；都导出 `event`、`feedback`、`props`、`expose`、`context`；都把 `state`、`lifecycle`、`meta` 列为 channel 之外的内部维度。

### 2.3 Site implementation sources

- `apps/www/src/utils/rehype-enhanced-image.ts` 会把 Markdown `<img>` 包装成 `<figure>`，保留 `alt`，并把非空 `alt` 投影为 `<figcaption>`。
- `apps/www/src/styles/markdown.css` 已提供图片宽度、SVG 容器、caption、暗色模式和窄屏间距样式。
- `apps/www/astro.config.mjs` 同时启用 Starlight、MDX 与 `rehypeEnhancedImage`。
- `apps/www/public/` 是无需内容格式迁移即可由两个 locale 共享静态资源的现有入口。

## 3. Observed semantic model

### 3.1 Exact relationship matrix

| External target | Into Component | Out of Component | Evidence |
| --- | --- | --- | --- |
| User | `event` | `feedback` | `C-EVENT-0001-A`; `C-FEEDBACK-0001-A` |
| Maker / App Maker | `props` | `expose` | `C-PROPS-0001`; `C-EXPOSE-0001-A` |
| Other Component | `context` | `context` | `C-CONTEXT-0001-A` and `C-CONTEXT-0001-B` |

`context` 应画成一条双端箭头关系，而不是两个独立 request/response channel。白皮书称它为 environmental relationship；`C-CONTEXT-0001` 明确把方向写成 Component ↔ Component。

### 3.2 Component interior

`state`、`lifecycle`、`meta` 放在 Component 边界内部，并用 “Internal dimensions” 分组：

- `state`：由 `C-STATE-0001-A` 明确排除出信息通路；
- `lifecycle`：白皮书描述时间与执行阶段秩序，目前没有本 issue 引用的独立 catalog contract；
- `meta`：白皮书描述自描述与额外语义，目前没有本 issue 引用的独立 catalog contract。

三者不画箭头，不与外部 actor 连线。

### 3.3 Catalog lifecycle

`C-PROPS-0001` 已是 `active`，其余本图涉及的 channel contract 仍是 `draft`。图的任务是解释关系，不是展示 catalog maturity；图内不加入 status badge，PR handoff 中按实际状态列出来源，避免把全部来源误报为 active 或 draft。

## 4. Contradiction and chosen handling

### Maker vs App Maker

- 两篇目标白皮书与 `K-COMPONENT-ACTOR-0001` 使用 `Maker`。
- `C-PROPS-0001` 和 `C-EXPOSE-0001` 使用 `App Maker`。
- 两组来源给出的关系方向一致，差异集中在 actor label。

本图默认使用 **`Maker`**，因为它是图所在文章先定义、随后持续使用的本地术语。PR 必须逐字披露 catalog 使用 `App Maker`，不得宣称已解决命名差异，也不得在本 issue 中修改 spec 或白皮书定义。若 maintainer 要求以 active `C-PROPS-0001` 的名称为准，只改共享 SVG 中一个 actor label，仍保持同一方向矩阵。

## 5. Decision

采用 **一份 public SVG + 两处本地化 Markdown image reference**：

```text
apps/www/public/diagrams/information-flow-model.svg
apps/www/src/content/docs/en/whitepaper/information-flow-model.md
apps/www/src/content/docs/zh-cn/whitepaper/information-flow-model.md
apps/www/src/styles/markdown.css
```

不把 `.md` 改为 `.mdx`，不增加 Astro diagram component，不修改 rehype plugin 或 spec entity。`markdown.css` 只增加指向该资产的窄屏宽度约束，避免 English page 既有的 min-content 宽度把图推出 viewport。

### Why this is the smallest correct cut

1. 一份 SVG 满足两个 locale 共用完整 visual structure。
2. 图内所有可见 label 都是两个页面共享的 canonical identifiers：`User`、`Maker`、`Other Component`、`Component`、五个 channel 名和三个 internal dimension 名。
3. 两个 Markdown page 共享空 alt 的 image reference；中英文既有正文分别提供等价说明，无需复制 SVG 或暴露重复 accessible text。
4. 保留现有 `.md` 路径，避免使十个 K/C source references 与 `internal/issues/v0-good-first-issues.json` 产生路径漂移。
5. 复用现有 image pipeline，不引入 issue 明确排除的 site-wide diagram framework。

## 6. Visual specification

### 6.1 Hierarchy

使用 mobile-first 的纵向矩形 viewBox。左侧三行依次是外部 actor，右侧是一张跨三行的 Component card：

```text
┌───────────────┐   event ───────────────▶  ┌────────────────────┐
│ User          │   ◀──────────── feedback  │ Component          │
├───────────────┤   props ───────────────▶  │                    │
│ Maker         │   ◀────────────── expose  │ Internal dimensions│
├───────────────┤   ◀────── context ─────▶  │ state              │
│ Other         │                            │ lifecycle          │
│ Component     │                            │ meta               │
└───────────────┘                            └────────────────────┘
```

这只是布局草图；最终 SVG 中每个 actor 是独立 card，不能用表格边框暗示三者属于同一 actor。

### 6.2 Direction and encoding

- `event`：箭头只指向 Component。
- `feedback`：箭头只指向 User。
- `props`：箭头只指向 Component。
- `expose`：箭头只指向 Maker。
- `context`：同一关系线两端都有箭头。
- 每条线直接写 channel label；颜色只作辅助，不承担方向或类别信息。
- User 与 Maker 各使用两条平行、错开的单向线，避免用一个双向箭头掩盖两个不同 channel。
- Component card 内部单独标明 “Internal dimensions”；`state`、`lifecycle`、`meta` 只以 chip/list 呈现。

### 6.3 Scope exclusions inside the visual

不显示：

- potential `host` / `host/environment` flow；
- `intent`、host rendering 或 adapter/runtime execution；
- contract status badge；
- lifecycle transition arrow；
- API、callback、framework 或 protocol mechanics；
- animation。

这些元素要么是开放方向、旧 issue seed 遗留，要么属于白皮书后续章节；加入它们都会扩大当前图的语义。

### 6.4 Responsive geometry

- 目标 viewBox 约为 `0 0 600 760`；可在实现中微调，但保持窄而非横向全景。
- desktop 使用 20–26 SVG user units 的基础字号；SVG 内的 `@media (max-width: 400px)` 将窄屏 actor、channel 与 internal-dimension label 提升到 28–30 units，不复制第二套布局。
- `Other Component` 允许分两行，channel label 不缩写。
- SVG 只依赖 `viewBox` 保持比例，不写固定 CSS pixel width/height。
- 线条使用 `vector-effect="non-scaling-stroke"`，缩小时保留可辨认的 stroke 与 arrowhead。
- 320 CSS px 下不得裁切、重叠或要求横向滚动。
- `markdown.css` 在 768 px 以下把该 figure 限制为 `100vw - 4rem`，并将 SVG container padding 收敛到 `0.5rem`；320 px 实测 figure 为 256 px、左右边界为 32/288 px。

### 6.5 Theme strategy

外部 SVG 作为 `<img>` 加载，不能可靠继承页面 `[data-theme]` CSS variables。SVG 因此使用一套自包含、高对比、非透明 panel palette；不要依赖 `currentColor`、parent custom properties 或仅依赖 `prefers-color-scheme`。

- panel、文字、节点与 channel line 的对比在资产内部成立；
- light/dark site theme 只改变外围页面，不影响图内可读性；
- channel 仍需有文字 label，不能只靠颜色区分；
- 现有 `.enhanced-image-svg-element` dark-theme filter 应在浏览器实测后确认不会降低辨识度。

### 6.6 Accessibility and localization

SVG 文件内提供简短的英文 `<title>` 与 `<desc>`，保证直接打开资产时仍有语义。嵌入白皮书时使用空 alt：

```md
![](/diagrams/information-flow-model.svg)
```

这是有意的冗余内容处理：图后面的 `User ↔ Component`、`Maker ↔ Component`、`Other Component ↔ Component` 小节以及后续 internal-dimensions 小节，已分别用当前 locale 完整表达图中关系。现有 rehype plugin 会把任何非空 alt 同时复制为 `img.alt` 和可见 `figcaption`；对本图使用完整 alt 会让 assistive technology 连续遇到两份相同长描述。空 alt 让图作为正文的视觉投影被跳过，同时保留唯一、可本地化的 prose 信息源。

### 6.7 Placement

两页都把 image reference 放在以下 section 的导语之后、第一条 `User ↔ Component` subsection 之前：

- EN: `## Which core capabilities follow from the information flows?`
- ZH: `## 由信息通路可以导出哪些核心能力？`

该位置先给出整体关系，再由后续三个 subsection 按 actor 展开；不重排或重写正文。

## 7. Implementation sequence

1. **Freeze the semantic matrix**
   - 从六个 channel/state contract 逐项抄录 endpoint 和方向。
   - 把 `Maker` / `App Maker` 差异写入 PR 描述。
   - 确认图中没有 host、旧 seed 字段或执行语义。

2. **Create the shared asset**
   - 新建 `apps/www/public/diagrams/information-flow-model.svg`。
   - 按三行 actor + central Component card 布局实现。
   - 使用可复用 marker definition，但为单向与双向关系设置正确的 marker start/end。
   - 加入 internal dimensions group、asset `<title>` 和 `<desc>`。
   - 保持静态，无 script、foreignObject、remote font 或 animation。

3. **Project into both locales**
   - 在两个既有 `.md` 文件的相同语义位置加入 `/diagrams/information-flow-model.svg`。
   - 两页都使用空 alt，依赖当前 locale 的既有正文提供等价非图像说明。
   - 不改 frontmatter、section wording 或文件扩展名。

4. **Build and exercise the rendered pages**
   - 运行 issue 指定的 docs build。
   - 以 build 后的站点为准打开两个 locale route。
   - 分别在 light/dark 与 desktop/narrow viewport 检查。

5. **Prepare the PR handoff**
   - 列出本文第 2 节的 source paths。
   - 说明 visual mapping、decorative-image accessibility strategy 与验证矩阵。
   - 显式列出 `Maker` / `App Maker` 未决命名，不把它包装成已解决 contract change。

## 8. Verification matrix

### 8.1 Executable checks

```sh
corepack pnpm@10.32.1 --filter apps-www build
corepack pnpm@10.32.1 check:agent-doc
```

第一条是 issue 的硬性 acceptance check。第二条覆盖本次新增 internal record 对 agent documentation projection 的仓库约束。

### 8.2 Browser smoke test

在 build/preview 或 docs dev server 上检查：

| Route                                       | Viewport   | Theme        |
| ------------------------------------------- | ---------- | ------------ |
| `/en/whitepaper/information-flow-model/`    | 1280 × 800 | light + dark |
| `/zh-cn/whitepaper/information-flow-model/` | 1280 × 800 | light + dark |
| `/en/whitepaper/information-flow-model/`    | 320 × 800  | light + dark |
| `/zh-cn/whitepaper/information-flow-model/` | 320 × 800  | light + dark |

每个组合都确认：

- SVG request 成功，图片有非零 natural width/height；
- 五个 channel label 和三个 internal dimension label 可读；
- arrowhead 没有被裁切，方向与第 3.1 节矩阵一致；
- 320 px 下无重叠、裁切或横向滚动；
- image 保留 `alt=""`，不生成重复 `figcaption`；
- accessibility tree 不包含重复图像描述，且当前 locale 的邻近 prose 完整保留关系信息；
- 主题切换后 panel、文字、线条仍可辨认；
- 页面无 console error。

实测结果：

- 中英文两页的 SVG 均成功加载，`complete=true`，且 natural width/height 非零；
- 1280 × 800 与 320 × 800、light 与 dark 的八个组合均完成 browser smoke；
- 320 px 下两页 figure 均位于 `x=32..288`，`scrollX=0`，图内 label 与 arrowhead 无重叠或裁切；
- 两个 locale 均实测 `img.alt === ""`、`figcaptionCount === 0`，旧长描述未出现在 accessibility tree；三个关系小节仍可访问；
- 两页实测均无 console error 或 page error。

### 8.3 Why no new automated test

该变更不新增 runtime/API contract。现有 build 验证 asset resolution 与 Markdown rendering；浏览器矩阵直接验证视觉、响应式、theme 与 accessible-name acceptance。不要添加只断言文件文本或 SVG source string 的脆弱测试。

## 9. Acceptance mapping

| Issue criterion                    | Evidence                                              |
| ---------------------------------- | ----------------------------------------------------- |
| Both locale pages show the diagram | 两个 Markdown reference + 两条 route 的 browser smoke |
| Labels and arrows match sources    | 第 3.1 节 matrix + visual arrow audit                 |
| No new semantic claim              | 第 6.3 节 exclusions + PR source map                  |
| Narrow/light/dark readable         | 320/1280 × light/dark browser matrix                  |
| Equivalent non-image explanation   | empty image alt + existing localized prose            |
| No full visual duplication         | single file under `public/diagrams/`                  |
| Docs build passes                  | exact issue command                                   |

## 10. Rejected alternatives

### Rename the pages to MDX and import an Astro component

这会获得直接 theme-token inheritance，但需把两个 `.md` 改为 `.mdx`。当前十个 K/C entities 与内部 issue seed 都引用原 `.md` 路径；为一个静态图迁移全部 source references 会触碰 issue 明确排除的 spec scope。

### Duplicate inline SVG in both pages

可直接继承页面 CSS variables，但完整 visual structure 会重复，后续修正箭头或 label 容易让两个 locale 漂移。

### Add Mermaid or a general diagram renderer

仓库当前没有站点 diagram framework。为一张静态图引入 parser、client runtime 或 site-wide pipeline 超出 issue 范围。

### Show host/environment as a dashed fourth actor

白皮书只把它描述为潜在、非默认核心方向；`K-INFORMATION-CHANNEL-0001-D` 与 `C-CORE-CHANNEL-0001-D` 都排除默认核心承诺。将它放入主图会弱化当前五个 channel 的边界。

## 11. Review trigger and non-goals

只有以下情况需要 maintainer 在实现前改变本计划：

- 要求图中以 `App Maker` 取代白皮书的 `Maker`；
- 要求图展示 catalog lifecycle；
- 要求 host/environment 进入主图；
- 要求图随手动 site theme 改色，而不仅是在两种 theme 下保持可读。

后三项会扩大 issue 的视觉或语义范围，应先回到 source entity / issue 讨论，不在贡献者实现中自行决定。

非目标：修改 spec、重写白皮书、修复 EN frontmatter 的既有 `desp` 字段、更新旧 issue seed、增加动画、设计通用图表系统。
