# Documentation flow and Liquid Glass public consumer gates

These are corrections to the actual public-consumer bindings of two browser gates. They do not change component recipes, layout dimensions, native activation, optical material behavior or timing budgets. The executed cases and SHA-256-bound raw reports are in `evidence/2026-11-25-docs-flow-and-liquid-public-consumers/receipts.json`. The runs used an isolated dirty checkout based on `5f0844907895a4ae0db506fe6a5d0bf162318329`; they are not the integrated clean-head Actions gate.

## Documentation flow follows the same authored example

The original Brutalist documentation case failed when the React destructive-section heading moved down by 48px. The archived original WC and React measurements show identical hero preview height, RuntimeBox canvas, surface and insets. The preceding independent Surface example has a one-line WC snippet, with a 24px code viewport and 48px code frame; its multi-line React snippet has a 72px viewport and 96px frame. The extra source text accounts for the following heading's 48px document-flow displacement. It is not a change to the component's rendered canvas.

The corrected comparison anchors each prose block to the bottom of the same preceding real previewer, or to the main content origin when no example precedes it. It requires the complete demoId order and each text identity/anchor pair to remain identical. The original 1px limit still applies to relative vertical spacing, horizontal position, width and height. Typography, the first hero's canvas, full preview bounds, padding and vertical insets remain independently checked. No fixed code height or production CSS was introduced.

Both original documentation cases pass **2/2**, for Shadcn and Brutalist, through the complete WC → React → Vue → Vue 2 → WC cycle. All ten candidate geometry snapshots are archived alongside the two original failing-state snapshots. The four unselected homepage cases are recorded as filtered, not as passes.

## Current Liquid Glass Button examples

The original public Button case looked for removed adapter panels and three copies of the hero. The current EN and ZH pages instead contain one runtime-selected hero and independent `regular`, `prominent` and `disabled` examples. The test now selects each actual previewer's runtime and verifies its real native button count, visible label and authored code. Ordinary examples do not require fixed-family projection metadata; their public runtime readiness is checked by the existing shared harness and actual button roles.

The existing native Back activation, optical quality/material paint, transparent surrounding scene, source-only availability and no unsupported CLI package claims remain unchanged. The generated WC tag and framework wrapper imports now match the current visible source. Vue 2 still must declare its component and must not use script setup. The disabled example additionally requires the actual button's `aria-disabled="true"`.

The complete original public case passes **1/1** in 67.4 seconds within its unchanged 150-second budget, covering both languages, all four Web runtimes and all three independent examples. The old panel-locator failure remains archived as failed evidence. The separate WIP optical route is not admitted by this result.
