# React entry owner readiness review, 2026-10-05

Scope: PR #832 review `5412158829` on `75a9f16d`. This is a bounded correction to draft Focus direction, not stable lifecycle admission or platform approval.

## Reproductions and owning layer

- In a real React nested Adapter update under happy-dom, the outer entry request executed from the inner `onUpdated` callback. The old source focused the inner button while its event gate was closed: `active=true`, `focused=false`, both during the callback and after commit. The outside-update control was `true/true`.
- In a separate controlled-host test, each descendant entry initially rejected focus and then succeeded after delivered layout frames. On old source, cycles 0–2 completed and cycle 3 stopped after the initial rejection because earlier descendant successes had consumed the requesting Adapter's three-retry allowance. The test intentionally controls `focus()` rejection and frame delivery and is not native browser evidence.
- Role-scoped target/entry cancellation already had executable coverage, but its draft source criteria did not explicitly state the role boundary and synchronous blur-observer ordering.

## Candidate

React acquisition now checks the event-owning view of the actual resolved target. It reuses the single private readiness registry from PR #811 (`13a7e559`) and adds an ordinary-descendant subscription that rejects stale source/disposed callbacks. Readiness re-enters Focus, which resolves the current entry target; the bridge does not store or restore pending intent. A successful host acquisition resets the private bounded retry allowance regardless of whether the target is the requesting root or a descendant.

The committed target getter stays available to blur, A11y and projection. There is no public API, synthetic focus fact, new first-request no-target wait, new queue or new timer. Existing bounded post-layout retry scheduling is retained.

Draft `C-AS-FOCUSABLE-0001-G`, `C-AS-FOCUS-ENTRY-0001-E`, and new `C-FOCUS-0001-H` explicitly state role-scoped pending cancellation, non-resurrection, and cancellation-before-host-blur ordering. `T-FOCUS-0001` maps the role case to the precise criterion and adds actual-owner and repeated-entry cases; none of these entities is promoted.

## Evidence boundary

The candidate's four focused files passed 34 tests. New controls include entry disable and explicit blur while owner readiness is pending, repeated immediately applicable requests, four independent rejection/success cycles, persistent rejection bounded at one initial plus three retry attempts, and old source/disposed callback rejection. Workspace types, draft authoring, catalog validation, native fixture bundling and browser-suite plan coverage passed locally.

The native fixture uses actual React and native focus/frame delivery. One case uses connected `display:none` descendants to cause genuine host rejection; it does not patch `focus` or frame APIs. It is registered in the canonical browser test plan. Local Chromium cannot start because the process-singleton socket is denied, so no local native execution is claimed; the catalog implementation remains `needs-review` pending exact-head CI.

The source review is independent local technical review, not an eligible GitHub `APPROVED` review. Full candidate CI, the true #811 combination, new package measurements and the dependent glass combination remain separately required. Earlier #775 audit evidence (822 frames) and #832 `75a9f16d` CI remain historical and do not cover this new production delta.
