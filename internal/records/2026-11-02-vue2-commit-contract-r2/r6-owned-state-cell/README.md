# WIP native Vue2 product checkpoint: strict and legal-helper regression remain red

This is the next bounded product/evidence checkpoint for [#1055](https://github.com/Proto-UI/Proto-UI/issues/1055), continuing [Draft #1209](https://github.com/Proto-UI/Proto-UI/pull/1209). It is **not merge-ready or complete compiler acceptance**. The parent record preserves the original r2 reproduction and all167 diagnostics unchanged. This versioned child records later actual R6 output; it does not rewrite that history.

## What the code now does, and what it does not

The local tested product prepares authored values in original call/evaluation order and publishes compiled native Vue2 paint functions only after successful authored evaluation. Exercised client inputs use native `h` at compiled sites with current native slots; canonical compile-time lexical/shape facts come only from the existing #1120 analyzer. Actual helper identity, repeated calls, lazy branches, failed publication retention, ViewIntent, KeepAlive, custom-tag `pre:true`, primitive text normalization and terminal cleanup retain their source-bound controls. Native state/props/lifecycle facilities are not an IR evaluator.

R6 adds a generic private owned-state cell contract for value/event/subscriber/disposal/notifications. Original family checking, setup authority, frozen spec and validation order remain byte-identical. This does **not** establish the still-implicit factory/config relationships or all state family types. The separate interaction queue is not in the recorded non-interaction strict graph.

**Known legal-input regression:** an uncalled helper whose identity is observed and whose checked parameter is the legacy `template` umbrella is still rejected by the new lowerer. The test expects valid native generation and stays red; no skip, new unsupported assertion, function erasure or throw stub masks it. The original product accepted this case. Generic private projection work is unconnected and not represented as a fix.

**Known unfinished SSR:** `ssr:true` still uses the old template walker/carrier. SSR-option source tests are not server/hydration acceptance. A same-source native versioned committed-input carrier and real pinned server/hydration/cleanup evidence remain necessary. No new renderer dependency was installed.

## Exact executed evidence

Executed base `783ac833a77102365489d4050f7279c758114ec4`; control tree `b25a1d925a4a49d6d8bcd49fcc6a8d0c3cabbb9f` (R5 product with the same new tests), candidate tree `d15cb53aa92177a56d7d6dad798e4de2485c8627`. All five delivered source/test files are byte-identical to that candidate; original r2 test is already identical in the preceding commit. Publishing these bytes on the existing PR parent is a static source-preserving continuation, **not execution of the resulting publication commit or current main**.

2026-11-02 12:22–12:27 UTC, both variants independently ran collect, source-strict, core unit, regression collect and regression unit: ten stages in total.

| Check | Each actual variant |
|---|---|
| Core collection | 43 exact; no skip/todo |
| Original behavioral cases | 11/11 pass; original r2 file12 cases/43 expect sites unchanged |
| Native controls | 30/31 pass; legal legacy-template-formal case fails |
| Full actual generated graph strict | Fails: control143 / candidate134 diagnostics |
| Separate source-strict, actual four tests plus imported compiler graph | 0 diagnostics |
| Independent existing Vue2 regression group | 41 collected and41/41 pass on each tree |
| Source/dependency/evidence guards | All ten terminal receipts clean |

Three native cases are expected rejections for currently unsupported Vue2 operations, not implemented native abilities. The four new state consumers pass on both trees: family defaults/validation and explicit commit versus live slots; subscriber snapshots/reentry/queued work after throw; admitted structural extra fields; cleanup failure across cells and terminal handles. These are bounded actual consumers, not exhaustive family acceptance. In particular, bool covers initial/default/paint, not invalid bool mutation.

Full strict delta is **134 common /9 control-only /0 candidate-only** by normalized filename, code and complete message multiset; all134 common sites also match source line and inline diagnostic span. The nine reports concern owned-state array/queue and cell parameters, not nine independently established product bugs. Remaining134 are state35, props36, owner24, Context12, Expose12, lifecycle5, root VNode data5 and authored-entry5. Do not turn the zero-diagnostic assertion into a count assertion, filter errors, add any/no-check shims or edit captured output.

Control Component SHA256 `c6880443aa8f4223c68757e3fc83777c9024b756ef1b0089f0d83a28311cbeda` equals R5 candidate exactly; candidate Component SHA256 `fe8b34cb17bd975bc3e447a01077a522eceeb4757a92edf3af0eab7f5e2617b5`. The manifest binds actual sources, toolchain, every delivered artifact and all raw/portable diagnostic hashes.

The isolated runner used unchanged105 locked packages, cleared environment, no real account credentials, network syscall denial, per-child source/dependency pre/post checks and fresh cache/scratch/output. An earlier inode gate stopped before any project source executed; its exit1 and logs remain retained. Recovery restored resources without lowering the gate or changing source. All1,182 actual artifacts/20,804,830B were hash-verified locally. This small public carrier supplies the complete original strict graph and raw GeneratedModule, not every runtime capture or a publicly hosted full sandbox archive.

## Reproduce the real compiler/consumers

Use an authorized isolated checkout with Node24 and the repository's frozen lockfile installation (measured Node24.22.1, TypeScript5.9.3, Vue2.6.14, Vitest2.1.9, Happy DOM15.11.7). Vue2 resolves through its actual adapter package, not root Vue3.

```sh
node node_modules/vitest/vitest.mjs list --config vitest.config.ts \
  packages/compiler/test/vue2-native-template-commit-contract.test.ts \
  packages/compiler/test/vue2-native-template.test.ts \
  --pool=threads --maxWorkers=1 --minWorkers=1 --disableConsoleIntercept

node node_modules/vitest/vitest.mjs run --config vitest.config.ts \
  packages/compiler/test/vue2-native-template-commit-contract.test.ts \
  packages/compiler/test/vue2-native-template.test.ts \
  --pool=threads --maxWorkers=1 --minWorkers=1

node node_modules/vitest/vitest.mjs run --config vitest.config.ts \
  packages/compiler/test/vue2-native-this-boundary.test.ts \
  packages/compiler/test/vue2-state-reachability.test.ts \
  --pool=threads --maxWorkers=1 --minWorkers=1
```

For optional bounded capture, set `PUI_VUE2_CONTRACT_EVIDENCE_DIR`, `PUI_VUE2_NATIVE_EVIDENCE_DIR` and `PUI_VUE2_REGRESSION_EVIDENCE_DIR` to separate absolute empty self-owned output directories. Captures use real authored/checked inputs, actual GeneratedModule/support, full strict options/program/diagnostics and separate explicit negative mutations before cleanup. These shell examples alone do not reproduce the measured network/resource sandbox or the separate source-strict program.

`graph/*.txt`, `authored.proto.ts.txt` and `actual-generated-module.json` retain original bytes; the `.txt` suffix avoids feeding a recorded graph into default source checks. All three portable JSON files differ from raw artifacts only by four declared absolute path-prefix substitutions; inversion was checked byte-for-byte, with no removed field, error, order, option or program hash. The portable files are evidence, not executable root-name configuration. The real test reconstructs actual paths and target declarations.

Real-browser/ordinary production mixed consumers, complete generated strict, legal-helper repair, same-source native SSR/hydration, reached capability cost pruning and retained bundle/init measurements remain open. The independent static review of the cell slice is not a technical APPROVE or acceptance of the entire product. Keep Draft and preserve all original failures. No screenshots are claimed for these logic-only Happy DOM tests.
