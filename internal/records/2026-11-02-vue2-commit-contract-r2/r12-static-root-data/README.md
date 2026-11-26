# R12: eliminate an unreachable static RootData helper

This is a bounded WIP compiler increment, not complete Vue2/native/SSR acceptance.
Public parent: `7ba0f8dd4357dff8ade6d569ba16da92de2c627a` in Draft #1209.
Execution uses fixed `783ac833a77102365489d4050f7279c758114ec4` plus the
manifested overlays; the complete public parent/current-main ancestry was not run.

## Change and semantic boundary

Only `!ssr && !interactive` omits the generic RootData function. That path supplies
empty properties and fixed root-marker attrs, so its key loop cannot affect output.
`viewActive` is **dynamic**, not a proven constant; the initial flag is irrelevant
on this particular empty-property path. Each render still constructs a fresh
outer data object and fresh attrs object before native Vue2 `h`.

Interactive and SSR lowering retain the old helper. Five paired reached-event,
Image, Text and SSR-option **complete GeneratedModule outputs are byte-identical**;
the direct static case changes. No shared analyzer, public runtime, new projection
parameter, `any`/cast blanket, component-name dispatch or DSL admission change was
introduced. SSR-option assertions check emission, not a real SSR server or hydration.

The test-only loader permits the existing locked `@floating-ui/dom@1.8.0` only
when the three new event/Image/Text consumers opt in through the existing positioning
package resolver. The original 69 tests retain their default-deny loader behavior;
unknown dependencies still fail. No dependency or link was added.

## Actual final results

| Check | Control | Candidate |
| --- | --- | --- |
| Core | 72/75 | 73/75 |
| Original behavior | 11/11 | 11/11 |
| Original native controls | 37/37 | 37/37 |
| R11 identity controls | 20/20 | 20/20 |
| New root-data controls | 4/6 | 5/6 |
| Source strict | exit 0 | exit 0 |
| Original regression suite | 41/41 | 41/41 |

Control fails the direct helper-absence assertion, complete generated strict and
Text value assertion. Candidate removes only the first of these failures. Actual
event dispatch/update and Image root attrs/native style pass. **Both Text consumers
still report `''` instead of `'seed'`** after mounting; the complete assertion and
failure are preserved. This is a real newly exposed consumer defect, not another
dependency-loader error. It remains an explicit #1055 follow-up; no expected value
was relaxed and no component/module semantics were redefined.

Three separately compiled complete graphs retain all 215 program files and their
original strict options. Full diagnostic occurrence comparison includes category,
code, message tree/text, relative file, source line, UTF-16 column and span:

| Graph | Before | After | Common | Removed | New |
| --- | --- | --- | --- | --- | --- |
| Original consumer | 97 | 92 | 92 | 5 | 0 |
| Identity/arity consumer | 59 | 54 | 54 | 5 | 0 |
| Called-alias consumer | 60 | 55 | 55 | 5 | 0 |

Each removes the same three unused RootData parameter diagnostics and two unused
RootData property-shape diagnostics. These graphs remain **strict failures**.
This is not interactive RootData typing/style repair, and the three different
inputs are not a 97-to-54 improvement comparison. `diagnostic-comparison.json`
retains the removed occurrences; each graph directory includes complete before
and after diagnostics, final source graph, request and program inventory.

Every control graph was freshly reproduced and matched to its existing immutable
public carrier: the original graph to R10 reconstruction, and the two additional
graphs to R11. These byte matches are listed in the manifest/comparison, not
substituted for the new control execution. `paired-consumers.json` binds each new
actual input and both entire result hashes; the direct-root final result is also
included. All unit failures are retained in `all-unit-failures.portable.json`.

## Execution and formatting evidence

The initial attempt completed six phases, then the seventh entry resource gate
refused before source execution. Its combined gate did not record component values;
later resource snapshots cannot identify the original trigger. The stopped attempt
and raw stderr remain intact. A diagnostic-only runner then logged exact original
values/thresholds and monotonic sample intervals and completed only the remaining
four phases, without rerunning the first six or lowering a threshold.

All ten real receipts, 1,450 artifacts / 29,419,097 bytes and 14 root guards were
rechecked. Source/layout and all 105 locked dependencies remained clean; temporary
root bundles and strict scratch were empty. Reuse changed only three held-FD leaves
across the two existing subjects; no new full repository copy was created.

Official formatter export/recheck returned 0/0 before these final source bytes
were executed. Full formatting diffs were attributed; no new AST-comparator pass
is claimed. Earlier failed format/static candidates and the sole-JSDoc hypothesis
remain historical failures. The latter produced 59→55 diagnostics **with one new
style TS2322** and was not adopted. No spec file or public definition changed.

The adjacent R11 README now also names removal of the added `rmSync` specifier in
its inverse recipe; R11 source, raw results and historical commit remain unchanged.

## Cost and remaining work

Source-byte deltas are recorded for the actual emitted graphs. They are not final
bundle/link retention, initialization, GC, heap or timing measurements. Complete
callable/domain lowering, interactive typing, Text value ownership, native
SSR/hydration, real-browser/production mixing and the all-backend/operation matrix
remain unfinished. Keep #1055 open and #1209 Draft; no APPROVE, merge or deployment.

AI assistance: OpenAI Dots for cyjin-yl.
