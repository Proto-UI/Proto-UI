# Card native report inventory correction

## Cause and authority

Native [run 44945602403 attempt 1, job 136974962086](https://github.com/Proto-UI/Proto-UI/actions/runs/44945602403/job/136974962086), exact e775cd5448b3ab13ebe08b051121fda3508de5e9 / tree a0f99b2ff699fe21a9ecf586cbcaf06addc61be9 completed all eight current native cases (New York and Rhea × WC, React, Vue, Vue 2), with zero failures or skips. Its subsequent report guard failed `8 !== 10`. All eight source-clean capture receipts and PNG hashes match the retained native artifact.

Commit 19da90383954ee1fc6255bcc18f35b9b2b04292e deliberately removed the bilingual public overview routes and the two Gallery JavaScript cases. These are retired subjects, not omitted current cases. The November 16 retirement record explicitly preserves the real Card demo owner. Draft T-SHADCN-CARD-0001 binds this native file only to CASE-NATIVE; the separate required Gallery SSR module continues to own CASE-4 and is unchanged. P-SHADCN-CARD criteria and draft lifecycle are unchanged.

## Finite correction

Only the workflow report inventory and its existing controls change. The guard now requires exactly the eight extant native case identities in the original single suite, each passed, with zero failed/pending tests. It rejects the obsolete ten-case report as well as missing, duplicate, renamed, pending and unsuccessful evidence. A new control evaluates the actual Card source registration using RUNTIMES from the actual harness, without executing lifecycle hooks or browser bodies; its synthetic passing statuses are only report-control inputs.

No browser test, product behavior, test selection, timeout, threshold, budget or generated binding is edited. The original failed native job remains failed in history; report replay is not a new candidate native run.

## Verification

- Original guard plus new current-source controls: exit 1, two failures `8 !== 10`, one pass, 82 unrelated skipped.
- Reconciled guard, focused Card controls: exit 0, three passes, 82 unrelated skipped.
- Complete existing control file: exit 0, 85/85 pass, zero skipped.
- Actual retained native Vitest report replay: original guard rejects; reconciled guard accepts the same eight actual passes.
- Prettier completed without additional formatting changes; `git diff --check` passed.

[The machine-readable receipt](2026-11-22-card-report-retirement.json) records exact paths, SHA-256 hashes, source identity, native captures, commands, exit codes and retained evidence, and embeds the actual retirement diff and original native report.
