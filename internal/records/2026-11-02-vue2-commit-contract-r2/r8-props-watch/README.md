# R8 props watcher typing — WIP, not acceptance

This incremental record carries the actual generated Vue 2 graph and **all 102
remaining strict diagnostics**. The lawful retained-template-helper regression
and old SSR walker are still unresolved. Original r2 (167), R6 (134), and R7 (124)
records and failures remain unchanged.

## Exact execution

- Fixed base: `783ac833a77102365489d4050f7279c758114ec4`.
- Control: `81763496145c0f2fab5d1362118d11ff930ab6a5`.
- Candidate: `b260f143a70c15c6ae7524b0847c129be5a4e52d`.
- Ten isolated phases: both collect **47**, both source-strict **0**, both core
  **45 passed / 2 failed / 0 skipped**, both separate regressions **41/41**.
- Complete generated strict: **124 → 102**, comprising **102 common, 22 old-only,
  0 new** diagnostic occurrences. All common source lines, columns and spans
  match too. This is not 22 independent behavior fixes or a strict pass.
- Both new actual Vue2 consumers pass on both variants: hydration skip,
  coalesced previous/next snapshots, runtime run binding, registration order,
  unmatched keys, invalid raw input retaining its valid resolved value, live
  slots, `Object.is(-0, 0)` distinction; and setup-returned watcher cancellation
  across repeated native invocations, prop changes and destruction.
- Original 12 cases / 43 assertion sites and prior 33 native cases are retained.
  Three other cases remain unsupported-operation rejection controls.
- All **1,214 artifacts / 22,208,273 bytes** were individually hash-verified;
  source, original 105 locked dependencies, layout and capture guards passed.

The product types raw and resolved snapshots separately, binds callbacks to the
real local `run`, and retains the registration-kind / callback-snapshot
relationship. The compiler-private registration helper takes an own literal
record rather than three arguments; dispatch explicitly distinguishes raw and
resolved callbacks. Callback receiver, validation, copying, registration order
and the active-bit disposer are preserved. No public callback wrapper, new
runtime protocol, `any` escape or second shape analyzer is added.

The annotation alone does **not** prove the dynamic schema-to-`GeneratedProps`
correspondence or complete Props soundness. Existing declaration/default/factory
input typing still has debt. The current target admits `props.watch`, not
`watchAll`, `watchRaw` or `watchRawAll`; emitting helper declarations is not
implementation of those operations. The current parsed IR also does not provide
general field access on the fourth record-shaped WatchInfo parameter or ordinary
helper invocation of a native-returned disposer. The controls use existing lawful
setup-returned callable transport and do not bypass admission.

C-PROPS-0011 and C-PROPS-0013 are active source contracts. Bounded producer typing
and these controls do not establish their full cross-target acceptance.

## Formatting / source identity

Prettier 3.8.1 exported the two own source files as data before the first R8
runtime run; read-only recheck passed. Both stages retained original inputs and
passed source/dependency/cleanup guards. The product output was byte-identical;
formatting the two new tests left all previous 33 test bodies unchanged.
**The two published source/test files are the exact executed R8 bytes.**

The fixed runtime package is base 783 plus explicit compiler/test overlays, not
a new full run of this PR's complete public ancestry or current main. The control
Component exactly matches the original executed R7 graph; the candidate has the
102-diagnostic graph below. No UI screenshot or browser acceptance is claimed.

## Reconstruct actual captured graph bytes — no project execution

Use the unchanged R6 and R7 records from public parent
[`c4d90c98`](https://github.com/Proto-UI/Proto-UI/commit/c4d90c98cc7814bdaa1cacc3862f13b06dc3cdeb):

```sh
python3 ../r7-owner-commit/reconstruct.py --base-record ../r6-owned-state-cell --output /tmp/vue2-r7-evidence
python3 reconstruct.py --base-record /tmp/vue2-r7-evidence --output /tmp/vue2-r8-evidence
```

Both output directories must be absent. These helpers use only Python's standard
library: they check existing artifact hashes and reconstruct bytes; they do not
run the compiler, generated code, tests, package installation or network calls.
R8 verifies seven base files and all eight outputs before writing. Its manifest
contains exact original-byte replacement spans; `Component.js.patch` is the
readable equivalent. The emitted and consumed Component bytes match exactly.
The full GeneratedModule changes only its one JSON-quoted Component code field;
the 215-entry strict program changes only that Component hash. Authored input,
consumer, Context support and portable strict request are byte-identical to R7.

All diagnostic fields and their order are retained. Only the four documented
R6 temporary path prefixes are normalized in diagnostics/program/request
metadata; inverse conversion was byte-verified. Generated source and authored
input are not normalized. This small carrier does not publish the private
execution environment or every other local capture; public tests preserve the
reproducers. It is not a mock emitter or a replacement strict check.

## Still open

- All 102 generated diagnostics: State 35, props 14, owner 14, Context 12,
  Expose 12, lifecycle 5, root VNode 5, authored-entry 5.
- General lawful legacy template-formal/helper projection, without new rejection,
  function-body erasure or runtime Template interpretation.
- Native SSR/hydration, ordinary mixed production consumers/browser validation.
- Reachable-only capability costs, factory/schema typing and complete backend
  acceptance.

Draft #1209 / #1055 continue; #1120 remains the only shared canonical shape
analyzer. This is not independent approval, ready-to-merge status or completion.
