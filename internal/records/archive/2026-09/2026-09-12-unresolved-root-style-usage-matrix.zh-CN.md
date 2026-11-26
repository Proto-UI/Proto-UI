# Unresolved Root style token usage matrix

日期：2026-09-12。状态：analysis checkpoint，non-normative。本文使用 `collectProtoRootStyleTokenOccurrences()` 记录当前三套官方 Prototype 库中 unresolved Root token 的实际 call-site 分布，为后续 semantic decision 提供证据；本文不直接裁定 canonical role。

## 可执行 provenance

`collectProtoRootStyleTokenOccurrences(root)` 为每个 Root `feedback.style.use(...)` token 返回：

```ts
{
  token: string;
  path: string; // relative to the requested root
  line: number; // one-based
  column: number; // one-based
  context: 'setup' | 'rule';
}
```

结果按 path、line、column 与 token 稳定排序。Call-site 指向 style application，而不是 token 常量的声明位置；这正好回答“哪个 Prototype 在什么语义上下文使用该 token”。

## 总体分布

18 个 unresolved token 共形成 99 个 Root call-site occurrence：

| 用途族 | occurrence | 主要上下文 |
| --- | --: | --- |
| Dialog 居中 translate | 6 | Base、Shadcn、Brutalist Dialog Content setup |
| Brutalist lift/press translate | 27 | Button、Trigger、Toggle、Tabs Trigger Rule |
| Switch Thumb translate/will-change | 5 | Shadcn 与 Brutalist Thumb setup/Rule |
| `hidden` | 9 | overlay/content/tabs visibility Rule |
| `overflow-*` | 11 | Scroll Area viewport/root 与 popup content setup |
| `pointer-events-none` | 25 | disabled Rule 为主，另有 Value/Thumb setup |
| `relative` | 14 | group/item/content/scroll Root setup |
| `scale-[0.98]` | 2 | Switch 与 Tooltip Trigger pressed Rule |

### Transform family

相同 CSS family 已经承载至少三类不同 intent：

1. `dialog/content.proto.ts` 的 `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2` 是整体 viewport placement；split target 时 translate 必须与 fixed/inset 作用于同一 placement box。
2. Brutalist Button、Trigger、Toggle 与 Tabs Trigger 的正负 1px translate 是按压/抬升视觉反馈，并与 shadow token 成对变化，更接近 surface effect。
3. Switch Thumb 的 `translate-x-*` 是一个子 Prototype 相对 track 的状态位置；它既改变该实例的视觉/命中位置，又不改变父 flex/layout flow，不能仅凭 property 名推导为普通 surface 或普通 placement。

因此 transform family 保持 `unresolved` 是有实际冲突证据的，不只是保守猜测。若要在 split target 上保持语义，必须提供显式 role 或由更具体 capability 拥有该 intent。

### Visibility 与 pointer participation

`hidden` 的 9 个 occurrence 全部位于 Rule，并用于让 overlay/content/tab panel 退出可见与布局参与。只隐藏 inner surface 而保留具有尺寸或布局参与的 host box，无法普遍保持当前结果。它更接近 boundary/placement visibility，但现有 role vocabulary 尚未决定 visibility 是否应继续属于 style channel。

`pointer-events-none` 的 25 个 occurrence 多数与 disabled state 同时出现，但也用于 Select Value 与 Switch Thumb 的静态 hit participation。该 token 会影响事件目标选择，surface role 不能自动获得 event/hit-testing ownership；把它直接归为 surface 或 placement 都会隐含跨 domain 决策。

### Overflow 与 containing block

`overflow-*` 当前用于 Scroll Area viewport、Scroll Area root，以及 Dropdown/Select/Tooltip content。多数用例明显描述实际 presentation/scroll surface；但 Scroll Module、focus clipping、portal geometry 与 scrollbar target 可能依赖同一物理盒，因此需要在 host capability 层确认，不能只把 class 移入 wrapper。

`relative` 的现有用例多用于为内部 absolute descendant 建立 containing block，例如 item indicator、scrollbar 或 popup substructure；这倾向 surface。Dialog/Hover Card group root 等用法仍需与 portal/anchor projection 一起验证，不能据此宣称 family 永远只有一个合法 role。

### Scale

两个 `scale-[0.98]` occurrence 都是 pressed visual feedback，当前证据倾向 surface。但 scale 与 translate/rotate 共享 CSS transform composition；在 Style IR 或 physical CSS generator 能安全拆分 transform components 前，单独把 scale family提升为 canonical surface 可能导致同一 transform declaration 跨 target 被错误组合。

## 当前结论

Usage matrix 支持以下分层处理，而不是一次性给 18 个 token 填默认值：

1. transform family 需要显式 application role 或专属 semantic owner；
2. `hidden` 应先决定 visibility 是否从 style channel 提升为独立语义；
3. `pointer-events-*` 应先确认 hit participation 与 Event domain 的 ownership；
4. `overflow-*` 应与 Scroll host capability 和实际 scroll target 一起裁定；
5. `relative` 需要 containing-block evidence；
6. scale 虽倾向 surface，但必须与 transform composition 一起设计。

在这些问题解决前，可以继续做不改变 style target 的 Shadow owner-shell refactor，但不能把 generic Root token 自动分发到 host 与 inner surface。
