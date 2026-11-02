# R9 finite lifecycle registry — WIP, not acceptance

This additive checkpoint preserves the actual generated Vue 2 graph and **all
97 remaining strict diagnostics**. The lawful legacy-template helper regression
and old SSR walker remain unresolved. Original r2/167, R6/134, R7/124 and R8/102
records and failures are unchanged.

## Actual paired execution

- Fixed third-party base: `783ac833a77102365489d4050f7279c758114ec4`.
- Control: `2ffbe46c50d3d9769d77439fbd4d19128dd94cbd` (R8 product, new tests).
- Candidate: `a90472e123d0933ef4396c16d222444f728796b0`.
- Both exact collections: **49 core**, no skip; both source-strict: **0**.
- Both core runs: **47 passed / 2 failed**. Original 11 behavioral controls pass;
  native controls are 36/37, with the retained lawful-helper failure. The other
  failed case still expects zero complete generated strict diagnostics.
- Both independently executed existing Vue2 regression suites: **41/41**.
- Full generated strict: **102 → 97**, comprising **97 common, 5 old-only,
  0 new** occurrences. All 97 common source lines, columns and spans match too.
- All **1,230 captured artifacts / 23,224,101 bytes** were hash-verified. All ten
  source, original 105 locked dependency, layout and capture checks passed.

The two new real Vue2 consumers pass on **both** variants. They cover registration
order and the actual run binding across created/mounted/updated/unmounted/
beforeDispose, repeated view epochs and live-slot paint; and first-throw retention
while terminal state cleanup and exposed-handle invalidation still finish.
These are compatibility controls, not evidence that R9 fixed two behavior bugs.
Original 12 cases / 43 assertion sites and all prior 35 native cases remain.
Three unsupported-operation rejection controls are not native implementations.

## Product boundary

The compile-time operation table supplies the same five lifecycle names, in the
same order, to the emitted key union, registry and finite key array. No separate
shape analyzer or second lifecycle-name list is introduced. Registration still
performs setupOnly before pushing the original callback; fire still directly
calls it with the real local run and preserves throw-stop behavior. Cleanup
iterates the same five live arrays at the same point. There is no callback
wrapper, cast, broad any facade, new rejection or generic interpreter.

The five removed diagnostic occurrences are two implicit parameters and three
invalid registry-index sites at registration, fire and cleanup. Their absence is
not complete Lifecycle, generated strict, SSR or backend acceptance.

The finite key literal replaces the old Object.keys result; the original map
entry arrays remain. Cleanup still creates one enumeration array. The actual
captured Component grows from **38,054 to 38,625 bytes** including annotations.
This is source-size/allocation-site accounting, not heap, GC, elapsed-time or
final-bundle performance measurement. R8's extra private registration object is
still a separate recorded cost debt; this checkpoint does not optimize it.

## Exact bytes and reconstruction

Official Prettier 3.8.1 data export and read-only recheck both passed before the
first R9 runtime run. Product output was unchanged; the final formatted test
bytes were the actual execution input. **Both published source/test files are
byte-identical to the executed candidate.** The run is fixed base 783 plus its
explicit overlays, not a fresh test of this PR's entire public ancestry or main.

Reconstruct the prior carriers from public parent
[`a80effa7`](https://github.com/Proto-UI/Proto-UI/commit/a80effa78514ae7c5238dfc08bbd84715ccb6b82),
then this incremental graph:

```sh
python3 ../r7-owner-commit/reconstruct.py --base-record ../r6-owned-state-cell --output /tmp/vue2-r7-evidence
python3 ../r8-props-watch/reconstruct.py --base-record /tmp/vue2-r7-evidence --output /tmp/vue2-r8-evidence
python3 reconstruct.py --base-record /tmp/vue2-r8-evidence --output /tmp/vue2-r9-evidence
```

All output directories must be absent. These standard-library helpers only
verify and reconstruct artifact bytes; they never execute project/generated
code, install dependencies or access the network. R9 checks seven base files and
all eight outputs before writing. Six exact original-byte edit spans reconstruct
the captured Component; the readable patch is included. Emitted and consumed
Component bytes match. The full GeneratedModule changes only its one JSON-quoted
code field, and the 215-entry strict program only that Component hash. Authored
input, consumer, Context support and portable strict request match R8 exactly.
All diagnostic fields and ordering are preserved. Only the four documented R6
temporary path prefixes in metadata are normalized, with full inverse-byte proof;
source and authored input are not normalized. The carrier does not publish every
other local capture or the private execution environment.

## Still open

- 97 full diagnostics: State 35, props 14, owner 14, Context 12, Expose 12,
  root VNode 5 and authored-entry 5. Factory/schema correlations remain unproven.
- General lawful legacy-template formal/helper projection without body erasure,
  new admission restrictions or runtime Template interpretation.
- Same-source native SSR/hydration, real-browser/mixed production consumers,
  reached-capability costs and complete backend/operation coverage.
- Exact public-head CI and independent acceptance; static review is not approval.

Draft #1209 and #1055 continue. #1120 remains the sole canonical shared shape
analyzer. No ready, merge, Issue closure or whole-compiler completion is claimed.
