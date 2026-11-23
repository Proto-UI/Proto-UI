# Additional documentation checks

These commands ran at evidence commit `1eb751b7ef39285f00e2d2ce49d5c10f8aea177a`; the implementation PR stayed at c18. See [disposition.json](disposition.json), [manifest.json](manifest.json), and [all original commands and logs](originals.tar.gz).

| Check | Actual result |
| --- | --- |
| `corepack pnpm@10.32.1 check:public-docs` | Exit 0. |
| `corepack pnpm@10.32.1 check:agent-operations` | Exit 1; the reporter recorded 1,360 tests, 1,358 passed and two file-level failures: `review-pagination.test.mjs` and `review-reply-identity.test.mjs`. Their original whole-suite cause is not established by this record. |
| Those two files, `node --test --test-concurrency=1 --test-reporter=tap` | Exit 0, 191/191, no failure/skip/cancellation. This is a bounded successor; the original whole suite was not rerun or relabeled green. |
| `corepack pnpm@10.32.1 check:agent-doc` | Exit 1 before the script could run: the tsx CLI IPC listener received `EPERM`. |
| The same script with `node --import tsx … --check`, before dependency wiring | Exit 1: this evidence worktree lacked the declared `zod` dependency. |
| The same Node invocation after wiring the three spec packages' declared dependencies | Exit 0. The lockfile matched the existing installation byte for byte; workspace package links point at this evidence checkout. No clean-install result is claimed. |

The source, repository policy and sandbox permissions were unchanged. The alternative Node entry does not create the CLI IPC server. The original IPC and dependency failures remain readable. These additional checks do not replace the separately bound 245-test implementation run, the 37 browser journeys or the strict 9/9 budget. No aggregate all-green Agent-operations result is claimed.
