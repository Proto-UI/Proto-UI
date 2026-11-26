# Header family dogfood correction (2026-10-04)

This records the user's later correction to the earlier same-day ghost direction. Consistency is scoped to the selected design language. Shadcn keeps its additive public Select `appearance: default | ghost` and quiet Header Buttons. Brutalist returns to its existing public `surface` Button and `elevated` Header Select, retaining its border, hard shadow and displacement. The unreleased Brutalist ghost addition has no independent requirement and is withdrawn from source, types, catalog, documentation, demos and tests. Base hooks, exports, stable defaults and theme palettes are unchanged.

The whole Header was traced, including the left side:

- Brand and Docs/Libraries/Whitepaper: native anchors retain href, selection, keyboard and history. Existing public family Surface/Text provide presentation. Brutalist brand/nav now consume secondary fill, all borders and raised elevation, including browser-owned hover/press/focus facts; Shadcn stays quiet. There is no Link prototype.
- Homepage language: a native navigation link with the same family nav recipe. Documentation language: the existing complete family Select, with its ordinary flat/default field appearance.
- Runtime and homepage family: the existing five-part public Select; Shadcn uses ghost desktop/default compact, Brutalist uses elevated, with unchanged owner through responsive reparenting.
- Search, Theme, Menu and Contents: the existing public family Button. Brutalist uses surface; Shadcn uses ghost (retry retains secondary).
- Social links: native anchors with existing family Surface and original icon content; their previous structural Brutalist projection remains.
- Mobile panel: the existing Base-derived family Surface and website disclosure, retaining the one Header close toggle, natural content height and bounded internal scroll.

The previous popup capture waited for visibility but did not prove that the entering transition had settled. New evidence separately records first-visible and entered/opaque/animation-finished popup paint, and checks actual composited enabled-option contrast. Trigger measurement now also waits for finite presentation transitions before reading color endpoints; d905's eight Shadcn failures were samples with intermediate border alpha, not a reason to relax the transparent resting requirement. This is evidence work, not a palette change or a claim that the earlier dark popup was acceptable.

Focused tests and exact-head hosted captures remain distinct. No local browser is available in this executor. Hosted actual-page evidence, the full current-head matrix, visual inspection and independent review remain required before completion; no merge or production publication is part of this change.
