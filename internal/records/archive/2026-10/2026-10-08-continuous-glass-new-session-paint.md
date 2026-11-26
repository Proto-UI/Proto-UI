# Continuous glass: preserve admitted paint across a fresh pointer session

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and original evidence

Human-assisted #872 repair, based on `5445b04c970f6fb46ccd871d2fbe509709c80e45`, tree `c793cb77c89ad2162783ab4607d1fe928b228768`. This change repairs the shared Web material sink's new-contact paint transition. It does not change material policy, the fixed shader, authored pseudo-element sampling, native support, or lifecycle admission.

Official run `37769859748`, job `113286482251`, artifact `11546109837` preserves the original failure. The downloaded ZIP has SHA-256 `3b58bd6ac178fb643023072156d7fd3cbbfdddacbcc2e74f0e371f5494494748`. Both source and packed continuous runs stop at `experiments/material-v2/continuous-browser.test.mjs:288`: `valid live source updates must not flash opaque fallback`. Their ordinary four-runtime optical runs pass; this does not mean that later continuous journeys ran.

The source artifact's `pui-material-v2-source-continuous/recording/00003.jpg` visibly shows the WC Optical action as a white opaque button while the other runtimes retain glass. Its SHA-256 is `6e22f1e834618f6047cef8b88185842d2d42f52235ea967c7a156386b2ae1485`; adjacent `00002.jpg` retains glass. The captured `failure.png` is already a recovered optical state and must not be presented as the instantaneous failure. These original image pixels were inspected, not inferred from the test name.

The source failure state contains one WC bad sample at `t=1017.9ms`; packed has the same shape at `t=1025.9ms`: `materialQuality=opaque-fallback`, `materialReason=preparing`, `pressed` present, prior contact-session receipt `0`, a white host background, and no carrier image. Source asset SHA-256 is `2a8b1ca38e86e307337cf22979529645212a4cdf2532800154152784c7ed778c`; packed is `459c67b8c3d9f34feab1950d401fd9de5d6e2b52d61f80e76c92cdadfb4e4240`. The recording has 69 source and 75 packed raw frames. MP4 encoding failed because ffmpeg was absent; capture cadence is not UI frame-rate evidence.

## Cause and bounded repair

The first pointer down replaces the initial contact session. The old sink immediately cancelled pending work, released the already admitted image, and restored the opaque host. Its presentation lease also included contact-session identity, so the next asynchronous decode could not preserve the previous safe paint. This reproduced both at first down and at repress during release; a valid live canvas update alone was not the root cause.

The sink now separates compatible presented paint from pending session work. A fresh active session cancels the old completion but retains admitted pixels until its own decoded successor is ready. Source/view, palette, geometry, effective motion, fallback colors, contact profile and variant still bind presentation compatibility. Session identity still binds pending work and retry admission, and is now explicit in the rendered signature so identical coordinates cannot reuse a previous session's receipt. Cancellation still withdraws rejected contact paint immediately.

Authority remains the draft `C-FEEDBACK-MATERIAL-0001` ownership, safety, contact and quality criteria, `HC-FEEDBACK-VISUAL-SINK-0001` lifetime/evidence criteria, and `T-WEB-LIQUID-OPTICAL-0001` view/optics cases. In particular, retained already-committed pixels do not authorize an old session's late completion. No criterion or browser assertion is relaxed.

## Verification and retained limitations

- Added delayed-decode first-down and release/repress regressions. Both fail against the unmodified `5445b04c` sink because the admitted carrier image is cleared. They pass after this repair, including rejection of the superseded source/session callback.
- Additional cases cover identical-coordinate new sessions, and withdrawal before replacement decode when source is revoked, transparency is reduced, geometry changes, material is withdrawn, contact is cancelled, or the view retires.
- All 13 material/wiring files pass: 126 tests. The pointer-contact and Web preference files pass: 18 tests. These use Happy DOM and mocked GPU/decode, not native optical rendering.
- The first red-test draft omitted cleanup after assertion failure and contaminated two later observer-idle tests. Adding `finally` cleanup restored isolation. The controlled baseline rerun passed those existing tests while the intended new regressions remained red. No observer or assertion was weakened.
- Workspace TypeScript passes. The first attempt lacked the fresh worktree's generated Shadow stylesheet module; the repository's `generate:proto-ui-style` generated it, and the unchanged TypeScript command then passed. Generated outputs were not hand-edited or committed.
- All nine package budgets pass, including React `105839/106000`, Vue `105689/106000`, and WC `131463/132000` gzip bytes. Environment: Node `v24.19.0`, esbuild `0.25.12`, Linux x64, zlib `1.3.2.1-motley-3246f1b`. These local numbers do not replace canonical exact-head CI.
- Prettier and `git diff --check` pass. The original continuous browser script remains byte-identical to `5445b04c` (SHA-256 `17a5d4515c4e2a2f81fb668ec0046e0fa1f328ecc21e941fa5c29002a7612845`).

Local native-browser execution remains unavailable because of the previously established socket permission restriction; no bypass or replacement fake browser result was attempted. The parent owns official source/packed browser reruns, review of the new artifacts, and publication. First-down repair does not establish that the remaining continuous journeys, all runtime transitions, or perceived smoothness already pass. New passing optical captures remain evidence debt until those exact-head runs finish.

The local commit uses the documented connected-service path with real hooks, the existing cyjin-yl contribution identity and DCO sign-off. The connected GitHub read confirmed `Proto-UI/Proto-UI`, public visibility, default branch `main`, not archived, and the authenticated `cyjin-yl` account with maintain permission and no admin permission. Local `gh auth status` reports no logged-in host; `agent:publish` was not executed or represented as passing. No remote ref, PR comment, protection rule or production deployment was changed by this repair task.
