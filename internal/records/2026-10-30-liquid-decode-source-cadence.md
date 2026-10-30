# Controlled decode/source cadence diagnostic

Issue #1053. Source inspected: main9ab0fcad0fd9b5b49513a6b335e5007abea2d844. Status: test-only candidate, not executed. No measured user lag, GPU failure or production root-cause claim.

## Full source path, including correction to the first hypothesis

The completion guard in sink.ts807–829 refuses a decoded result if its source frame identity has changed. However, ordinary source notifications first cancelPending at963–969 and then repaint. Thus a notified compatible frame supersedes the earlier ticket before that completion guard; a late callback is ignored by the ticket identity check. The reason lease-replaced-during-image-prepare is not guaranteed for this common path. A silent changed source can reach that later guard. These paths must not be conflated.

source.ts84 creates a new immutable frame on each successful draw. The production preview animation uses an approximately120ms cadence. A decoder consistently slower than compatible source revisions can therefore be repeatedly superseded. Cold startup may stay preparing until a source stays stable long enough; an already-admitted compatible image can bridge the same lease, so a warm case can retain an older optical frame rather than degrade to opaque. Actual source withdrawal, owner/geometry replacement or restrictive preferences still require immediate withdrawal. No stale policy is relaxed by this diagnostic.

## Deterministic experiment

Four additive cases exercise the unchanged production sink via the existing GPU/image-prepare mocks. The source cadence model remains120ms; decoder completion is controlled at60ms or180ms. Logical time is not wall-clock or measured decode latency. The mocked completion is deliberately delivered even after cancellation to check stale-ticket suppression; real cancellation may prevent that callback entirely.

The timeline records logical time, source revision and owner generation, preparation start/cancellation/completion, render attempts, publication/nonpublication, current quality/reason and painted source revision. Cases cover fast cold progress, slow cold supersession with stable-source recovery, warm compatible-paint bridging, silent source replacement, real source withdrawal/rebind, transparency revocation and disposal. Assert at most one modelled unfinished, uncancelled preparation at recorded boundaries and count scheduled/completed/discarded work; these are controlled seam counts, not measured native resource allocations. Cold recovery occurs after updates stop, not under a continuing fast source. Existing tests and their assertions remain unchanged; the fixture's optional silent source update defaults to normal notifications for all existing callers.

## Acceptance limits and next evidence

The proposed expectations describe current source behavior, not an accepted permanent product policy or proof that the user's lag follows this mechanism. No production renderer/source/scene, fallback rule, cadence, threshold or workflow changes. Retain an unmodified production/native control separately. Existing exact-head CI must first establish whether the timeline matches reality; a failing prediction must be investigated, not changed blindly to green.

Native reproduction still needs actual hardware/browser, cold/warm source cadence and decode/encode/render timing, allocations, quality/reason transitions, four-host interactions and source/policy revocation. Synthetic logical counters cannot supply p50/p95 or GPU-cost claims. A recovery proposal must distinguish compatible newer pixels from revoked source ownership, keep safe fallback and sole input ownership, and receive separate definition/scope review. No per-frame histogram, unbounded retry or stale-image admission is silently introduced.
