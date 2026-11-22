# Sprint 7: real Harness follow-tail and editor boundary

Date: 2026-11-22. Scope: [#746](https://github.com/Proto-UI/Proto-UI/issues/746), [#745](https://github.com/Proto-UI/Proto-UI/issues/745), and the corresponding consumer evidence of #522/#523. This is a bounded implementation and execution record, not an Issue closure or a stable catalog promotion.

## Actual consumer and ownership

The current user identified [cyjin-yl/shenko](https://github.com/cyjin-yl/shenko) as the real Harness. Work starts from Shenko `f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42`, with its existing live React controller, Inspect timeline, IM conversation, compiled message bubbles, and production frontend bundle. No replacement `apps/agent-harness` application was created. The [consumer inventory](2026-11-22-sprint-7-real-consumers.md) separately records Verdant's GPUI compiler path.

The planned [63-row Harness matrix](../agent-harness/dogfood-coverage-matrix.md) and its #513/#514 source identities remain intact. Shenko's Shadcn consumer does not change that plan's Brutalist decision or complete all planned rows. A new introductory mapping links the real consumers without changing any row ID, state, count or editor exemption.

The shared definition is the draft `C-SCROLL-END-FOLLOW-0001`, related to `M-SCROLL-0001`, `HC-SCROLL-SURFACE-0001`, the Base MessageScroller and their tests. `pauseFollowing()` is a geometry-free command: it cancels pending end movement and reports paused without changing position, focus, or an App anchor. Its result has the existing dispatched/queued/rejected vocabulary. Attachment commands preserve FIFO order, and retired leases cannot apply them to a replacement owner. Unrelated input and no-motion layout reports cannot resume a pause. Actual reader arrival or an explicit end request can resume it. This remains draft direction with bounded Web evidence.

| Owner | Responsibility in the actual consumer |
| --- | --- |
| Scroll Module and Web host | End-follow policy/facts, native input attribution, coalescing, pending movement cancellation, layout and lease lifetime. No message or Agent vocabulary. |
| Base/Shadcn MessageScroller | Existing Root/Viewport composition and public `following`, `jumpToEnd` and `pauseFollowing` exposes. |
| Shenko | Message/part identities, persisted reading mode, selected text, unread counts, session identity and visible entry anchors. Raw geometry remains only in this App-owned stable-key anchor restoration. |
| React integration | Subscribe after the Adapter's setup effect, remove subscriptions/observers, and key the actual reading owner by surface/source/subject identity. |

Shenko's two surfaces remove their private pixel thresholds and automatic `scrollTop = scrollHeight` follow machines. They consume public follow facts and semantic commands. The narrow viewport composition disables generic anchor compensation because Shenko already owns the stable message/part anchor. Reading-history restoration keeps the original persisted key through HTTP/replay and late compiled child layout until new reader input takes over. A focused resume control stays mounted after activation so keyboard focus is retained. Subject replacement creates a new reading owner; disposed renderer patches and old microtasks, animation frames, timers and observer callbacks are inert.

## Real browser execution

[The v5 receipt](2026-11-22-sprint-7-harness-evidence/shenko-v5.json) records **four passed journeys and 54 passed checks**, using the actual production frontend with deterministic HTTP and WebSocket read fixtures. The browser is headless Chromium 145.0.7632.6, Playwright 1.58.2, Node 24.22.3, light theme, reduced motion, 900 px height. The original 2 px stable-anchor tolerance is retained. Each run has its own terminal result, and there are no page errors.

| Surface | Width | Result | Checks |
| --- | ---: | --- | ---: |
| Inspect | 1280 | Passed | 14 |
| IM | 1280 | Passed | 13 |
| Inspect | 390 | Passed | 14 |
| IM | 390 | Passed | 13 |

Each journey verifies committed mixed Chinese/English reply text in the real renderer; initial tail alignment; append with composer focus retained; trusted browser wheel departure; the same visible key and offset after append; duplicate committed replay; keyboard resume with surviving focus; later growth; selection and anchor preservation; natural end arrival; new-subject owner replacement with old observer callbacks; and actual pagehide disposal with disconnected observers and no recreated view. It also checks that replay/render/dispose do not emit business writes. The two Inspect runs additionally reopen the page and restore the persisted reader key through replay materialization.

Wheel and keyboard input come from the browser automation driver's native input route. Text selection uses an explicitly scripted DOM Range. This is not physical keyboard/IME, touch hardware, screen-reader, backend/ledger/model, deployment, all-theme or all-host acceptance. HTTP/WS fixtures supply facts to the actual live App; they do not replace its renderer or controller. The saved screenshots show a missing emoji font glyph in the execution environment; this run does not claim full typography or visual parity.

Screenshots: [Inspect desktop](2026-11-22-sprint-7-harness-evidence/inspect-1280.png), [Inspect narrow](2026-11-22-sprint-7-harness-evidence/inspect-390.png), [IM desktop](2026-11-22-sprint-7-harness-evidence/im-1280.png), [IM narrow](2026-11-22-sprint-7-harness-evidence/im-390.png).

## Source and execution binding

The v5 bundle uses Proto-UI `d5153ea45530446aa01288c3cd4d2c346c381920`. Its source basis is shared pause commit `3334b45970ca6eaf62b7e307ec545bbf596f3587`, expose-shape correction `0d8e71a23a435071bca1dab92330dd908e07d8a8`, explicit pause input correction `a437f89026097fdf7a47a673b4899528534f4233`, and retirement of pre-pause reader intent `d5153ea`. The consumer's [eight changed executable inputs](2026-11-22-sprint-7-harness-evidence/shenko-v5-source.json), emitted bundle manifest hash and upstream pin are retained. The transferred v5 archive is 394,619 bytes, SHA-256 `520c061b16b447bebbc837958a8a6ddfd9d45e38fb73b6235c9330d9258100cd`; remote execution exited 0 after 43.68 seconds. Final integrated source/pin verification is a separate later receipt, not inferred from this working-tree snapshot.

The 42-package public build at `a437f89` passed; `d5153ea` then rebuilt the eight-package Scroll closure. Both [public build](2026-11-22-sprint-7-harness-evidence/public-build-a437f89.json) and [Scroll rebuild](2026-11-22-sprint-7-harness-evidence/scroll-build-d5153ea.json) receipts remain. V5's bundle manifest therefore leaves its optional single full-build receipt null instead of pretending the earlier 42-package receipt belongs to the later head. The companion's final pin must bind the integrated public build.

Shenko's build now passes its own tsconfig explicitly to esbuild for the whole graph. Previously linked upstream packages picked up development `paths`, mixing `core/src` and `core/dist` and splitting the Hook context. The build rejects upstream package `src` inputs in the browser graph, so browser consumption uses the checked public exports. Compiler source still runs separately at build time for Shenko's own transport-badge and message-bubble.

## Retained failures and local verification

| Receipt | Actual result and disposition |
| --- | --- |
| [v1](2026-11-22-sprint-7-harness-evidence/shenko-v1.json) | First Inspect run failed before materialization: the consumer subscribed before public exposes were installed. Other cells were unrun in this early runner. The parent layout-effect ref bridge fixes this timing. |
| [v3](2026-11-22-sprint-7-harness-evidence/shenko-v3.json) | All four cells failed with split Hook setup contexts and consequent missing exposes. The public-export build graph correction fixes the cause. V2 was prepared but not executed. |
| [v4](2026-11-22-sprint-7-harness-evidence/shenko-v4.json) | Initial follow/depart/append/replay checks passed with zero page errors. Resume lookup incorrectly required a native `button` tag rather than the real accessible button role; mobile Inspect also lost its original persisted key during early fallback. The first is an oracle prerequisite correction, the second an App fix. The HTTP submission-view fixture also lacked its required schema version, so IM had shown unpaired-round summaries; v5 supplies the actual version and independently requires reply text in the renderer. |
| [Pause negative](2026-11-22-sprint-7-harness-evidence/pause-input-red.log) | The unchanged first pause implementation failed the stationary-input counterexample: 78 passed, one failed. No assertion was removed. |
| [Pause final model checks](2026-11-22-sprint-7-harness-evidence/pause-input-green.log) | 108/108 passed across end-follow, reader-contact lifetime and module delivery; [four Adapter contract checks](2026-11-22-sprint-7-harness-evidence/four-adapters-final.log) add 4/4. These are model/integration checks, separately labeled from the browser journeys. |
| [Shenko existing unit suite](2026-11-22-sprint-7-harness-evidence/shenko-unit-v5.log) | 51/51 passed. The existing static message assertions render the same production `Messages` row renderer because an Adapter viewport only materializes client-side; the full browser journey checks the complete App. |
| Type check during rebuild | [An early failed type check](2026-11-22-sprint-7-harness-evidence/types-during-build-failed.log) overlapped removal/recreation of upstream dist. The later serial `tsc --noEmit`, after the build completed, exited 0 with no diagnostics. This is build ordering, not an accepted product failure. |

Local Chromium could not open its process-singleton socket in the container, so the browser was run on the authorized doesvm device. Remote `/tmp` was full from other work; this run used an isolated home-directory TMPDIR without deleting others' files. Neither infrastructure condition was relabeled as a product result. [The evidence manifest](2026-11-22-sprint-7-harness-evidence/manifest.json) binds the retained files.

## Editor and remaining original conditions

For #745, the existing two editor rows and their derived projection preserve #531's research result, option-C boundary, engine infrastructure exemption, independent Textarea/Code Block/static Diff fallbacks, Inspector delta and re-review triggers. The [focused projection suite](2026-11-22-sprint-7-harness-evidence/editor-projection-focused.log) passes 5/5. No editor engine, new semantic entity or third-party UI dependency was introduced.

The [complete pre-integration matrix run](2026-11-22-sprint-7-harness-evidence/matrix-pre-integration.log) reached 124 terminal tests: 119 passed and five failed, with no skips. Every failure concerns candidate source binding/path drift at `internal/website/self-hosting-coverage-matrix.md`; the GPUI-named cases fail this prerequisite before receipt validation. The [checker failure](2026-11-22-sprint-7-harness-evidence/matrix-pre-integration-check.log) is retained. Integration must refresh the canonical candidate binding and regenerate its readable projections, then rerun the existing gate. These results do not replace the November 10/11 historical failures or create the missing historical independent approval.

#522's resizable Inspector and #523's two Tree domain fixtures retain their original acceptance. Shenko currently has a fixed lens and App task/file views; Verdant's separate native path does not substitute for them. #514's planned whole matrix, original consumer/equivalence requirements, and catalog activation/other input conditions remain explicitly separate. The bounded source and real consumer evidence can be accepted with its own PR and review; closing the larger Issues requires their remaining original conditions or an explicit scope disposition.
