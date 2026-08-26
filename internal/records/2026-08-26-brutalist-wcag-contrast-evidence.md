# Brutalist WCAG contrast evidence — 2026-08-26

Non-normative record. Refs #469. Does not create a stable spec guarantee or authorize merge.

## Baseline

- `main` commit: `259aeb77`
- Theme source: `packages/cli/src/generated/brutalist-theme.ts`
- Tokens source: `packages/prototypes/brutalist/src/style.ts`
- Method: WCAG 2.2 SC 1.4.3 (text, ≥4.5:1), SC 1.4.11 (non-text, ≥3:0)

## Text contrast (SC 1.4.3) — all PASS

| Pair | Light | Dark |
| --- | --- | --- |
| bg-background / text-foreground | 16.44 PASS | 16.44 PASS |
| bg-main / text-main-foreground | 18.05 PASS | 18.05 PASS |
| bg-card / text-card-foreground | 17.93 PASS | 13.88 PASS |
| bg-popover / text-popover-foreground | 17.93 PASS | 13.88 PASS |
| bg-muted / text-muted-foreground | 11.54 PASS | 6.99 PASS |

No text contrast failures in either theme.

## Non-text contrast (SC 1.4.11) — classification required

| Pair | Light | Dark | Classification |
| --- | --- | --- | --- |
| border-black on bg-background | 19.26 PASS | **1.17 FAIL** | Depends on call site |
| border-black on bg-main | 18.05 PASS | 18.05 PASS | Required indicator — PASS |
| border-black on bg-card | 21.00 PASS | **1.39 FAIL** | Depends on call site |

### Classification per #469 corrected baseline

Per the corrected audit comment on #469: `border-black` or a black hard shadow measuring below 3:1 against the page does **not** make every call site a WCAG 1.4.11 failure. The criterion applies only to visual information required to identify a component or state, against the actual adjacent colors.

**Dark theme — border-black (#000) on bg-background (#171717) = 1.17:1**

This pair appears in Brutalist components where `border-2 border-black` is used directly on a surface with `bg-background`. Classification:

1. **Required component/state indicator**: When `border-black` is the sole visual boundary distinguishing a control from its surroundings (e.g., a Button at rest with transparent fill on dark background, or a Card frame), the 1.17:1 ratio fails SC 1.4.11.
2. **Decorative/structural**: When the component has a contrasting fill (e.g., `bg-main` canary yellow), `border-black` measures 18.05:1 against that fill — the boundary is clearly visible. The border against the page background is decorative in this case.
3. **Hard shadow** (`shadow-[3px_3px_0_0_#000]`): A black hard shadow on dark background is decorative — it does not convey component identity or state. SC 1.4.11 applies only to required indicators.

### Affected call sites (Dark theme only)

The shared token groups `BRUTALIST_CONTROL_TOKENS` and `BRUTALIST_PANEL_TOKENS` both pair `border-black` with `bg-secondary-background` (#262626 in Dark, ratio 1.39:1). These tokens are used by multiple interactive surfaces:

**Control tokens** (`BRUTALIST_CONTROL_TOKENS = border-2 border-black + bg-secondary-background`):
- **Toggle**: default, sm, lg variants all use `BRUTALIST_CONTROL_TOKENS`. If the border is a required structural boundary, fails SC 1.4.11 in Dark.
- **Button (surface variant)**: variants using `BRUTALIST_CONTROL_TOKENS` directly. Button at rest uses `border-transparent` (no contrast requirement); selected/hovered uses `border-black` on `bg-main` (18.05:1 PASS).
- **Select Trigger, Switch Root**: if these use `BRUTALIST_CONTROL_TOKENS`, same 1.39:1 ratio in Dark.

**Panel tokens** (`BRUTALIST_PANEL_TOKENS = border-2 border-black + bg-secondary-background`):
- **Dialog Content**: panel uses `BRUTALIST_PANEL_TOKENS`. Ratio 1.39:1 in Dark. If panel frame is a required structural boundary, fails SC 1.4.11.
- **Dropdown Content**: same `BRUTALIST_PANEL_TOKENS`. Same ratio.
- **Hover Card Content**: same `BRUTALIST_PANEL_TOKENS`. Same ratio.
- **Select Content**: same `BRUTALIST_PANEL_TOKENS`. Same ratio.

**Not affected**:
- **Card** (`P-BRUTALIST-CARD`): uses `border-2 border-foreground` (not `border-black`) on `bg-background`. Ratio 16.44:1 in both themes. PASS.
- All components using `border-black` on `bg-main`, `bg-primary`, or accent fills (canary, lavender, mint, coral) pass SC 1.4.11 at 14-18:1 in both themes.
- Button at rest uses `border-transparent` — no contrast requirement.

## Conclusion

1. **Text contrast**: no failures in either theme.
2. **Non-text contrast**: multiple shared-token call sites potentially fail SC 1.4.11 in Dark theme. `BRUTALIST_CONTROL_TOKENS` and `BRUTALIST_PANEL_TOKENS` both pair `border-black` with `bg-secondary-background` (#262626 in Dark, 1.39:1). Affected: Toggle, Dialog/Dropdown/Hover Card/Select Content panels. Card is NOT affected (uses `border-foreground` at 16.44:1).
3. **Perceptual**: black hard shadows on dark background are decorative and do not trigger SC 1.4.11.
4. **Light theme**: all pairs pass.

## Recommended next steps (not authorized in this record)

- Per-call-site classification with rendered evidence for each Brutalist component.
- Component-specific Dark palette proposals for shared-token control/panel surfaces where `border-black` on `bg-secondary-background` is a required structural boundary.
- Automated contrast-ratio test in the test suite.
