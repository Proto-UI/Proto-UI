# R10 private props-registration reuse — WIP, not acceptance

This additive checkpoint removes the second compiler-private registration record
while preserving all actual consumer behavior and **all 97 strict diagnostics**.
The lawful retained-template helper regression and old SSR walker are still open.
Original r2/R6/R7/R8/R9 records and failures are unchanged.

## New actual paired evidence

- Fixed third-party base: `783ac833a77102365489d4050f7279c758114ec4`.
- Control: `a90472e123d0933ef4396c16d222444f728796b0` (exact R9 product/tests).
- Candidate: `9db936d579dffe2c8debb61e43783a1205986b4e`.
- Executed 2026-11-02 22:52–22:56 UTC under the original isolated ten-phase
  envelope, with all original 105 locked dependencies and no network/install.
- Both exact core collections: **49**, with no skip/todo. Both source-strict: **0**.
- Both core executions: **47 passed / 2 failed**. Original 11 behavioral controls
  pass; native controls are 36/37, retaining the lawful-helper failure. Full
  generated strict is the other failed case. All tests are byte-identical to R9:
  original 12 cases / 43 assertion sites, 37 native cases and three unsupported
  operation rejection controls remain; no new or weakened assertion was added.
- Both separate original Vue2 regression suites: **41/41**.
- Complete generated strict: **97 → 97**, comprising **97 common, 0 old-only,
  0 new** diagnostic occurrences. All 97 source-line/column/span occurrences match
  as well. This is not a strict-type fix or a passing complete generated graph.
- **1,230 artifacts / 23,308,109 bytes** were individually hash-verified; every
  source/dependency/layout/capture guard passed. All 14 subprocess root checks
  and terminal postchecks were clean. No test was replaced with a mock emitter.

## What changed, and what did not

Each of the four existing compiler-private ordinary literals now carries its own
`active: true`. The registration helper still checks setup phase and keys before
performing the real key-array copy and appending the record. It stores that owned
literal rather than constructing a second spread record. Callback identity and
receiver, registration order, cancellation closure, validation/throw boundaries,
rollback and terminal cleanup remain intact. No author object is mutated or
exposed, no public API is added, and no shared analysis/runtime layer is introduced.

The unchanged actual props consumers cover hydration skip, coalesced snapshots,
registration order, run binding, unmatched keys, invalid-raw fallback, live slots,
-0, and a setup-returned disposer invoked repeatedly through native rendering and
cleanup. Both selected cases passed on each variant. This is not newly added
listener reentry/failure-after-catch coverage; no illegal parser fixture or
validator bypass is used to claim it.

For both selected consumers, new control output is byte-identical to the retained
R9 capture, and new control/candidate input including checked IR is byte-identical.
The actual GeneratedModule changes only its code field, by the same eight bound
private-registration substitutions. Complete input/code/module hashes are in the
manifest. Actual emitted Component lengths are:

| Consumer | Control | Candidate | Delta |
| --- | ---: | ---: | ---: |
| Setup-returned disposer / repeated invocation / cleanup | 29,248 B | 29,304 B | +56 B |
| Hydration / coalescing / order / run binding | 31,458 B | 31,514 B | +56 B |
| Full strict fixture | 38,625 B | 38,681 B | +56 B |

There are still four private record-literal call sites, a real key-array copy and
the cancellation closure. On successful registration the source has **two → one
object construction sites** (the callsite literal and formerly a second spread).
This is source accounting, **not measured V8 allocations, heap, GC, initialization
time, elapsed time or optimized retained bundle savings**. The emitted source
actually grows by 56 bytes including type annotations; do not call that a byte
saving. Full raw captures remain local evidence, not a new browser result or
public artifact download claim.

## Exact bytes and reconstruction

The published product file is the exact executed candidate. The existing native
test is unchanged from public parent `83a560f449489529c5729a493a3ae2c9156918ba`.
Actual Prettier 3.8.1 data export and read-only recheck passed before runtime; both
source/test outputs matched their inputs byte-for-byte. Execution remains the
fixed 783ac833 overlay, not this public PR's complete ancestry or current main.

First reconstruct R7, R8 and R9 from their unchanged public carrier instructions,
then run:

```sh
python3 reconstruct.py --base-record /tmp/vue2-r9-evidence --output /tmp/vue2-r10-evidence
```

The output must not exist. This standard-library helper only verifies and
reconstructs evidence bytes; it never executes compiler/generated code, accesses
the network or installs anything. Nine exact byte-edit spans reproduce the
captured strict Component; the readable patch is included. These diff spans are
not the count of semantic substitutions. Emitted and consumed Component bytes
match. The full GeneratedModule changes only its one JSON-quoted code field; the
215-entry strict program changes only that Component hash. Authored input,
consumer, Context support and portable strict request match R9 exactly. All
97 diagnostics and every original metadata field/order are retained; only the
same four documented temporary path prefixes are normalized, with inverse-byte
proof. Seven base files and all eight outputs are checked before writing.

## Still open

- All 97 generated strict diagnostics: State 35, props 14, owner 14, Context 12,
  Expose 12, root VNode 5 and authored entry 5. Factory/schema relations remain
  unproven; source-strict does not replace generated-strict.
- General lawful legacy-template helper/formal lowering without erasing bodies,
  new legal-input rejection or a fallback Template interpreter.
- Native SSR/hydration, ordinary production/mixed consumers, real browser,
  reached-capability costs and the full backend/operation matrix.
- Exact public-head CI and independent acceptance. Static QA is not APPROVE.

Continue in Draft #1209 / #1055; #1120 remains the sole shared shape analyzer.
No ready, merge, Issue closure or whole-compiler completion is claimed.
