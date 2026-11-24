# React Portal origin document repair: native validation

## Bounded result

The React Portal repair at `cd684a20ba60c1f382c88eeaea5b25eb29a0f6c5` (tree `3a4e220c6c5dc5b66bcd902540cd75cdb0ba8337`) passes the complete 82-case source regression selection, all 84 component-consumer repairs cases, and all eight public Base Tooltip cases on an owned production documentation build. This evidence follow-up changes no product implementation or test.

The implementation was authored from the existing `HC-OVERLAY-PORTAL-0001` contract. It waits for the connected origin document before allocating the first content host and retains that document for the lifetime of a live portal mount. It preserves existing Shader wiring and does not add a same-root attach guard. The two identity cases cover the main document and an iframe.

| Source or check | Actual result |
| --- | --- |
| Exact `8b052eb9` causal baseline | 2 passed, 8 failed across three complete files |
| Initial repair source `ade46dc8` | 50/50 across 11 complete source files |
| Fixed-main union `cd684a20` | 82/82 across the same 11 files plus 32 existing AdapterHost disposal controls |
| Complete component-consumer repairs file | 84/84, zero skipped, original 300-second outer allowance |
| Original production CLI build | Exit 0, 3,685 ms |
| Original `docs:build` | Exit 0, 245,913 ms within its 600-second allowance |
| Complete public Base Tooltip file | 8/8, zero skipped, 49,631 ms within its 300-second outer allowance |

The source and native test commands, original case names, terminal states, source hashes and runtime versions are retained under [evidence](./evidence/2026-11-24-react-portal-origin-native/). All original test assertions, case/hook timeouts and Chromium sandbox settings were retained. The environment used Node 24.22.3, pnpm 10.32.1, the frozen lockfile and Chromium 145.0.7632.6. A fresh offline dependency installation completed successfully.

## Source and production binding

The implemented adapter SHA-256 is `19059122572fc60b056e4f500186198d09adac50ea1c85b5855c7b70501971ae`. The identity-test SHA-256 is `8d49ba8463f1bed5bf639be013111d5d49fecf5ea89ecea1baf7d3c35c2774ee`. The lockfile SHA-256 is `6e21c4b8444ca5e4a2e427287a76a346137b65d76403579942269bfea1fc7fe8`.

The production supervisor reuses the repository's `runCommand`, `startOwnedPreview`, `suiteOrigins` and `vitestProblems` helpers. It built the actual documentation output from the clean `cd684a20` checkout, inventoried every output file, and served it through an exclusive owned loopback listener. It checked the response's `X-Proto-UI-Evidence-Source` header and page bytes against that source and build. The sorted production inventory hash is `67efa8f2b7bf3ebdddc0394dd0aeb404941611858ad1762f2bcfcaf705998a77`. The inventory remained identical through execution; the listener was retired.

The case-level `servedPageRevision` field is null. Its source binding comes from the separately retained supervising production receipt, runner and complete output manifest. This was a bounded eight-case run using unchanged repository tests, not the complete official Sprint 3 profile or a hosted CI execution.

## Failed attempts remain part of the record

The initial local native attempt and the later local union regression were interrupted; the union run ended with SIGKILL without a terminal test report. Neither is counted as a pass. Initial isolated source/native attempts encountered ENOSPC on shared `/tmp`. Pointing temporary files to an owned `/var/tmp` directory enabled the unchanged source selection and component suite to run.

The first production eight-case attempt built successfully but Chromium exited with SIGTRAP before any test executed: zero passed and eight pending. A controlled standalone launch probe retained the same browser options and reproduced failure with the original long temporary path and success with a shorter owned path. The successful second attempt changed only `TMPDIR`, verified every existing production output file against the first build, and ran the entire original eight-case file. This establishes the controlled environment remedy; it does not infer an unobserved operating-system crash cause.

## Native observations and visual inspection

The eight case records cover English and Chinese routes and Web Components, React, Vue and Vue 2. Each includes the actual browser AX description after first focus, native Tab to the sibling trigger, Escape cleanup, and runtime replacement. They record no page errors. These are Chromium AX observations, not tests with native OS assistive technology.

The primary agent and an independent reviewing agent inspected representative native captures. The two production files whose names contain `react` show the final replacement-owner stage, which switches to Web Components. They are not presented as screenshots of the initial React owner. The component fixtures exercise lifecycle behavior with sparse styling; those screenshots do not establish production style parity.

The evidence directory includes the original bytes of the selected captures, reports and failed-attempt receipts, plus SHA-256 manifests. Its narrow formatter ignore preserves these recorded bytes. The new Markdown record remains subject to the normal formatter and commit hook.

## Review and remaining scope

A separate agent reviewed the implementation, fixed-main union and native evidence without actionable findings. Those technical reviews are retained; they are not an eligible independent GitHub approval.

This closes the bounded native verification gap for PR #1770. Header typing, font preparation, Image wheel behavior, Select positioning, the complete release rehearsal, strict budgets, current-head hosted CI and platform review retain their own acceptance requirements. This record does not mark Sprint 3 or all seven Sprints complete. The published Vercel failure is a deployment quota limit and is not reclassified as the repository's git/authorize exception.

Codex materially authored the fix, tests and this record, and used the real `Codex <codex@openai.com>` commit identity and sign-off. No user certification, external review approval or release authorization is asserted.
