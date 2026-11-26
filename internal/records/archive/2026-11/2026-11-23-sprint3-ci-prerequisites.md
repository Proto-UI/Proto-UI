# Sprint 3 CI prerequisites — retained failures and narrow repairs

The integrated published baseline is 6a2bb11a1e8abf3fffa8921d267db215bb70b10d. The prior independent red/green source was 9cd4d10d1953a3c030e679d8d11061660e202ed9. Its original worktree was retained when the remote advanced. This exact four-file patch then applied cleanly to a new, independently installed 6a2bb11 worktree. The actual CI failures below belong to 1658768483ba5d81e4502a64945fe5c0a21dda1d, [run 45202101258](https://github.com/Proto-UI/Proto-UI/actions/runs/45202101258). This record does not promote that older run into final-candidate acceptance.

## Actual failures and changes

Image Preview failed before any of its 32 cases ran. Chrome reported "Socket path too long" for its 111-byte SingletonSocket path beneath the verbose workflow temporary directory. The complete original artifact (14832658779) is retained. Both follow-up jobs now create an independent mktemp directory under RUNNER_TEMP with a short name. Their evidence directories still retain the complete candidate SHA, run, attempt and suite. Browser sandboxing is unchanged.

Scroll Area (artifact 14833461209) and Drawer (14833446322) each exhausted their original five-minute setup bound while fetching the same 61.2 MB Noto CJK package from the us-east-2 Ubuntu mirror. The independent production Compiler job had already exhausted its original three-minute font step on that mirror. APT now uses a 20-second HTTP/HTTPS read timeout and two bounded retries. The original three/five-minute step limits, required font packages, installed package records, and direct consumers' SC/JP/KR family checks remain in place. This does not claim that the remote mirror is repaired.

Release rehearsal passed its workspace/docs type stage, then the release-script stage reported 244 passes and one failure out of 245. Its family-export expectation predated the authored proto condition on Base. The existing explicit 16-family inventory now requires each exact ./src/<family>/index.ts path alongside the unchanged types/import/default targets. The sideEffects false requirement, corresponding-family dependency constraints and Shadcn/Brutalist export shapes remain unchanged.

## Executed evidence

- Before the temporary-directory repair, the complete workflow control file reported **8 passed / 1 failed / 0 skipped**, failing on the Image Preview singleton path. Its repaired control actually binds and closes the Unix socket.
- The repaired workflow, admission and receipt control files reported **32 passed / 0 failed / 0 skipped**.
- Before the export-expectation repair, the complete family boundary file reported **5 passed / 1 failed / 0 skipped**. After repair, **6/6 passed**, including a fresh real Brutalist package build and root/subpath import checks.
- On the new 6a2bb11 combination plus this patch, all 32 workflow controls and all six full family cases passed again, along with **37/37 production source, delivery, repository-root and actual relocated esbuild asset controls**.
- CI scheduling policy, formal public-manifest check, formatting and diff checks passed.
- The parent agent independently reviewed the complete four-file patch and found no blocking issue within this scope. This is not GitHub approval.

Node 24.22.3 and the locked pnpm 10.32.1 workspace were used. Each worktree installed its own frozen dependencies; no cross-worktree dependency symlink was used as proof of the repository-bound asset case. Original decoded logs and ZIP bytes, candidate patch and source hashes are sealed in [evidence/2026-11-23-sprint3-ci-prerequisites/manifest.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint3-ci-prerequisites/manifest.json). No prior artifact or failed receipt is rewritten.

## Remaining acceptance

The separate installed-consumer job on the older 1658768 candidate completed Tooltip 12/12, Select 4/4 and its one historical old-CLI negative control, with independent consumed-byte/receipt verification; its separate public Select source file passed 4/4 (artifact 14832624839). These are genuine older-candidate results.

New-head direct/native/production browser acceptance and the complete release rehearsal remain to run. Four strict whole-entry package budgets remain genuinely over their current ceilings and require their own evidence-backed transaction or a semantics-preserving reduction. No package threshold, product implementation, capability lifecycle, release approval or integration permission changes here.

## Follow-up on the integrated 6a2 source

The later original native job 137806713683 and rehearsal job 137806713175 in run 45206446598 each reached the same stalled 61.2 MB Ubuntu font download, then hit their original five-minute setup deadline before their product cases. Those complete original ZIPs are retained separately in [evidence/2026-11-23-sprint3-font-retry-followup/manifest.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint3-font-retry-followup/manifest.json).

On the separately published numeric-transaction baseline 15963a323d9a6d8a0f61aae32942e2172128bdab, the same 20-second HTTP/HTTPS read timeout and two retries now cover all three original CJK steps (native, separate Base Select, rehearsal). All three keep their original five-minute total bound, mandatory font install, dpkg records and independent complete producers. No browser case or original assertion is removed. The complete workflow/receipt controls passed 32/32 with zero skips and the scheduling policy passed.

The earlier four package-budget failures above remain historical facts; their standalone cost transaction is recorded separately in [2026-11-23-sprint3-package-budget.json](../../2026-11-23-sprint3-package-budget.json). The current follow-up does not claim a repaired mirror, a new native pass or final canonical package acceptance. The production cleanup failure remains separately owned by the source-input repair.
