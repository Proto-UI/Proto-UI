# Brutalist depth and motion grammar reconciliation — 2026-08-25

Non-normative record. Authorizes evidence capture and a typed-grammar proposal only. Does not create a stable spec guarantee, P entity, or implementation change.

## Problem

The public Brutalist Design Contract page presents one unqualified rest/hover/press depth grammar, but prototype sources and P entities encode several different values and state exceptions. See #398 for the full drift table.

## Current state (baseline `24cfabbe8a9c`)

### Rest depth

| Surface            | Rest shadow                         | P entity                          |
| ------------------ | ----------------------------------- | --------------------------------- |
| Button             | `3px 3px 0 0 #000`                  | P-BRUTALIST-BUTTON                |
| Badge              | `2px 2px 0 0 var(--pui-foreground)` | P-BRUTALIST-BADGE                 |
| Card               | `6px 6px 0 0 var(--pui-foreground)` | P-BRUTALIST-CARD                  |
| Skeleton           | `2px 2px 0 0 var(--pui-foreground)` | P-BRUTALIST-SKELETON              |
| Textarea           | `3px 3px 0 0 var(--pui-foreground)` | P-BRUTALIST-TEXTAREA              |
| Scroll Area        | none                                | P-BRUTALIST-SCROLL-AREA           |
| Switch             | `3px 3px 0 0 #000`                  | P-BRUTALIST-SWITCH                |
| Tabs (trigger)     | `3px 3px 0 0 #000`                  | P-BRUTALIST-TABS-TRIGGER          |
| Toggle             | `3px 3px 0 0 #000`                  | P-BRUTALIST-TOGGLE                |
| Separator          | none                                | P-BRUTALIST-SEPARATOR             |
| Dialog Content     | `3px 3px 0 0 #000`                  | P-BRUTALIST-DIALOG-CONTENT        |
| Dropdown Content   | `3px 3px 0 0 #000`                  | P-BRUTALIST-DROPDOWN-MENU-CONTENT |
| Select Content     | `3px 3px 0 0 #000`                  | P-BRUTALIST-SELECT-CONTENT        |
| Hover Card Content | `3px 3px 0 0 #000`                  | P-BRUTALIST-HOVER-CARD-CONTENT    |
| Dropdown Menu Item | none                                | P-BRUTALIST-DROPDOWN-MENU-ITEM    |
| Select Item        | none                                | P-BRUTALIST-SELECT-ITEM           |

### Motion (hover/press)

| Surface | Hover | Press | Exception |
| --- | --- | --- | --- |
| Button | lift -1px, deepen 4px | sink +1px, shadow-none | — |
| Badge | — | — | no interaction states |
| Card | — | — | no interaction states |
| Skeleton | — | — | no interaction states |
| Toggle | lift -1px (inactive only) | sink +1px, shadow-none | active stays at rest |
| Tabs | lift -1px (unselected only) | sink +1px, shadow-none | selected stays at rest |
| Switch | no hover visual | color swap, shadow-none | thumb retains 3px shadow |
| Textarea | — (focus ring only) | — | no hover lift or press |
| Scroll Area | — | — | scroll chrome, no lift |
| Dialog Trigger | lift -1px | sink +1px, shadow-none | no active gate |
| Dropdown Trigger | lift -1px | sink +1px, shadow-none | no active gate |
| Select Trigger | lift -1px | sink +1px, shadow-none | no active gate |
| Hover Card Trigger | lift -1px | — | no press state |
| Dialog Close Icon | — | — | color swap, no lift |
| Content panels | — | — | positioned by adapter |
| Flat items | — | — | bg change, no lift |
| Separator | — | — | no interaction states |

## Proposed resolution: typed grammar

Define named surface/control categories with explicit defaults and permitted exceptions:

1. **Interactive control** (Button, Toggle, Tabs, Dialog Trigger, Dropdown Menu Trigger, Select Trigger): 3px rest, hover lift -1px + deepen to 4px, press sink +1px + shadow-none. Exceptions: active/inactive and selected/unselected gating. Active Toggle preserves a 2px inset ink frame (shadow-[inset_0_0_0_2px_#000]) during press; only the outer elevation clears, not the inset frame (P-BRUTALIST-TOGGLE-ACTIVE-SIGNAL).
2. **Hover Card Trigger**: 3px rest, hover lift -1px + deepen to 4px (same as interactive control), no press sink.
3. **Dialog Close Icon**: 3px rest, hover color swap + shadow deepen, no lift, no press sink.
4. **Binary control** (Switch): 3px rest, no hover lift, press color swap + shadow-none. Exception: thumb retains its own 3px.
5. **Editable surface** (Textarea): 3px rest, focus ring only, no hover lift or press.
6. **Panel** (Card): 6px rest (larger panel depth), no interaction motion.
7. **Content panel** (Dialog Content, Dropdown Content, Select Content, Hover Card Content): 3px rest (`shadow-[3px_3px_0_0_#000]`), no interaction motion (positioned by adapter, not self-elevating).
8. **Flat interactive item** (Dropdown Menu Item, Select Item): no resting shadow, hover/active visual feedback via background change, no lift or press depth.
9. **Passive label** (Badge): 2px rest (smaller), no interaction motion.
10. **Loading placeholder** (Skeleton): 2px rest (smaller), no interaction motion.
11. **Chrome** (Separator, Scroll Area): no rest shadow, no interaction motion.

## Next steps

This record does not authorize implementation. A maintainer checkpoint must:

1. Admit a K- or D- entity that owns the typed grammar.
2. Update P entities to reference the category they belong to.
3. Normalize implementations where the typed grammar says behavior is invariant.
4. Add executable visual tests for every category/exception.
5. Update the design-contract EN/ZH pages to project from the source of truth.
