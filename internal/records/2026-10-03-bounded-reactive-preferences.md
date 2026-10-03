# Bounded reactive preferences (issue #793)

This is a draft implementation increment, not admission of a stable Base guarantee or completion of Liquid Glass.

- The existing `colorScheme` source and sampled `reducedMotion` remain unchanged. Four new `preference.*` keys have an independent getter-paired, dependency-driven mounted lease.
- Unknown is explicit. Web checks every defined media-query alternative; false for `reduce` alone never implies `no-preference`. Missing/unobservable APIs and conflicting matches fail closed.
- Source loss, reset and getter mismatch retire old generations and request immediate style reconciliation. Custom getters never inherit the default observer.
- Unit evidence covers per-query resource sharing, independent repeated subscription, Document isolation, coalescing, callback errors, unknown inputs, late callbacks and disposal. Runtime evidence covers actual Rule output and sampled compatibility.
- `apps/www/test/preferences.browser.test.ts` exercises real Base Button rendering through WC/React/Vue3/Vue2 with native CDP media emulation and separate missing/custom-source cases. This fixture is a preference witness, not a Glass material demo. Browser execution status must be reported from actual runs.
- Material support remains a separate host fact; no alpha, blur, refraction, Compiler or native parity follows from these preferences. #793 stays open for those admission/evidence obligations.

The implementation scope was approved as a bounded draft during the current maintainer-directed development loop. Stable admission remains open under the catalog criteria.
