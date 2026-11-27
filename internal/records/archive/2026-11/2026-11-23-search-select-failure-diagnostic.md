# Search Select failure snapshot, 2026-11-23

This record preserves a failed setup and adds observation after the original Search assertion has already failed. It does not close the Search native gate.

## Original failure

[Sprint 1 run 45160060271](https://github.com/Proto-UI/Proto-UI/actions/runs/45160060271) tested clean `502693304fc8d7509402fdfb586b283681915231`. Search completed 83 of 84 native cases successfully. The remaining case is Docs Shadcn at 320px with 200% text. Its text geometry and overflow assertions passed; after the real runtime Select trigger click, its controlled listbox remained invisible at the original 1000ms assertion. The trigger was connected, focused and `aria-expanded=true`. The original evidence does not contain the retained and portalled Select content's lifecycle and alignment state, so it does not yet identify the failing owner.

The same official job's successful production Search, other native cases and geometry checks do not substitute for this failed case. The provisional Positioning cleanup subsequently integrated by the overlay owner is not yet demonstrated to fix this failure.

## Bounded added observation

Only the failure handler for the four existing enlarged-text Docs cases reads the Select elements. It examines actual root, content, surface, viewport, trigger, value, item and item-text tags, including retained author elements and body portals. It records existing attributes, exposed state reads, used sizes, rectangles, offset parent and relevant computed layout. It does not depend on the missing listbox role to find the owner. At most 100 matching elements are recorded.

The observation starts after the original exception, has its own 1000ms ceiling, and records an unavailable snapshot when that ceiling expires. It introduces no input, focus, prop, style, subscription or readiness change. The existing failure capture and original exception remain the verdict. The four original inputs, assertions, 1000ms visibility threshold and case deadlines are unchanged.

## Retained unsuccessful reproduction

The first local attempt selected exactly the original Shadcn/Brutalist 320/390px 200% Docs cases on `8fbeda8157a8d39654c08ea656a082869e870ce3` plus the initial failure-only diagnostic. It exited 1 after 77.8043 seconds because the formal `generate:proto-ui-style` process exited 137. The log reached CLI init and theme generation before reporting `Killed`. No browser case executed: four selected cases were blocked and 80 others were not selected. Source hashes before and after match. No readable cgroup memory event counter was available; exit 137 is not presented as proof of an OOM cause.

[The manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-search-select-diagnostic/manifest.json) binds the original stdout, Vitest report, source receipt and exact initial patch in a verified gzip archive. That earlier patch did not yet contain the added snapshot ceiling. The current bounded diagnostic has syntax and formatting checks only; its browser execution and original failing Select state remain pending.

Next, rerun the original four cases and full 84-case queue on the integrated candidate with the formal setup. Diagnose the captured content phase and geometry before changing product code. Do not extend the visibility threshold, replace the consumer or infer a pass from the unavailable snapshot.
