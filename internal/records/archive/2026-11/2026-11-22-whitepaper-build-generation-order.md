# Whitepaper evidence: generate CSS before binding the build

This is a bounded CI orchestration repair for the Sprint 3 graphical-asset evidence in #1165/#782. It does not record a completed production build or visual acceptance.

## Observed failure and owning layer

[Workflow run 45018254112, job 137195195604](https://github.com/Proto-UI/Proto-UI/actions/runs/45018254112/job/137195195604) checked out `830287f95959a4a1a4fb797df68b0bd6889e0bae`. Its 46 selected Node tests passed. The next command, `whitepaper-diagram-build.mjs begin-build`, failed because `apps/www/src/styles/proto-ui-tokens.generated.css` did not exist. The production build and all browser captures remained unexecuted. The uploaded one-file, 248-byte artifact was not graphical evidence.

The workflow installs dependencies with `--ignore-scripts` and called `begin-build` before `apps-www build`. The source guard correctly requires three actual CSS digests. Two inputs, the generated tokens and Shadcn theme, are absent in a clean checkout; the tracked style wrapper is present. Their real generation was inside the later build command, which the failure prevented from running.

The fix invokes the existing `generate:proto-ui-style` script immediately before `begin-build`, preserving its stdout/stderr in `generate.log`. That script builds and exercises the real CLI, generates its theme, scans the actual package and website Prototype token inputs, and emits the website styles. No CSS is supplied by a fixture or copied from another checkout. The ordinary production build, source checks, five existing profiles, separate authored-export capture, final checker, read-only permissions and unconditional evidence upload are unchanged. No new trigger or gate is added.

## Discriminating checks

The added workflow regression uses a clean temporary Git checkout containing the actual build/provenance modules and tracked style wrapper. The real `begin-build` rejects the absent generated tokens. It then executes the actual YAML shell prelude with a deliberately failing generator process that emits no CSS. This checks that generation is reached first, its nonzero exit survives `tee`, both output streams are retained, and neither build receipt is published. This process substitute proves ordering and failure handling only.

Before the workflow change, that test failed with the same missing-CSS error: four tests passed and one failed. After the change, the complete seven selected files passed **47/47**, with no failures, cancellations or skips. The provenance implementation and its assertions were not changed.

## Actual generation on the clean source

A separate local experiment used the complete clean `830287f95959a4a1a4fb797df68b0bd6889e0bae` checkout, tree `f7b2851e7e6fa6b7d9e64fd1e687d316a4c51644`, Node 24.22.3 and Corepack pnpm 10.32.1. Heavy commands held both shared validation locks; no Astro or browser was started.

| Command or observation | Actual result |
| --- | --- |
| Frozen offline dependency installation with `--ignore-scripts` | Exit 0; tracked/untracked source status clean. |
| Original `begin-build`, before generation | Exit 1: required tokens CSS missing; no start receipt. |
| `corepack pnpm@10.32.1 --filter apps-www run generate:proto-ui-style` | Exit 0; real CLI init, theme, token-union and style generation completed. |
| `begin-build`, after actual generation | Exit 0; exact source/tree and all three generated CSS hashes bound. |
| A second invocation of the same real generator | Exit 137, with `Killed`, during token collection after CLI init and theme generation. The cause of termination is not established by this log. Repeated-generation success is **not** claimed. |
| Temporary mutation of the generated tokens CSS, then `finish-build` | Exit 1: `Source changed during the production build`; no completed build receipt. Original bytes restored and source remained clean. |

The successful first generation bound these exact inputs:

| CSS input | SHA-256 |
| --- | --- |
| `proto-ui-tokens.generated.css` | `dd7c14fd69677a4baadf3bd9dd5a16c2c0e19f67e56fd02657717f1bea54eaec` |
| `proto-ui-style.css` | `446d2249e0672bdee7ddf77de55c7a8f2140adfb60c41d13ec0183d5f7199d88` |
| `shadcn-theme.css` | `3de2d4ce2a38e83086128c8863d3391eb74159adde7b1a8b7f450f93fd643f96` |

Raw command receipts, stdout/stderr, the real start receipt and both negative controls are retained in the session evidence packet at `s3-history-evidence/whitepaper-build-order-830287/`. They retain the original Actions failure and the separate local exit-137 result. The next integrated candidate still needs its actual workflow, successful production build, five-profile and authored captures, receipt readback and independent visual/semantic review. A start receipt's declared production command is an intended next command, not proof that it ran.
