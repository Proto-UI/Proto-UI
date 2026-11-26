# Shadcn Select popup follows the anchor box instead of per-row sizes

Date: 2026-11-07
Status: implemented, verification listed below; no lifecycle promotion claimed.

## Observation

On the live docs Select (`/zh-cn/ui-libraries/shadcn/select/`, Rhea profile, `position: 'item-aligned'`)
the open popup measured 232px at `x=500` while its Trigger measured 224px at `x=504`, and the
ungrouped disabled row sat at `x=500..724` while grouped rows sat at `x=504..728`. The result was a
popup 4px wider than its control on both sides plus one ragged row.

Two mechanisms produced that:

1. The Base `itemSizing: 'match-trigger'` policy registered a row-level size lease. Each inheriting
   row was written to the Trigger's border box (224px) and the floating frame's `min-width` became
   `224 + group gutter(8) = 232px`. Upstream binds the **popup** to the anchor width
   (`w-(--anchor-width)` in the pinned `select.tsx`), so rows are ordinary full-width children and
   never match the Trigger's border box.
2. The Shadcn popper-width recipe classes already read `--proto-ui-anchor-width`, but the web
   target-alignment host never published that fact (only the edge host and the native compiler did),
   so the classes were inert and the row lease was the only thing sizing the popup.

The ungrouped row also exposed the policy's structural inconsistency: ungrouped rows received the
Trigger width at the viewport edge while grouped rows were inset by the Group's padding.

## Decision

- Publish `--proto-ui-anchor-width` and `--proto-ui-anchor-height` on the target-alignment frame,
  matching the edge host and `packages/compiler/src/native-adapter-modules.ts`.
- Bind every translucent Shadcn Select Surface to `w-[var(--proto-ui-anchor-width)]`, keeping the
  profile `min-w-*` as the floor. Rows stay `w-full` inside their Group or Viewport.
- Drop `h-[var(--proto-ui-anchor-height)]` from the popper viewport: the pinned v4 registry has no
  viewport, and publishing the fact would otherwise clamp the scroll area to the Trigger height.
- Retire the Base `itemSizing` policy, the Select size-lease integration, and the popper size gate.
  They were the second mechanism for one visual relation and are now unused by every prototype.
- Solve the popup inline box from the reference box: inline inset = reference logical inline start,
  inline minimum span = reference inline span. Value-span and row-text metrics no longer enter the
  equation, so a Trigger label edit or a row's own text inset cannot move the popup.
- Keep the disabled row inside its Group in the docs demo so grouping is uniform.

The neutral `registerSizeMatch` host capability and `C-TARGET-SIZE-MATCH-0001` remain in place; they
now have no prototype consumer.

## Evidence

Measured before: frame `{x:500,w:232,minWidth:232px}`, rows `504/224` plus one `500/224`.
Measured after: frame `{x:504,w:224}`, surface `{x:504,w:224}`, rows `508/216` for all four rows,
and the active row (`y=495.5`) covers the Trigger exactly (upstream `alignItemWithTrigger: true`).

Source tests: `packages/modules/positioning/test` 97 passed, `packages/prototypes/base/test`,
`packages/prototypes/shadcn/test/select.test.ts`, and the www composition/locale/header tests pass.
Workspace `tsc -p tsconfig.workspace.json` reports only the pre-existing
`packages/cli/test/lowered-hook-coverage.test.ts(5085)` error, reproduced on the pristine tree.

Pre-existing failures reproduced unchanged on the pristine tree: `tooltip.test.ts` (2),
`command-profile-transitions.test.ts` (1), `data-table-header-row.test.ts` (1). The regenerated
Shadcn preset manifest also absorbs pre-existing drift (`mx-[-0.375rem]` removed, `select-auto` and
`select-text` added) that made `button-ghost-style.test.ts` fail before this change.

## Residual

`inlineReference` and `inlineTarget` remain required target-alignment parts with membership
validation, but no longer influence placement. Removing or re-specifying that pair belongs to a
separate change to `C-TARGET-ALIGNMENT-BINDING-0001`; it is not silently bundled here.

Native raster/portal acceptance for the new popup width remains unverified.
