# Brutalist WCAG contrast evidence — 2026-08-26

Non-normative record. Refs #469. Does not create a stable spec guarantee, change an entity lifecycle, or authorize merge.

## Baseline

- `main` commit: `259aeb77`
- Theme source: `packages/prototypes/brutalist/src/theme.ts`
- Shared-token source: `packages/prototypes/brutalist/src/style.ts`
- Call-site sources: the Brutalist prototype recipes named below at the recorded commit
- Method: WCAG 2.2 SC 1.4.3 (text, ≥4.5:1) and SC 1.4.11 (non-text, ≥3.0:1), using relative luminance from the resolved hex colors

This is a source audit. A pair is classified at each implemented call site because the same color can be text, a required state indicator, a redundant indicator, or decoration depending on how the prototype uses it.

## Implemented text pairs (SC 1.4.3)

| Implemented pair | Representative recipes | Light | Dark |
| --- | --- | --- | --- |
| bg-background / text-foreground | unfilled page-level surfaces | 16.44 PASS | 16.44 PASS |
| bg-main / text-main-foreground | accent controls and active menu rows | 18.05 PASS | 18.05 PASS |
| bg-secondary-background / text-foreground | shared panels, Toggle, surface Button, Dropdown resting row | 17.93 PASS | 13.88 PASS |
| bg-secondary-background / text-muted-foreground | Select Trigger placeholder; disabled Dropdown row | 7.81 PASS | 10.21 PASS |
| bg-secondary-background / text-destructive-ink | destructive Dropdown resting row | 8.02 PASS | 10.73 PASS |
| bg-destructive / text-destructive-foreground | destructive Button and active Dropdown row | 14.89 PASS | 14.89 PASS |

The implemented text pairs measured above pass in both themes. This conclusion is limited to these audited recipes; it is not a claim that every future Brutalist token combination passes.

## Non-text pairs (SC 1.4.11)

| Pair | Light | Dark | Source-level significance |
| --- | --- | --- | --- |
| border-black on bg-background | 19.26 PASS | **1.17 FAIL** | Directly used by the unselected Tabs Trigger hover state |
| border-black on bg-main | 18.05 PASS | 18.05 PASS | Accent control boundary and selected-state indicator |
| border-black on bg-secondary-background | 21.00 PASS | **1.39 FAIL** | Control and panel boundaries; inventory below |
| bg-main against bg-secondary-background | **1.16 FAIL** | 13.00 PASS | Light menu focus/active fill |
| bg-destructive against bg-secondary-background | **1.41 FAIL** | 10.73 PASS | Light destructive-menu focus/active fill |

The failing ratios do not automatically make every consumer a conformance failure. Each call site still needs rendered evidence showing which adjacent color is relevant and whether another ≥3:1 visual cue conveys the same component or state.

## Dark border call-site inventory

### `border-black` on `bg-background` — 1.17:1

- `packages/prototypes/brutalist/src/tabs/trigger.proto.ts` directly adds `bg-background border-black` while an unselected, unpressed Trigger is hovered. This is the concrete 1.17:1 state call site governed by `P-BRUTALIST-TABS-TRIGGER-INTERACTION`; Button and Card are not examples of this pair.

### `border-black` on `bg-secondary-background` — 1.39:1

Shared-token consumers and direct recipes are tracked separately so changing one constant cannot be mistaken for complete remediation.

| Ownership | Source call sites | Remediation boundary |
| --- | --- | --- |
| `BRUTALIST_CONTROL_TOKENS` | Toggle | A shared-control-token change reaches Toggle only |
| `BRUTALIST_STRUCTURE_TOKENS` plus direct fill | surface Button | Requires a Button recipe change or an explicit refactor into a shared control token |
| Direct control recipe | Select Trigger | Requires a Select Trigger recipe change or refactor |
| Direct control recipe | Switch Root | Requires a Switch Root recipe change or refactor |
| `BRUTALIST_PANEL_TOKENS` | Dialog Content, Dropdown Content, Hover Card Content, Select Content, Tabs Content | A panel-token change reaches these five panels |
| Direct panel recipe | Tabs List | Requires a Tabs List recipe change or refactor |

For each control or panel, a 1.39:1 black boundary fails if that boundary is required to identify the component against its adjacent fill or surroundings and no independent ≥3:1 cue supplies the boundary. The record does not pre-classify all panel frames as decorative.

`P-BRUTALIST-CARD` is not in this inventory: Card uses `border-foreground` on `bg-background`, which is 16.44:1 in both themes.

### Dark parent-child boundaries — 1.39:1 externally

Same-element recipes are not the whole boundary inventory. These child borders are externally adjacent to a `bg-secondary-background` parent in Dark:

| Child call site | Parent surface | Independent inner cue |
| --- | --- | --- |
| unchecked Switch Thumb `border-black` | Switch Root | `bg-foreground` against the black border is 19.26:1; checked also moves and changes to `bg-canary` |
| selected Tabs Trigger `border-black` | Tabs List | the inner `bg-main`/black boundary is 18.05:1 and the selected label also gains fill |
| Dialog Close Icon `border-black` | Dialog Content | the inner canary/coral fill against black is ≥14.89:1 |

The exterior edge is 1.39:1 in each case. The contrasting inner fill may make that edge redundant, but rendered per-call-site evidence must confirm that the child remains identifiable and that its required states do not depend on the low-contrast exterior edge. These direct child recipes remain separate from shared panel-token remediation.

## Stateful hard-shadow classification

Hard shadows cannot be categorically excluded from SC 1.4.11 because some recipes change them with state.

| Call site | Stateful use | Classification at this baseline |
| --- | --- | --- |
| Button, Toggle, Dialog Trigger, Dropdown Trigger, Select Trigger | 3px at rest, 4px on hover, removed on press where the recipe exposes pressed | Hover/press also translate these controls, and each retains a fill/border boundary. The shadow is a redundant state cue only if rendered evidence confirms those independent cues remain perceivable. |
| Tabs Trigger | selected-and-not-pressed adds a 3px shadow; unselected hover adds 4px; press removes it | The selected fill/border and hover/press movement are independent cues. Rendered evidence must still classify each state, including the Dark 1.17:1 hover border. |
| Switch Root | 3px at rest, removed on press | Press also changes the fill to coral. The shadow is a redundant press cue only if the rendered fill change and control boundary remain perceivable. |
| Hover Card Trigger | 3px at rest, 4px with translation on hover | Translation is an independent hover cue; rendered evidence must retain this call site rather than treating the shell as static. |
| Dialog Close Icon | 3px at rest, 4px on hover while canary changes to coral | This call site has no translation rule. The fill and child boundary must be evaluated against Dialog Content before classifying the shadow change as redundant. |
| Shared panels and other static shells | fixed 3px shadow | Structural decoration only where it does not identify the component or communicate state; the border/fill boundary is classified separately. |

Thus a low-contrast black shadow against the Dark page is not automatically counted as the sole failure, but every stateful consumer remains in the rendered-evidence scope instead of being erased from the audit.

## Light menu-state failures

The Light theme has real SC 1.4.11 failures even though its black borders pass:

- `packages/prototypes/brutalist/src/dropdown/item.proto.ts` uses `outline-none`. Keyboard focus/active changes a default row from white `bg-secondary-background` to `bg-main` at 1.16:1, and a destructive row to `bg-destructive` at 1.41:1. Neither fill reaches 3:1 against the surrounding white panel, and the recipe supplies no alternate focus outline.
- `packages/prototypes/brutalist/src/select/item.proto.ts` also uses `outline-none`. An unselected focused item relies on the same 1.16:1 `bg-main` change. A selected item additionally renders a check mark, but that does not repair the missing focus indication for an unselected item.

These are required focus-state indicators, not decorative fills, so they fail SC 1.4.11 in Light. The same fills pass against the Dark panel (13.00:1 and 10.73:1 respectively).

## Conclusion

1. The audited implemented text recipes pass SC 1.4.3 in both themes.
2. Dark has low-contrast black boundaries on the exact control and panel call sites inventoried above, plus the 1.17:1 Tabs Trigger hover pair. Final required-versus-redundant classification needs rendered adjacent-color evidence per component.
3. Hard-shadow state ownership spans Button, Toggle, Select/Dialog/Dropdown triggers, Tabs Trigger, Switch Root, Hover Card Trigger, and Dialog Close Icon. Redundancy must be confirmed per rendered call site; static shadows are decorative only where they carry no component or state information.
4. Light Dropdown and Select item focus fills fail SC 1.4.11 because their 1.16:1/1.41:1 changes are the only focus indicators.
5. Shared-token remediation alone is incomplete: surface Button, Select Trigger, Switch Root, and Tabs List are direct recipes that require separate changes or an explicit refactor.

## Recommended next steps (not authorized in this record)

- Capture rendered Light/Dark evidence for every affected control, child boundary, and panel, including rest, hover, keyboard focus, selected, and pressed states.
- Add a ≥3:1 focus indicator for Light Dropdown and Select items without relying on the low-contrast fill alone.
- Decide Dark boundary colors per component, or deliberately refactor the direct recipes into governed shared tokens before changing the shared tokens.
- Add executable contrast checks for the resolved theme pairs and browser assertions for state indicators; keep per-call-site classification in the evidence rather than inferring it from token names.
