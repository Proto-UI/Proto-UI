# Brutalist depth and motion reconciliation corrections — 2026-08-28

Non-normative follow-up to [`2026-08-25-brutalist-depth-motion-reconciliation.md`](./2026-08-25-brutalist-depth-motion-reconciliation.md). It preserves the earlier record as history while correcting two statements that must not guide later normalization work. Applicable `spec/**` entities remain authoritative.

## Toggle and Tabs state gates

The active Toggle and selected Tabs exceptions limit the hover lift only. They do not suppress press feedback. Press still translates the control by `+1px` and clears the outer shadow under `P-BRUTALIST-TOGGLE-INTERACTION` and `P-BRUTALIST-TABS-TRIGGER-INTERACTION`. The active Toggle's inset ink frame remains independently governed by `P-BRUTALIST-TOGGLE-ACTIVE-SIGNAL`.

Any future typed grammar must express those state gates as hover-only conditions while retaining the governed press transition.

## Content-panel positioning ownership

The four content panels share a 3px rest shadow, but they do not share one positioning owner:

- `P-BRUTALIST-DIALOG-CONTENT-VISUAL-GRAMMAR` keeps fixed centering in the Dialog prototype through `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`;
- Dropdown Menu, Select, and Hover Card content remain anchored surfaces whose final placement is supplied through their positioning/Adapter path.

The proposed category may share depth and non-interaction motion. It must not describe Dialog Content as Adapter-positioned or use category normalization to remove prototype-owned centering.

## Progression

These corrections close evidence drift in the proposal without admitting the typed grammar as a stable guarantee. Agents may continue the evidence, entity-proposal, executable-test, and projection work. Pause only if applicable authority leaves materially different grammar ownership or public semantics unresolved.
