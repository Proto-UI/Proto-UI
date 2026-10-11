# Passive DataTable HeaderRow successor

Date: 2026-10-10 UTC. Parent source: `fabf2d2b2e971060243e3843df7dde91d27e4440` / tree `dfbdb76745607db116c8c98ba3210892599ec591`. This is an independent append candidate; the previously frozen/uploaded 45-change candidate tree is unchanged.

## Failure and semantic decision

Official run 38054606599, browser shard 8 job 114221022341 logs repeated `as-trigger` sibling-branch rejection in DataTable Header setup during committed-host-readiness. The checkout source was 3023289e589126e503e5ff16229eed662e9cb565; the publication owner verified its complete tree equals the fabf tree above. The source-map stack line 266 corresponds to raw source line 336. The shard ended after 900 seconds with exit 124 and no final test count. This establishes a real page error, not that this error explains every timeout or proves pixel output.

An exact-source two-column WC fixture reproduces the same failure on fabf and the next candidate tree `ebe17788fc6ecf83cab342b7e55456896e382daf` (a tree object, not a commit). Each run has one failing mount expectation and three passing normal/boundary controls. The original feature commit `52110aad4604d8fe1f6f51c461ff859b0772f4b5` also fails that two-column case. Trigger rejection predates that feature via ancestor `75ef16a76a563b8f736680eed731e81a0acf9fed`.

The cause is prototype composition: DataTableRow unconditionally declares Trigger even with `header=true`, and two directly nested Header controls each declare Trigger. Existing smoke tested only one Header. `C-AS-TRIGGER-0001-L` and `HC-TRIGGER-GROUP-0001-B` require rejection of this branching. These entities remain draft; no Runtime or Compiler exemption is justified.

The owner approved a static structural identity after independent proposal review. It explicitly inherits `P-BASE-TABLE-ROW`; the draft `D-BASE-PROTOTYPE-INDEPENDENCE-0001` boundary is disclosed as protocol derivation rather than treating a renamed protocol hook as a generic substrate. The public `defineAsHook` helper receives the compatible Table Row definition, owns its setup/capture/once-policy/lifecycle, and the consuming prototype returns the inherited render fragment. No direct `tableRow.setup(def)` call occurs.

## Implemented boundary

Five `DataTableHeaderRow` entries share the existing Table Structure row role. They do not claim a DataTable collection row, create a rowKey context, or own selection, focus or Trigger. Public Props and Exposes inherit exact `Record<string, never>` shapes. Four styled projections add only their own existing static DataTable row recipes. Shared package-root exports, CLI and Previewer integration belong to the separate integrator; exact names/IDs are in the adjacent manifest.

Five real DemoSpecs and ten bilingual DataTable docs now use/document the static header container. Legacy `DataTableRow.header` still changes its runtime record-slot policy, selected state and focus policy; it does not withdraw its setup-time Trigger identity and remains unable to contain multiple direct Trigger children. The retained negative test rejects that old topology. This migration does not claim the legacy topology is repaired or silently freeze its dynamic prop.

## Evidence and limits

- New source fixture: 15/15 actual-WC/Happy-DOM tests across five families. It checks two-header pointer/Enter/Space sorting once per request, root-controlled refusal/synchronous and later canonical updates, disabled and existing readOnly policy, body-selection isolation, collection count, no HeaderRow exposes/Tab/activation, current Table topology and opaque header refs, terminal disposal/rebind, reordered header children, empty authored state capture, missing Button child, and five migrated DemoSpecs using exact local exports.
- Static recipe observations compare HeaderRow with the static tokens of its family's ordinary row and verify body selection does not alter HeaderRow tokens. A first assertion compared the whole token list and correctly failed on four families because ordinary rows also carry conditional focus/selection selectors; it now explicitly excludes only those selectors and separately asserts none are present on HeaderRow. This is not computed CSS or upstream visual equivalence.
- Combined source run: 55/55 across the new fixture, Table tests and existing collection compositions/projections/hook contracts. Scoped TypeScript passes, rejecting arbitrary HeaderRow props and treating unknown child-handle fallback as a Button. The fallback lookup itself remains legal; it returns unknown and is not falsely asserted to be a key-rejection API.
- Type-checking initially caught optional getAsHookHandle calls; the fixture now verifies the real method exists and uses the public optional signature without casts or widening.
- The original `pnpm check:spec-authoring -- --base fabf...` entry failed before validation because the tsx CLI could not create `/tmp/tsx-1000/40.pipe` (listen EPERM). The owner authorized the documented installed `node --import tsx` entry for the exact same script and argv, without permission changes, source changes or rule disabling. The initial equivalent run caught authoring defects (T case IDs lacked CASE prefixes and the new T entity lacked lifecycleRationale); these were repaired. It also found three unmaterialized GPUI test paths in this sparse worktree. Each exists in the exact parent Git tree; only those same-HEAD blobs were materialized under owner authorization, without changing native source or executing Rust. The original CLI IPC failure remains recorded; The final equivalent command exits 0 and checks all six changed catalog inputs. This is a distinct verified entry result, not a claim that the failed pnpm/tsx CLI invocation passed.
- New catalog identities remain draft. The broader DataTable catalog gap, independent implementation acceptance, actual shared registry/CLI entry checks, real-browser matrix/screenshots, compiled/packed/native and upstream visual acceptance remain open. Local DOM facts are not any of those acceptance results.

Commands:

```sh
./node_modules/.bin/vitest run packages/prototypes/base/test/data-table-header-row.test.ts packages/prototypes/base/test/table.test.ts packages/prototypes/base/test/finf-collection-compositions.test.ts packages/prototypes/base/test/finf-collection-projections.test.ts packages/prototypes/base/test/finf-collection-hook-contracts.test.ts --maxWorkers=1 --minWorkers=1
./node_modules/.bin/tsc --noEmit -p packages/prototypes/base/test/tsconfig.data-table-header-row.json
node --import tsx scripts/spec/check-lifecycle-authoring.mjs -- --base fabf2d2b2e971060243e3843df7dde91d27e4440
```

Publication disposition: `gh auth status` exits 1 with no authenticated GitHub host. Per the current owner instruction, no direct local `git commit` fallback is used; the final staged tree, binary patch, prepared DCO message and test evidence are handed to the authorized publisher for its real connected-service process. No commit or normal commit-hook success is claimed for this frozen source packet.

Environment: Node 24.19.0, fixed offline pnpm 10.32.1, installed Vitest 2.1.9, one worker. No new dependency/version, external publication, browser sandbox bypass, lifecycle promotion or checklist completion accompanies this slice.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
