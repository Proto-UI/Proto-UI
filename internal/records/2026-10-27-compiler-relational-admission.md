# Compiler relational admission follow-up (#1019)

This is a dated migration/evidence record, not an independent normative source.
The proposed direction is cataloged in draft `C-COMPILER-RELATIONAL-0001` and mapped
by draft `T-COMPILER-RELATIONAL-0001`. Neither entity is a stable target guarantee.

The current user directed completion of unfinished Compiler work and delegated
portable semantic choices. The fixed source parent is
`d4c5587beb00ef058b72473b9b69bd85365e79e7`; the seven-path role
`DotCompilerRelational20261027` is recorded in
https://github.com/Proto-UI/Proto-UI/issues/1019#issuecomment-6439016041.
Its lease expires 2026-10-28T10:06:53Z, without automatic extension.
This does not reopen the closed issue or take over the frozen #902 IRv10 worktree,
#1022 C lane, Transition #1018 or CLI #1020. Merged #1021 fixed authored-hook
identity, not these relational semantics; #1023 is a separate Runtime type fix.

## Migration

The old shared inference accepted primitive mixed/nullish relations. GPUI chose
text versus numeric conversion from the left operand type and used Rust string
ordering. The bounded migration rejects mixed pairs and any invalid union pair,
through the same inference used by source admission and forged-IR validation.
Authors must narrow or explicitly convert both values to a chosen common kind;
there is no automatic rewrite and no new conversion API in this change.
Strict equality, concatenation, other arithmetic and portable-data nonfinite
rejection remain outside the semantic change.

GPUI classifies the shared primitive kind (including literal unions), binds both
operands once in order, and compares text via UTF-16 iterators. Numeric operators
remain direct ordered relations, including NaN false and signed-zero equality.
Rust literal encoding now processes original characters, preserving controls and
literal backslash-u text; authored lone-surrogate literals diagnose explicitly.
No Rust toolchain was installed or invoked. Dynamic host string transport is not
expanded or fully accepted by this slice.

Independent static review identified two defects in the first candidate: bottom
against null/boolean escaped GPUI emission as TypeError, and non-literal string
sites could retain lone surrogates which UTF-8 output replaces. Both reproduced
as 4 failed / 86 passed before repair. Bottom comparisons now retain an unreachable
expression with once-only operand evaluation, without reclassifying an empty
domain. All strings sent to the Rust literal encoder now share a diagnostic guard,
including record keys, members, type fields and configuration; any diagnostic
discards the entire generated module. Known owning source spans are carried into
diagnostics. The independent opaque hook registry still uses injective UTF-16
keys, which can represent lone surrogates without Rust strings containing them.
Tests check actual emission failure, successful output UTF-8 roundtripping and
two distinct surrogate hook keys; they do not claim Rust compilation.

A subsequent independent review found that the pre-emission walker also visits
DataType literal nodes, which do not themselves carry source spans. The typed
parameter case reproduced a diagnostic with an undefined span. The walker now
carries the nearest real IR owner span through arrays and schema children;
the regression requires every diagnostic span to belong to the parsed IR and
the parameter diagnostic to cover its actual annotation. PropIR spans currently
cover the descriptor rather than its key token, so the general checks verify
real owner provenance and source bounds, not a fabricated key position.
The expanded four-Web-consumer truth tables include numeric strings ('2' versus
'10') and internally computed positive/negative infinity, with all four operators;
portable-data rejection of nonfinite payloads remains unchanged.
Actual `diagnosticsJson` and text `formatCompilerDiagnostics` both threw while
reading `span.file` on the v2 candidate (3 failed / 103 passed with the new span
and formatter regressions). Their repaired paths must remain explicitly
unsupported and preserve source-backed diagnostics, not silently accept the type
or suppress the formatter call. No formatter source file is changed.

## Evidence and limits

The original two inference/data suites passed 19/19. The first new matrix against
unchanged implementation had 46 failed / 31 passed. After implementation, the
unchanged legacy null>=number acceptance assertion failed explicitly (1 failed /
86 passed); it was migrated to assert rejection rather than removed. These logs
remain in the source-bound review archive. New negative expectations originate
in the current semantic decision, not a claim of historical stable rejection.

The local consumer executes emitted WC and supporting modules with real approved
Floating UI resolved from its declared positioning owner. Transpilation is only
an execution harness; separate targeted TypeScript checking is required. Handwritten
expectations cover number, NaN, signed zero, string prefixes, UTF-16 ordering,
normalization differences, controls and effect order. Unsupported local function
declarations and helper literal argument widening encountered during fixture
construction are preserved as harness failures; they are not fixed by expanding
language admission.

React, Vue3 and Vue2 generated consumers additionally execute the same handwritten
matrix and effect-order probe with lock-pinned official packages, downloaded with
SHA512 verification and without lifecycle execution. Native Qt, Flutter and GPUI
emission checks are not runtime acceptance; native execution remains UNTESTED.
Standard spec authoring initially rejected this candidate's question/case ID
prefixes; those were repaired without changing criteria. Its remaining failures
are the existing P-BASE-SWITCH / C-FIELD-SWITCH-0001 and P-SHADCN-CHECKBOX /
C-CHECKBOX-LABEL-COMPOSITION-0001 relation-version mismatches. Preserve the actual
nonzero result, baseline graph comparison and separate scoped schema evidence;
do not call the repository catalog green. Independent review and hosted CI remain
separate. No UI appearance changes
or browser screenshots are claimed. Astro base-config and missing TypeScript
source-map warnings are retained in local test output.

## Design references

- [TC39 IsLessThan](https://tc39.es/ecma262/#sec-islessthan): UTF-16 code-unit order and numeric unordered behavior, not wholesale JS coercion adoption.
- [Dart String.compareTo](https://api.dart.dev/dart-core/String/compareTo.html): code-unit lexicographic ordering.
- [LLVM fcmp](https://llvm.org/docs/LangRef.html#fcmp-instruction): ordered/unordered distinction, not a backend implementation mandate.

AI assistance: OpenAI Dots.
