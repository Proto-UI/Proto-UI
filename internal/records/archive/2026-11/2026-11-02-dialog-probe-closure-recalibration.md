# Dialog probe closure re-calibration — current input binding only

AI-assisted by dot for cyjin-yl. Related #1161 / #856 / Draft #1210.

## Retained failure and provenance

At head `6202aabd11b7964614a4cad4e7aa0afbeb4c3409` (tree `3e13d7f0f650e1d5fad66c9ce3f0b9382008142c`), matched workflow run41450060640 jobs125292768504/125292768973 each stopped at124/125 source-binding controls. Neither side executed its native Dialog journeys. The workflow copies the same complete three-file candidate probe closure to both subjects; the Timer fix changed `browser-harness.ts` from historical e3792a3e to0f150fc2. These are binding failures, not measured new Dialog geometry failures.

Keep three evidence epochs distinct. The original geometry oracle comes from run37756502706/artifact11540591374 (probe06d6, closure e50e6c8b/9ac8ced9/4bbc332f); its package does not contain the newer process-exit integrity receipt, so it is not proof that the current complete verifier passed. The historical accepted source table was updated in d28b17bc (#901), and its complete matched execution source is [run38995355607](https://github.com/Proto-UI/Proto-UI/actions/runs/38995355607), not377.

In the [author's 2026-11-02 provenance review](https://github.com/Proto-UI/Proto-UI/pull/1210#issuecomment-6581592461), the author reports re-downloading and checking the389 originals: baseline12086688715 ZIP SHA256 `4e98c34dbdcd2807cc02a6b18c2dc0f29d6db156faa38859965a99478606a628` and candidate12086713903 ZIP SHA256 `41b9d3ee0ebaa820fcb4be4944e66745a309cc84a1f9f5d6580c712fc27368ef`. Both use181f88d9/e3792a3e/4bbc332f. Baseline product exit1/0-of-8 is historically classified; candidate product exit0/8-of-8. The author reports complete process-exit/report/cleanup bindings and149 referenced PNG byte/header hashes, explicitly not149 visual reviews. These are attributed author observations: this record's writer has read that report, not independently re-executed the historical source or re-verified those ZIPs.

Current run41450060640 instead uses181f88d9/0f150fc2/4bbc332f and both native steps are skipped. Neither historical run calibrates this new closure. The original fixed baseline15d864de, eight exact failures (seven geometry journeys and one unavailable runtime), partial-coverage limitations, screenshot checks and process-exit/runner/unhandled/cleanup checks remain unchanged.

## Separate two assertions

1. `CURRENT_PROBE_HASHES` binds all three actual candidate input files. A dedicated source check compares the independently listed complete paths and real SHA-256 bytes. Missing, extra and independently changed members must fail. This makes a new matched capture possible without falsifying its calibration status.
2. `PROBE_HASHES` remains the historical accepted table, byte-for-byte. `verifyExpectedBaseline` and all its prior assertions remain byte-for-byte. A new negative control must reject CURRENT_PROBE_HASHES even with otherwise valid historical synthetic data. Thus a new baseline artifact still fails classification with **Uncalibrated probe closure**. Nothing in this change grants it a pass, generic expected failure, or allowance for arbitrary geometry errors.

The existing workflow, permissions, browser options, install process, budgets and native cases are unchanged. Its baseline classifier runs after real native execution and artifact upload remains unconditional. If execution reaches that point, the new current closure remains UNCALIBRATED until the complete new source/probe/exit/log/observation/PNG/font/browser evidence is reviewed. Earlier setup/runner/geometry problems can still fail first and must be retained, not relabeled as successful calibration. Later calibration, if justified by actual evidence, needs its own explicit review; no automatic historical acceptance is introduced here.

## Preparation snapshot (before local execution)

Implementation is prepared, **UNRUN**. The old source-binding control is renamed to accurately say current complete closure; the existing workflow/geometry/identity/runner negative-control body after that first test is unchanged. New synthetic source-bound controls do not constitute native evidence. Applicable fixed local tests/format, actual exact-head paired CI, raw artifacts and independent calibration review remain pending. Author-provided6202 Header11-case evidence is separate and does not substitute for Dialog matched execution. The PR/Issues are not closed or approved.

## Local evidence update — 2026-11-02 16:36 UTC

The preparation paragraph above is retained as history, not the current execution state. On 2026-11-02 at 16:18 UTC, the bounded pure-checker matrix actually ran: old source 91/92 (exit1, current helper source-binding mismatch), candidate 99/99 (exit0); official format checks returned baseline0 and candidate1, the latter limited to this test file and record. All four phase source/config/dependency/lifecycle postguards were clean. Exact test names, TAP plan/pass/fail totals, exit status, skip/todo and asynchronous-error boundaries were checked. The original failures and raw output remain evidence, not retroactive passes.

At 16:34 UTC, the two-file read-only formatter export detected all24 negative controls. The MJS output was strictly AST-and-comment equivalent and is adopted here. The Markdown output was rejected by the unchanged strict comparison because its final paragraph changed an ordinary newline into a space; that payload exit1 is retained. Instead of ignoring Markdown whitespace, this revision explicitly authors the two source links as independent list items and adds this factual update. Those prose edits are not claimed as format-only equivalence. A new fixed data-export/checker/official-format result must be bound separately to this revised candidate in its delivery comment.

The local pure-checker run is not the complete132-control CI command: other workflow and real child-process integrity tests were not executed in this narrow environment. The current native Dialog closure remains UNCALIBRATED. The official6202 Header11-case pass is separate, and no new Dialog browser, screenshot or historical calibration is claimed here.

## Coordination

- Owner coordination: https://github.com/Proto-UI/Proto-UI/pull/1210#issuecomment-6579951927
- Formal three-path scope: https://github.com/Proto-UI/Proto-UI/issues/1161#issuecomment-6580245392
