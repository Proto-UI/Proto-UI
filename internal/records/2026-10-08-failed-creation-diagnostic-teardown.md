# Failed creation: diagnostic-safe terminal teardown

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Diagnosis and authority

On local base `8ff1643aa`, the delay and module-resource suites reproduce two failing delay assertions and 22 passing controls. Both failures first compare a dual failure to the original creation Error alone. This is stale evidence: `fa8d9caa94e9437bb3c1a66d84c651d8be352892` deliberately routed synchronous failed-creation cleanup errors through the same caller, using `AggregateError([creationError, cleanupError])`; the module-resource suite separately requires the ordered original errors, including falsy thrown cleanup values.

`C-LIFECYCLE-0002` is draft and explicitly leaves callback-error propagation open (`C-LIFECYCLE-0002-Q-CALLBACK-ERRORS`). This change does not close that question or promote AggregateError to a new stable guarantee. It retains the already integrated implementation convention. Draft `C-DELAY-0001-G/H`, `C-LIFECYCLE-0002-G` and `C-LIFECYCLE-0007-A` supply cancellation, terminal invalidation and owner-lifetime constraints.

After correcting only the obsolete error assertions, the diagnostic case still fails: the host delay remains uncanceled. A throwing disposing-phase observer exits disposal before cancellation and resource release. This is a real teardown defect hidden by the first assertion, not a reason to weaken the cleanup oracle.

## Bounded repair

Terminal phase/begin/done diagnostic failures are retained while disposal continues. One cleanup error keeps its exact identity; multiple terminal errors remain ordered in a nested AggregateError, after the unchanged original creation error. State remains available to beforeDispose and is invalidated afterward. Delay callbacks invoked reentrantly by terminal diagnostics stay pending until cancellation rather than silently removing their cancellation record. No public API, scheduler timing, lifecycle callback ordering or host wiring policy changes.

The repair does not define arbitrary host cancel/module-port failures or the full lifecycle callback-error policy. Existing callback short-circuit behavior and asynchronous unmount precedence are unchanged.

## Evidence and limits

- Baseline: 2 failed / 22 passed across delay and module-resource suites.
- Error-assertion-only control: 1 failed / 9 passed, exposing uncanceled scheduled work.
- Final regression tests with original session implementation restored: 3 failed / 11 passed. The failures cover early diagnostic interruption and lost cleanup-error evidence.
- Candidate: 11 delay/lifecycle test files, 76/76 passed, one Vitest worker.
- Four terminal notification points check original error object identities, one cleanup pass, state invalidation, exactly one host cancel, already queued callback suppression and inability to schedule new delay during cleanup. Combined diagnostic/author cleanup errors remain individually inspectable. Existing next-generation and falsy cleanup controls remain green.

This is source-only local evidence. No browser, full runtime shard, package build, workspace typecheck or remote CI result is claimed. Independent exact-commit review and the integrating branch's heavy checks remain required. Historical failures remain failures.
