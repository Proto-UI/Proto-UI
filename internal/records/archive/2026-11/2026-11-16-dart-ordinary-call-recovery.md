# Direct Dart closure calls after the IR 7 integration

This repair follows independent local review R-CI-01 of the integration tree
`3cd3c5c8b836fa5350c792186c61ec7a82e8bd94`, subsequently committed with corrected
current IR guides as `f8389c8513b196c4287ffb58f599a1b56a7dacc4`. It restores the
existing direct emitter experiment. The Flutter registry profile remains
unimplemented; none of the evidence below establishes Flutter Widget or
NativeOwner lifecycle conformance.

## Failure and ownership

The four conditional fixtures introduced in the 2026-11-15 record were replayed
through the actual parsers and emitters on both integration parents. The original
author sources all emitted successfully on `6510b63696a4885a7cb20a3e9f1ff50daa5f1d42`.
Under IR 7, the evaluation-order case instead produced eight ordinary `call`
expressions and received eight `PUI4003` diagnostics from the Dart admission
check. The same author closures were previously represented as `helper-call`.
Changing their authorship or converting the positive assertions into unsupported
expectations would not restore the behavior.

Two other fixtures observed pure locals only from code appended after emission.
The compiler correctly removed those locals from its authored demand graph: the
Boolean case emitted an empty setup, and the non-Boolean case lost ten observed
bindings. The test premise needed correction independently of the call lowering.

## Bounded restoration

Checked `call` expressions now invoke ordinary typed Dart closures. The existing
checked callable signature supplies parameter and result representations. A
callee is evaluated once before its arguments. Optional calls evaluate arguments
only after the callee is known to be non-nullish. Omitted, explicit undefined and
void-valued optional arguments use the existing native optional carrier; a void
effect executes once before producing its undefined value. Ordinary void return
values likewise use the existing `NativeVoid` carrier. Optional function returns
are normalized through `nativeOptionalResult`, including a conditional returning
either a number or undefined.

Callable, lexical-cell and callable-union types are lowered only to native Dart
types. There is no new host helper, semantic interpreter, component identity
dispatch or target profile. `narrow`, `element`, `intrinsic`, `object-spread` and
`member-write` remain explicit unsupported diagnostics. Structural callable
records and capture types without a Dart representation are also diagnosed.
The existing default-parameter and checked-callback-parameter admission guard
remains in place.

The native fixture now appends real authored `def.expose.value` observations
before parsing. Typed observation ports retain those results in the demand graph
and collect the actual emitted values. The original four expected-result objects
are unchanged. The operation fixture still separately counts its three actual
void port calls. The ports are test doubles accepting emitted scalar values,
not a replacement claim for the complete generated owner.

Two additional native cases cover argument order, immutable aliases, omitted and
undefined arguments, effectful void arguments, nullable optional calls, callable
factories, optional results and thrown arguments. They assert complete expected
traces and values. A separate twelve-case ordinary test checks actual parsing
and emission plus the retained unsupported boundaries. Existing pointer-label
normalization and exception-flow tests now require successful direct Dart
emission for their ordinary calls; their original author cases remain present.

## Evidence status

Before the repair, the twelve-case focused check had eight passes and four
failures, all four positive cases failing with the expected `PUI4003` diagnostic.
After the call repair it passed twelve of twelve with no skips. The first
six-file affected run had 338 passes and four failures: the four existing tests
still asserting that every ordinary call was unsupported. After updating those
coverage expectations, all 342 cases passed with no skips. Selected strict
TypeScript checking of the implementation, admission and two new/updated Dart
test files also passed.

The real six-case Dart execution is pending at this source checkpoint. The
shared Box is reserved for serial native acceptance by the parent coordinator.
The final candidate must run with Dart 3.9.2; parser/emitter success and ordinary
unit tests are not Dart execution. Historical four-case results from November 15
do not certify this integrated source.

```sh
PROTO_UI_DART=/absolute/path/to/dart \
PROTO_UI_DART_EVIDENCE_DIR=/absolute/path/to/evidence \
  corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/flutter-conditional.native.test.ts \
  --no-file-parallelism --maxWorkers=1 --minWorkers=1
```

The independent pre-repair review, baseline and candidate emissions, local
red/green results and source receipts are retained by the parent continuation.
The author of this repair does not approve it independently.

## Independent review correction before native execution

Root review found that optional-call syntax on a definitely non-null callable
retains its original checked result type. The first repair instead treated every
`?.()` as possibly absent. The actual `call-arguments` output contained
`nativeOptionalResult<>` inside a `nativeProject<Object?, double>` branch, which
is invalid Dart. This was a source defect found before native execution, not an
SDK problem.

The emitter now uses the checked callee's null/undefined alternatives to decide
whether a short-circuit branch is needed, matching `checkedCall`. The new
generation assertion failed on the first repair (twelve passes, one failure)
and passed after this correction. The existing native `alias?.(...)` case is
retained to verify its actual result and argument trace with Dart. The original
repair commit and failed generation evidence remain preserved.
