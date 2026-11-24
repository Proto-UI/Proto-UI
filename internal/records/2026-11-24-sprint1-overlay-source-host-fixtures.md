# Sprint 1: Popover and HoverCard source-host fixture corrections

This follows the original `81c103bd` general-CI failures without changing product code, focus targets, or test timeouts. Both full files failed again on the current source before correction. This is Happy DOM source-host evidence, separate from Chromium, layout, physical input and assistive technology acceptance.

## Reproduced failures

| Original full file | Before | Final |
| --- | --- | --- |
| `popover-entry-focus-scroll.test.ts` | 16 passed / 6 failed / 0 skipped | Original 22 plus one calibration: 23 passed / 0 failed / 0 skipped |
| `hover-card-lifecycle.test.ts` | 18 passed / 1 failed / 0 skipped | Original 19: 19 passed / 0 failed / 0 skipped |

The Popover failures were the five families' native-only descendant entry and the empty fallback followed by a later native insertion. HoverCard failed at the early `data-pui-view-detached` assertion in its retained-Content generation journey.

## Popover: rendered entry and an actual focus effect

The temporary diagnostic forwarded the real scope sampler and real host focus effect. At the first resolution, Content was connected under the Portal but still carried `data-pui-portal-preparing` and `data-pui-view-revealing="portal"`; its computed display was `none`. The sampler correctly returned no rendered descendant. Its self fallback attempted Content. Happy DOM nevertheless changed `document.activeElement` to that hidden element, allowing the host to treat the request as acquired and consume the pending entry.

The fixture now waits for the existing two host rendering opportunities in addition to microtasks. This alone fixed the later-opening case, but the five initial native-only cases remained red. A local focus observer then supplies only the missing Light DOM `display:none` refusal. It forwards the original focus method, options and events when the target and its containing boxes are rendered. No target is selected or focused by the shim.

The added calibration proves two refusals (hidden ancestor and hidden target), with no focus event or active-element change, followed by one real visible focus effect and event. All three attempts remain observable. In the native-only journeys, hidden self-fallback attempts are retained with their `rendered` and `focused` facts and must all have been refused. Content must have no forwarded native effect. The original link must acquire focus on both first open and keyboard reopen, with `preventScroll: true`. Logical priority, controlled refusal, empty fallback, options, restoration and disposal assertions remain in the file.

This explicitly replaces the old native-only assertion that no Content focus _attempt_ ever occurred: before reveal, a refused hidden fallback can be legitimate pending work. It does not permit Content to acquire focus or consume the later link entry. The intermediate combined run retained in the archive was still **37 passed / 5 failed** because that old attempt-count assertion was the remaining failure. Its filename contains `green`; its JSON truthfully records `success: false`.

## HoverCard: hidden intent versus completed unmount

The existing WC reconciler sets the detached marker as soon as the view resolves absent. A connected Portal then waits for its conceal rendering barrier before the Runtime's actual detach. The original test already waited for that barrier later, but incorrectly required the earlier marker to remain absent.

The corrected fixture observes real Runtime lifecycle diagnostics for its unique retained Content prototype. Immediately after Transition completes, the marker is present and `unmount.done` has not advanced. After the original two-frame barrier, unmount has advanced exactly once. Reopening advances the mounted phase exactly once. The original State identity, new interaction owner, stale release rejection, preserved current hover and later close checks remain unchanged. No synthetic lifecycle event or extra delay was added.

## Execution and source binding

Final full-file command:

```sh
node node_modules/vitest/vitest.mjs run \
  packages/prototypes/base/test/navigation-overlays/popover-entry-focus-scroll.test.ts \
  packages/prototypes/base/test/hover-card-lifecycle.test.ts \
  --maxWorkers=1 --minWorkers=1 --reporter=json --outputFile=overlay-fixtures-final.json
```

Result: **42/42, 0 failed, 0 skipped**, Node `v24.22.3`. Existing case and suite budgets are unchanged. The source checkout HEAD at recording was `f14bdf350b0fed011b4817a60f691fc884436982`, with these fixture changes uncommitted. Other agents' changes are not represented as an unchanged whole tree.

The [manifest](evidence/2026-11-24-sprint1-overlay-source-host-fixtures/manifest.json) binds the actual fixture/product bytes read, original failure snapshots, intermediate diagnostic stages and final receipt. The temporary diagnostic was removed from the runnable inventory after its exact source was archived. Its one failing case and the isolated original case's 21 skips remain diagnostics, not acceptance runs.

The [receipt archive](evidence/2026-11-24-sprint1-overlay-source-host-fixtures/receipts.zip) contains 30 members, 240,912 bytes, SHA-256 `2d4280943c5644ae1b46ccf1c0fc4aea5c14257d2ce1b81824dd6fbf6bc7dc15`. Every member and ZIP CRC was read back. These two current-source successes are successors to the recorded old failures; they do not rewrite the old CI result or accept the rest of Sprint 1.
