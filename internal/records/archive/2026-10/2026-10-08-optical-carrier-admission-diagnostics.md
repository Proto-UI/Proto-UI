# Optical carrier admission diagnostic boundary

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Observed official failure

The exact PR #872 head `0a3fac594103bf1c6fd60fa511ace2e733adb97c` failed all four source/emitted, ordinary/continuous optical runs before the initial `self-optical` admission. Official run [37743002063](https://github.com/Proto-UI/Proto-UI/actions/runs/37743002063), job `113197852081`, retained [artifact 11534199157](https://github.com/Proto-UI/Proto-UI/actions/runs/37743002063/artifacts/11534199157). Its downloaded ZIP contains 16 files and matches SHA-256 `2bc73a9e14f1f150dde8cef4f6206c2c2b9275554a0e39221a4e2d0311991a73`.

All four failure images were inspected. Every runtime mounted the visible owned canvas and ordinary opaque Buttons. The controls reported `materialQuality: opaque-fallback` and `materialReason: contact-carrier-style-unavailable`. The GPU counters already contained completed renders, source uploads and image preparations. Continuous capture retained zero frames because the initial admission never completed. These facts identify the carrier validation boundary; they do not identify a shader defect or an absent server.

The sink synchronously removes the rejected pseudo carrier and restores its inline properties. Consequently, the existing timeout snapshot cannot recover the actual computed properties which made `carrier.valid(image)` false. No individual CSS property is claimed as the root cause yet.

## Bounded observation

`experiments/material-v2/carrier-diagnostics.mjs` records at most the first 32 real `getComputedStyle(host, '::before')` reads while the owned `contact-v1` marker exists. It copies the returned CSS values, current host inline values, host positioning/isolation, runtime and connection/tree facts before cleanup. Both browser suites retain those reads in their existing failure-state artifact. The global first-32 bound may be filled by one runtime; it is not a claim of complete four-runtime sampling.

This is test-only instrumentation installed before the fixture loads. It returns the original computed-style object, preserves the original receiver and errors, and cannot change material admission. No production code, assertion, timeout, source guard, shader or browser restriction is modified. The additional host-style read and value enumeration mean instrumented timing must not be promoted to performance evidence.

## Verification and next step

The focused suite passed 15 tests: four instrumentation unit cases, four direct-consumer cases and seven graph-boundary cases. Negative controls cover unowned/other-pseudo reads, bounded collection, immutable snapshots after cleanup, observation failure isolation and preservation of original errors. These tests use a style-returning spy and prove the observer contract only; they do not prove browser CSS or optical output. All three browser/helper JavaScript files pass syntax checks and the diff passes whitespace checks.

The failed official output remains failed. The next step is an independently reviewed exact-head official run, inspection of its pre-cleanup CSS snapshots, and a minimal production repair backed by a discriminating red/green regression. Local Chromium's Unix-socket restriction is not bypassed. No Finf item is promoted: complete acceptance remains 0/68, with actual source/emitted continuous pixels, performance and visual acceptance still open.
