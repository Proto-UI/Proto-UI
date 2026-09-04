# Brutalist depth and motion reconciliation corrections — 2026-08-28

Non-normative follow-up to [`2026-08-25-brutalist-depth-motion-reconciliation.md`](./2026-08-25-brutalist-depth-motion-reconciliation.md). It preserves the earlier record as history while correcting two statements that must not guide later normalization work. Applicable `spec/**` entities remain authoritative.

## Toggle and Tabs state gates

The active Toggle and selected Tabs exceptions limit the hover lift only. They do not suppress press feedback. Press still translates the control by `+1px` and clears the outer shadow under `P-BRUTALIST-TOGGLE-INTERACTION` and `P-BRUTALIST-TABS-TRIGGER-INTERACTION`. The active Toggle's inset ink frame remains independently governed by `P-BRUTALIST-TOGGLE-ACTIVE-SIGNAL`.

Any future typed grammar must express those state gates as hover-only conditions while retaining the governed press transition.

## Tabs panel and trigger ownership

Tabs does not have one uniform 3px-rest surface. A future taxonomy must preserve the three prototype-owned surfaces separately:

- `P-BRUTALIST-TABS-LIST-VISUAL-GRAMMAR` owns the always-elevated strip: a square structural panel with `shadow-[3px_3px_0_0_#000]`.
- `P-BRUTALIST-TABS-CONTENT-VISUAL-GRAMMAR` owns the rendered content panel's `BRUTALIST_PANEL_TOKENS`, including the same 3px hard shadow. Its independent hidden-state rule may collapse the panel; it does not transfer the visible panel depth to the Trigger.
- `P-BRUTALIST-TABS-TRIGGER` has no universal 3px resting shadow. An unselected, released Trigger rests with a transparent border and no shadow. A selected, released Trigger owns the selected color pair, black border, and 3px shadow. Hover lifts only an unselected, unpressed Trigger to a 4px shadow. Press takes precedence for either selection state, translates by `+1px`, and clears the outer shadow until release. A selected Trigger does not hover-lift; while released it retains its governed selected 3px elevation.

The List and Content therefore belong in the governed 3px content/panel inventory. The Trigger requires state-specific interactive-control rules and must not be represented as an unconditional 3px-rest control.

## Content-panel positioning ownership

The four content panels share a 3px rest shadow, but they do not share one positioning owner:

- `P-BRUTALIST-DIALOG-CONTENT-VISUAL-GRAMMAR` keeps fixed centering in the Dialog prototype through `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`;
- Dropdown Menu, Select, and Hover Card content remain anchored surfaces whose final placement is supplied through their positioning/Adapter path.

The proposed category may share depth and non-interaction motion. It must not describe Dialog Content as Adapter-positioned or use category normalization to remove prototype-owned centering.

## Dialog Mask flat-overlay category

`P-BRUTALIST-DIALOG-MASK` is neither a structural panel nor no-motion Chrome. It requires its own flat-overlay category:

- the surface is `fixed inset-0 bg-overlay`, with no backdrop blur, rounded corner, border, or shadow;
- Base Dialog Mask remains the owner of open/presence/transition state;
- the Brutalist projection configures `enterDuration: 150` and `leaveDuration: 150`, using only `animate-in fade-in-0` and `animate-out fade-out-0` with no zoom or slide component.

Any category inventory and executable evidence plan must include this Mask and preserve the 150ms open/close fade as the category's governed motion exception. It must not inherit the no-motion rule proposed for Separator or Scroll Area.

## Progression

The earlier proposal still contains incomplete or over-broad historical rows and categories. This follow-up enumerates the required corrections; it does not claim that proposal drift is closed, admit the typed grammar as a stable guarantee, or authorize normalization from the earlier table.

Evidence capture may continue, but the maintainer checkpoint remains paused before entity admission, implementation normalization, or public projection work. Progression requires a reviewed proposal that incorporates the Tabs List/Content panel ownership, state-specific Tabs Trigger behavior, Dialog Content positioning ownership, Dialog Mask flat-overlay fade category, and the other applicable prototype-owned exceptions without contradicting `spec/**`.
