# Whitepaper font roles and image content measurements — 2026-11-23

This repair follows the actual diagram acceptance failures in Sprint 3, PR #1713, for [#1165](https://github.com/Proto-UI/Proto-UI/issues/1165) and [#782](https://github.com/Proto-UI/Proto-UI/issues/782). It changes the measurement tools and their rejecting controls. The authored SVGs, article references, production styles, scope of captures, and visual acceptance obligations remain intact.

## Original observation

[Run 45057995978](https://github.com/Proto-UI/Proto-UI/actions/runs/45057995978) captured `f8f8b72f18e2f262b423f7328851dd3dc8b80cb9`. Its retained artifact is `14768711919`, SHA-256 `01c09b8c3a56bd0d6689305ca6d9ec26226cf8474484117b57867399cbc3d35c`; the downloaded ZIP digest matched GitHub's artifact digest.

Two distinct checks rejected valid existing presentation:

- The retained `information-flow-model.svg` uses system monospace for the five channel names and system sans-serif for actors, the component and internal dimensions. The broad `fonts: system` branch incorrectly required every family to include `sans-serif`. Four font probes failed and the eight corresponding article cases did not earn acceptance.
- Four narrow authored `whitepaper-lifecycle.svg` cases (both locales and themes) compared the image border box with the SVG's intrinsic proportions. The actual stylesheet applies a 1px border on every side and `height: auto`. The observed 358 × 182.859375 border box differs from the 982.4986302983941 × 499.1608633439397 viewBox ratio by approximately 0.010512. Its 356 × 180.859375 content box differs by approximately 0.0000795.

The original failed run and aggregate reconciliation failures remain historical failures. This record does not relabel them or establish source drift from a missing completion receipt.

## Repair and rejection boundaries

The retained information-flow profile now declares its two authored font roles. Each measured text element must match exactly one role, and all five named channels must occur exactly once. Both the live probe and terminal receipt verifier inspect the measured class/family assignments. Unknown or missing roles, role overlap, changed channel labels, monospace body text, sans-serif channel text, incomplete family measurements, and embedded system-font faces are rejected. The three other system-font profiles remain sans-serif-only. Switch keeps its existing loaded Hand Latin/CJK requirements.

The authored-image collector retains all four measured border and padding edges and derives the content box from them. Capture and terminal readback recompute that box, reject nonfinite, negative or nonpositive geometry, and apply the existing `0.01` ratio tolerance to content. Terminal checks also bind the positioned and post-screenshot content measurements. Outer bounds continue to govern viewport fit, header overlap and complete PNG clips. This repair addresses the current untransformed article CSS; it does not add a general transformed-image geometry claim.

## Executed evidence

Node was `24.22.3`. The existing dependency directories were reused after confirming the same `pnpm-lock.yaml` SHA-256, `e374ba03f76079fd191d63c2da1f62861b7e90bbeba64a0b310027fc2c15b7f8`. No new frozen installation or new production build is claimed.

| Execution | Actual result |
| --- | --- |
| New regression fixtures against unchanged collectors/verifiers | 15 tests: 11 passed, four failed for the border/content or unchecked font/geometry conditions |
| Initial focused corrected suite | 28/28 passed |
| Expanded first attempt | 52 passed; one file could not initialize because its local Astro package link was absent |
| All eight existing `scripts/docs/test/*diagram*.test.mjs` files after restoring that dependency link | 55/55 passed, zero skipped/cancelled |
| Separate read-only review of the actual SVG/CSS contract and candidate | 13 additional oracle probes passed; this is local review, not a GitHub approval |
| Local Chromium 156.0.8078.79 with Playwright 1.58.2 and `chromiumSandbox: true` | Browser launch failed at `process_singleton_posix.cc` with `socket() failed: Operation not permitted`; zero font or image probes executed |

The final eight-file test log has SHA-256 `a8db36092ed95f1e7f1eb077a5b4ffa535a47a5fb9236b0ad3f0da8d19e12e5c`. The candidate patch for the eight implementation/documentation/test files, before this record, has SHA-256 `ec7eaddcc8ce8a056d5560903ace9bb70324dec32f4da89d689587981fc62dc5`.

The original production workflow still needs to run on the published candidate: all five profiles, 60 article/preview cases, 24 font probes, and the separate 32 authored-export cases. Real screenshot inspection, applicable preview interaction, assistive technology, ordinary CI and independent integration review retain their original acceptance boundaries.
