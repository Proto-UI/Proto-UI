# Shadcn Drawer command density (v0, proposed bounded presentation)

Status: independently reviewed bounded presentation direction, admitted for this local implementation on 2026-10-11. This uncataloged transitional presentation slice does not admit the full Drawer or Button. Draft `C-AS-HOOK-0001`, `C-FEEDBACK-STYLE-0003` and `C-AS-OVERLAY-0001` constrain composition, style intent and unchanged overlay ownership.

## Fixed source and scope

Use shadcn/ui `c2a67849be260701852b0977ba15eb5f3a0ce2a4`, Base route with Nova styling:

- [Base Drawer consumer](https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/bases/base/examples/drawer-example.tsx) renders an outline Button for Trigger and footer Close, with size omitted.
- [Base Button](https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/bases/base/ui/button.tsx) selects default size.
- [Nova Button rules](https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/styles/style-nova.css#L148-L206) supply `h-8 px-2.5`, `rounded-lg text-sm font-medium`; there is no vertical-padding contribution for default size. The primitive alone does not supply this command density.

This changes only the two existing Drawer command recipes' density, weight and radius, plus the explicit long-label adaptation below. It does not change the separately cataloged Shadcn Button reference. Full outline paint, icon spacing, hover, dark, expanded and focus equivalence remain outside this slice.

## Presentation and ownership

Both commands contribute `min-h-8 px-2.5 py-0 rounded-lg text-sm font-medium min-w-0 max-w-full whitespace-normal wrap-anywhere text-center`, replacing `px-3 py-2 rounded-md`. At root16 and one line, expected border-box height is32px, inline padding10px, block padding0, font14px/line20px, weight500. At root32, the rem dimensions become minimum64px, inline20px, font28px/line40px; actual 1px borders remain host pixel borders. Radius uses the existing family `rounded-lg` mapping. Retain `inline-flex items-center justify-center` and border-box sizing. Explicit `text-center` centers each wrapped text line, rather than relying on native Button defaults or ancestor text alignment; this is part of the local wrapping adaptation. Font family and all existing paint/state rules remain unchanged.

Upstream uses fixed height and no-wrap. Choosing minimum height and wrapping is a Proto UI adaptation for the owner's narrow-screen/enlarged-text requirement, not an upstream assertion: allow additional lines to increase the box instead of clipping or ellipsizing its label. Under constrained available width, `min-w-0 max-w-full whitespace-normal wrap-anywhere text-center` must allow long and unbroken labels to wrap. Do not set a fixed width, max-height, overflow clipping or expanded invisible hit region. Consumer stretch may still set Close width. This is a 32px default visual density, not a claim of a 44px touch target or full accessibility certification.

Keep one existing `asDrawerTrigger()` or `asDrawerClose()` and no `asButton()`, new activation listener, DOM inspection, prop or public anatomy. Do not change Base behavior, root open/request ownership, controlled refusal, disabled logic, portal membership, gesture, focus, scroll or disposal. No Compiler, IR, Adapter or Focus changes.

## Acceptance

1. An independent contract-derived source/token oracle rejects both old recipes, preserves paint/focus/disabled tokens and proves one Drawer hook with no second button behavior.
2. Real source-host contributions and complete-family normal Document and Shadow CSS lower minimum height2rem, inline padding0.625rem, block padding0, small type0.875rem/1.25rem and wrapping without unsupported-token diagnostics. Source-host/CSS checks do not prove native layout or hit testing.
3. Existing Drawer request, controlled, disabled, focus, gesture and lifecycle regressions remain intact. Test one request for Trigger/Close, reopen and final disposal; do not weaken existing tests or correct other owners' logic.
4. Before claiming native visual acceptance, collect exact-source native receipts for WC/React/Vue/Vue2, light/dark, normal/narrow320px, root32 and long/unbroken labels. Measure box-sizing, font/root metrics, rect/scroll/client sizes, all borders/padding, height/min/max-height and any Shadow visual surface separately. Normal one-line32px and constrained-label growth must be observed, including no clipped text. Constrain the long-label command container to160px at root16 and240px at root32, both greater than inline padding plus borders; use a repeated sentence and an unbroken identifier. An arbitrarily narrower box below that physical floor has no absolute no-overflow guarantee. Root scaling is not browser zoom.
5. Native pointer hit probes inside/just outside actual command edges, open/close/reopen/Escape, and exact-commit screenshots are separate evidence. Missing native/browser/GPUI evidence remains explicit debt; registration or source CSS is not a pass.

Mapping: `packages/prototypes/shadcn/src/drawer/{trigger,close}.proto.ts`; planned `packages/prototypes/shadcn/test/drawer-command-density.test.ts`. No demo content or Finf completion-count changes.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
