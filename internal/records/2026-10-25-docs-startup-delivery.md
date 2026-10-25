# Docs startup delivery and S4 observations

Date: 2026-10-25. Scope: the #883 C-group follow-up after #921 merged. The baseline is main `7181a93a5ec5cad43936a72e31d5477d5488733a`. This record adds observations to the previous day's record; it does not amend an acceptance criterion or promote a draft entity.

## Accepted Hero oracle

#926 merged the source-bound Rhea/Luma profiles and the secondary, icon-free internal Demo action. The [maintainer's follow-up](https://github.com/Proto-UI/Proto-UI/pull/921#issuecomment-6390983097) requests migration of the two remaining Hero assertions. The test now scopes the exact internal anchor under `#homepage-hero-actions`, retains the count, text and href, rejects both icon metadata and SVGs, and checks the exact family secondary token. The no-JavaScript branch checks the authored secondary variant. The sidebar case is unchanged.

On unchanged main, the original 43-case local combination reported 38 passes and five failures: Search 30/30, NativeLinks 8/10, and three S4 case timeouts. With the test/observation candidate, the same combination reported 40 passes and the same three S4 timeouts. Both Hero cases passed, including the original four-runtime/two-family journey and no-JavaScript checks. This is an oracle migration, not a production startup repair.

## Current main CI remains a counterexample

Main CI [40147277848](https://github.com/Proto-UI/Proto-UI/actions/runs/40147277848) has a successful 47-package build and 47-manifest check, but its runtime jobs are not green. The package policy reports four PASS and five Finf ADVISORY entries, not nine strict budget passes. The general job stops at 78 public-docs catalog drift findings. Four browser shards (1, 2, 4 and 8) exit 124; complete shard summaries cannot be inferred for those jobs.

Its Search suite reports 13 passes and 17 failures. The eight initial Search readiness failures and their same-case startup journals distinguish two observations:

- Seven readiness evaluations first enter after the original one-second deadline; one enters 38ms before it.
- The exact active command is first observed ready 11–1214ms after that deadline in all eight cases. At the original browser entry, the exact active-command count is zero. These are observer delivery times under the original test's clock convention, not a continuous absence proof or physical paint timestamps.

Nine of the ten Docs role cases fail. Their exact combobox observation batches reach Node 202–336ms before the original query. Eight failures still await the first injected-script `Runtime.evaluate` at the verdict. The ninth first evaluate returns in about 947ms, but the subsequent getter command returns about 5ms after the deadline. That case must not be grouped with the eight still-pending first evaluations.

## Additional SDK observation

The pinned Playwright 1.58.2 diagnostic retains actual session/CDP IDs and now observes the original pipe writes and the original NUL-frame dispatch/scheduler callbacks. It adds no write callback, extra parse, early context resolution or warmup. It preserves original arguments, return values, Promises and throws; stream drain is passive observation, not per-message acknowledgement. Retained expression strings are hashed after the verdict.

In the ten passing local Docs cases, the first 305324-character expression has the same SHA256. Transport entry to the last write return spans 0.372–1.183ms; the observed stream drain follows in 0.223–0.753ms. Last write return to the chunk that completes the matching response spans 5.507–216.964ms. The original frame scheduler-call observation to callback entry spans 0.012–0.070ms. These local passing intervals cannot be assigned to the nine CI failures, whose older observer lacks the new pipe boundaries.

The remaining write-to-response interval includes pipes, browser scheduling/evaluation, return delivery and Node scheduling. Completing a NUL frame is not necessarily the first response byte; the scheduler-call observation is not an internal queue-insertion timestamp. Rows retained after the matching response need their recorded timestamps rather than array order. Zero dropped/error rows in these cases does not establish universal transport coverage.

A separate single-expression Chrome 155 capability control binds exact source bytes, context, script, isolate and renderer process through actual Debugger/rundown fields. Its compile trace scopes have empty argument payloads, so they cannot be uniquely bound to that expression. This does not measure the Docs expression's compilation time or identify browser receipt of its command.

## S4 first-missing owner and separate failures

The original S4 Boolean, short circuit, input sequence and deadlines remain. Additional fields reuse the host already queried by the predicate and identify its previewer, Demo, declared runtime, pending/inert state and text. Console errors use a separate bounded channel; a frozen array snapshot prevents later messages from changing an earlier evidence object. Neither channel changes the original page-error assertion.

Two private source-observation runs retain the original 150-second locale failures. In both locales, the first miss progresses from the WC `demo-base-accordion` previewer to its React peer. The WC host has a child even while its surface-ready Promise remains pending; the original predicate is not a full committed-projection oracle. The React peer finishes `loadDemo` and `loadPrototypes`, enters `renderDemo`, completes its Adapter-module load, and then has no `loadReact` return recorded before the deadline. Vue and Vue2 progress farther, including long nextTick/rAF waits. All 108 classified runtime-request observations per locale have zero recorded drops/errors; their matching requests have HTTP 200/completion events. Completion of a shared module transfer is not evaluation or import-Promise fulfillment, and Node event receipt is not pure transfer time.

Each locale also records six Shadcn Button and eighteen Tabs Trigger preflight errors. Their physical hosts belong to S2/S3/S5 examples, have no Previewer ancestor, and are distinct from the missing Accordion host. They record applied border widths `[[0],[0],[0],[0]]` changing to `[[1],[1],[1],[1]]` with `transition-all`. The existing draft shadow-split/H1 boundary and `T-WEB-COMPONENT-SHADOW-S2-0001` reject unsupported animated border width. These facts do not justify removing that guard or identify it as the cause of the React wait.

In the private paint trace, the first light trigger click and subsequent Switch/Checkbox reads succeed. The original open-marker assertion then starts `page.screenshot`; it has not returned when the 150-second case closes the context. The case has not reached the first close or closed-paint assertions. This run is a screenshot wait, not evidence that the click was never delivered.

Private producer instrumentation is restored after observation. Its runs are not clean-head acceptance. The original failed runs, local passing controls, canonical CI, visual review, exact-head combination and independent acceptance remain separate evidence. Original one-second assertions, case/hook deadlines and keyboard-owner controls are retained; the production startup and S4 findings remain open.

## Complete preview artifact envelope

A later clean `06a752a861b0ceaaa549f1a019d7b15c5ea4178b` build, containing accepted main `357068f0f371dd40826b81da43bd4ef5df73bee7`, produces 651 pages and 3853 complete files. Their expanded size is 107,503,910 bytes; the complete ZIP is 21,525,712 bytes and the largest file is 4,652,800 bytes. HTML accounts for 91,764,695 bytes. The original generated-artifact regression rejects the same ZIP at the 104,857,600-byte expanded limit, matching the earlier PR preview job's failure. No route or asset was removed to fit the envelope.

The bounded expanded limit is increased to 128 MiB (134,217,728 bytes), leaving 26,713,818 bytes above this measured producer. The 50 MiB compressed, 25 MiB per-file, 20,000-file and independent ZIP path/directory limits remain. Extraction and sanitation still share one default envelope and retain their hostile-input checks. The unchanged generated-artifact test must compare every admitted and sanitized file with this complete producer's bytes. Local admission does not establish a deployed service, its capacity, a Ready catalog generation or runtime/browser acceptance.

## LanguageSelect dedup and original envelope follow-up

The [maintainer's P2 coordination](https://github.com/Proto-UI/Proto-UI/pull/1002#issuecomment-6394765245) requests trying the already published [#1005 head `4ecb49e09e9ebda35a76d5d768ec25b764572a01`](https://github.com/Proto-UI/Proto-UI/commit/4ecb49e09e9ebda35a76d5d768ec25b764572a01) before expanding capacity. This follow-up reuses its three exact LanguageSelect source/test blobs, originally extracted from #982 / #933, and restores the accepted main's 100 MiB limit and README. No content, route or asset is removed. The previous 128 MiB attempt and its measured results above remain historical; they are not evidence of admission under the restored limit.

The existing processed Astro module now owns the locale initializer once per document, retaining both controls, per-root guards, DOM-ready/Astro page-load handling, locale paths, cookie and localStorage behavior. The existing two-instance test and fourteen lifecycle cases are reused without changing their assertions. This is a source combination of the published repair, not a second implementation or completion claim for #1005. Its reported canonical 651-page / 3853-file result does not certify this branch: the complete combined producer, every-file default admission and C-group browser combination require their own exact-source results. No production Search startup, S4 missing-host or paint-wait repair is claimed by this bundling change.

The actual saved combination then built651 pages and3853 files (669 HTML files), totaling104,051,807 expanded bytes. Its complete20,433,697-byte ZIP passed all62 original preview checks under the restored104,857,600-byte limit, leaving805,793 bytes. All101 focused unit tests passed; the whole-site typecheck reported969 Astro files, zero errors/warnings and14 hints. These are precommit results on the saved candidate, not canonical hosted CI or a deployed preview. The margin is measured current headroom, not a long-term capacity guarantee.

## Original query browser dispatch observation

A separate local single-case capability run adds the `devtools` trace category to the prior private observation. The original Docs Shadcn 1440 query passes; it is not a replay of a hosted failure. Actual CDP ID 37 appears once at each Browser and renderer command stage. The exact command contains a 5.465ms `EvaluateScript` scope; Browser forwarding to renderer entry spans 354.134ms. These inclusive local scopes neither establish pure compilation time nor explain the earlier CI interval. The complete trace has no recorded data loss. The private post-context page-session detach error remains recorded separately from successful trace-stream/browser-session cleanup.

One existing CI-enabled Docs Shadcn 1440 case now captures a bounded test-only trace with `devtools`, `devtools.timeline` and V8 compile categories. It uses the actual original query CDP IDs and the existing pinned Frame ID observation, sends no Runtime/Debugger query or warmup, and freezes the original verdict before recording a clock-sync bracket. Browser dispatch occurs after pipe/UI/session routing, not at raw pipe receipt. Browser and renderer flow IDs are process scoped; exact command IDs, method, frame/process and strict nesting must be checked before joining scopes. Nested compile and evaluate durations must not be added or called pure compilation.

The collector has an exclusive output directory, a 32MiB stream bound, finite setup/read/cleanup waits and explicit incomplete/ownership-debt reporting. Late start/complete events retain ownership for bounded cleanup. Diagnostic failures cannot replace the original verdict or prevent its context close. The original one-second role assertion, 180-second case deadline, other Search cases and keyboard-owner controls remain. Hosted failure attribution, Brutalist late getter, S4 missing host and paint click remain open until their own same-run evidence is captured.
