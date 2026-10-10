# Collection family feedback: consume the actual nested owner

Date: 2026-10-10 UTC. Baseline `f8c86392a340978d30e7e9e05602e51ab1e6ff67`; branch `finf/collection-nested-state-feedback`. Calendar f8c863 is the separate preceding change. No fifth frozen snapshot is rewritten.

## Finding and authority

The independent values/geometry audit reproduced four Carousel family failures: Previous was exposed/ARIA-disabled, but its family never registered a disabled style rule. A positive control consumed the actual nested Button capture and registered that same rule. This was a Prototype consumer defect, not a static collector defect. `C-AS-HOOK-0007` (draft) requires nested frames to retain their own named state handles; the public runtime contract and existing capture tests already implement that direction. It is not legal to flatten Button state to make these consumers work. Button and family Button P entities remain draft; this maintenance repair does not activate them or claim full component fidelity.

The earlier code cast an optional outer frame to `Record<string, State<boolean>>` and silently skipped rules when the invented property was absent. These exact interactive consumers now use typed named child captures, fail visibly if a required capture is unavailable, and register the intended owner-state rules. No Base behavior, shared API, additional interaction hook or compiler parser was added or changed.

## Exact repaired paths (all four styled families)

| Consumer | Actual public owner path | Registered feedback |
| --- | --- | --- |
| Carousel Previous / Next | `asCarouselPrevious/Next → as-button` | disabled, focus-visible, pressed |
| Tree Toggle | `asTreeToggle → as-button` | disabled, focus-visible, pressed |
| MessageScroller Jump | `asMessageScrollerJump → as-button` | disabled, focus-visible, pressed |
| DataTable Previous / Next | `asDataTablePrevious/Next → as-button` | disabled, focus-visible, pressed; removed nonexistent selected condition |
| DatePicker Trigger | `asDatePickerTrigger → as-popover-trigger` | disabled, focus-visible, pressed; removed nonexistent selected condition |
| DatePicker Day | `asDatePickerDay → as-calendar-day` | selected, disabled, focus-visible, pressed; selection/close composition retained |
| MessageScroller Viewport | `asMessageScrollerViewport → as-scroll-area-viewport` | actual surface focus-visible; no invented disabled state |

The DatePicker Trigger detail corrects the audit's provisional path: at this baseline Popover uses its own `setupPopoverCommand`; its child capture directly owns the interaction state. It has no further `as-button`. Runtime negative controls assert that absent child as well as the absent outer disabled/focus/ pressed fields. MessageScroller Jump retains its own atEnd/newContentCount frame.

Existing static geometry, selected colors and focus/disabled recipe values are preserved. Newly connected pressed feedback uses each existing family's Button vocabulary, rather than a new shared visual grammar: Shadcn translate-y-px; Neo press translation/shadow removal plus its existing motion hit-envelope; Bootstrap's existing inset pressed-shadow paint; Liquid's shadow-xs. Sources are the respective `src/button/button.proto.ts`, Neo `src/style.ts`, and Bootstrap `src/button/paint.ts`. These are existing family references, not a claim that the collection components' current geometry is upstream-complete. Existing notices/reference revisions remain applicable; no third-party source was executed or copied anew.

## Discriminating tests and types

- The independent audit fixture is retained as `collection-nested-audit.test.ts`: before 4 failed / 1 positive control passed; after 5/5 passed.
- `collection-nested-feedback.test.ts` tests eight interactive consumers × four families, then four MessageScroller Viewports. Actual WC exposed disabled, ARIA-disabled, focused/focus-visible, pressed data attributes, cancellation, disable-after-press, and off-tab behavior are observed together with runtime registered feedback tokens. DatePicker Day still selects and closes its Popover. Tests use real adapters and synthetic inputs in Happy DOM, not real browser pointer/cascade claims.
- The final two-file fixture was rerun against the exact 20 original family files from f8c863: **40 failed / 1 passed**. Candidate files were then restored. The additional Viewport failures are missing inherited focus-rule tokens.
- `collection-nested-captures.test.ts` has eight actual-frame positive/negative cases. Named child states have real boolean domains; nonexistent outer fields remain absent. It does not compare two unknown type aliases.
- `collection-nested-feedback.types.ts` calls the nine real public child paths and requires boolean state results; assigning those results to number is a compile-time negative control. No public type broadening was used.
- Final post-format combined run: **107/107 tests across all 11 requested files**, 14.80s, exit 0. It includes the new 49 cases and existing collection behavior, projection, capture, Tree, MessageScroller and Calendar/DatePicker consumers. Toolchain: Node 24.19.0, fixed offline pnpm 10.32.1, Vitest 2.1.9, one worker.

Commands:

```sh
./node_modules/.bin/vitest run packages/prototypes/base/test/collection-nested*.test.ts packages/prototypes/base/test/finf-collection-compositions.test.ts packages/prototypes/base/test/finf-collection-projections.test.ts packages/prototypes/base/test/finf-collection-hook-contracts.test.ts packages/prototypes/base/test/carousel-resizable-public-handles.test.ts packages/prototypes/base/test/message-scroller.test.ts packages/prototypes/base/test/tree.test.ts packages/prototypes/base/test/calendar-public-handles.test.ts packages/prototypes/base/test/calendar-variable-weeks.test.ts --maxWorkers=1 --minWorkers=1
./node_modules/.bin/tsc --noEmit -p packages/prototypes/base/test/tsconfig.collection-nested-feedback.json
./node_modules/.bin/tsc --noEmit -p packages/prototypes/base/test/tsconfig.calendar-public.json
./node_modules/.bin/tsc --noEmit -p packages/prototypes/base/test/tsconfig.carousel-resizable-public.json
```

## Separate real blockers and unfixed findings

After runtime registration was repaired, an isolated read-only `collectProtoStyleTokens` probe still failed **20/20 family/component cases**: required disabled/focus selectors were absent. Exact token arrays and missing values are in `2026-10-10-collection-nested-feedback-collector.json`. The initial probe directory did not match the repository test globs and collected zero tests; moving only that temporary fixture into a matching packages/test path produced the real 20-case failure. No zero-discovery run is counted as evidence. No CLI/Compiler semantic source, whitelist or shared entry was modified.

Two distinct Base policy gaps are not hidden by the styled repair:

1. Carousel navigation's existing mounted boundary synchronization overwrites a locally supplied disabled=true when root is enabled and the index is in the middle. The first fixture exposed this; the final ownership/style fixture explicitly uses root disabled, then re-enables it, and later tests local disable updates. That is not evidence that initial local disabled is fixed. Base `carousel/index.ts` navigation sync needs its own follow-up.
2. DataTable pagination does not currently derive disabled from root policy or first/last page. This test deliberately verifies the supported explicit child disabled input. The missing boundary policy is not silently added or declared complete in a presentation-consumer repair.

Other passive parts' old speculative top-level casts and full visual recipes are not accepted by this narrow correction. In particular DatePicker day geometry and the full Calendar family states remain a separate fidelity task. Fresh exact-commit screenshots, actual CSS/cascade/hover/press paint, accessible names, four-Web behavior expansion, packed/compiled/native/GPUI evidence and independent review remain open. No TODO checkbox, full-delivery verdict, publication or external write is made here.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
