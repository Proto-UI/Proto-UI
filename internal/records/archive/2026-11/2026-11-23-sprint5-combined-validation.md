# Sprint 5 combined validation before the next hosted run

## Integrated source and scope

This follow-up to PR #1715 remains [PR #1738](https://github.com/Proto-UI/Proto-UI/pull/1738). Normal merges preserve the original commits, the program-owned tint-source gate repair `6bfda28416527c6ee1c87e954b3fe5208480522b`, GPUI public admission and producer repair `0f6e10b56624130822a66b16a95aa51a5e32e2a7`, and main `457d27f7fe554f398970a836ee9c95edb4846f47`. Main independently includes the same GPUI-only admission through PR #1742; the merge preserves it once, together with this branch's public-entry controls and producer correction.

The official Checkbox session refresh and emitted-artifact count clarification are `c0e5bc91c47589d64080af974d0c98edd308099c`. Its complete source validation used the actual 24-file list from the browser workflow. No original lifecycle assertion, legal target control or invalid-operation rejection was removed.

The root team's later manual-browser boundary repair `047b0fdf438e15da771c7e7e3511827520e2d99a` was signed-off cherry-picked as `ff5b83bddd07a4f76282d327ee7d22093076cf81`. Its only active source change is the CI-policy test; every changed path is that file or an evidence record. It preserves the integrated main decision: only Adapter is reusable, browser acceptance is an explicit optional boolean manual input with default false, and its exact registered job still runs both source and production lanes. The earlier superseded two-input assumption and its real failed synthetic-merge result remain in history.

## Actual results and bindings

| Executed source | Validation | Actual result |
| --- | --- | --- |
| `c0e5bc91c47589d64080af974d0c98edd308099c` | Complete official source list, 24 files, one worker | 401 / 401, 0 failed, 0 pending |
| Same source | Complete production bundle controls | 2,082 / 2,082, 0 failed, 0 skipped |
| Same committed source | Official GPUI session fixture freshness check | exit 0 |
| `ff5b83bddd07a4f76282d327ee7d22093076cf81` | Scheduling policy controls | 31 / 31, 0 skipped |
| Same source | Cycle job inventory and report controls | 28 / 28, 0 skipped |
| Same source | Release source-ledger checkpoint controls | 21 / 21, 0 skipped |
| Same source | CI schedule and integrated difference checks | exit 0 |

The complete selected source/test/workflow/target/producer/gate/Checkbox input hash map was captured before and after the 401/2,082 run. The worktree remained clean. After the CI-only cherry-pick, every one of those hashes was checked again and remained identical; no compiler/runtime revalidation result is attributed to an unexecuted source revision. The subsequent commit that contains this record changes evidence only.

Tests used private temporary directories on the project volume. A read-only filesystem check found the separate 4 GiB `/tmp` almost full; no other session's temporary files were deleted. The original environment failures retained by the related CI repair remain separate from passing controls.

## What remains pending

The real production graph from d995 is retained unchanged in the earlier tint-source record: four original issues become zero with the exact one-module admission. That replay is not a new production build of this combined head.

The original d995 hosted browser receipt still contains actual cleanup-acknowledgement and dependent journey failures. Its full receipt and original browser output are preserved here. The local unobserved d995 attempt failed earlier during Astro startup and never reached a browser journey; its raw status, receipt and output are also preserved, with no claim that it reproduced or fixed the hosted cleanup failure.

The real producer generated 37 unique modules, and 38 Cargo manifests parsed. Both receipt variants cover the same 132 distinct emitted artifact paths with identical bytes. These source/generation results do not replace actual Cargo/native or Adapter acceptance.

The next single manual workflow dispatch must be bound to the published head and separately read back for source, production, browser, native and Adapter results. At this checkpoint PR #1738 remains Draft. Independent source reviews are documented in the individual repair records; they are not GitHub approval, merge or release.

## Retained evidence

`internal/records/evidence/2026-11-23-sprint5-combined-validation` contains the complete 401-case output/JSON, 2,082-case output, fixture check, all 80 CI controls, schedule output, source hash bindings, exact drivers and the original d995 browser failures. The manifest records each original and gzip SHA-256 and byte count.

Agent: ChatGPT / Codex, continuing the user's authorized implementation and readiness work.
