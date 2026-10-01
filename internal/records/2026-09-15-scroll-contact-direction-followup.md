# Scroll contact direction follow-up — 2026-09-15

Non-normative implementation/evidence record for [PR #623](https://github.com/Proto-UI/Proto-UI/pull/623) and [Issue #519](https://github.com/Proto-UI/Proto-UI/issues/519). The applicable draft authorities are `C-SCROLL-END-FOLLOW-0001-INTERRUPT/REFLOW/LIFETIME`, `HC-SCROLL-SURFACE-0001-I/J`, and `M-SCROLL-0001-G/H`. This record does not promote them or approve the PR.

## User request, paraphrased

Synchronize the outstanding PRs with main, repair verified review/CI defects, and push ordinary revisions. Prefer deterministic state and ownership over delay-based fixes. Reproduce Agent-authored reports, attach actual component evidence, and correct faulty earlier tests as well as implementation. Humans may still describe a symptom without supplying evidence. Independent defects need linked tracking, not unrelated scope added to this PR.

## Failure and cause

At baseline `7d520f35362202fca2b1fbaad9ebb4aadcdca2b8`, the host treated every live contact as departure evidence. A stationary press followed by an offset-only host change therefore changed `following` to `paused`. Terminal pointer/touch callbacks made the same inference. Five deterministic tests failed before repair, including the scroll, release and cancellation paths.

The final host-local model separates three facts:

- contact identity/lifetime: `idle`, `contact`, or native pointer handoff while owned touches survive;
- directional evidence from consecutive samples of an owned contact, independently for each axis;
- actual departure of the followed surface, read before replacing direction evidence or ending the contact.

A contact is not a pan. Another contact cannot inherit a canceled pointer's direction. Pointer and TouchEvent identifiers are separate namespaces; after pointer cancellation, surviving TouchEvents provide their own motion samples. An unrelated-axis scroll at the unchanged followed end is not a new end arrival and must not clear pending directional evidence. Explicit end application or an observed paused-to-following arrival clears motion evidence while retaining contact ownership.

Independent bounded Astra review found four errors in intermediate candidates: cross-contact handoff leakage, reversal before terminal sampling, unrelated-axis evidence clearing, and reversal after a clamped toward-end movement. Each was reproduced in a permanent failing test before correction. In particular, neither direction from the original contact position alone nor a global handoff flag is sufficient. The final algorithm samples an already-applied departure before updating the consecutive movement direction. No contact grace timer was added.

## Actual visual reproduction

The fixture consumes the real Web Component Adapter, `asScrollSurface`, and shared Web Scroll host. It contains twenty 24px rows in a 120px viewport. Start at offset 360, hold a real browser mouse press stationary, set offset 264 explicitly as unclassified host movement, then append four rows. This offset injection isolates the attribution defect; it is **not** represented as a native pan or a fully reconstructed browser scroll-anchoring trigger. A separate Chromium test uses trusted touch input and a separately labeled test-driven offset change. Existing trusted native-pan coverage also runs.

| Observed transition | Before | Repaired candidate |
| --- | --- | --- |
| Initial offset / maximum | 360 / 360 | 360 / 360 |
| Stationary contact, offset-only change | 264; incorrectly paused | 264; still following |
| After four appended rows | 264 / 456; rows 12–16 visible | 456 / 456; rows 20–24 visible |

![Baseline: actual viewport misses appended rows](https://raw.githubusercontent.com/Proto-UI/Proto-UI/0a95ad361fe921b1d2964c6857b0ca5a07bff6d4/evidence/2026-09-15/pr623/623-before-stalled-3564640cfe77.png)

![Repaired candidate: actual viewport reaches the new final row](https://raw.githubusercontent.com/Proto-UI/Proto-UI/0a95ad361fe921b1d2964c6857b0ca5a07bff6d4/evidence/2026-09-15/pr623/623-after-following-da1ac2a52835.png)

These are browser captures, with actual host facts printed beneath the component, not text rendered to stand in for a screenshot. Images total 51,499 bytes on the existing evidence-only branch, pinned to an immutable commit and byte-verified via GitHub and unauthenticated raw access; they are not added to the product tree. The comparison uses baseline versions of only the two changed host source files; the fixture and other consumed source are shared. The final candidate repeats the same scenario; lifecycle/gesture corner cases are established by executable tests, not inferred from these two screenshots.

## Adapter evidence boundary

Each of `A-WEB-COMPONENT-0001`, `A-REACT-18-19-0001`, `A-VUE-3-0001`, and `A-VUE-2-0001` now has a scoped `-SCROLL-END-FOLLOW` criterion and a reciprocal `T-SCROLL-END-FOLLOW-0001` relation. The Test's four-Adapter case binds those exact criteria. `packages/web-conformance/test/scroll-end-follow.journey.test.ts` executes policy/facts/to-end routing and stationary-contact non-interference with simulated geometry. It does not certify native panning across all four frameworks or turn the consumed draft contract into a stable guarantee.

## Validation boundary

Node.js 22.22.1 / pnpm 10.32.1 on Windows. The follow-up runs focused Module/contact/journey tests, the real Chromium suite, dependent Base/Brutalist and four-Adapter Scroll tests, spec fixtures/graph checks, workspace types, catalog/authoring checks, generated projections, public-doc checks, Module build, and manifest/budget checks. Exact-head totals and results are reported in the PR follow-up, not inferred from catalog `passing` fields.

Existing discrete wheel/key timing and scroll-end notification fallback are outside this contact repair. Non-Chromium native input, pointer-only native cancellation, horizontal RTL/writing-mode guarantees, full workspace/docs builds, release and deployment acceptance are not claimed. The earlier WC budget increase in this PR remains a separately reviewable proposal; this repair does not raise it again. Independent human review and fresh CI remain required.
