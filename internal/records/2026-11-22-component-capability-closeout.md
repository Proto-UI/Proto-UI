# Component capability acceptance closeout

This record continues the current user's request to repair Calendar/Date Picker, Number Field, Carousel and Resizable and continue until integration is ready. It records observed results without promoting draft definitions or substituting source delivery for native acceptance.

## Integrated implementation and evidence repairs

[PR #1666](https://github.com/Proto-UI/Proto-UI/pull/1666) was merged as `a8bf56087e5836e3c14c153cafbd796bd98bff37`. The generated-style, themed-capture and browser-engine IME follow-up, [PR #1669](https://github.com/Proto-UI/Proto-UI/pull/1669), was subsequently merged as `604231ff21b9efbe01a23609d13f4e37f2729b4b`. Those merges were observed in live GitHub state; this invocation did not perform either merge. Their original results and limitations remain in `2026-11-22-component-capabilities.md`.

The current closeout starts from main `2d21cb4d6c3f726c5d6756d03739d466faa7ff10`. It repairs acceptance plumbing and test fixtures after the integrated source and later host changes. It changes no portable component semantics or Compiler/IR implementation.

## Native Calendar regression: wrong demonstration selected

The first exact-source native run, [44929210569](https://github.com/Proto-UI/Proto-UI/actions/runs/44929210569), passed 100 interaction journeys before failing the later generated-preset check. Its 220 images were inspected and led to PR #1669's fixture and capture corrections. That historical pass does not execute the strengthened runner added afterward.

Three later full CI runs retained a separate Calendar regression:

| Full run | Checked-out source | Calendar job |
| --- | --- | --- |
| [44932370526](https://github.com/Proto-UI/Proto-UI/actions/runs/44932370526) | `a8bf56087e5836e3c14c153cafbd796bd98bff37` | `136934288727` |
| [44951627713](https://github.com/Proto-UI/Proto-UI/actions/runs/44951627713) | `604231ff21b9efbe01a23609d13f4e37f2729b4b` | `136992713090` |
| [44956263999](https://github.com/Proto-UI/Proto-UI/actions/runs/44956263999) | `f0b502704b825b5b644639522555d13e3d64231e` | `137007870271` |

All nine old Calendar journeys timed out in `waitForRealRuntime`. The last run's [artifact 14728103262](https://github.com/Proto-UI/Proto-UI/actions/runs/44956263999/artifacts/14728103262), a 2,385,785-byte ZIP, was downloaded and verified as SHA-256 `bfae3b03394335e2917db276efc64f9c1b2ff4b7c8ae885ff51f6d5990585928`. Every failed DOM selected `demo-shadcn-calendar-selection`, contained 84 gridcells and had no caption combobox. Page errors and blocked-request arrays were empty. The new two-calendar selection demonstration precedes the original single-date caption demonstration; the old test selected the first previewer instead of its intended subject.

The repaired journey selects the existing `demo-${family}-calendar` ID. Its failure collector reuses that same Locator. All five families and both languages retain exactly one such caption demonstration. The 42-cell expectation, Month/Year controls and all nine original behavioral journeys remain intact. A real-DOM ordering control failed against the old selector and passed after the correction; the complete no-browser evidence harness passed 85/85.

## Restore coherent synthetic layout fixtures

Later main changes made Axis Input contact-basis cancellation compare untransformed computed extents. The old happy-dom fixtures supplied bounding rectangles without matching layout dimensions, so the contact correctly failed to begin. Re-running the original 36-file selection on the current main produced 575 passes and 18 failures: 11 Carousel and 7 Resizable cases.

Carousel now provides the same explicit border-box dimensions to rect, client and computed-layout observations, including after resize. Resizable derives both rects and inline Panel dimensions from the accepted public `sizes` state and subscribes to accepted changes. Replacing geometry or retiring a test unsubscribes the fixture. A rejected controlled proposal never becomes a simulated layout. No global computed-style replacement is used.

All 47 original tests in these two files are retained with their original behavior assertions. An additional case checks that a container resize cancels the old release and that a subsequent controlled contact can propose the same value again. The two-file selection passed 48/48. The combined affected selection then passed **36 files / 594 tests**, with no skips.

The two-file patch at `81722b5fd969e9a86e5b07d35f21486df1ab220a` on the parallel regression branch was inspected as a diagnostic reference. This repair uses a public-state subscription and inline layout instead of that branch's global computed-style Proxy. No unrelated branch source was copied.

## Make the maintained native runner part of full CI

The complete job inventories of the three full runs above contained no `projection-family-evidence.yml` job. The strengthened 100-journey runner, including 40 native composition scenarios across the 20 Adapter/family combinations, therefore remained unexecuted by those runs.

`ci-production-suites.yml` now calls the existing capability workflow at the end of its second evidence chain. It continues after a failed predecessor unless the cycle is cancelled. The callee serializes same-ref requests without cancelling active evidence, as required by the existing cycle policy. The first policy check exposed the old cancellation setting; the corrected workflow passed all 24 scheduling/inventory controls and the live schedule audit. No automatic trigger or token permission was added.

The existing manual workflow remains available for diagnosis. The maintained runner must execute on the published candidate, and its actual terminal report, trusted composition events and settled screenshots must be reviewed. Wiring the job does not claim that execution has occurred.

## Source proof and remaining acceptance

The current-main workspace type check and the combined repair's workspace type check both passed with Node 24.22.3, pnpm 10.32.1 and a 4 GiB Node heap. The interim `runtime-inventory.mjs` declaration failure on the older merged baseline remains historical; main supplied its declaration before these passing runs.

The official preset check found the current main's draft-family token inventory stale. The closeout regenerated it through the official generator, and the complete preset check plus its 13 palette controls passed. The failed check is retained separately. The final PR records the refreshed candidate-source proof after its execution. Historical main/reference snapshots, delivery-plan completion and acceptance fields must remain unchanged by a candidate refresh.

The clean strict budget measurement on `95f4374f6dba48e65480ed4f2f7d11d73d1fda49` passed all nine entries. A new clean measurement on current main `2d21cb4d6c3f726c5d6756d03739d466faa7ff10` instead reports React at 164,569 / 164,500 gzip bytes and Web Component at 197,732 / 197,500 bytes: overruns of 69 and 232 bytes. The remaining seven entries pass. This test/evidence closeout neither changes runtime code nor increases those limits. The newer baseline failure cannot be relabeled with the older candidate's successful receipt.

The source-binding review also identified an independent Previewer issue, `PREVIEW-THEME-AUTHORED-001`, in current main's `pushNestedOwnedThemeSurfaces()`. A mounted nested authored surface with `--pui-foreground: #aabbcc` receives `#eeeeee` from a later enclosing theme update through public `api.setSurfaceStyle`. The original DemoSpec remains unchanged, so static object equality does not detect the actual surface write. The helper uses the presence of a theme key as an ownership test. This finding remains open with the Previewer owner; this closeout does not alter that implementation or claim authored-theme preservation. The related four-file local check produced 116 passes and three marker-observer failures; the latter have not been attributed by a controlled old-source comparison. The website ledger's renewed source fingerprint records inspected bytes, preserves the existing blocked consumer status and does not convert these observations into semantic acceptance.

An independent local review also records inherited `AXIS-CONTACT-SCALE-DRIFT-001`: current main checks untransformed contact extents with an arithmetic tolerance, while draft `C-AXIS-INPUT-CONTACT-BASIS-0001` still describes exact normalization-span equality and changing-scale observations. A source-function probe with fixed computed width 100 and rect width changing from 100 to 200 retains both `basis*` values at 100. That synthetic probe is not native evidence, but it identifies a definition/implementation mismatch for the Axis Input owner to resolve. This fixture repair does not amend that definition or certify scale-change behavior. The local review found no new blocking defect in this closeout's bounded diff; it does not supply independent platform approval or complete integration acceptance.

At this observation, the connected browser used for the first dispatch had disconnected. The fallback GitHub browser required authentication and the secure authentication request was cancelled. Local `gh` has no authenticated account, and the available GitHub connector exposes no workflow-dispatch operation. No alternative credential was extracted and no denied local Chromium launch was retried. Exact-head native reruns, final pixel inspection and full integration CI remain pending until an authorized authenticated workflow entry can execute them. Physical OS IME, hardware touch, AT and non-Web/compiled-consumer acceptance remain outside the observed evidence.

Live tracking in #1098 and #1099 already marks the four source-delivery slices complete with #1666's merge SHA. Their native/AT acceptance conditions remain open. #1673 records #1669's actual merge. Historical Issue checkboxes are not reclassified as current execution evidence. The final PR retains these distinctions, its actual checks, DCO and independent-review state; no unexecuted or failed condition is called ready for integration.
