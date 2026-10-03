# Spinner visual evidence for Issue 781 / PR 778

This is an evidence-only branch. Do not merge it into the product branch.
Only actual public Proto UI renderings are included, never the private user reference image.
Retain while Issue 781 / PR 778 is under review; no automatic deletion is scheduled.

## Current validated capture scope

- Candidate: `57f48cf67e7fa6eee411814a2830d205275a7d46`
- Base: `42aaca074eb4c1532545fe554d1ee9bc3d0a8891`
- Source tree: `79c47ecc65063be5d30f7811f275b08189568679`
- [Successful real-browser evidence run](https://github.com/Proto-UI/Proto-UI/actions/runs/37109952149)
- [All 64 PNGs, two source-bound manifests and original WebM recordings](https://github.com/Proto-UI/Proto-UI/actions/runs/37109952149/artifacts/11269262262). Actions retains this artifact until 2026-11-02 and download may require GitHub sign-in.
- Chromium 154.0.8037.57; desktop 960x720, mobile 320x844; WC/React/Vue/Vue2; light/dark; normal/reduced motion. Screenshots crop the real preview surface; recordings retain the desktop viewport.
- 11/11 browser-contract, serialization and native positive/negative control tests passed. Base and candidate each captured 32/32 states.
- Candidate: 80 full-turn Root windows, each at least 395.999 degrees, and 80 static reduced-motion Root windows. Maximum geometry-center drift/parent-center offset: 0.000031 CSS px; rotation-origin error: zero. The open arc's rotating visual mass is not a geometry-center drift.
- Minimum modeled browser-resolved stroke/background contrast: 15.79:1. No captured page exception or horizontal overflow. This is not a general accessibility or authored-CSS-alpha-fidelity claim.
- `summary.json` records exact measurements and the source artifact SHA-256.

## Image provenance

The four current candidate PNGs show desktop light/dark and mobile light/dark-reduced examples. The baseline PNG is recaptured in the same successful run.

Historical images retain their own SHA rather than being relabeled as the latest revision:

- `58f8c4f3`: a decoded still from the first failed capture run's actual WebM. The runtime menu is dismissing. This is explicitly partial historical evidence, not a completed matrix or final visual acceptance.
- `651dcfdb`: actual first desktop/WC/light capture before the contrast probe stopped on a CSS4 background it could not yet measure.
- `c0771459`: actual desktop/WC/light image from a full 32-case capture pass; that run separately failed newly added browser-control call plumbing.

Those failures and repairs remain in PR 778's per-commit comments. No screenshot content was repainted or fabricated. The historical decoded video frame is labeled separately from native PNG captures.

Co-author by OpenAI Dots
