# Finf group C functional source checkpoint

Date: 2026-10-10 UTC. This records implementation and local evidence, not full Finf acceptance or lifecycle promotion.

## Implemented slices

- Calendar: civil Gregorian date arithmetic, month grids, controlled date/month requests, date availability, keyboard day navigation and four visual projections.
- Tree: validated stable-key parent graph, visible preorder, expansion, selection, hierarchy accessibility facts and keyboard focus movement.
- Resizable: two-panel ratio constraints, controlled requests, keyboard controls and the shared normalized Axis Input path. Physical sizing remains blocked below.
- Carousel: controlled current index, actual current/hidden slide states, previous/next boundaries, keyboard and normalized swipe requests. No autoplay.
- Message Scroller: existing Scroll Surface end-follow, application-supplied new-content count and explicit end resume, including disconnected-view callback handling.
- Virtual List: complete stable logical IDs, item-count bounds, revision/generation settlement and an explicit Web materializer with variable extent measurements, keyed physical views, spacers, ensure-visible and cleanup. The prerequisite model is not yet integrated into the existing Collection provider or native materializers.
- Date Picker: real Calendar and Popover composition with date selection, value rendering and close requests.
- Data Table: real passive Table structure composed with stable sorting, filtering, pagination, selection, row slots and rendered record cells.

Each slice has Base behavior, four family projections, a real DemoSpec and bilingual WIP documentation. Shared package/catalog/CLI/registry/navigation changes are intentionally left to the Finf integrator.

## Local verification

- Final focused command: `corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/calendar.test.ts packages/prototypes/base/test/tree.test.ts packages/prototypes/base/test/finf-collection-compositions.test.ts packages/prototypes/base/test/finf-collection-projections.test.ts packages/prototypes/base/test/message-scroller.test.ts packages/prototypes/base/test/virtual-list.test.ts --maxWorkers=1 --minWorkers=1`.
- Result: 47 tests passed across six files. These are happy-dom/model consumers, not real-browser or native acceptance.
- Scoped TypeScript includes the eight Base component directories, all four family projections and forty DemoSpecs. It passes with the workspace compiler settings and existing pinned dependencies.
- Whole-workspace type checking still reports two absent ignored `proto-ui-shadow-style.generated.js` inputs in the pre-existing shadow analysis fixtures. No full-workspace type success is claimed.
- No Rust toolchain/native GPUI execution, browser visual screenshots, packed-package smoke, lifecycle admission or independent acceptance was performed in this slice.

## Observed failures and repairs

1. Calendar initially omitted the required owner context subscription. The failing consumer test exposed it; the subscription was added. A separate projection test used an incorrect October date expectation for offset 13; the expectation was corrected to October 10.
2. Tree initially exposed portable hierarchy facts without a generic Web `aria-level` mapping. Shared A11y commits supply finite `level`, `posInSet` and `setSize` projection while preserving heading-only `a.level()` semantics.
3. Message Scroller received a late Scroll fact after its context disconnected. An optional context subscription and guarded optional read preserve teardown safety.
4. Carousel collided with Collection's existing `count` expose. Its own public count is now `slideCount`.
5. Projection rendering tests initially assumed a shadow root while the current Web Component profile uses light DOM. The assertions now inspect the actual rendered text.
6. Windowed materialization now checks requested range/IDs as well as generations; policy changes invalidate in-flight results. Forged contents and stale policy requests have a negative test.

## Open functional and acceptance debt

- Resizable currently publishes a dynamic percentage `basis-[…%]` token. The static CSS collector cannot by itself prove realization of arbitrary runtime percentage tokens. Normalized input and ratios pass, but physical layout resizing is explicitly unverified and remains a source blocker pending a shared dimensionless proportional-layout projection. No DOM geometry or inline styling is introduced into portable prototype props/state to conceal this gap.
- `aria-sort` mapping is being handled by the shared A11y integrator. Sorting already updates actual Table cell content through the composition.
- Multi-panel resizing, existing Collection-provider integration for windowing, all Adapter/Compiler/native materialization, real pointer/touch/keyboard/a11y journeys, visual optical/spacing audits, package consumers, exact-head CI/DCO and independent review remain open.
- No checklist item is checked and no native/family completeness claim follows from the local smoke counts.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
