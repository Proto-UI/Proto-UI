# Anatomy scope-only lookup avoids unrelated part enumeration

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Observed behavior and bounded repair

At source `5445b04c970f6fb46ccd871d2fbe509709c80e45`, `AnatomyModuleImpl.port.resolveDomainScope()` calls `resolveCurrentDomain()` only to return its `rootInstance`. That helper additionally enumerates every claim in the family and resolves every claim's ancestry. A11y invokes the scope-only port while refreshing part relationships, so unrelated instances can multiply this unnecessary work.

The focused executable regression creates a nested queried item plus 12 unrelated items in another root domain. One scope-only call returns the correct nearest root but performs 14 parent reads: the queried item twice and all 12 unrelated items. The unchanged-source red is the extra reads, not an incorrect root result, missing dependency, or test timeout.

The repair calls the existing `findDomainRoot()` directly. It neither caches ancestry nor changes that algorithm. The same regression now performs one parent read, and still resolves the current root after logical reparenting and returns null outside any valid root. Existing tests preserve retired boundaries, detached-domain adoption, independent renderers, and repeated view lifetime. `C-ANATOMY-0005` remains draft and is unchanged; this is a source-work reduction, not a new public performance guarantee.

## Demo Matrix investigation boundary

The native diagnostic [run 37769859848](https://github.com/Proto-UI/Proto-UI/actions/runs/37769859848) on `5445b04` records 420 initialized previewers and 420 hosts at the intermediate `inited-count` phase. The later committed-host assertion still times out at its original 60 seconds; its terminal DOM sample is unavailable. All 2,696 recorded requests completed with status 200 and no failures. `Profiler.stop` did not respond within the separate two-second diagnostic bound, so there is no native CPU profile in that receipt.

A local 420-cell HappyDOM diagnostic with installed official adapters, synthetic theme inputs, and read-only observer/call instrumentation ended at its external 28-second limit. Its last delivered mount log was the 85th WC cell at 6.244 seconds; no other adapter had yet delivered a mount log. This is incomplete progress, not a terminal DOM state. The last delivered cumulative readings included 15,989 `resolveCurrentDomain` calls (116 ms), 1,549 target notifications (862 ms), and 1,415 document queries (699 ms). Nested durations overlap. These partial readings do not explain the whole deadline failure or establish an observer loop. An earlier instrumentation-order mistake was stopped and retained separately as an invalid harness experiment, not a product failure.

This one-line change removes independently demonstrated unnecessary work. It does **not** establish the Demo Matrix's primary root cause or claim that the 420-cell native failure is repaired. No Matrix case, readiness assertion, deadline, prototype, runtime loader, or rendering schedule is changed.

## Verification and remaining work

- The new scope-locality regression fails on the unchanged source and passes on this candidate.
- All Anatomy and A11y module tests plus the four official Web-adapter Anatomy integration tests pass: 12 files, 108 tests, serialized with one worker.
- Whole-workspace type checks, aggregate validation, independent review, and exact-candidate native Matrix verification remain with integration.
- Continue the stall investigation with a bounded profiler that writes samples from the actual test worker independently of its JavaScript/event-loop progress. A successful small test or this local optimization must not substitute for the original unprofiled Matrix acceptance suite.
