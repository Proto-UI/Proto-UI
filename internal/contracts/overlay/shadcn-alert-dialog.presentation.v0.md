# Shadcn AlertDialog New York presentation, v0

Status: draft implementation target and bounded static repair; not full upstream admission.

## Reference and ownership

Use shadcn-ui/ui `02cad61166c4c20edbc8a3f71bd720eed4c1f49b`, `apps/v4/registry/new-york-v4/ui/alert-dialog.tsx` and `button.tsx`. Base/Nova is not this component's accepted reference. Preserve the original Base AlertDialog Root, content modality/focus and command ownership; passive Header/Footer own only grouping and slot presentation. AlertDialog Action/Cancel inherit their existing Base command and consume shared passive Button paint, never a second `asButton` interaction instance. No compiler, IR, host-specific component branch or page-local substitute is allowed.

## Default static surface

- Content: centered grid, gap 1rem, padding 1.5rem, 1px border, background/foreground theme roles, large shadow, large radius. Preserve the existing neutral available-region placement/scroll safety. Default desktop cap is 32rem.
- Header: reusable title/description group with 0.375rem gap; default desktop left alignment. Preserve Title text-lg/600 and Description text-sm/muted-foreground. No margin or second typography owner on the consumer.
- Footer: reusable command group, 0.5rem gap and desktop end alignment. Intrinsic reverse wrapping prevents a rigid-row overflow; it is not the upstream mobile breakpoint behavior.
- Action: default New York Button static geometry and primary visual. Existing 80% primary hover is retained as an explicit temporary mismatch from the upstream 90% hover; migrating it currently exposes a lawful Form Submit borrowed-state style-closure gap. The subsequent migration must fix the neutral collector and preserve all actual consumer CSS, not add dead token seeds. Cancel: outline New York Button visual including 1px border and extra-small shadow. Both use the shared default fixed size h-9, px-4, py-2, rounded-md and text-sm/500. Use relative units; do not hardcode their 16px-root pixel equivalents. Exact rendered border-box dimensions require real-browser evidence. Both commands expose wrap=false by default; wrap=true shares the existing Button multiline extension (minimum h-9, auto height, px-4/py-1, bounded width and anywhere wrapping), so long-label consumers have an explicit portable path rather than losing wrapping support.
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
