# Bounded rounded-perimeter and shadow-side observations

Date: 2026-10-06 UTC. Non-normative continuation of #775 from `733397ae1b9f0776f9355d0cfeb8af5c071beccb`; this does not change Prototype paint, thresholds, lifecycle, or #469's acceptance scope.

## Recovered source

The six-file Dialog Escape / zero-border calibration repair was recovered from the source archive with SHA-256 `64370dc7a90f72cce5d8ea345fb1d208c7d52546bbcd23014652f26ee577bd11`. All six recovered file SHA-256 values and Git blob identities match its manifest. The separate #832 files were not applied. The prior recovery record retains its historical observations; the results below are newly executed.

## Two additional source findings

- [4191077754](https://github.com/Proto-UI/Proto-UI/pull/775#discussion_r4191077754): bounding-box fractions can lie outside rounded paint. All nonzero computed corner radii now add `unsupported-rounded-perimeter`; raw perimeter pixels and geometry remain recorded, but border/fill perimeter ratios and rectangular shadow metrics are withheld. This conservative domain does not pretend to solve curved adjacency.
- [4191077765](https://github.com/Proto-UI/Proto-UI/pull/775#discussion_r4191077765): a right/bottom shadow receiver is emitted only where the signed offset plus spread extends beyond that side and the spread rectangle has positive dimensions. Other sides retain null points and ratios. Negative offsets remain supported where positive spread covers the sampled side. Left/top metrics remain unimplemented rather than fabricated.

Native calibration adds circular/elliptical and square controls; zero, negative, mixed, spread-covered negative, and collapsed-spread shadow cases. The new fixtures retain PNG/fact diagnostics through the existing source-bound calibration recorder. Identity, anatomy, current-lease checks, visibility rules, exact RGB expectations and contrast thresholds remain intact.

## Fresh validation

Node 24.19.0 / pnpm 10.32.1, recovered source plus these bounded sampling edits:

- Controlled DOM/host tests: `contrast-projection-identity.test.ts` 432/432 and `contrast-popup-escape.test.ts` 26/26 pass. These are not native-browser claims.
- Node audit journal/planning/anatomy/toolbar controls: 111/111 pass after locked dependency installation. An earlier attempt before dependency linking failed to import `yaml`; it was setup failure, not a source result.
- Public-docs suite: 159/159 pass. Its initial run exposed a missing new geometry input in the source-expression test harness; the harness now supplies that input and tests its false branch. With the old `733397ae1` probe temporarily substituted, the strengthened perimeter and shadow controls both fail specifically on fabricated `21` ratios rather than null; the candidate restores all 23 serialization tests. These use controlled CSSOM/pixel inputs and do not replace native rendering.
- Full `check:types`: passes, 461 Astro files, zero errors, zero warnings, six existing hints. Initial docs startup failed because the environment's default Astro configuration directory did not exist; rerun used writable temporary XDG configuration/cache directories, without changing repository source.
- Native calibration: blocked before tests by Chromium `socket() failed: Operation not permitted`. Normal and approved elevated launches hit the same environment restriction. No native tests passed locally and no local screenshots are claimed. Exact-head CI must execute all 28 calibration tests and the existing complete audit matrix before native acceptance.

## Remaining work

Publish this bounded repair independently of the separate #832 startup fixes. Collect exact-head CI, calibration PNG/facts and public component captures; reconcile the findings only after verification. Consume the separately accepted #832 source by an ordinary merge and rerun affected combined checks. Independent reviewer acceptance and all existing merge gates remain required. No old capture represents this candidate.
