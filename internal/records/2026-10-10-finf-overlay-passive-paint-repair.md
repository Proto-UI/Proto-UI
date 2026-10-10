# Finf overlay passive-paint repair and retained blockers

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

Base source: `c2cbb8d6fce71e949f84f0358189184783505989`; this slice follows the separate Accordion repair. It changes only existing family presentation. No new Base/active guarantee, public Props/Exposes, semantic owner, transition timing, Compiler/CLI semantics, #884 or #886 work is included.

## Definition boundary

Popover and AlertDialog still lack complete Base/family catalog definitions. A narrow, independently reviewed presentation-only proposal precedes this repair; it is not a substitute for catalog admission. No set of unsupported family P placeholders is created.

The independent presentation goal is an identifiable primary confirmation and a distinct safe exit, with visible borrowed hover/press/focus/disabled states. `C-AS-HOOK-0001`, `C-AS-HOOK-0007`, `C-AS-HOOK-0009` and `C-FEEDBACK-STYLE-0003` provide composition, borrowed-state and style-intent boundaries. Legacy `internal/contracts/overlay/as-overlay.v0.md` supplies overlay background only, not a complete AlertDialog public protocol.

The retained source behavior is evidence, not a newly legislated guarantee: Root owns canonical open; controlled commands issue requests that the caller can reject; Action emits its action event then requests close; Cancel requests close without Action's event; local/Root disabled suppresses commands. Shadcn base-nova Action is an ordinary Button without implicit closing, so its behavior is not equivalent to the current Proto Action. Async wait/error/retry and close ordering need their own Base definition review. This repair deliberately cannot settle them by copying upstream behavior or ratifying the current implementation.

## Component-specific presentation

- Shadcn Popover Content follows the base-nova 18rem width, 0.625rem padding/gap, ring rather than border, small type and medium shadow. Available-width/height bounds and scrolling remain.
- Neo Popover Content follows the pinned component's rounded-base/2px frame/18rem width/gap-4 and has no popup shadow. A global hard-shadow theme is not applied to every role.
- AlertDialog Action/Cancel across four families borrow their existing command state and add passive family Button paint. They do not compose `asButton`, register an event or create interaction state. Shadcn is primary/outline, Neo main/neutral, Bootstrap primary/default gradient, and Liquid prominent/regular opaque fill.
- Hover and pressed presentation is defined in the command's setup from those borrowed states. Shadcn includes dark outline input/30 and dark hover input/50. Neo uses its existing translation/hit-envelope tokens; Bootstrap reuses its passive gradient/inset tokens.
- Text commands preserve long labels with minimum rather than fixed height, max-width containment and wrapping. This is an intentional safety adaptation; source assertions are not measured pixel equivalence. Icon/side-specific Button spacing is not newly exposed.
- Liquid here gains fallback paint only. It does not gain a material property or certify optical behavior. Popover transition remains zero; header/footer/media/size anatomy, placement animation, arrows and complete visual equivalence remain outside this bounded repair.

Static references, never executed:

- Shadcn base-nova [Popover](https://ui.shadcn.com/r/styles/base-nova/popover.json), [AlertDialog](https://ui.shadcn.com/r/styles/base-nova/alert-dialog.json), [Button](https://ui.shadcn.com/r/styles/base-nova/button.json), fetched 2026-10-10; deployed Git SHA is unknown. MIT attribution is retained in existing notices.
- Neo [Popover](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/popover.tsx), [AlertDialog](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/alert-dialog.tsx), [Button](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/button.tsx), MIT.
- Bootstrap v2.3.2 Buttons is a visual combination reference; there is no same-named upstream AlertDialog. Existing `button/paint.ts` and Apache-2.0 notices retain that attribution. Liquid is an independently authored projection of material principles, not an Apple component source copy.

## Executed evidence and retained failures

The 10 new cases all failed before this repair. The 8 repaired AlertDialog source-host cases pass, including actual borrowed hover/press/cancel, distinct primary/cancel fill, retained public controls, one event/request per command, controlled rejection/repeat, disabled suppression and wrap-token negative controls. With existing window, focus-outside, Drawer and controlled-dismissal regressions: 5 files / 65 tests pass. Description-registration initialization warnings remain visible.

Both Popover source recipes now meet the independent static recipe expectations, but the two CSS closure cases still fail because the existing renderer does not lower standard `w-72`. It must become `width: 18rem` through the physical style vocabulary owner. No arbitrary-width workaround or component-name special case is introduced. The failing cases remain executable in `packages/prototypes/test-utils/test/popover-recipes.test.ts`; this suite is not reported green.

Isolated normal collection of all eight AlertDialog Action/Cancel sources still returns zero `data-[...]` condition tokens and no focus-visible selector. The valid captured `getState` pattern is preserved for its collector owner. Runtime rules/borrowed state being present does not prove final consumer CSS or pixels. Cross-component token leakage in a full preset cannot replace those isolated cases.

Generated style presets are refreshed through their normal generators. Workspace TypeScript passes; no public type edits. Passing source tests or successful generation are not a full compiler or packed-consumer pass.

## Next minimum official evidence

1. Fix `w-72` in the existing physical style vocabulary workstream, then rerun the two unchanged failing Popover cases and exact isolated collector/CSS outputs.
2. The collector owner repairs all eight unchanged borrowed-state cases, then verifies complete preset and packed actual consumers. Do not rewrite valid authored state acquisition merely to hide the gap.
3. Bind a real-browser fixture to the final SHA for the actual two Popover Content entries and four AlertDialog families. Capture light/dark default, hover, held press, keyboard focus and disabled Action/Cancel; measure 320px/200% long-label bounds; test cancel, single Action event, controlled rejection/repeated commands and focus return. Existing Drawer Cancel-only journeys do not substitute for Action evidence. Dedicated AlertDialog/Popover native journeys remain to be added.
4. Keep Dialog/Tooltip Bootstrap and Liquid projection gaps, full anatomy/motion/material, GPUI/native, final build/pack, lifecycle and independent acceptance open.

No new exact-source browser image exists for this slice. No old image is used as repaired evidence. No push, PR comment or Full-delivery checkbox mutation is performed.
