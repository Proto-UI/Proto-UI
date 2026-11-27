# Sprint 1: finite rows captured by a canonical setup

Date: 2026-11-24 (Beijing). This is a bounded scanner repair and full-inventory failure record, not completion of the lowered-hook gate.

## Defect and repair

The scanner correctly resolved an imported finite literal array, then treated every identifier anywhere inside `definePrototype({ setup() { ... } })` as an escape through the factory call. A closed loop over that array consequently lost its row bindings. The same defect occurred when the canonical Core factory was imported under another name. The production token collector already emitted both expected variants from the same source.

`collectEscapedNames` now uses the existing source-backed `isAuthoredSetup` predicate to separate passing a canonical setup closure from passing all values mentioned in its body. `writeNamesOf` still visits the complete body independently: real member writes, returns, deferred writes and calls receiving the array remain disqualifying. A same-named local factory or an ordinary unknown callback owner does not receive this distinction. No function name, parameter type, token-map spelling or shipped-file exemption grants proof.

## Executed evidence

The new complete `lowered-authored-setup-rows.test.ts` file first produced **6 passed / 2 failed** against the unchanged scanner. The failures were canonical and renamed Core factories; the six negative controls already passed. After repair, this file and the existing complete token-map file passed **28/28**, exit 0, in 3.54 seconds. The positives assert actual collector tokens `data-[direction=left]:bg-primary` and `data-[direction=right]:bg-primary`, with both scanner exposure records. The controls preserve unknown calls receiving the array, returned arrays, deferred opaque calls, later member writes, a fake same-named factory and an unknown callback owner.

The complete unfiltered `lowered-hook-coverage.test.ts` then ran **199 cases: 198 passed / 1 failed**, zero pending/todo, exit 1, in 52.46 seconds. The original whole-inventory test kept its 240-second limit and still failed. Its exact received array contains **724 unresolved records across 109 files**:

| Reason     | Records |
| ---------- | ------: |
| subject    |     550 |
| comparison |      77 |
| intent     |      66 |
| condition  |      30 |
| spec       |       1 |

More complete row expansion can expose additional unresolved subjects. These counts are diagnostic records, not independently reproduced product bugs. The historical 684-record snapshot is retained but is not claimed as a same-input counterfactual for this current worktree. Assertions following the failed full-inventory expectation, including declaration provenance and shaped attributes, were not reached and are not represented as passing.

All commands used `corepack pnpm@10.32.1 exec vitest run` with the exact files named above, `--no-file-parallelism --maxWorkers=1 --reporter=default --reporter=json`. The [evidence manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-lowered-setup-escape/manifest.json) retains raw logs, complete result JSON, the parsed received array, and the four exact source/test snapshots and their post-run hashes. This is local worktree evidence, not a final committed-head or native-browser gate.

## Continuing work

Exported visual helper parameter origins, imported mutable token maps, remaining finite-profile and conditional forms, and the optional rule relay remain in the inventory. The repair does not certify these by type, erase their independent declaration rows, or replace them with an allowlist. A separate helper-call proof must preserve lexical identity, actual argument evaluation, every eligible call/use, unknown and escape boundaries, and independent rules before it can replace an unresolved parameter read.
