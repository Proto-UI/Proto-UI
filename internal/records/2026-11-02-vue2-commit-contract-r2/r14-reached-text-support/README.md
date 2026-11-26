# R14: reached Text support and explicit directory migration (WIP)

**Explicitly migrated new output directories pass the old/new combinations. Untouched old directories remain separate and are not made compatible automatically.** Migration is an explicit user operation, only for the exact verified legacy/current support formats below. This is a bounded solution to the reproduced R14 mixed-version blocker, not full compiler completion. R13's separate CSR value change is excluded.

## Actual acceptance and failures

- Final formatted compiler/source test graph: **strict 0**. Original 75 plus five R14 controls: **78/80**, with the unchanged full-generated-strict and Text empty-value-versus-seed failures. Original independent Vue2 regressions: **41/41**. Existing CLI28/output6: **34/34**.
- **Separate actual process entry: success exit0, wrong trust anchor exit1 with no output directory, missing-output usage exit2.** All69 successful output files exactly match the previously verified handler output; original8 input directories and Component/map bytes are unchanged. See [process-entry.json](migration/process-entry.json).
- **62/62 migration acceptance tests** use the real production `runCompilerCli(argv, environment)` handler, write actual output directories, and resolve normal filesystem imports in real Vue2/HappyDOM consumers. The normal test invocation requires no external corpus variable. One archival capture-only test is unselected, not a skipped migration acceptance case.
- Nine official format exports/checks are **0/0**, and those exact formatted bytes were executed afterward. The unchanged capability test was already formatted and is included in the final80.
- Complete original generated graphs still contain **92/54/55 diagnostics**, 215 program files each. Every diagnostic/message/source-line/UTF16 span and full normalized request/program matches the previous actual R14/R12 graph; nine generated source files match bytes. Four identity formal-type records also match. Counts alone were not used as proof.
- The actual additional Text graph remains **62 diagnostics / 217 program files**, versus the original107/221. Its complete input/GeneratedModule is byte-identical to the earlier actual Text strict probe, so that complete red result remains applicable; it was not rerun or relabeled green.
- Both SSR inputs and whole GeneratedModule results match previous R14/public R12 bytes. This is emitted-artifact equality, not real SSR or hydration acceptance.
- Historical old/new misrouting, canonical-op TS2367, the collection-name mismatch with no unit execution, and the initial60/62 evidence-label failures remain recorded. Only the evidence label casing changed for the latter two cases, after their correct rejection assertions; no product assertion or input was removed.

## Ordinary CLI entry and plan

This is the repository's private compiler source entry, not a published package binary. With the repository's pinned development dependencies:

```sh
node --import tsx packages/compiler/src/cli-entry.ts migrate-native-support ./plan.json --output ./cohort --json
```

[example-plan.json](example-plan.json) is a minimal two-entry example bound to the checked fixture's actual old Trigger and final Text manifests. Its directories are relative to the plan, and its SHA values apply only to those exact fixture outputs:

```json
{
  "version": 1,
  "inputs": [
    {
      "id": "old-trigger",
      "directory": "./old-trigger",
      "provenanceSHA256": "ad08f3ae5d9f9ae98c6fec357fac5442a8ed0babcea7d8bd15e06abef03cf664"
    },
    {
      "id": "new-text",
      "directory": "./new-text",
      "provenanceSHA256": "3cb13c24ed226d8b0a6d724e8f5823b3631c850d4d8dd22e91754e183dcc276c"
    }
  ]
}
```

For other trusted outputs, supply SHA-256 anchors from an independently retained successful compilation/provenance record. Do not bless unknown or modified files merely by hashing their current manifest. The complete byte inventory, artifact kinds, profile/dependencies, paths and known support SHA/ABI are validated before output creation. The current recognized legacy native/adapter SHA values and actual old source identities are in [old-fixture-provenance.json](old-fixture-provenance.json). Unknown versions or user-modified helpers are rejected, not guessed.

A successful call creates a fresh cohort. Import `./cohort/old-trigger/Component.js` and `./cohort/new-text/Component.js` normally; their original support import paths resolve through compiler-produced relative export facades to one shared full helper/ownership instance. Original input directories and all Component/source-map bytes remain unchanged. Move the whole cohort together: whole-directory relocation and nested output paths are tested; moving a single component subdirectory away from its shared support is not promised. Existing compile/watch/diff create-only behavior remains covered by the unchanged regressions.

## Three distinct consumer groups

1. **Untouched old independent directories:** preserved baseline behavior, including separate-registry misrouting and Boundary/Modal interference. These are not described as compatible.
2. **Explicit old shared-support assembly:** test-only old support and byte-identical old components/maps are assembled with relative facades. This reproduces the shared old-instance baseline; it is not original independent CLI output.
3. **New directories produced by explicit migration:** actual handler output passes old/new and new/old Trigger/Text and Boundary/Modal combinations, both relevant owner orders, same-version controls, and whole-cohort relocation/nesting. Separate process-entry evidence is reported distinctly from these handler tests.

The sole-instance negative controls duplicate only the full-helper instance while retaining the shared ownership module. They expose double Boundary closure and early Modal body-lock release. Other controls cover unknown/resealed/changed/missing/extra inputs, empty extra directories, symlinks/ancestors, path/case/ID conflicts, dependency versions, trust anchors, fresh-output conflict, partial-write rollback and preserving a foreign replacement. Rejection does not produce a usable half-migration. The original create-only writer and ownership-aware rollback are reused rather than weakened.

## Reached support and honest costs

Canonical checked operations and declarations choose the Text support/tag at compile time. The selected emitted Text file does not scan declarations, select a capability at runtime, invoke either full factory, or read prototype/IR. Required owner lifetimes and real edit/event/cleanup semantics remain. Renaming and dormant-operation controls prevent component-name/path dispatch; reached broader families retain their still-unfinished support.

Pure Text's narrow interaction sources total **19,236 B** (Text15,007 + ownership4,229). The broader full-family interaction source remains **172,804 B**, **1,077 B larger** than the old universal pair. Shared ownership still allocates three containers unused by pure Text. Migration additionally retains provenance manifests and introduces local facades/new directories; the original directories stay on disk. The full-family broad layer is not declared removed, and omitted unchanged helper snapshots are not evidence of removal.

The emitted modules disclose actual target dependencies. The Text-only graph no longer reaches Floating UI, while reached full/geometry families retain **Vue2.6.14** and **@floating-ui/dom1.8.0** as required. Tests use pinned HappyDOM15.11.7, TypeScript5.9.3 and esbuild0.25.12. Consumer bundle metadata is diagnostic, not an optimized production-retained measurement. No final bundle/link, heap, timing or initialization saving is claimed.

## Evidence and remaining work

[execution-results.json](execution-results.json) retains selected commands, all case names/statuses, current full failures and ten exact tested source/test/fixture hashes. `migration/` retains all97 selected top-level project records, 24 normal-import consumer traces/bundle metadata and source hashes, rejections and rollback. Random fixture directories have distinct consistent portable labels; original full local evidence remains unmodified. No bundle code, old broad helper duplicate or execution-platform records are included.

`strict/` and `text/` retain full diagnostics/program hashes. [source-cost-and-imports.json](source-cost-and-imports.json) gives actual imports and source bytes, eleven compilation results and two complete SSR identity proofs. The old fixture keeps12 captured component/map/provenance files exactly; its CLI directory metadata was normalized and is not claimed raw-byte-identical. Normal tests reconstruct omitted support only after exact captured SHA checks, never by using the new emitter to fabricate old component code.

Fixed execution base `783ac833a77102365489d4050f7279c758114ec4`, final tested tree `9f68a24dbe9ce444c78a1b52dfac3bd39ab91e32`, public parent `91c63aa7d4344a2d9130b3fabb737f4670f0aa68`. The complete public ancestry/current main was not executed. Source formatting is followed by final verification, not substituted for it.

**Keep Draft and #1055/#584 open:** remaining generated types, Text value ownership, complete callable lowering, broader-family runtime removal, all operation-family/backends, native browser/production mixing, SSR/hydration and final costs remain unfinished. No Ready, APPROVE, merge, deployment or broad Issue closure. AI-assisted contribution by dot for cyjin-yl.
