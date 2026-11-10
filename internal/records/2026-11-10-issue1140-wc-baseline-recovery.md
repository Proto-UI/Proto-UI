# Issue #1140: recover the original WC numerical-baseline proposal

This record recovers the original WC proposal **117,850 → 119,059**, its published source preimages and the actual historical budget failure. The proposal was an unimplemented, unreviewed engineering recommendation. The current **132,000** ceiling stays unchanged. No current product defect, passing measurement, independent approval or completed numerical transaction is asserted.

The retained condition is **“Deliver independently reviewed WC numerical baseline transaction（投递独立评审的 WC 数值基线事务）”**. Its original keys are `issue.1140.001` and `issue.1088.014`, inherited from PR #887, section “Source PR 886 gate followup.” Issue #1140 remains open. This recovery does not close that condition or parent #1088.

## Recovered source and chronology

The [verbatim original proposal](2026-11-10-issue1140-wc-baseline-proposal-178.txt) is the exact 4,779-byte content of the original write to `/tmp/native-source-ci-wc-budget-independent-proposal-178.txt`. Its SHA-256 is `dbd4b347185f2ffc86e762caf9d8ee779d969b8b416d48cd16b37cce2f9cb88f`. Recovery selected only that original tool call from the retained native parent carrier: event `cfcaaac1`, timestamp `2026-10-10T07:37:49.543Z`. The old text's “current,” execution and permission statements retain their original meaning; they do not describe this worktree.

The [machine-readable recovery ledger](2026-11-10-issue1140-wc-baseline-recovery.json) contains all 26 source paths changed between baseline `ea19727838d85c05af5e4bca8d5fc235cb44e288` and the published source candidate `caef71a43310d11fdd3f314f8706d62b57071a70`, with before/after SHA-256, Git blob identities and a separate comparison with this assignment's base `0607c6c5c386b8a932ab850e92a8873b2121dc45`. All 52 original preimage/source files were retained privately under `/tmp/release03-issue1140-wc-baseline-recovery-20261110/original-source/`. These are immutable published Git bytes, not a recreated immediate preoptimization snapshot. Seven source paths match the assignment base; nineteen differ. Those differences alone establish neither regressions nor lost source.

The original `caef` commit object is retained with its actual author, committer and sign-off. Observing those bytes does not certify another contributor's work or substitute for a native DCO App result at a future candidate.

The original serialized `native-source-ci-wc-budget-independent-proposal-178.json` was not recovered. Its actual construction program and successful write summary were recovered. This record preserves that distinction instead of fabricating its dynamic fields or relabeling a new JSON file as the original.

## Actual historical measurements

| Subject | WC gzip bytes | Ceiling | Result and provenance |
| --- | ---: | ---: | --- |
| Original main `ea197278` | 117,706 | 117,850 | [Package job 113896790334](https://github.com/Proto-UI/Proto-UI/actions/runs/37953108222/job/113896790334) succeeded; other tests in that run failed. The retained observation includes the environment and four package rows, not the complete original log. |
| Published source `caef71a4`, executed merge `f62672dedd406ceccd5683d79f0fb2b6022c59af` | 118,915 | 117,850 | [Package job 114169535553](https://github.com/Proto-UI/Proto-UI/actions/runs/38036882685/job/114169535553) failed. Eight of nine whole-entry comparisons passed; WC exceeded its limit by 1,065 bytes. All nine entries and both supplementary diagnostics are retained. |
| Original proposed numerical change | 118,915, inherited from that source measurement | 119,059, proposed | Arithmetic only: no post-mutation measurement, numerical commit or numerical approval was recovered. |
| Later historical Props source | 118,931, reported in continuation event `80437c3a` | 119,059, still proposed | The proposal would leave 128 bytes, not the earlier 144. This is a different historical source. |
| Assignment base `0607c6c5` | Unmeasured by this worker | 132,000 | Current source and quota stay separate from the historical proposal. |

The historical environment was Linux x64, Node `v24.21.0`, zlib `1.3.2.1-motley-8002e91` and esbuild `0.25.12`. The WC minified artifact changed from 418,847 bytes / `6c0bc106413987ae9b8d2722b1189656532f05cfb45ccaebfcfacf31ac25639f` to 420,388 bytes / `ee4e1794de483e972f0d1ba30aa086f7dbf665a948a154f20695f83a54820b79`.

The proposal restores only the old 144-byte margin:

```text
117850 + (118915 - 117706) = 119059
119059 - 118915 = 144
```

Its standalone 1,353-byte allowance on the old main includes 1,209 bytes reserved for that source capability. It is not 1,353 bytes of free combined headroom.

The original report attributes dominant retained minified growth to WC `adapt.ts` and increased retention of an unchanged logical-tree module, with the same reported 289-input set and no outside dependency inputs. Those original findings are retained as reported evidence; the original raw attribution/metafile JSON was not recovered. They are not a new scan, and module minified contributions cannot be summed into gzip attribution.

## Numerical preimage boundary

The historical budget script at `caef` has SHA-256 `f41959490bf0c00b4b303be72c2467ec9f8dd4f082c3990a93a4017a95fcd4b7`. A private, unapplied reconstruction changes only its WC literal `117_850` to `119_059`; that counterfactual file has SHA-256 `a72c1fc2ab79eb95163fc3191d964f5d1942dce4b487bec0de42c8f6e44275c6`.

The reconstructed patch and its after-image were authored during this recovery. They are not original executed artifacts. The patch lives at `/tmp/release03-issue1140-wc-baseline-recovery-20261110/historical-only-wc-119059.patch` and has SHA-256 `64a39152cedc20b6a1d346b67597aeb36b2a3d65c31f13c801fdc12061a35936`.

The current budget script has a different SHA-256, `01e4987b4552c2284741a5d9945d990f8798ca7a601b170ded968f3a2feb9c31`, and a 132,000-byte WC ceiling. The historical patch must fail its exact-preimage admission against this source. Do not lower the current quota to manufacture the old transaction.

## Authority, ownership and review limits

The current `A-WEB-COMPONENT-0001` identity is active. `C-LIFECYCLE-0002`, `T-LIFECYCLE-0001`, `HC-FOCUS-TARGET-0001`, the Focus Entry/Scope contracts and both Shadow profile/style decisions remain draft in the applicable bounded slices. The ledger records their criteria and relations. Active Adapter identity does not promote draft Shadow recipes or establish non-Web conformance.

Historical failed-created criterion `C-LIFECYCLE-0002-I` remains bound to its historical source. On this assignment's base, failed-created cleanup is criterion J, ordinary authored `beforeDispose` fail-fast is K, and I governs normally returning callback registration order. Do not silently rewrite old acceptance against the new anchors or expand broad callback-error recovery.

`pui-dev` requires canonical pinned-toolchain cost evidence, closure investigation, an independently reviewable numerical transaction, post-mutation validation and honest independent review. The present Finf advisory policy preserves strict baselines, actual failed comparisons and all non-size gates; it does not retroactively accept the old number. A future current numeric mutation must enter the registered `pui-package-budget` leaf with its actual prerequisites, then `pui-validate` and independent `pui-review`.

The original `WCBudgetAudit172` verdict concerns source optimization. It is not numerical review. Live PR #886 has two `COMMENTED` reviews at `caef`; neither is an independent numeric `APPROVED` review. PR #886 later merged as `9f360300ff25e69793d6f029470a759bda1298b0` from head `9d64fb08d82e12550285eb8681c9aa182b8f7522`. That source integration does not complete the numerical proposal. Current-user review deferral applies only to the exact present operation and cannot create a historical approval.

The current discussion was read completely: Issue #1140 has one comment, parent #1088 has three, and source PR #887 has 77, each through complete pagination. The November 6 deferral remains historical discussion. Current user direction and Main's explicit approval authorize these new recovery records without changing the historical release disposition or quotas.

`SolThirty1140WcBaseline` owns this recovery. Main owns serial validation, PR publication, independent review and lawful integration. Owner #1158 retains the separate original PR886 conflict-preservation subject. No shared release ledger, compiler, Runtime, Adapter implementation, global test inventory or public registry was edited here.

## Serial Main continuation

No command below was executed by this worker. The proportional checks for these recovery records are formatting, JSON/reference review and exact historical-byte preservation. The heavier commands define the runnable continuation if Main advances the original numerical acceptance; they are not mandatory reruns of an already established old failure.

Use Node 24 and pnpm 10.32.1 with real product dependencies. Main supplies a disposable validation checkout at the exact `0607c6c5` base under `/workspace/worktrees/release03-issue1140-validation-base-20261110`; this worker did not create it or install dependencies. Preserve actual toolchain details for every new measurement.

First, in the assignment worktree:

```sh
corepack pnpm@10.32.1 exec prettier --check internal/records/2026-11-10-issue1140-wc-baseline-recovery.json internal/records/2026-11-10-issue1140-wc-baseline-recovery.md
```

Never format the verbatim proposal text or old preimages. If formatting changes a new record, refresh only that new candidate's digest and handoff; retain every original historical hash.

For a current before/after comparison, run once in Main's exact `0607c6c5` validation checkout, then once in the assignment worktree:

```sh
node scripts/analysis/package-budgets.mjs --json
```

Compare all eleven minified SHA-256, minified byte and gzip byte values. The same-product-source expectation is an inference until Main executes it. Keep every actual strict failure. If Main also needs the explicit project-stage report, run the separate command and retain its false comparisons beside the strict result:

```sh
node scripts/analysis/package-budgets.mjs --finf-development --json
```

The existing focused consumer suites, all cases without name filters, run serially in the assignment worktree:

```sh
corepack pnpm@10.32.1 exec vitest run --pool=forks --maxWorkers=1 --minWorkers=1 packages/adapters/web-component/test/focus-teardown-readiness.integration.test.ts packages/adapters/web-component/test/focus-terminal-cleanup.integration.test.ts packages/adapters/web-component/test/focus-portal-parent-release.integration.test.ts packages/adapters/web-component/test/shadow-split-profile.test.ts packages/adapters/web-component/test/shadow-split-prototype-admission.test.ts packages/adapters/web-component/test/root-role-compatibility.test.ts packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts
corepack pnpm@10.32.1 exec vitest run --pool=forks --maxWorkers=1 --minWorkers=1 packages/adapters/web-component/test/shadow-closeout.browser.test.ts
```

Required outcomes include real readiness acquisition/release, Error and `undefined` identity, independent cleanup tails, ordinary disposal fail-fast, retained editor and view identity, explicit Portal undo versus terminal retirement, Root compatibility and unsupported split rejection. The native suite must report its actual current collected/executed/skipped counts; the original 111 passes are not a current inventory or result. Preserve genuine negative controls, tolerances and event sequence.

After Main has prepared actual built public artifacts, use the canonical consumers:

```sh
corepack pnpm@10.32.1 -s release:smoke:cli
corepack pnpm@10.32.1 -s release:smoke:react
```

Retain their actual installed package closures and public behavior. Old 44-package build counts and local diagnostics cannot stand in for these executions.

## Actual native and visual consumer commands

The current executable discovered on this host is `/usr/bin/chromium`; no browser was launched during recovery. Main runs these existing entrypoints serially after preparing their real dependencies and public dist artifacts:

```sh
env PUI_CHROME_EXECUTABLE=/usr/bin/chromium node --import tsx scripts/analysis/shadow-split-focus-browser.mjs
env PUI_CHROME_EXECUTABLE=/usr/bin/chromium node scripts/analysis/shadow-s4-public-browser.mjs
env PUI_CHROME_EXECUTABLE=/usr/bin/chromium node scripts/analysis/shadow-s5-public-browser.mjs
```

They exercise actual native Tab/outline transitions, the public-dist Dialog consumer and the public-dist/CLI input/textarea consumer. The public-dist producers reject workspace-source substitution. They do not establish full AT, all palettes/Mask states or non-Web support.

For continuous public paint, Main starts its own server in the assignment worktree and stops it after observation:

```sh
corepack pnpm@10.32.1 --filter apps-www dev --host 127.0.0.1 --port 43140
```

After that server is ready, the separate capture command navigates the retained real route `/zh-cn/internal/demo-matrix/#shadow-split-s4`:

```sh
env PUI_CHROME_EXECUTABLE=/usr/bin/chromium PROTO_UI_BROWSER_BASE_URL=http://127.0.0.1:43140 S4_PAINT_OUTPUT=/tmp/i1140paint node scripts/analysis/shadow-s4-paint-browser.mjs
```

The existing producer samples actual compositor frames through open, exit, concealment and retirement for Light/split/mixed profiles. It writes `results.json` and failed-path PNGs. A passing run does **not** archive successful PNG frames or upload screenshots. Main must separately retain and inspect actual adjacent-state images before closing visual debt; a successful console message is insufficient.

Inspect the real Root/slot paint and inherited `--pui-primary`, trusted focus outline without clipping, editor value/selection and physical identity, the intermediate hidden frame, remount, adoption, explicit Portal undo and terminal removal. Bind captures to exact source/head, profile, viewport, scale, browser/version, theme and fonts. The original local 800×500 / DPR 1.25 / Chrome150 captures remain historical, unavailable as current uploaded attachments.

## Remaining original work

The ledger preserves every original condition and splits its evidence obligations without changing the compound checkbox. Still required are the actual numerical transaction's disposition under current source/policy, any corresponding fresh canonical final/combined measurements and closure attribution, genuine exact-head independent acceptance, real CI/DCO/rights and ruleset checks, applicable packed/native/visual evidence, a published PR with review repairs, lawful integration and actual criterion-bound Issue readback.

Prepare a PR related to #1140 and #1088. Do not put `Closes #1140` in this recovery-only PR. Do not check the original numerical-delivery condition merely because this source-recovery record was reviewed or merged. Ownership continues through Main validation and review repair.
