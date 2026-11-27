# Sprint 1 dispatch wiring after the Sprint 3 opt-in integration

The shared repair workflow now exposes two explicit, default-false Sprint 3 dispatch inputs. Both ordinary repair and Sprint 1 are excluded when either input selects the independent Sprint 3 acceptance path. The old Sprint 1 wiring test still expected the earlier scope-only condition and rejected the integrated workflow before its own complete producer could run.

This change updates that existing test to require the full, exact conditions for both repair and Sprint 1, and explicitly checks both opt-in defaults remain false. It does not change a workflow, product, evidence threshold, execution deadline, source claim, or readiness state. The existing serial-worker, 90-minute job, 80-minute producer, no-continue-on-error, unconditional finalizer and artifact assertions remain intact.

The manifest in `evidence/2026-11-24-sprint1-dispatch-wiring/` binds the fresh main base, unchanged workflow hash, original and candidate test hashes, exact commands, real failing and passing target-test outputs, adjacent Sprint 3 workflow/receipt controls, and CI scheduling validation. The target run selects one existing wiring test; it is not a claim that all Sprint 1 native or production acceptance ran. Compressed logs are lossless and include original byte hashes.

Independent review checks this exact test change against the already-integrated workflow contract. A technical peer review is not a GitHub APPROVED review.
