# Select item-aligned 定位 proposal（design-only，non-normative）

日期：2026-08-24 状态：design proposal 草案。本文是短期方向记录，不是 Proto UI 语义来源；不含任何已授权的实现、实体准入或 owner 定案。授权来源：#495 maintainer checkpoint（2026-08-24，guangliang2019）。镜像有界 proposal issue：#496。

## 问题

固定 shadcn 基线（`apps/v4/registry/new-york-v4/ui/select.tsx` line 56）默认 `position = "item-aligned"`：Select popover 打开时，当前选中项对齐在 trigger 位置上（原生 macOS `<select>` 风格），菜单位置由选中项驱动而非 trigger 驱动。

我们的现状：

- Base Select Content 只实现 popper 风格 anchored dropdown（`packages/prototypes/base/src/select/content.proto.ts`：`placement: 'bottom'`、`sideOffset: 4`、`align: 'center'`）。
- `P-BASE-SELECT-CONTENT-DEFERRED-SURFACES` 已把 item-aligned positioning 排除在当前 Base guarantee 外。
- `P-SHADCN-SELECT-CONTENT-POSITION-PROP` 记录 `item-aligned | popper`、默认 `item-aligned`，但只保证参数存在——行为欠账已在 catalog 具名。

## Authority map（pui-trace 摘要）

- 语义 owner：`P-BASE-SELECT-CONTENT` / `P-SHADCN-SELECT-CONTENT-*`；selection truth 归 Root（`value` state + `valueChange` event，`packages/prototypes/base/src/select/root.proto.ts`）。
- Item 侧：`asCollectionItem()` + anatomy role claim；item 暴露 `selected` derived state（`packages/prototypes/base/src/select/item.proto.ts`）。
- 放置基础设施：`C-ANCHORED-POSITIONING-0001`（anchor→floating root 盒子放置 + flip/shift 碰撞 + 有界 lease）、web 实现 `packages/modules/positioning/src/web/floating-ui-host.ts`。
- Overlay 链路：base select content 经 `asOverlay` 的 `anchored: true` 走既有 positioning 连接（`packages/modules/overlay/src/impl.ts` `syncAnchoredPosition`）。
- 上游参照：Radix Select 双模式文档；shadcn v4 包装层默认 `item-aligned`。

## 信息通路（candidate）

```
Root value truth（state）
  → 在同一 Select domain 内解析 selected Item（anatomy/collection part view）
    → 解析其渲染 target 元素
      → host 测量：item 几何、viewport 几何、trigger 几何（host-local，不进 author State）
        → 计算 floating placement 使 item 对齐 trigger
          → collision 回退
            → 写坐标（沿用 left/top 非 transform 投影约定）
```

与 `C-ANCHORED-POSITIONING-0001` 的关系：**并行的放置策略，不修改其现有保证**。现有契约描述 anchor→floating root 的盒子放置；本 proposal 需要"由 floating 内部 descendant 驱动放置"的策略层。是否以 floating-ui middleware 扩展、独立 host-cap、或 overlay config policy 表达，留给 checkpoint（见"开放实现问题"）。

## 四个重点的设计回应

### 1. selected Item target lifetime

- **解析时机**：open 触发后，content 经 Portal 挂载，items 注册完成后才能解析 selected target。placement 必须等待"selected item 已注册"这一有界 readiness，而不是零延迟重试或私有 expose handshake——沿 `P-BASE-DROPDOWN-MENU-CONTENT-A11Y` 中 entry-focus readiness 的先例：请求被保留，target 就绪时消费。
- **空值/未匹配**：`value` 为空或不匹配任何 item 时无 selected target。回退到 popper 式放置（bottom/sideOffset），与上游空值打开行为对齐（待 pinned revision 核实，见 unknowns）。
- **lifetime 边界**：selected-item target 引用绑定到本次 content view epoch（同 positioning lease 的有界 lifetime）；view detach/rebuild 后旧引用作废，不跨 epoch 复用。
- **不进 author State**：item 几何、解析结果、临时对齐量全部 host-local；author 可见的仍只有 `value` 与 item `selected` state。

### 2. Viewport scroll 与 measure/place/collision 的执行顺序

核心难点：selected item 相对 floating root 的位置取决于 viewport 内部 scrollTop。两个候选策略：

- **策略 A（scroll-first）**：先把 viewport scrollTop 设为规范位（使 selected item 处于 viewport 内已知相对位置），再测量，再整体放置 floating 使 item 落在 trigger 上，最后碰撞调整。
  - 优点：测量即所得，缩放/变换祖先下不易漂移。
  - 缺点：打开瞬间可能有一帧内部滚动跳变；需要保证 scroll 先于 paint。
- **策略 B（math-first）**：用 scroll 无关的偏移量（如 offsetTop 链）直接计算 placement 数学解，再设 scrollTop 对齐。
  - 优点：无中间帧。
  - 缺点：transformed/zoomed 祖先下 offsetTop 语义不可靠，需要显式约束。

倾向 A 为首轮（可证伪点见下）。**碰撞回退顺序**（candidate）：完整对齐 → 垂直翻转侧 → 放弃 item 对齐退回 popper 式 bottom/top → 既有 flip/shift。阈值与级联细节留 checkpoint。

### 3. 异步挂载与 open 期间的 selection 变化

- **首开放**：placement 计算一次，发生在 content mounted + items registered 之后；此前浮层按上游惯例不可见或以最终位姿入场（transition 进场已有 presence driver 承接）。
- **open 期间 selection 变化**（键盘/指针）：基线预期是**不重新放置**——Radix/shadcn 在 open 后 selection 变化只改选中态与高亮，floating 保持初始位姿（待 pinned revision 精确核实）。若核实成立，则本策略只需 open-time 一次放置 + 既有 autoUpdate 的布局变化观察，不需要 selection-follow 重放置，显著缩小范围。
- **异步 late item**：selected item 迟到时按第 1 点的 readiness 处理；超时回退 popper 式并保留诊断。

### 4. host 能力缺失时的 fallback

- 策略层必须表达为宿主中立语义（anchor 点、child 相对偏移、碰撞边界），Web 宿主用 DOM rect/scrollTop 实现；非 Web 宿主（如 GPUI spike 方向）若无等价几何能力，**降级为现有 anchored popper 行为**——即 `P-BASE-SELECT-CONTENT-DEFERRED-SURFACES` 维持成立，Base guarantee 不因本 proposal 扩大。
- 因此该策略是 Base guarantee 之上的可选能力（opt-in policy 或下游 styled 层配置），默认关闭路径与今天完全一致。

## 负边界

- 不拥有 selection truth：Root 继续独家持有 `value` / `valueChange`；本策略只读。
- 不改 `C-ANCHORED-POSITIONING-0001` 任何现有 criterion；新能力作为并行策略存在。
- Thumb/indicator 类比不适用：这里没有第二个 part 获得 ownership；item 的 a11y（`aria-selected` 等）不变。
- 不做虚拟化、不做 typeahead、不动 #377 排期。
- styled-only 层保持 style-only，不得自行 hack 测量。

## 开放实现问题（checkpoint 裁定）

1. 载体形态：floating-ui middleware + connection config 扩展 vs 独立 host-cap vs overlay config policy。
2. 策略 A/B 取舍及碰撞回退阈值。
3. open 期间 selection 变化是否永不重放置（依赖上游 pinned revision 核实结果）。
4. 是否值得现在做一项准备性 spec 调整：把 `P-SHADCN-SELECT-CONTENT-COMPATIBILITY-SUBSET` / `Q-UPSTREAM-DIFFERENCES` 中的定位差异从泛化表述细化为具名 item-aligned 差异项（单独授权项）。

## 跨宿主假设与 fallback

见第 4 点。补充：策略语义不假设 scrollTop 可写性以外的宿主能力；一切几何访问经 host binding，与 Move Gesture 的 host-local 哲学一致。

## 可执行证据与 falsification

- **falsify「需要新 host-cap」**：若纯 floating-ui middleware + config 能同时满足四个重点且不违反 `C-ANCHORED-POSITIONING-0001-D/E`（非 transform 写入、有界观察），则不需要新 host-cap。
- **falsify「策略 A」**：构造 transformed/scaled 祖先 + 打开瞬间采样，若 scroll-first 出现可见跳动而 math-first 没有，则重估。
- 单测：执行顺序确定性（mount→register→measure→place→collision 的断言序列）；unmatched value 回退；late-item readiness 超时；controlled 模式不受影响。
- Browser journey（三 runtime）：中部选项打开 → selected item 覆盖 trigger；首/尾选项边界钳制；窗口 resize/滚动后重定位正确；dark/light 无关性。

## 只能由实现或第二消费者验证的结论

- floating-ui 是否能干净表达该策略（决定载体形态）。
- 真实碰撞阈值的体感校准。
- Combobox/Command 未来是否复用同一 contract（通用化提取的门，届时另议）。

## 下一步

本 record 提交 maintainer checkpoint。若方向认可，再单独授权：(a) 载体形态定型后的 implementation Issue；(b) 第 4 点的准备性 spec 细化。
