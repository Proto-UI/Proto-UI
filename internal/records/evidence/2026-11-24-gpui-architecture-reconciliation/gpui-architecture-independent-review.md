# Independent review: GPUI architecture first steps

Reviewer: `/root/native`, read-only. No blocking findings in the original four #687 first-step deliverables.

Frozen record SHA-256: `f0b0b834337ff017e93810de53687a9308b37bd67c6c02134f33be562ab83831`. Manifest SHA-256: `37d59b7f3360fd69a998c9215196aa5f3072d10e9ff5172afb73ffa0a8078392`. All 18 main and 18 candidate Git blobs, byte counts and SHA-256 values were independently verified. Main is `0fbb52ef832cc27c78e24c28c59a55a16f51d7fe`; candidate is `b8800d4cef9302718d4514b1ba28508860059929`.

The source supports the candidate-only readOnly statement: native projection retains absence/true/false, and the actual host node sets or clears readOnly without overriding prototype behavior. Focus ordering is now a synchronous opaque whole-set capability; an unavailable or invalid complete order keeps stable registration order. The remaining HTMLElement-shaped interfaces and draft lifecycle are retained honestly.

The four original issue requirements, inherited single-owner direction, first Base Button T0 plan, three contract classes, multi-artifact profile decision, T1/T2 separation, and human/platform/AT gates are preserved. This review does not appoint an owner, supply HyacinthHaru or maintainer approval, promote a catalog entity, or accept any unexecuted native/profile/WASM scope. No additional native run was needed for this documentation/source reconciliation.
