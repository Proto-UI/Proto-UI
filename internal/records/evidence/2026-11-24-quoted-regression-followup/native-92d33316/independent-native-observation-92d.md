# Independent native evidence observation: exact 92d

## Result and provenance

The public **Shadcn / WC / click** Contents attempt still fails `expected +0 not to be +0`, at the original 1000 ms progress assertion (`homepage-dogfood.browser.test.ts:1260`). Both original authored native controls pass, with 0 skips. The selected product matrix executes one case and fails; its nine intentionally unselected suite cases are not counted as passes.

Source: `92d3331636ff6337c87fc557f4b0334d426398dd`. Run `45392795625`, job `138440634742`, artifact `14918983751`. I independently hashed the downloaded ZIP: 165121 bytes, SHA256 `96d17cae5635a8b811c9611bfdb9e9f4053b9bde835de11030036bade5e021f0`. All 33 extracted files match their manifest sizes/hashes and the ZIP members byte-for-byte, with no extra or missing members.

Before/after source receipts both report that exact SHA and an empty worktree status. I compared every recorded source-file hash against the exact Git object: 10 files in each phase and nine additional paths in the public matrix receipt; all match. All five afterTest generated files match their retained bytes/hashes. Four generated files were absent before the harness's style-generation operation, explicitly recorded as absent, and present afterward. The two oracle controls use the reviewed observer hash and report no completion errors.

This actual execution establishes that the workflow-context correction is accepted by the platform and can reach native tests. It does not erase the prior 422 rejection or the independent review's earlier miss. It also does not establish product success: the original matrix remains red.

## New observation

The retained public owner is connected and current in all recorded reads. Its viewport is 776 px high, scroll height 6230 px, and remaining vertical range 5454 px. It has a real fixed-position box at (8,60), size 374×776, and computed `overflow-x/y: auto`. The native wheel has trusted input, deltaY 500, both owner path flags true, and final cancellation false. Content and document offsets remain 0 in the sampled initial/final reads.

The hit path contains 15 elements. Its recorded before/after descriptions and geometry are equal, and the retained dispatch path's inspection-time geometry equals the final hit chain. All ancestors between the hit `summary` and Content have both overflow axes `visible`. The borrowed pane has `overscroll-behavior: contain`, but no sampled internal scrolling range and no sampled auto/hidden scroll box. There is no shadow root or split surface on this actual Content path. These observations do not substantiate the proposed inner-scroll-container explanation.

The recorder now supplies a materially different fact from the old evidence: **two UA-dispatched scroll events reached the actual Content/surface**, with `droppedScrolls: 0`.

| Observation | Event timestamp (ms) | Listener timestamp (ms) | Offset when read |
| --- | --- | --- | --- |
| Wheel | 34281.8 | — | Initial 0 |
| First scroll | 34366.8 | 34414.0 | top 0, left 0 |
| Second scroll | 34414.1 | 34471.1 | top 0, left 0 |

No positive offset was retained. `isTrusted` on a scroll event does not distinguish input-driven movement from a browser-generated notification following a script/layout change. The record therefore cannot prove that a positive offset occurred or name the operation that reset it. Equality of the first/final geometry also cannot exclude temporary geometry changes between those samples. I viewed the failure screenshot; it remains at the beginning of the borrowed navigation.

## Specific owning-layer candidate

The exact-source positioning implementation provides a concrete mechanism consistent with this sequence:

1. `floating-ui-host.ts` registers a document capture scroll callback that invokes `position()` for every captured scroll, including the floating Content itself.
2. At the start of `position()`, `retireProjectedSize()` restores the previous geometry lease before the asynchronous solve. `owned-style-lease.ts` removes an owned variable when its original baseline was empty.
3. The lease includes `--proto-ui-available-height`. Base and Shadcn Popover recipes constrain Content through `max-h-[var(--proto-ui-available-height)]`; the archived generated CSS retains the corresponding declaration.
4. Temporarily releasing that cap can expand the scroll viewport and clamp its current offset. The subsequent solve can restore the same 776 px viewport before the final sample. Positioning's capture listener is registered during opening, before the later test observer.

This is a **static causal candidate**, not a dynamically established reset or a verified fix. A targeted correction should keep real reference/floating geometry dependencies live: a scroll of an outer floating Content must still update an inner popup whose reference is inside it. Composed ancestry must account for assigned slots and shadow hosts and be evaluated from current nodes. Root/document paths, genuine ancestor scrolls, ResizeObserver/size matching, explicit updates, and intrinsic remeasurement must not be silently disabled.

The `targetAlignment && !sizeMatch` branch uses the separate target-alignment lease, so changing the edge host's capture fallback does not directly change that branch. I am reviewing the author's forthcoming patch separately.

## Actual generated outputs

| Output | Bytes | SHA256 |
| --- | --- | --- |
| `apps/www/src/styles/shadcn-theme.css` | 6473 | `3de2d4ce2a38e83086128c8863d3391eb74159adde7b1a8b7f450f93fd643f96` |
| `apps/www/src/styles/proto-ui-style.css` | 294 | `446d2249e0672bdee7ddf77de55c7a8f2140adfb60c41d13ec0183d5f7199d88` |
| `apps/www/src/styles/proto-ui-tokens.generated.css` | 249803 | `e503f7dff500dd7894d122b808f623f971fb590bb88fba7859126ee3ca20e1d7` |
| `apps/www/src/styles/proto-ui-shadow-style.generated.js` | 629704 | `08415c4d6276a790c2a5538aa8bc70279ad4a060624dc8e3e024fd36e44f7036` |
| `apps/www/src/styles/proto-ui-shadow-style.generated.d.ts` | 261 | `76d772bac1c5de84e6fb455683513c74c6d40b55de2744caaf3dfc4e4ead94b8` |

These hashes bind the actual browser-run output closure for this exact source. No historical e47 generated-output bytes are available in this comparison, so no CSS byte-equality claim across those heads is made.

I executed no additional native run, tests, source edits, or platform writes. This report is an independent read of retained evidence and exact source, not a platform approval or an acceptance verdict.
