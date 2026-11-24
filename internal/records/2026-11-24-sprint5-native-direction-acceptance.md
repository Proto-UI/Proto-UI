# Sprint 5: native direction acceptance and preserved concurrent CI

## Concrete result

The original native `dir=auto` input and textarea cases both executed successfully in Chromium 145.0.7632.6, with the original five-second case timeout, trusted input, all assertions, and OS sandbox retained. Input completed in 1,425.118 ms and textarea in 168.451 ms. The other 190 Shadow cases were unselected. This accepts the two direction regressions at their recorded source; it is not complete Focus, IME, assistive-technology or production-browser acceptance.

The executed source was `f6bdadf1bf1791bab8a66d7c9a6c25993fc5c1f4` plus the one-file bounded preparation patch. Its exact fixture SHA-256 is `fc2157d23740281f7f840dcbfb7e42ca1f61cc45f18e66dda2d500e11bf23c9e`. The initial fixture evaluation, both actual input actions, and all assertions retain SHA-256 `c33da4e89d0505d6843936291264eb5401cbf64016419be2d0abb7aa089be1f6`. Only each fresh page's creation and loading of the shared Adapter and stylesheet move into a bounded 30-second preparation hook; both pages close after the group. No product source or 250 ms preview retirement guard changes in this patch.

## Original failures and why preparation changed

The two earlier unchanged runs remain input timeouts at 5,003.923 ms and 5,006.744 ms; their textarea cases passed. The diagnostic Playwright trace shows that the first trusted input began 4.929 seconds after case start, after cold page, script, stylesheet and fixture preparation. No assertion was removed or deadline extended to relabel those failures. A later wrapper comparison also stopped before Vitest because local and remote Git abbreviated blob IDs differently. It executed zero tests. Fixing only that comparison allowed the recorded two-case execution.

The complete original and prepared archives, receipts, exact patch, and source hashes are in the adjacent evidence directory. Their hashes and member counts were verified on download. The first archive is 72,540 bytes, SHA-256 `99b2226acb3406abdbec5a8124088e332a29d0ad5d7521ae51717acaa8d96335`; the prepared archive is 164,046 bytes, SHA-256 `4a2a5f1ca897e57bad5b64c48332205d0103f33ed9e6da991dec8f5ed36d063d`.

## Concurrent source reconciliation

The normal merge preserves our React retirement commit `ecedf58`, its native integration `5bbcca3`, and public `ea60064882924eb455e1dfc3ff7de55a32de4558`. The incoming ControlLabel additions are test assertions for diagnostic delivery after a drain and permanently inactive old action bridges. They were independently reviewed and retained alongside the unchanged 12af product repair. Incoming Shadow formatting has identical TypeScript node structure, flags and literal contents across 51,269 nodes. The initial comparison mistakenly included the entire SourceFile text; that invalid comparison is retained separately. The corrected structural comparison confirms formatting equivalence and is not a browser run.

The only merge conflict was the explicit source-test list. Its resolution retains both React and Vue owner/Context suites and all incoming source tests, with one copy of each path. The incoming native-direction CI step and its exact-two-case receipt check remain intact. The original scheduling suite executed 31/31 with zero skips; schedule and formatting checks succeeded. The final fixture hash and complete workflow-path union are recorded in the evidence manifest.

Formal run [45271472592](https://github.com/Proto-UI/Proto-UI/actions/runs/45271472592) belongs to the earlier public `ea600648` source. It cannot supply results for this later prepared tree. The successful earlier `2df421b` production receipt remains 20 canonical cases with its original 250 ms guard; it provides no per-cleanup latency distribution. Its full workspace/docs type command succeeded, but the 1,330-file counter is specifically Astro's documentation counter, not a workspace TypeScript source-file total. No draft profile, shared definition, issue umbrella, GitHub approval, release or merge decision changes through this evidence record.
