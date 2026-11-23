# Sprint 6 prominent tint profile 6 — independent source review

This is a provisional source review of the Liquid implementation worktree. The final integrated commit, patch identity, native receipts, and formal review packet remain to be bound by the integrator. The reviewer did not implement this slice.

## Reason for the change

The real `9b6448e` WC prominent-tint run retained four failures in source-response amplitude, changed area and/or delta RMS. Their source/paint ownership and readability checks passed. The independent triage record retains the exact measurements and original thresholds. These failures cannot be relabeled as passed because the profile changes, and the same original cases must run again.

## Definition and bounded behavior

The revised profile derives a finite code-luma interval from per-channel extrema of the admitted opaque source, a one-code boundary allowance and the existing maximum contact-lighting envelope. The interval is computed for the same prepared source identity and revision; it is not an author parameter or a fixture-specific constant.

For interval width `r`, the definition uses `b = 0.5 / max(r, 1-r)` and `s = 1-b*r`, with `F(t) = s*t + b*clamp(t-low, 0, r)`. The equivalent coupled evaluation `t + b*(clamp(t-low,0,r)-r*t)` avoids uploading independently rounded slope coefficients. In real arithmetic the endpoints remain 0 and 1, all slopes remain between 0.5 and 1.5, and a full-domain or zero-width interval is identity. It adds no plateau of the rejected mean-plus-clamp type.

The uploaded lower bound is float32, and width/boost are rounded inward using the same represented width. The source review found the intended finite endpoint/slope bounds coherent. This is not a statement of exact CPU/GPU floating-point equivalence. Actual shader output must still pass the original readback and contrast checks.

## Ownership and cost

The source interval is computed only on first tinted use of a prepared source cache entry. Neutral use remains lazy. Cache identity includes the current frame, revision, dimensions, pixel-view identity/offset and existing source/canvas/scope ownership; retirement, clearing and bounded entry limits are reused. It adds scalar facts rather than a separate DOM owner or background scheduling loop.

The additional scan is counted in total source preparation time, with separate preparation counters. Therefore the earlier horizontal-prefilter CPU benefit cannot be presented as a measurement of the whole revised profile. The new matched native frame-budget run is required, and a fixture-layout change requires a common baseline.

## Preservation of existing evidence

The original structured sources, three control roles, source hashes/binding checks, opacity, readability, span, RMS, correlation, changed-area and refraction thresholds remain. Existing passing arithmetic vectors and the known negative history are retained. Historical profile-4 diagnostic replay keeps the exact historical kernel and explicitly records the now-unused profile-6 adapter uniform; schema negatives reject missing, duplicated or incorrectly typed current uniforms. Historical diagnostics are not relabeled as current-profile output.

## Additional native coverage, not a replacement matrix

The six additive fixture/metric/browser files preserve the original **48 cases / 1,608 captures** and add **8 constant-field cases / 80 captures**. The full inventory is **56 cases / 1,688 captures**, or **14 cases / 422 captures per runtime shard**.

Each added case uses the actual owned source sequence `32 -> 96 -> 160 -> 224 -> 32` with the same component owner. The tinted output must remain opaque, readable and bound to the current source; each 64-code increase must produce at least eight codes of mean output-luma increase. Geometry, sampled cells, foreground and profile remain fixed. Revisions increase, source hashes change, the opaque control does not respond, and returning to A restores the original source hash and output mean within one code. The actual source crop is also checked against the requested code.

These cases measure absolute brightness response and recovery. A flat field cannot establish spatial refraction or structured optical transmission. Omitting the neutral control from only these new cases does not remove it from the original matrix. The new cases do not establish Apple equivalence, physical input, device refresh rate or visual acceptance.

## Terminal integrity

The complete inventory is assessed before reporting completion. Missing or unexpected cases/captures, non-completed states, page errors and cleanup errors prevent completion. The browser and source server are independently cleaned before the final terminal record. Per-case context closure remains inside the case wrapper, so a close failure cannot leave a completed case receipt. The preflight continues to require an official exact-head Actions source and a clean tracked/untracked worktree.

## Source conclusion

No remaining source blocker was found in the reviewed profile and additive six-file slice. This provisional source-clear conclusion does **not** accept the four historical failures, the new brightness sequences, GPU behavior, frame cost, all four native hosts, the 120 Hz/10 ms target, or physical input-to-photon performance. Those require the corresponding actual final-head receipts, retained manual visual review and external hardware conditions.
