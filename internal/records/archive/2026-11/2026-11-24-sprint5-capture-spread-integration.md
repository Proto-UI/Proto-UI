# Sprint 5 capture-spread IR reconciliation

## Reproduced source and owning layer

The unchanged complete ControlLabel producer at `packages/compiler/test/fixtures/gpui-control-label/produce.mjs` failed on the Sprint 5 integration baseline. Its first three entries, official Button, Label and Input, generated successfully. Its fourth entry, `input-delegate.proto.ts`, imports the complete official `asInputRoot` and reaches its `projectHandle(result)` implementation in `packages/prototypes/base/src/input/root.proto.ts`.

The error was `PUI2002`, “Object spread requires a checked ordinary record,” at InputRoot lines 273–287. The diagnostic's source span points into the official Input file; the failing entry is its actual delegated consumer. Compiling the default InputRoot export alone was already successful and is not a red case for this repair.

The baseline for the local comparison is `0605181b6ff3df3ed55ab48a955f592420800e29`, a descendant of integration baseline `1709cd31b1d44775cd9e441e8f217e37a40a526c` with only the separate SSR-owner work. Its parser, IR validator, official Input and native producer were unchanged from that integration baseline.

| Original source | SHA-256 |
| --- | --- |
| `packages/prototypes/base/src/input/root.proto.ts` | `851fabc3b1b9b859e5ee4a8888a27a03f415e3352180b86253163cc8ee4719fc` |
| `packages/compiler/test/fixtures/gpui-control-label/input-delegate.proto.ts` | `8d996c799344dc8d3bbc0d8ba6387d8cf607bb43bf310927207b797fa1b77f7c` |

The behavior is governed by the existing draft custom-handle and capture contracts, including `C-AS-HOOK-0009`, and the [capture-facade integration record](2026-11-23-compiler-capture-facade-integration.md). Their lifecycle is unchanged.

## Narrow shared repair

The source parser already used `checkedSpreadFields` to derive the finite public facade from checked capture contributions and to handle explicitly known nullish alternatives. The standalone IR validator retained an older `objectFields` call, which only accepts ordinary record/object types. The validator had the current capture-field derivation and helper import, but its object-spread branch did not use them.

The repair changes that one validator call to `checkedSpreadFields(value, captureFields)`. It independently re-derives the same closed field proof from the checked IR hook declarations. It retains the existing `spreadObjectField` handling for optional overwrite and getter copies and the existing getter-effect invalidation. Unknown values, opaque capture buckets and open index signatures do not become ordinary records.

There is no Input, ControlLabel, GPUI, component-name or path-specific admission rule. No authored source, generated Rust, target profile or native fixture was weakened or replaced.

## Producer result and complete input regression

The exact original producer command was run against a fresh output directory before and after the one-line repair:

```sh
node --import tsx packages/compiler/test/fixtures/gpui-control-label/produce.mjs \
  /absolute/fresh/output/directory
```

Before repair it exited 1 at the delegated Input's checked spread. After repair it exited 0 and generated all four original entries with `generatedRustEdited: false`. The output uses the producer's unchanged pinned GPUI revision `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`. This is actual complete source compilation and artifact production, not Rust typechecking, mounted native execution or physical input acceptance; those remain with the native consumer lane.

`capture-facade.test.ts` now also compiles the original default Input and its original full delegated consumer under both `gpui-source-v1` and `web-component-source-v1`, then independently validates their serialized IR. The delegated input must retain its actual `as-input-root` projectHandle. The tests do not substitute a simplified editor or remove the nested artifact spread.

## Full bounded comparison, including retained failures

The same six-file command was executed with the validator change, then with that one line temporarily restored to the baseline. The repaired line was restored after the comparison:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/capture-facade.test.ts \
  packages/compiler/test/capture-facade-runtime.test.ts \
  packages/compiler/test/capture-lookup-integrity.test.ts \
  packages/compiler/test/json-boundary-provenance.test.ts \
  packages/compiler/test/record-getters.test.ts \
  packages/compiler/test/record-getter-consumer.test.ts \
  --maxWorkers=1 --minWorkers=1
```

| Checked tree                                                         | Passed | Failed | Skipped |
| -------------------------------------------------------------------- | -----: | -----: | ------: |
| Baseline validator, with the two new complete-input regression cases |     64 |     40 |       0 |
| Repaired validator, identical tests                                  |     73 |     31 |       0 |

All nine changed outcomes are successes: the two complete-input target cases, six GPUI/Vue 2 projected null/string/number facade cases, and the public getter-forwarding IR case. The failure-title comparison found no newly failing case. Both record-getter files passed in both trees.

The **31 retained failures remain real unresolved integration debt**. They include an already existing `PUI1007` refusal of copied capture getter calls, which prevents several facade/runtime and forged-lookup tests from reaching their intended assertions, and existing outward-JSON provenance failures involving structurally narrowed hidden fields. Their baseline reproduction is retained; they are not relabeled as successful negative tests or covered by the producer's success. This repair does not claim that all capture facade, JSON provenance or Compiler tests pass.

A strict TypeScript program for the changed validator and test, using repository compiler options, resolved 451 files and reported zero diagnostics. Prettier and `git diff --check` passed. The integration handoff retains `owner-control-label-producer-red.log`, `owner-control-label-producer-green.log`, `capture-spread-baseline.log` and `capture-spread-green.log`. The last filename describes the repaired candidate, whose six-file suite still exits 1 as reported above.

## Tracking disposition

This completes the bounded shared-IR prerequisite for the original ControlLabel producer within Sprint 5's non-Web consumption work. The integration owner must record the merged source and producer receipt under the applicable #1144/#1056 child criterion. Native compilation/execution, the retained 31 integration failures, final Compiler gates, independent acceptance and the parent Issue conditions remain separately owned work.
