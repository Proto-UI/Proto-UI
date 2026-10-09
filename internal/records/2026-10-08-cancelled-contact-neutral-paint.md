# Cancelled contact returns through an admitted neutral image

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and original evidence

Human-assisted PR #872 repair against `8e8c4ca21801378c11ea055f8f39796f86eeeda6`, tree `821fb3649a6c3c454807a11137dbd3b206117e7a`. The original [Optical run 37816158159](https://github.com/Proto-UI/Proto-UI/actions/runs/37816158159), artifact `11567690762`, retains source missing-carrier samples 581/593 and packed sample 586. Computed styles show opaque-fallback/preparing and no carrier image. This is not a screenshot of each transient, nor proof of precisely when pixels were presented. The four-runtime principal drag segments had no missing-paint samples.

The frame recorder's `t` is a requestAnimationFrame timestamp; native/contact observers use performance.now at callback execution. These cannot directly order a DOM sample against a cancellation event. The new recorder also saves `sampledAt` from performance.now at the start of its DOM-read callback. Older evidence is retained unchanged.

The original sink explicitly clears the decoded image, releases the carrier and empties paintLease for cancellation. Its next neutral render necessarily enters preparing fallback until decode finishes. A controlled host-unit reproduction with an already admitted neutral image, unchanged source owner and geometry, and a delayed neutral successor fails on the original source because the carrier image becomes empty. This is mock GPU/decode evidence that isolates the lifecycle cause; exact-head native verification remains necessary.

## Repair and safety boundary

`C-FEEDBACK-MATERIAL-0001-CONTACT` (draft) requires visual cancellation without a new activation owner. The repair does not change input, capture or click semantics. Cancellation still withdraws held/deformed paint immediately. The sink may synchronously restore only an already decoded neutral image after its ordinary source, source-owner, palette, geometry, style/foreground, carrier and preference guards pass. It never uses the cancelled held image as a bridge and never creates a neutral result by relabeling held pixels.

One retained neutral receipt is bound to the existing paint-generation lease: view, canvas/scope owner epoch, palette revision, optical geometry and source bounds, motion policy, fill/foreground, contact profile and variant. A newer source revision within the same admitted canvas generation may replace it atomically, as with the existing live-frame paint lease. Its diagnostic source revision remains the actual cached revision until the new result commits. Source withdrawal/rebinding, palette/theme change, geometry change, preference revocation, material withdrawal, author paint takeover and view retirement discard the bridge; stale completions cannot restore it.

Decoded ownership is reference-counted between current paint and at most one neutral receipt. They share one resource when current paint is neutral; while held, there can be one additional decoded neutral resource per surface. No extra GPU render/decode is launched merely to populate this cache. Replacing neutral/current images, invalidation and disposal retire each resource exactly once. The native fixture's final idle image bound is unchanged; a new native run must verify it.

A contact lifetime epoch also prevents synchronous cancellation during a renderer callback from installing a ticket for already rejected held input. New pointer sessions cancel pending old completions. Neutral restoration reports rest, the cancelled session ID and the neutral image's actual source revision; later native activation cannot restore tracking.

## Validation and remaining gates

- Original-source red with delayed successor and prior admitted neutral: 1 failed / 50 passed. Earlier diagnostic/setup attempts are retained separately.
- Candidate material/contact host suites: 16 files / 295 tests pass, including 19 added cancellation, source/theme/geometry/owner/preference/author/view negative controls, old-completion/new-session, render reentry and exact resource-retirement cases.
- Existing fixture suite on this separate baseline branch: 4 files / 26 tests pass. The separately reviewed activation-evidence driver commits are not part of this branch and must be combined independently.
- Workspace TypeScript passes after linking the existing workspace app dependencies and running the official style generator; the first missing-link/generated-module errors are retained. Prettier, script syntax and diff checks pass.
- Complete base host-unit suite: 49 files / 464 tests pass with browser files explicitly excluded. The first broad base selection also collected the native focus retry suite: Chromium failed before execution because socket() is not permitted (and reported read-only Crash Reports). That run has 49 passed files, one failed setup and 90 skipped tests; it is not a full pass. No alternate browser route was attempted.
- No successful native browser execution or visual acceptance is claimed. Existing Actions red, transient computed-style evidence, and downstream unexecuted native journeys remain outstanding. No generated screenshots are substituted for actual evidence.
- Local DCO commit only; independent source review, combined-candidate checks and official source/packed native reruns remain required. Finf remains WIP, 0/68 accepted.
