# Independent native follow-up: b110 partial progress and remaining reset

## Observed result

Exact **`b110ec92f5b1c5d256c79b831c0b86b9caaec3e3`**, run `45398259913`, job `138459735307` reached a later failure than92d. The two original native oracle controls passed with no skips. Within the single selected public matrix case, all **12 Shadcn combinations** completed: four runtimes (`wc`, `react`, `vue`, `vue2`) × three openings (`click`, `Enter`, `Space`). Their wheel receipts show 0→500, final current/ready owner, uncancelled trusted input and documentY0; the 12 normal-close observations and subsequent progression corroborate completion.

The next combination, **Brutalist / WC / click**, failed the original `expected +0 not to be +0` at line1260. The other 23 planned combinations were not reached. This is one failed Vitest matrix case, not 12 passing Vitest cases; nine other homepage test cases were intentionally filtered. The matrix case lasted80622.237ms and failed the 1000ms movement assertion, not the 180-second case timeout.

The first host repair therefore has actual partial evidence: the original Shadcn/WC/click failure now passes, and all Shadcn matrix combinations complete in this run. It does not establish complete Contents acceptance. Because92d stopped at the first Shadcn combination, this newly reached Brutalist failure has not independently been reproduced on92d and is not proven to have been introduced byb110.

## Stronger temporal observation

Unlike92d's two callbacks that already read zero, the b110 Brutalist receipt directly records the same connected Content/surface at **top500, then top0**. No scroll events were dropped.

| Scroll observation | Event timestamp (ms) | Listener timestamp (ms) | top |
| --- | --- | --- | --- |
| First | 5588.7 | 5593.3 | 500 |
| Second | 5649.9 | 5653.8 | 0 |

The listener samples are60.5ms apart (event timestamps61.2ms apart). This establishes an observed positive offset followed by a reset; it still does not identify which callback performed or induced that reset.

The initial/final owner identity, readiness, visibility and connection remain valid. Trusted deltaY500 reaches both owner paths without final cancellation. DocumentY stays0. The full15-element hit chain remains in light DOM, without a split surface. Its inner summary/details/list/nav/pane boxes have visible overflow on both axes; no sampled inner scroll container consumed the input.

The final geometry changes materially:

| Content measurement | Before | After |
| --- | --- | --- |
| y | 64 | 60 |
| Border-box height | 772 | 776 |
| clientHeight | 768 | 772 |
| scrollHeight | 6322 | 6322 |
| Available-height variable | 772 | 776 |
| top | 0 | 0 |

The descendant layout shifts upward by4px with unchanged scroll extent. I viewed the failure screenshot; it has returned to the beginning of the navigation. The companion JSON retains the complete relevant before/after hit chains and scroll observations for92d Shadcn/WC/click, b110 Shadcn/WC/click and b110 Brutalist/WC/click.

## Family-specific source evidence and limits

Brutalist's navigation Trigger applies `translate-x-1 translate-y-1` for hovered/pressed state, with `transition-all` under the normal motion preference. Its Shadcn navigation counterpart changes hover paint without that translation. Both Content implementations use the shared Base Popover behavior; the Brutalist Content adds no separate focus or overlay subscription that by itself explains this reset.

The website's header-clearance callback updates sideOffset only when the measured clearance changes, through the existing ResizeObserver/lifecycle path. Base positioning defaults to the actual rendered anchor geometry. The recorded4px panel movement is therefore consistent with leaving the Brutalist Trigger's hover translation while moving the pointer into Content, followed by a legitimate positioning update. Floating UI's move/resize observation can initiate such updates independently of the narrowed scroll fallback.

That callback identity remains a source-supported inference: the native artifact contains scroll and geometry observations, not a positioning-callback trace. The current positioning solve still releases its available-size projection before intrinsic measurement. Fixing only irrelevant scroll triggers does not eliminate cap retirement during legitimate reference movement. The next repair must preserve real reference tracking and correct intrinsic-content/collision invalidation; removing decoration, ignoring all resize/move observation, or substituting scroll writes would not establish that boundary.

A cached natural-size proposal has concrete hazards to test: content can change beneath an unchanged cap; anchor size can affect anchor-width-based layout; viewport width can change wrapping; root/config/explicit updates and new owner generations must invalidate stale dimensions. A projection772→776 may itself produce a floating ResizeObserver notification, so a reference-only path must not simply defer the same unnecessary retirement to its own resize echo.

## F-WHEEL-004: settled movement oracle

The new temporal evidence exposed an existing test gap: the movement poll could catch the short500 interval, while the later settled read checked owner/readiness/input but not the offset. Such a run could incorrectly pass after returning to0. This does **not** invalidate the observed12 Shadcn successes: their retained final receipts are500.

Root added two assertions to the existing post-two-RAF read: the final top must differ from its initial value, and its difference must retain the expected direction. I independently reviewed that exact two-line diff. It adds no wait and changes neither the original1000ms poll nor the two existing animation frames. Failure still enters the same wheelError/receipt/original-error-preservation block.

The strengthened matrix file SHA256 is `9b6f17dd10ab67bcc4c934cf06c6e3c5b0f0a69c1bf89094dd29a5ccad82826e`. It was added **after** the b110 run and has no native result yet. Future descriptions must say that the original timing/input is preserved with an added settled movement check, rather than claiming the matrix is byte-identical to92d.

## Provenance and generated-input comparison

I independently hashed the artifact ZIP: **736357 bytes**, SHA256 `481c083413e3781b43aded9c0cda781ecaa00e1b0b2a314fe790a453b11612da`. All65 extracted files match both their manifest sizes/hashes and ZIP members, with no extra or missing files. Before/after records are clean exactb110, using Chrome157.0.8103.78 and Node24.22.3.

All14 recorded source-file hashes in each phase match their exact Git blobs, including the reviewed positioning host and test. The13 public wheel receipts contribute another117 matching source hashes. All five actual generated outputs match their records and are **byte-identical to the92d native-run outputs**. Thus the observed Shadcn improvement is not accompanied by a generated-style byte change. Four files explicitly absent before generation are not misrepresented as preexisting proof.

| Actual generated output | Bytes | SHA256 |
| --- | --- | --- |
| `shadcn-theme.css` | 6473 | `3de2d4ce2a38e83086128c8863d3391eb74159adde7b1a8b7f450f93fd643f96` |
| `proto-ui-style.css` | 294 | `446d2249e0672bdee7ddf77de55c7a8f2140adfb60c41d13ec0183d5f7199d88` |
| `proto-ui-tokens.generated.css` | 249803 | `e503f7dff500dd7894d122b808f623f971fb590bb88fba7859126ee3ca20e1d7` |
| `proto-ui-shadow-style.generated.js` | 629704 | `08415c4d6276a790c2a5538aa8bc70279ad4a060624dc8e3e024fd36e44f7036` |
| `proto-ui-shadow-style.generated.d.ts` | 261 | `76d772bac1c5de84e6fb455683513c74c6d40b55de2744caaf3dfc4e4ead94b8` |

I performed read-only artifact/source verification and reviewed the two-line oracle strengthening. I did not execute another native run, edit product code, publish an approval, or declare complete acceptance.
