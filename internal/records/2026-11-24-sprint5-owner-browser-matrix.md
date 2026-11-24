# Sprint 5 private browser owner matrix and Vue initial graph acceptance

## Scope

This increment addresses concrete #896 owner initialization conditions without promoting either owner draft or canonical SSR admission. It adds a source-bound browser suite for React, Vue 3 and Vue 2, a matching simulated DOM preflight, and actual emitted Vue consumers for pending initial graphs. Native server renderers produce all HTML and carriers; the browser bundle contains the actual emitted source/support modules and real frameworks. No authored prototype substitutes for compiled output, and no native renderer, State or Context implementation is mocked.

At author freeze the physical nine-case Chromium run is **pending**. Source execution, actual generated artifact typing and runtime-plan discovery below are established. They are not physical-browser receipts. The draft mapping is `T-LIFECYCLE-OWNER-BROWSER-0001`; the original complete-target initialization requirement remains separate.

## Actual defects and bounded repair

The Vue ownership journey first adopts seed 3, updates to 7, withdraws/re-enters the view, disposes, then explicitly creates a fresh owner from the original carrier with current controlling seed 9. During that last adoption the parent validated its own server projection and immediately applied current Props. Its Context changed to 9 before child `0.0` validated the server projection of 3. This incorrectly rejected a valid input change and retired the native application.

A diagnostic-only emitter override retained the same control flow and added expected/actual projection to the existing error. It observed child `0.0`, expected output `3`, actual `9`, followed by complete native retirement. The raw observation is `owner-matrix-vue-projection.log`; it is diagnostic evidence, not a passing execution.

An initial repair deferred current Props until all initial records were accepted. Independent review then supplied another actual emitted consumer: a parent mounted callback legally updates shared Context to 7. The unchanged no-mutation control passed, while the mutating control rejected its child's initial projection. The observed order was parent created, parent mounted, then child created. This proved that delaying only Props did not cover accepted view callbacks. The original independent source and raw two-control result are preserved, as is the exact intermediate props-only archive.

The final private Vue session separates preparation from accepted physical commits only while its initial owner graph is pending:

- Setup and created run against source-bound server input. A present owner validates its initial projection after its parent's initial validation; this does not claim that its physical epoch is committed.
- Accepted initial commits wait until every original owner record is prepared. The existing parent-before-descendant order then delivers guarded resource mounts and mounted callbacks. Current Props use the existing watcher/update policy after initial validation.
- A pending native async descendant keeps the parent's accepted mounted/updated callbacks and current Props deferred. Successful resolution validates that child against server value 3 before applying current input 9. Terminal cancellation discards pending preparation, staged commits and Props, invalidates handles, and ignores late native resolution.
- Ordinary subsequent commits retain their existing per-task prepare/accept sequence. New views do not revalidate an already-accepted server epoch. Epoch, revision, activation, disposal and connected-root guards continue to reject stale work.
- Closing a session clears every pending collection before retiring acquired owners. A first falsy mounted failure remains the initiating failure even when cleanup also throws, and remaining initial callbacks are not delivered.

This does not define a new public cross-instance lifecycle order, widen carrier trust, change normal source/Adapter lifecycle rules, or admit a canonical SSR profile. It makes the private initial-adoption graph coherent before mutable accepted-view effects run.

Initially absent owners also complete their initial acceptance. Presence is checked after created; accepted absence can then apply current input and create a normal visible epoch. That later epoch must not compare itself with the accepted empty server projection. The first absence attempt missed this distinction and rejected visible output 9 against the absent record; `owner-matrix-absence-projection.log` remains in custody.

The complete generated Vue artifact closure also exposed a pre-existing strict-TypeScript defect in the encoder. Reassigning unknown input before a stored `Array.isArray` boolean lost TypeScript's later narrowing, producing TS2339 for `length`/`map` and TS7006 for `item`. A direct `Array.isArray(value)` branch preserves the same data check and ordinary narrowing. No cast to an admitted data shape, wider unknown allowance or data-boundary exception was added.

## Consumer observations

The three common ownership journeys directly compare four State handles and Context identities across a native wrapper and nested provider. Normal updates retain State; Context values propagate within their provider graph. Withdrawing a view retains the root owner but retires child owners. Re-entry creates distinct children; a held old-child callback refuses after release. Disposal invalidates State and public methods. Explicit fresh adoption accepts current seed 9, creates a distinct owner graph, and leaves old State terminal.

The three native mismatch journeys use real effects, watchers and event listeners. Rejection leaves no active probe, and old signals/events cannot trigger retired work. Explicit current input then succeeds. Vue-specific absence starts with an actual server absence comment and one record, then creates its visible graph. Vue-specific partial startup throws `false` from the child's native event consumer, observes parent initial value 3, checks retirement, and recovers with fresh input 9.

The ninth browser journey uses authored mounted and updated callbacks to change Context from 3 to 7 to 8. All initial descendants must be created before the first accepted mounted effect; the original DOM and distinct owner identities survive. An ordinary controlled update to 9 still propagates afterward. This same journey is preflighted in simulated DOM; physical execution remains pending.

Five additional actual Vue source consumers cover inert and mutating commit controls, native async-descendant release with current Props, cancellation before graph acceptance, and a falsy mounted failure with secondary cleanup failure. These use actual Vue async setup/Suspense and actual emitted modules in happy-dom, not a scheduler or owner substitute. The inert control checks per-owner lifecycle order without inventing a new ordinary cross-instance promise. Intermediate source assertions and all counterfactual outcomes are retained.

Readiness observes actual handles, rendered output and passive cleanup; a root handle alone does not establish nested commit completion. Early setup and fixture failures are retained: a wrong bundle dependency directory, premature nested React handle/paint reads, and premature passive cleanup observations. Exact-parent replays use the final unchanged corresponding assertions, so those fixture errors are not counted as product defects.

## Verification at author freeze

| Check | Actual result |
| --- | --- |
| Matrix preflight and complete Vue artifact strict check | 10/10 pass: nine actual bundle journeys in happy-dom and one complete artifact typecheck |
| Initial graph source consumers | 5/5 pass |
| Existing affected Vue source, Context and adoption suites | 22/22 pass |
| Final combined source result | 37/37 pass, no skip, exit 0 |
| Original independent mounted controls with the repaired sources | 2/2 pass, simulated DOM |
| Exact props-only source/support under original independent plus final graph controls | 2 pass / 5 expected fail; both inert controls pass, while Context mutation, pending-graph mutation and premature initial commit remain observable |
| Reviewed parent source/support under final ten matrix assertions | 5 pass / 5 expected fail: fresh Context adoption, absence, partial-startup recovery, mounted/updated Context and encoder type errors |
| Changed production modules and strict dependency closure | 329 files, zero diagnostics |
| Earlier broad fixture/production dependency-closure typecheck | SIGKILL / exit 137 before diagnostics; not a pass, no cause inferred |
| Final actual Vue request/data/held-serializer subset | 22 pass; 65 other target cases deliberately filtered |
| Prior canonical SSR refusal subset | Four selected tests pass; 83 other cases filtered |
| Runtime planning/discovery | Existing 134/134 controls pass; registration unchanged, one browser owner, excluded from general phase |
| Catalog authoring | Same validator via `node --import tsx`: two changed inputs against `c99a224ad2` pass, including the prior reviewed request-owner mapping and this new draft |

The first catalog invocation through the `tsx` CLI stopped before validation because this local executor refuses its Unix IPC socket. That raw EPERM is retained. Running the same validator through the Node import loader, which does not require the CLI socket, completed successfully.

The emitted artifact strict test covers the complete generated Vue support closure. The limited 329-file source program checks both changed production modules without claiming the killed broad source check passed. Full integration type gates remain required.

The runtime planner assigns the browser suite dynamically. In this author tree it is registered once in shard `16/18`; integrated inventory changes may rebalance that position. The physical runner retains sandboxed Chromium, actual HTTP delivery, source/artifact/framework hashes and per-case JSON/PNG output. The five source controls also remain part of the ordinary source inventory.

## Reproduction and custody

The final affected source command is:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/owner-hydration-matrix.test.ts \
  packages/compiler/test/vue-owner-initial-graph.test.ts \
  packages/compiler/test/vue-owner-hydration.test.ts \
  packages/compiler/test/vue-context-source.test.ts \
  packages/compiler/test/vue-source.test.ts \
  --maxWorkers=1 --minWorkers=1
```

The physical successor is:

```sh
COMPILER_EVIDENCE_DIR=<absolute-evidence-directory> \
  corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/owner-hydration-matrix.browser.test.ts \
  --maxWorkers=1 --minWorkers=1
```

Raw failures, controls, exact-source substitutions, source/artifact typing, request subsets, runtime ownership and catalog output are in `evidence/2026-11-24-sprint5-owner-browser-matrix/author.tar.gz`. The adjacent manifest binds each entry and final source. It also retains the exact intermediate props-only archive, SHA-256 `2af247e2f3f152d870cfa9e32fbea2c91a8c0b988489855c0235bd70c36550a0`, instead of rewriting its history as a complete repair.

The reviewed-parent substitution uses exact Vue files from tree `95576086dfad30c721b95dff5e97d4d103ba6be8`. The second substitution uses the exact intermediate props-only Vue files reviewed before the mounted finding. Both are read-only two-module counterfactuals over the same authoring environment, not claims that every file in those earlier trees was rerun.

This patch contains only the new Vue initial-graph/type correction and matrix/evidence additions. Previously integrated Vue native retirement and React recovery are the comparison baseline; their historical changes are not reapplied. Root integration must validate the resulting final checkout and actual producer/artifact closure.

## Remaining acceptance boundary

Independent final-source review and the nine-case sandboxed Chromium receipt remain pending at author freeze. These trusted fixtures do not establish application authentication/provenance, complete compiler/helper/request compatibility governance, arbitrary runtime-State migration, all native platforms or every per-target/assistive-technology route. The original complete conditions in #895/#896 remain separate. Canonical SSR stays explicitly unsupported and both owner specifications remain draft.
