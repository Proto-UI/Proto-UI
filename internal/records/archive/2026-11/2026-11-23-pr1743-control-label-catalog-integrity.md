# PR #1743: Control Label catalog integrity reconciliation

Date: 2026-11-23. This is an observational repair record, not a new semantic definition, lifecycle admission, or native acceptance result.

## Scope and original failure

The active follow-up is [PR #1743](https://github.com/Proto-UI/Proto-UI/pull/1743), branch `work/sprint3-acceptance-followup-a507-20261123`. The reproduced source is `48ebbaa7139e5caf7730659ae827049a93e97ea3`, tree `f773661d2a3e8b43975af0833242d27448b47ad5`.

The [release-rehearsal run 45222928664](https://github.com/Proto-UI/Proto-UI/actions/runs/45222928664) passed gates 01 and 02, then gate 03 rejected two criteria with the same ID, `HC-CONTROL-LABEL-0001-GPUI`, in [HC-CONTROL-LABEL-0001](../../../../spec/host-caps/HC-CONTROL-LABEL-0001.yaml). The seven following missing-target messages are consequences of that entity failing to load. Gates 04–15 were not run.

Original artifact `14841752556` has SHA-256 `694aa47dcf3bfacd6748e41c07c17cf5cb82d1b41a7ad41269c044c1a91afcee`; its unmodified `rehearsal/step-03.log` has SHA-256 `a04563f29b739a26a3188c3dd2fff9cc040436c7523405322c6d5ed6f5228e52`. The archive and original failure remain preserved.

## Introduction and owning correction

The merge [`f5add6485f6d6e73bdd80a4f8a905a7f11c8ccc2`](https://github.com/Proto-UI/Proto-UI/commit/f5add6485f6d6e73bdd80a4f8a905a7f11c8ccc2) retained independently authored rows with the same identity. Its first parent, `ddc1b66469ab7e7ac75fcc6df4c57559ca4fd33a`, contains one GPUI row in blob `a906638c8adcb94199c04553c81d6044278fce08`; its second parent, `bd5800dcc833e3155f7b8ca89d10d03aaef6606e`, contains one GPUI row in blob `ef1be640348e5897d70eb489bd3ad606cbea62db`. The merge, reproduced candidate, and inspected main `457d27f7fe554f398970a836ee9c95edb4846f47` contain both rows in blob `692f044db761a6248a23691706c7208ed242ce9f`.

The correction retains the first row and appends the second row's complete English text, separated by one space. It removes only the duplicate row structure. The resulting YAML blob is `3df90c3664a99e64679013eb492349a902e7e31b`.

Both texts remain verbatim and jointly constrain the same provider. Current Window, semantic-node, frame and checked-pair identities remain required. The primary-pointer restriction does not introduce touch support: the second text still limits the provider to native mouse gestures on known passive content. Every cancellation, replacement, opaque-child and stale-action restriction remains. The visible text-node accessibility action still creates no Button role, Tab stop, independent keyboard binding or naming-only action. Neither text claims physical touch or assistive-technology delivery.

All six distinct criterion IDs remain referenceable; seven authored rows become six unique rows. The other criteria, relations, source paths, revisions, `status: draft` and `lifecycleRationale` are unchanged. In particular, `HC-CONTROL-LABEL-0001-GPUI-OPAQUE-CHILD` and `HC-CONTROL-LABEL-0001-CALLBACK` remain intact. [T-CONTROL-LABEL-0001](../../../../spec/tests/T-CONTROL-LABEL-0001.yaml) and [T-COMPILER-GPUI-CONTROL-LABEL-0001](../../../../spec/tests/T-COMPILER-GPUI-CONTROL-LABEL-0001.yaml) retain their existing criterion mappings and draft lifecycle. The schema's duplicate-ID rejection is unchanged; no runtime or compiler implementation is modified.

## Actual validation and its limits

The independent checkout used Node.js 24.22.3, pnpm 10.32.1, the frozen lockfile, and `NODE_OPTIONS=--max-old-space-size=512`. The PR #1743 human-assisted regression handoff resolved with exit 0, `blocked: false`, and loaded `pui-regression` before source mutation.

The exact package command, `corepack pnpm@10.32.1 -s release:lifecycle -- --out <report>`, was attempted first. The local executor denied the tsx CLI's auxiliary Unix IPC listener with `EPERM` before catalog loading. That original stdout and exit 1 are retained separately; this environment failure is not the governed red case or a passing gate.

The subsequent red and green runs execute the same unmodified gate-03 script through its Node loader, without the CLI's auxiliary listener:

```sh
node --import tsx scripts/spec/lifecycle-report.mjs --out <report>
```

The script blob remains `1e5c2bd3f1f48a7b3500395b8e19886bfcc5cad3` in both runs. The clean candidate fails with exit 1 and the original duplicate-ID plus seven consequent relation errors. After only the YAML correction, the same command passes with exit 0 and emits the full lifecycle inventory.

| Observation | Result | Raw SHA-256 |
| --- | --- | --- |
| Original local package-command attempt | IPC EPERM; catalog not reached | `6eb17b5d38a7b3ecd28d91a2f4e57513b72b7c45c0d870a383c0eb8c90d95b33` |
| Gate-03 implementation before correction | Exit 1, duplicate criterion | `22a58a619d881e1ab491b04e19c3da2713abc7331f0e3777c2bd2ea1b398c5e5` |
| Gate-03 implementation after correction | Exit 0 | `3667102bc3a179f45d777338ea31791689df95ed5171eff0d238c32bf8d17ad8` |
| Complete green lifecycle JSON | No report issues | `1c48a4245b16c9dfc794528bba7d2f4928b4e177ec5e282206351ee6b610db2a` |
| Existing catalog evidence-integrity test file | 13 passed, 0 failed, 0 skipped | `db0577a638737d4952e78449426a64a5435f485b67231920ab8cb37dcd0913e1` |

The focused test command is `node node_modules/vitest/vitest.mjs run packages/spec/graph/test/catalog-evidence-integrity.test.ts --maxWorkers=1 --no-file-parallelism`. It checks real catalog loading, cited evidence paths and case consumption. No new mirrored validator or waived assertion was introduced.

The green inventory still reports 1,308 ordinary entities, 1,263 drafts, eight reviewed draft dispositions, 1,255 unreviewed drafts, 45 non-draft entities without activation provenance, and 114 unclassified legacy block targets. The three affected HC/Test entities remain draft and non-stable; their recorded `needs-review`, `active`, `planned` and other evidence gaps remain visible. A catalog `passing` field is not a new test execution.

This bounded repair establishes catalog integrity for the observed failure. It does not establish a final-candidate CI pass, the remaining rehearsal gates, full workspace types, GPUI native behavior, physical input, assistive-technology delivery, independent platform approval or release readiness. Integration must retain the original failed run and bind new canonical results to the resulting candidate.

## Preserved evidence

The [complete original evidence archive](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-pr1743-control-label-catalog-integrity/raw.tar.gz) is 275,189 bytes with SHA-256 `f20869860909fb24858587a2854d0220bccf3f47b42c6210816dbbe0f2ad6813`. It retains the original CI artifact, CLI IPC failure, gate implementation red/green runs, full lifecycle report, catalog tests, source history and the independent patch packet. The archive is immutable; this integration adds its repository link without rewriting those observations.
