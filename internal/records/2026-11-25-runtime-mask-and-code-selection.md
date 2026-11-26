# Runtime-switch mask and native code selection gate repairs

## Preserved acceptance boundaries

These repairs follow the original regional loading-mask and native code-selection journeys. They retain native input, exact selected text, original viewport/contrast/geometry bounds, focus ownership and case deadlines. Evidence comes from an isolated dirty checkout based on `5f0844907895a4ae0db506fe6a5d0bf162318329`, with sandboxed Chromium. The candidate input hashes, complete executed case names, raw report paths and SHA-256 digests are recorded in `evidence/2026-11-25-runtime-mask-and-code-selection/receipts.json`; raw negative and positive observations are also archived. This is not the final integrated clean-head Actions gate.

## Cold skeleton and retained-runtime controls

The narrow public gallery now starts as an inert compact overview. The original test's `fill()` targeted that inert overview and left an empty value before the runtime switch even began. The corrected journey uses the actual gallery expansion button, closing the actual compact header menu when it covers that button, and confirms the native input is outside an inert ancestor and holds the authored value before switching. It uses no forced activation or replacement input mechanism.

After that binding correction, all six original journeys still failed. The source introduced by #1835 hid every loading panel with `display: none !important`, including a switch with an already accepted generation. Native failure evidence has `data-projection-generation="1"` and an enabled cancellation box, but the panel has zero geometry and computed `display: none`. Retrying a failed target likewise hid the currently focused action; native focus fell to `body`, preventing the existing owned-focus restoration path from running.

The production correction limits the skeleton-only panel override to the absence of a committed projection generation. The initial acquisition still shows the passive skeleton and hides unavailable cancellation; a retained gallery keeps its existing region-bound cancellation panel. The cold skeleton is hidden once any generation has committed, so it does not displace retained content during another switch. The mask state machine, cancellation, retry and focus-restoration APIs are unchanged. This preserves the existing requirements recorded in `2026-10-07-runtime-switch-layout-and-mask-followup.md`.

The unchanged six original cases now pass **6/6**: Shadcn and Brutalist cancellation at desktop/light and 320px/dark/200% text, plus both target-failure/retry journeys. They retain the authored input value, correct-family public atoms, region bounds, keyboard cancellation, successful retry, native restoration to the actual current runtime control, retry URL identity and no unexpected navigation. The earlier 0/6 and narrow negative runs remain failed evidence.

## Same-token native code selection

The original desktop failure was reproduced with the existing passive event recorder. The exact first token remained connected and retained the correct text, but centering its whole 720px `<pre>` inside the 72px collapsed scroll viewport set that viewport's `scrollTop` to 324. The token's layout rectangle still existed above the clipping region. Native `pointerdown` therefore hit the preceding “Animated Box” example, and the native selection was empty. This was not an event cancellation or a replacement token.

The preparation now scrolls that same retained first-token handle into view before the existing horizontal gutter preparation. The test still performs the same eight-step mouse drag and requires `Selection.toString()` to equal `wc-base-transition` exactly, with no trimming or programmatic range. Both native gesture endpoints and the same-token event diagnostics remain recorded.

All six original viewport/theme cases pass **6/6** at 1440px, 390px and 320px in light and dark themes. The palette, controls, native horizontal/keyboard scrolling, Copy and page bounds checks remain intact. The negative pointer-hit record and all six candidate gesture records are archived separately, preserving the distinction between the failed old preparation and the passing actual native gestures.
