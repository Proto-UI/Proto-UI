# Issue 889: failure visibility and remaining acceptance

Date: 2026-11-10. Assigned source: `0607c6c5c386b8a932ab850e92a8873b2121dc45`, branch `fix/release03-thirty-issue-889-sol-20261110`. This is a source and evidence handoff for [#889](https://github.com/Proto-UI/Proto-UI/issues/889), in human-assisted/current-user mode. Product execution, independent review, publication and integration belong to Main. No product checks were executed while preparing this candidate.

The live Issue is open. Its six discussion comments and empty second page were read. The 2026-11-06 deferral comments remain history; the current assignment resumes this bounded work without changing the original acceptance conditions.

## Existing source and authority

All five confirmed production fixes are already present in the assigned base. This change preserves that source and adds missing release-consumer controls. It does not introduce another production implementation.

| Original class | Current source and executable consumer | Governing boundary |
| --- | --- | --- |
| RA.A1 | `packages/modules/anatomy/src/impl.ts`; `packages/runtime/test/contract/anatomy.order.v0.contract.test.ts` | Draft `C-ANATOMY-0009-E`: retain synchronous return/error and the target callback scope. Normal `undefined` return remains normal. |
| RA.A2 | `packages/runtime/src/orchestrator/module-orchestrator/runtime-module-orchestrator.ts`; `packages/runtime/test/module-teardown-errors.test.ts`; `packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts` | [Explicit maintainer decision](https://github.com/Proto-UI/Proto-UI/issues/889#issuecomment-6471711319) and `ModuleWiring.reset`: attempt every module, then rethrow the first failure unchanged, including falsy values. A throwing listener still stops later listeners within that vault. Draft `HC-PROPS-SOURCE-0001-B/E` governs the actual Props subscription. |
| HT.B1 | `scripts/release/lib.mjs`; `scripts/release/publish.mjs`; `scripts/release/test/publish-subprocess.test.mjs` | `internal/governance/release-workflow.md`, publication policy: startup/signal failure is not normal zero exit. Abnormal publication cannot enter the dry-run exemption or automatic rate-limit retry. A lost publication outcome requires explicit reconciliation. |
| HT.B2 | `packages/adapters/base/src/host/adapter-host.ts`; `packages/adapters/base/test/adapter-host.test.ts` | The existing shared host reports synchronous `afterUnmount` failure with an explicit presence flag, preserves Runtime's primary failure, and returns the retained disposal promise after one cleanup. Draft lifecycle G/J/K remain bounded. |
| HT.B4 | `packages/adapters/base/src/material/source.ts`; `packages/adapters/base/test/web-material-source.test.ts`; `packages/adapters/base/test/web-material-source-independent-review.test.ts` | The notifier retains the first arbitrary failure while attempting the listener snapshot; withdrawal precedes notification. Paint's initiating failure survives secondary notification failure. Draft `T-WEB-MATERIAL-PROVIDER-0001` does not establish GPU/native acceptance. |

The Issue already checks RA.A1, HT.B2 and HT.B4. Its unchecked RA.A2 and HT.B1 now have implementation and tests in this base; those source facts do not supply a fresh execution or an Issue-state mutation. Historical combined evidence for 198 tests belongs to `b57ecac5351827a8d38e4d26f41288e67b50274e`, not this candidate.

## Release test increment

The existing subprocess fixture restricts PATH to the existing Node executable and explicitly authored local children. The added cases exercise normal exit 0/7, single-attempt success, failure without rate-limit retry, the normal already-published dry-run exemption, its rejection outside dry-run, successful retry and the configured retry bound. Four actual command invocations reject invalid workspace/only/tag/recovery selections before staging.

The non-dry-run helper case selects the publication branch through an owned Node executable named `npm`; an actual registry client is absent. It proves classification of that child result, not a real publication or registry recovery. The existing missing-executable and signal controls remain intact. Together the file declares 16 POSIX cases; Windows is explicitly skipped by the existing fixture. Collection and results must be reconciled by Main.

### Source-only retry discriminator

While preparing the normal-child controls, source inspection found a further HT.B1 acceptance hypothesis. The loop currently requires `publishResult === null`, then stores a non-null result for a normal rate-limit failure before the permitted retry. [INFERENCE] The next iteration is skipped, `stagePackage` returns publication code 1, and the CLI can finish with exit 0 because it only checks `buildCode` afterward. This has not been executed or reported as a confirmed incident. The new retry-success and retry-bound cases deliberately discriminate this condition; they must not be weakened if the current source fails them.

The local packet contains an unapplied one-line candidate changing the loop condition to `publishResult?.code !== 0`, plus a separate proposed source copy and SHA manifest. A prior successful integrity-recovery result still skips publication, normal success stops, normal retryable failure can reach its existing finite bound, and abnormal startup/signal still throws before retry classification. This proposes no new retry policy and no automatic retry of an unknown external write. Main must execute the current before producer first, then validate/admit the proposal against the exact preserved preimage before applying any production change. The assigned production worktree is unchanged.

The first divergence to observe is the release owner's result admission: a native missing command has `pid: 0`, `status: null`, and `error.code: ENOENT`; the historical source converted that missing status to code 0. The current source requires failure. For signal termination, the current publication path must reject before interpreting dry-run exemption or retry text. Normal zero/nonzero exits distinguish that repair from indiscriminate rejection.

## Original conditions retained

The complete original Issue body, all 18 checkbox rows with their original text/check state, the six nested-token acceptance bullets, current discussion and parent handoff are retained in the local source-bound packet supplied to Main. No checkbox is edited by this candidate.

| Original row | Remaining acceptance or disposition |
| --- | --- |
| RA.A1 | Existing repair retained; Main exercises normal return, truthy/falsy errors and target callback binding. |
| RA.A2 | Main exercises a real Props disposer and subsequent unrelated module reset, first-value identity, named reset, SYS_CAP survival and the within-vault stop boundary. Attempting each module is not proof of every physical release. |
| HT.B1 | Main compares immutable historical, current and proposed source consumers, discriminates the normal rate-limit hypothesis, then executes the 16-case file after any admitted repair. Real registry publication/recovery remains outside this test and outside this assignment's execution authority. |
| HT.B2 | Existing repair retained; Main exercises error identity, Runtime primary failure, one cleanup and retained promise. Distinct deferred-finally/reentrant questions remain separate. |
| HT.B4 | Existing repair retained; Main exercises first failure, peer notification, unavailable frame and retirement. Controlled DOM/Canvas2D fixtures do not establish native pixels/GPU parity. |
| RA.G1 | Expose State publication/old-sink clearing still needs an agreed failure channel and transactional ownership policy. |
| RA.G2 | Terminal Web restoration still needs the owner decision on restoration failure and its ledger. |
| RA.G3 | Current versus stale Presence bridge rejection needs independent evidence and a chosen failure result. |
| RA.G4 | Promise-returning before-callback waiting/reporting remains unsettled. |
| RA.G5 | Terminal vault-reset reporting still lacks a confirmed standard-Module first-failure trigger. Extension-only evidence must remain labeled. |
| RA.G6 | Legacy ProtoPhase-only Rule release needs an admitted-consumer decision; modern Runtime mount-phase gating remains the negative control. |
| RA.G7 | Expose Event intentionally contains host-sink errors; this change does not replace that boundary with generic authored fail-fast behavior. |
| HT.B3 | The claimed synchronous Runtime disposal trigger remains unconfirmed; no retry or outcome-cache repair is inferred. |
| HT.G1 | Detached-owner initialization rollback still needs actual trigger and primary-error disposition. |
| HT.G2 | The old HT.B4 repair already preserves paint's initiating failure in source and controlled fixtures. The original native paint/GPU experiment remains unexecuted. |
| HT.G3 | Legacy Adapter host-wiring reset containment remains a distinct intentional policy requiring an owner decision. |
| HT.G4 | CLI import-stat failure and incomplete successful token output remain owner/reachability work. |
| RA.O1/O2 | Queue aftermath and discarded Promise outcome questions remain separate; initiating errors are not swallowed. Retain watcher recovery [#649](https://github.com/Proto-UI/Proto-UI/issues/649). |

The appended nested-token acceptance under #1068/#1069 also remains intact: imported/aliased/static/unknown indexed inventories and erased syntax; inventory versus exact state/expose/Rule values with real negative controls; conservative nonliteral keys; per-entry mutable graph isolation and same-entry alias identity; nullable spreads/overwrite/interpolation alternatives; and writes/deletion/cycles/shadows/spreads/ordinary keys with the prior suite and original five-second failures retained. Unknown external mutation and dynamic token universes are not proven closed. The public completeness diagnostic requires a separate contract; full compiler/native-host remediation remains open. No Compiler/IR, Focus, Prototype, token-analyzer, global registry or browser-plan file is changed here.

The parent [#883](https://github.com/Proto-UI/Proto-UI/issues/883), [carrier #887](https://github.com/Proto-UI/Proto-UI/pull/887) and [original audit handoff](https://github.com/Proto-UI/Proto-UI/pull/887#issuecomment-6213995557) retain their own gates. All 997 parent key/version pairs are projected without completion claims into the local packet; their original bodies and compound conditions remain in unchanged `internal/records/2026-10-14-finf-followup-source-debt.json` and its six published carrier comments. This candidate does not retire those source keys or reinterpret them as reproduced bugs.

## Main's serial validation

Run from the assigned worktree using Node24 and the existing repository dependency environment. The packet includes exact historical/current SHA-256 manifests, nine byte-exact historical files with independently matched Git blob IDs, current preimages, and the unexecuted `produce-release-outcomes.mjs`. Use a fresh output path for each observer invocation; it refuses an existing output instead of replacing evidence.

This fresh worktree currently has only the metadata `yaml` link. The observer and Node release tests use builtins; the seven-file Vitest command requires Main to attach the existing source-bound workspace dependency environment first. No dependency installation or product import was performed by this worker.

```sh
node /tmp/release03-889-sol-20261110/produce-release-outcomes.mjs /tmp/release03-889-sol-20261110/historical-source /tmp/release03-889-sol-20261110/historical-source-manifest.json /tmp/issue889-before-main01
node /tmp/release03-889-sol-20261110/produce-release-outcomes.mjs /workspace/worktrees/release03-thirty-issue-889-sol-20261110 /tmp/release03-889-sol-20261110/current-source-manifest.json /tmp/issue889-current-main01
node /tmp/release03-889-sol-20261110/produce-release-outcomes.mjs /tmp/release03-889-sol-20261110/proposed-source /tmp/release03-889-sol-20261110/proposed-source-manifest.json /tmp/issue889-proposed-main01
node --test scripts/release/test/publish-subprocess.test.mjs
corepack pnpm@10.32.1 exec vitest run packages/runtime/test/module-teardown-errors.test.ts packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts packages/runtime/test/contract/anatomy.order.v0.contract.test.ts packages/adapters/base/test/adapter-host.test.ts packages/adapters/base/test/adapter-host-delay.test.ts packages/adapters/base/test/web-material-source.test.ts packages/adapters/base/test/web-material-source-independent-review.test.ts
```

The observer runs eight scenarios against each source set, through both the actual release helper and actual `--dry-run` command in toy roots: missing tools, prerequisite signal/nonzero exit, publication signal/nonzero exit, normal rate-limit failure, normal zero and normal already-published exit. It copies each selected source set unchanged, including the explicitly separate proposed set. It records observations, not an invented passing result. Historical false success and the current retry hypothesis are source-derived expectations and must be established only by Main's actual receipts. The current CLI must stop before staging after a failed prerequisite. Publication's signalled case must have no automatic retry, even with exemption/rate-limit text. The proposed normal rate-limit case must reject after three children per independent consumer when two retries are configured.

The seven existing Vitest files must actually execute; reconcile their collected files/cases rather than treating one matching file as coverage. Required consumer outcomes include seven Anatomy return/error variants, six first-value reset variants plus real Props release, six AdapterHost failure variants with primary-error and promise controls, and material withdrawal/fanout/paint-primary controls. Retain ordinary authored fail-fast, failed-created complete cleanup and all existing aggregation assertions.

For this test/record-only increment, Main should format/check the two changed files and run the release manifest test beside the subprocess test. Any broader type, scheduled regression, browser or packed-consumer result must bind its actual source and scope. The metadata handoff explicitly records product evidence as not-run.

There is no changed visible component or navigation surface. Internal acceptance requires the native child result/CLI consequence and Runtime callback/resource transitions above, not a screenshot of logs. Native material paint, hardware, AT, Windows and public/packed cross-host parity remain original evidence limits and cannot be inferred from these controls.

Issue 889 remains open until every applicable original condition is earned or explicitly dispositioned by its owner. This packet is ready for Main's validation and review; it is not independent approval, a PR, lawful integration or closure.
