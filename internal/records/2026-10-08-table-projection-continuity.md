# Preserve valid Table facts across target notifications

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Executed evidence

A bounded HappyDOM replay of all 105 demos across four installed official Web adapters used the unchanged production source at `5445b04c970f6fb46ccd871d2fbe509709c80e45`. It mocked only browser framework loading to use the already-installed runtimes and the unavailable website CSS theme input. The test worker explicitly recorded its PID, `--prof` arguments, source/harness hashes, and mount events by synchronous writes. The external supervisor stopped the process at 28 seconds and verified no remaining worker. This is synthetic-DOM diagnostic evidence, not native-browser acceptance.

The actual test fork produced a continuously growing V8 log with 2,698 decodable 10 ms samples. Only 83 WC mounted events were persisted; the last was at 6.854 seconds. No later mount event was persisted before termination. In the 10–20 second V8 window, 778 of 987 sampled stacks included React `flushReact`/`renderDemoReact`. In the 20–27.65 second window, 552 of 756 sampled stacks included `AnatomyModuleImpl.notifyTargetChange`, 422 included `TableStructureModuleImpl.recompute`, and the closest project frame in 304 was A11y's `idIsAvailable`. These inclusive stack counts overlap and must not be added together. Later samples also show Vue view attachment and mounted-phase completion. The worker was executing synchronous first-mount semantic projection work; its last mount event was not a terminal DOM snapshot.

This isolates a concrete candidate within the synchronous cascade: every Table `recompute()` unconditionally cleared all current part projections before computing and reapplying the next topology, even when the topology remained valid and unchanged.

## Red/green repair

The new deterministic module fixture reports a target notification while keeping the same valid root/row/header/cell topology and opaque refs. The original implementation produces 34 actual State or relationship transitions, including temporarily removing all four semantic roles and withdrawing/restoring the cell's header IDREF. The root result remains valid; the failure is the intermediate withdrawal, not missing imports or a timing assertion.

The repair computes the next topology first and clears all current projections only when that topology is invalid. A valid topology directly updates the same role-specific complete facts. It adds no cache, scheduling, observer filtering, deadline, registry, new semantic owner, or native host assumption. Part roles remain immutable after declaration, and existing departure/domain cleanup still owns departing parts. `C-TABLE-STRUCTURE-0001` and `M-TABLE-STRUCTURE-0001` remain draft and unchanged.

The regression observes zero State/relationship changes on an unchanged target notification. Its invalid-header control still clears every structural role and IDREF; restoring valid headers with a changed span restores the current coordinates and header refs. Existing role mismatch, part departure, invalid topology, ordering, and four-adapter projection controls also remain passing.

## Validation boundary

- Table module tests and four Web-adapter Table integration tests: 6 files, 13 tests pass with one worker.
- The separate Anatomy scope-only improvement has its own red/green evidence and record; neither local change alone is presented as the Matrix's complete root cause.
- No native execution, native CPU profile, or exact-candidate full Matrix pass is claimed here. The existing official 60-second readiness assertion and all four Matrix cases are unchanged.
- Exact-candidate native Matrix verification, workspace checks, and independent review remain required. Retain the old failing official run and synthetic bounded profiles alongside subsequent evidence.
