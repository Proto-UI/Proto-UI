# Sprint 6 continuation: durable evidence and current execution boundary

Date: 2026-11-23, Asia/Shanghai. This continues the user's seven-Sprint request and PR [#1712](https://github.com/Proto-UI/Proto-UI/pull/1712). The source parent is `07f330261756dc95f10d3bb0d763827ab161c388`, tree `83cda20c97be2432706d57ffea582a268d37a110`. The seven original Issue scopes remain #1467, #1149, #1148, #1053, #1050, #1049 and #799.

## Recovered original evidence

The previous session left **869 untracked record and evidence files, 31,442,326 bytes**, outside the published branch. They were copied to an isolated worktree without modifying the original checkout or its index. This commit preserves every one of those original files in eight deterministic archives, totaling **24,113,985 compressed bytes**. The [complete manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint6-preserved/manifest.json) lists each original repository-relative path, archive, size, SHA-256, Git blob SHA-1 and file mode. Archive hashes and member inventories are included.

All eight archives were actually extracted into a fresh temporary directory. Every restored byte string, size and SHA-256 matched its original; all 869 files are regular files with safe relative paths. Archive metadata is normalized, but the members' original contents, embedded dates, source identities, failed attempts, unselected cases and historical judgments are unchanged. [Verification and restoration instructions](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint6-preserved/README.md) reconstruct the original paths so that relative links in the historical records work.

The archives include the fifth-candidate DPR failure, its old-source negative controls and source fix; subsequent Bootstrap, Liquid and frame readbacks; raw JSON/log inventories and representative original PNGs; the packed Bootstrap consumer regression; and the unfinished broad-CI attribution. Some earlier subarchives intentionally preserve only JSON plus selected PNGs and inventories of other remote images. This recovery does not create missing image bytes or extend GitHub's original artifact retention.

## Previously executed candidates, freshly reconciled

The native results below are earlier actual executions, freshly checked against their GitHub run status. They are not new runs at `07f3302`, this evidence commit, or a later merge.

| Workflow result | Actual executed source | Retained scope |
| --- | --- | --- |
| [Bootstrap 45030435352](https://github.com/Proto-UI/Proto-UI/actions/runs/45030435352), success | `7871a8da3967ae4bb29cd50c655860cf87d374c0` | Eight-part controls: 15 native cases; Navbar: 12 tests / 38 cells; Button motion: 8 tests / 96 cells. The 12 historical baseline captures remain captures. |
| [Frame 45035686872](https://github.com/Proto-UI/Proto-UI/actions/runs/45035686872), success | `050a1ded7726773486fa56211aa1df7820d19919` | The selected release inventory completed 5/5. One separate diagnostic remained unselected. Actual DPR source-buffer recovery and matched measurements are preserved. |
| [Liquid 45040359902](https://github.com/Proto-UI/Proto-UI/actions/runs/45040359902), success | `b8ff9c1940723c5fd65c825c4c132628f27494d5` | Main material/library: 33 files / 960 cases; state controls: 5 files / 94 cases. Explicit `browser_only=true` selected these stages; ten logical partitions were not newly executed. |

The repaired native DPR observations retain the actual physical buffers **466×172 → 932×344 → 466×172** across DPR **1 → 2 → 1**, together with source revisions, current quality admission and cleanup results. The old stale-buffer failure remains in the archive. Native CDP composition is not relabeled physical OS IME, and software rendering near 60 Hz does not establish the original physical 120 Hz / 10 ms target.

The Bootstrap package repair at the parent also has preserved packed-consumer evidence: 6 passing checks, 20 ESM imports, strict NodeNext resolution, 8 Tabs identity comparisons, 57 compiler-source imports, 16 installed packages, and 8 source-condition regression tests. Its original failed attempt, lockfile generation, final source bindings and independent review are preserved together. Later package metadata and lockfile changes are not described as byte-identical to the earlier browser execution.

## Broad baseline is now terminal

The old broad-CI snapshot was captured while jobs were still running. The [fresh terminal readback](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint6-preserved/baseline-terminal-jobs.json) now records [run 45034808725](https://github.com/Proto-UI/Proto-UI/actions/runs/45034808725), executed at baseline `dc3b184ba10b0de53e40359c52d012b204b2cd01`: **98 jobs, 69 successful and 29 failed**, with the workflow conclusion `failure`.

The original pending snapshot is retained as historical evidence. Twenty-nine failed jobs are not twenty-nine demonstrated product defects: the inventory includes aggregate jobs and distinct browser, family, homepage, language and startup gates. Original logs and source attribution must determine each cause. The newer Search A/B and ghost-hover repairs already present on the pinned main `39ca4f7729cde9a3ebb3abfd4fd987d9db57e4de` are integration inputs, not proof that this old baseline run passed.

## Publication and next acceptance

This evidence publication changes no product code, thresholds, browser sandbox flags or workflow selection. It preserves original author history and uses the existing authorized connector with the real account identity, repository permission, current branch lease and readback. An independent two-parent integration of the pinned main can follow without collapsing the archive/source boundary.

The PR remains Draft. The locally available normal-sandbox browser cannot start in this environment, and the available GitHub connector has no workflow-dispatch operation. A fresh candidate run therefore needs an authenticated dispatch surface; a skipped PR CI job is not a substitute. The existing exhausted remote execution allocation was not retried.

After integrating the pinned main, run the complete intended Bootstrap and Liquid workflows and the matched frame workflow at the new source, preserving the selected/unselected inventory and actual artifact hashes. Read the full CI terminal results and attribute every remaining red gate. Continue the original family/part, Apple-reference, physical input/AT and 120 Hz / 10 ms criteria, and the actual consumers [shenko](https://github.com/cyjin-yl/shenko) and [OpenGreendam/verdant](https://github.com/OpenGreendam/verdant), with their own exact source pins. This record does not claim those complete journeys ran, promote a draft entity, close an Issue or authorize merging without the original review gates.
