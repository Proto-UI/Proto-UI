# Shadcn AlertDialog New York presentation, v0

Status: draft implementation target and bounded static repair; not full upstream admission.

## Reference and ownership

Use shadcn-ui/ui `02cad61166c4c20edbc8a3f71bd720eed4c1f49b`, `apps/v4/registry/new-york-v4/ui/alert-dialog.tsx` and `button.tsx`. Base/Nova is not this component's accepted reference. Preserve the original Base AlertDialog Root, content modality/focus and command ownership; passive Header/Footer own only grouping and slot presentation. AlertDialog Action/Cancel inherit their existing Base command and consume shared passive Button paint, never a second `asButton` interaction instance. No compiler, IR, host-specific component branch or page-local substitute is allowed.

This contract describes the `new-york-v4` compatibility projection. The public `demo-shadcn-alert-dialog` now explicitly selects Rhea through `withShadcnRheaDemo`; its page describes that separate profile and its remaining composition gaps. New York measurements must come from an explicitly identified New York consumer and cannot stand in for Rhea page acceptance.

## Default static surface

- Content: centered grid, gap 1rem, padding 1.5rem, 1px border, background/foreground theme roles, large shadow, large radius. Preserve the existing neutral available-region placement/scroll safety. Default desktop cap is 32rem.
- Header: reusable title/description group with 0.375rem gap; default desktop left alignment. Preserve Title text-lg/600 and Description text-sm/muted-foreground. No margin or second typography owner on the consumer.
- Footer: reusable command group, 0.5rem gap and desktop end alignment. Intrinsic reverse wrapping prevents a rigid-row overflow; it is not the upstream mobile breakpoint behavior.
- Action: default New York Button static geometry and primary visual. The shared passive recipe in `packages/prototypes/shadcn/src/dialog/action-paint.ts` now authors `bg-primary/90` for New York hover; the earlier local 80% mismatch is historical, not the current source recipe. Rendered hover and complete consumer style closure still need their own evidence. Cancel: outline New York Button visual including 1px border and extra-small shadow. Both use the shared default fixed size h-9, px-4, py-2, rounded-md and text-sm/500. Use relative units; do not hardcode their 16px-root pixel equivalents. Exact rendered border-box dimensions require real-browser evidence. Both commands expose wrap=false by default; wrap=true shares the existing Button multiline extension (minimum h-9, auto height, px-4/py-1, bounded width and anywhere wrapping), so long-label consumers have an explicit portable path rather than losing wrapping support.
- Mask: black at 50% opacity. Its final static state already agrees; animation is separate.
- Demo: use the real Header/Footer prototypes and preserve its focus-restoration explanatory text. Different demo wording is not a styling defect.

## Unclosed conformance

1. Upstream default Content uses viewport width minus 2rem below `sm` (40rem), then a 32rem cap. Current available-region cap remains at every width. Header centers below `sm`; Footer reverses a full-width column below `sm`. C-FEEDBACK-STYLE-0004 forbids `sm:` author selectors and no governed responsive layout input is currently available. Define one neutral, observable layout inline-size/breakpoint input owned by the geometry/environment boundary, preserving viewport versus available-region identity, units, readiness, updates, lifetime and stale-callback behavior. Prototype rules must own the size-dependent intent. Acceptance needs 639/640px-equivalent boundary crossing, root-font scaling, region occlusion, replacement/disposal, source and compiled targets. Do not add a CSS media-query bypass or component-name dispatch.
2. Content `size=sm`, Media grouping, and command variant/size customization have no AlertDialog public equivalents yet. They remain Base/family definition work.
3. Upstream Content fades and zooms from/to 95% over 200ms; overlay fades with the imported animation utility's default duration. Existing AlertDialog transition durations are zero, and the demo explicitly requests zero. A source class or timer would not implement trajectory/presence. Use neutral prototype motion definitions, reduced-motion, interruption/reversal and retained presence; real CI motion evidence remains required.
4. The upstream neutral registry theme and upstream website globals differ (website foreground/primary use black). Compare the neutral theme with this package's neutral palette; do not attribute page-brand customization to component sizing. At a 16px root the default shared radius is 10px and rounded-md is 8px. The package's radius derivation at enlarged roots and font selection remain separate theme-level evidence.
5. The Trigger currently has its earlier independent outline paint. New York Trigger is unstyled and its demo composes Button; that API/composition gap remains open rather than silently adding another behavior owner.

## Evidence boundary

Source/host-unit and document/Shadow token closure tests prove authored static intent, exports, nested accessibility relations and single command requests only. They do not establish actual browser geometry, real focus, mobile parity, motion, native/GPUI or full delivery. Preserve the earlier exact-head screenshot and failed runs. After publication, CI must capture panel, groups and commands for the exact new SHA before visual acceptance.

### Planned native New York layout evidence

`apps/www/src/content/docs/zh-cn/finf-alert-dialog-layout.browser.test.ts` supplies the executable plan for the static-layout/root-font child of [#1097](https://github.com/Proto-UI/Proto-UI/issues/1097), mapped by `T-SHADCN-ALERT-DIALOG-0001-CASE-5` through `CASE-7`. It is authored and unexecuted. Its new catalog implementation remains `planned` until actual source-bound results are reviewed.

The suite renders a separate ordinary consumer of the real DemoSpec and preview renderer. It changes that consumer's public style-scope input to `new-york-v4`, adds observation refs and records the original callback while preserving its delivery. The public Rhea DemoSpec and page remain unchanged. The fixture retains the real text, parts, zero-duration inputs and inherited command owners; it supplies no replacement panel, command paint or transition.

The inventory has 32 cases: `wc`, `react`, `vue`, `vue2` × light/dark × `wide-root16`, `wide-root32`, `narrow-root16`, `narrow-root32`. Wide and narrow viewport widths are 1280px and 320px; height is 1000px. Root font sizes are 16px and 32px. IDs follow `alert-layout-new-york-v4-<runtime>-<scheme>-<scenario>`.

The official runner must bind a clean checked-out candidate to `CANDIDATE_SHA`, register the suite once in the canonical browser inventory and retain a loopback documentation server owned by that exact-source job. It runs:

```sh
corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/finf-alert-dialog-layout.browser.test.ts --maxWorkers=1
```

Use `PUI_FINF_ALERT_DIALOG_LAYOUT_EVIDENCE_DIR` for a targeted job's artifact directory. In the canonical browser shard, artifacts default to `alert-dialog-layout` beneath `PROTO_UI_RUNTIME_EVIDENCE_DIR`, which the existing CI workflow uploads. The suite accepts that runner's `PROTO_UI_BROWSER_BASE_URL` only with a browser-phase selection receipt matching the exact checkout, shard and suite membership; otherwise an official targeted invocation starts its own server. External hosts and arbitrary reused servers are rejected. The actual GitHub Actions environment remains required; a local invocation or forged environment is not official execution. Main owns registry admission, supported workflow selection and serialized execution. Merely adding this file does not demonstrate that any runner selected it.

Each case measures the real panel, Mask, groups, typography and command border boxes. It checks the rem-derived 1.5rem panel padding, 1rem panel gap, 0.375rem Header gap, 0.5rem Footer gap and 2.25rem command height, plus the available-region cap and horizontal containment. Pointer input opens, tests the backdrop guard and cancels. Real Tab/Shift+Tab, Enter and Escape exercise grouped focus and distinct requests across three open windows. Current results may expose a product, host or fixture failure; none is asserted before execution.

Opened, outside-guard and reopened images use `animations: allow`, with consecutive settled native observations and matching measurements before and after capture. Closed images bind the actual Trigger focus and expanded state on both sides. Source/candidate hashes, every declared case ID, samples, callback details, console diagnostics, actual failures and image hashes are retained. No initial passing baseline or failing-before repair claim is manufactured.

Inspect the actual panel/group/command captures in both themes and root sizes before accepting this bounded evidence. Passing these cases would establish only their static geometry and input observations. Root-font scaling is not browser zoom; intrinsic wrapping at 320px is not the upstream 40rem breakpoint. Rhea paint, other families, font selection, long-label extensions, controlled/native-owner cases, motion/interruption/reduced-motion conformance, AT, packed consumers and non-Web targets remain separate obligations. No parent checkbox or Issue closure follows from this suite alone.
