# d995 input and preview-retirement diagnostic

Date: 2026-11-23 UTC. Scope: source-bound diagnostic of the existing development browser journey. These observed probes are not an unobserved canonical acceptance receipt or GitHub approval.

## Frozen source

- Head: d9958d163436ea08d4a19b325d9e7f5dad3dc951.
- Tree: ea426866a21cd2cca2c5d166b4b0c2abfdd2f05c.
- Application/canonical source was never edited in this investigation. All 11 frozen hashes, HEAD, and clean git status matched before and after every completed worker.
- The original 90-second Astro readiness boundary, original canonical input calls, iframe sandbox, 1200-second canonical supervisor, and 250-millisecond preview cleanup acknowledgement deadline were retained.
- Chrome 145.0.7632.6, Playwright 1.58.2, Node 24.22.3.

## Startup observation

The first standalone exact Astro CLI on owned port 4396 became ready 26.038 seconds after spawn. It did not reproduce the earlier 90-second empty-log failure. Its recorded stderr EPIPE appeared during intentional process-group termination, after readiness. Earlier resource-pressure samples are contextual evidence, not proof of the historical startup cause.

Artifacts: astro-startup-4396-75d5/status.json, stdout.log, stderr.log. The owned process and port were retired, its private TMPDIR removed, and the source remained clean.

## Unchanged canonical journey with passive v3 observer

The single v3 run started 17:30:10 and finished 17:35:48 UTC. It reached the real page and completed 19 receipt entries: 17 passed and two failed:

1. edit-reject-recover-same-revision-source-and-preview: preview cleanup acknowledgement exceeded its original 250-millisecond deadline.
2. cancel-running-edit-and-reopen-fresh-owner: subsequent 30-second wait timeout.

The observer added original event target, constructor, composed path, full source value identities, byte equality, long tasks, and the first six untrusted input stacks per outer document. It did not dispatch input or acknowledgements. All application input calls remained the canonical calls.

The first source fill emitted 331 trusted InputEvent events, all targeted at the actual textarea and all with inputType=insertText. The first event changed the source; the remaining 330 had exactly the same full source value already bound by the panel. The source guard worked: revision advanced from 11 to 12 once.

The first-to-last input window was 662.2 ms within a 911-ms long task. The retiring revision-11 iframe received dispose about 703.7 ms after the first input. The parent received disposed about 761.3 ms after the first input, when the source iframe had already been removed. The previous Vue2-to-WC retirement acknowledged in about 11.8 ms. The second source fill emitted 329 trusted events over 563.1 ms and advanced revision 13 to 14 once.

The full bad input is 6724 UTF-8 bytes, SHA256 31cdc45eb20475366ca7ea0162d9e72b3425273629db5e10fc5d608549ad2035. Its 179 newline characters plus 152 nonempty text segments equal 331 events. The recovery input has 178 newlines plus 151 nonempty segments, equal to its 329 events.

This rules out the hypothesized untrusted CustomEvent echo as the source of these repeated events. It does not by itself identify the slow listener or native rendering operation.

Artifacts:

- observed-browser-v3-d9958d163436/status.json
- observed-browser-v3-d9958d163436/browser/receipt.json: SHA256 900040b5c5a5f966cad2eb2ad38e0e335578581926bdd294587bf64c6d2d7303
- observed-browser-v3-d9958d163436/trace.jsonl: 719253 bytes, SHA256 e10e00477c9df8dd37dadc34877681238f52dc5dcf07676020d25d1b8ef0d6d9
- observed-browser-v3-d9958d163436/analysis.json: SHA256 a64d71be27ee2ac1d735b1a4fe8a5e91e4547523fbcb739df70b5b0339ef831c

The supervisor child and owned Astro PID no longer existed, port 4386 was no longer listening, and the private TMPDIR was removed.

## Real single-fill comparisons

A separate finite diagnostic used the same Chrome, the same full source strings, one actual locator.fill per case, and a lightweight passive event counter. The actual application page came from its own exact Astro CLI service; the generator was not rerun.

| Case | Trusted input events | First-to-last input event interval | Entire fill call |
| --- | --: | --: | --: |
| Bare textarea, no product listeners | 331 | 4.8 ms | 333.6 ms |
| Bare textarea matching actual computed textarea styles | 331 | 2.9 ms | 243.8 ms |
| Actual d995 compiler panel | 331 | 688.7 ms | 991.6 ms |

The bare textarea events already observed the complete 6724-byte value; event.data alternated nonempty line text and null for newline insertion. This establishes that the event multiplicity occurs without the product. The actual page's event interval median was 1.7 ms, compared with 0 ms at the timer resolution in the bare pages. Its long task lasted 947 ms. The real panel's revision advanced only once, from 1 to 2.

The actual probe only entered the invalid source once and observed the expected PUI1004 source rejection. It did not test recovery or claim that cleanup had passed. No acknowledgement timing conclusion is drawn from this smaller probe's empty message list; the complete v3 trace supplies that evidence.

Artifacts: single-fill-probe-d995/status.json and probe.json. Full probe JSON: 416009 bytes, SHA256 7c0ddab4dd4cd9ce503766a546c3b8e738822dd2f24a3f15d5e179514badcc58. Total worker time 108.47 seconds. Browser/server retired, port 4396 closed, private TMPDIR removed, source stable.

## Source findings and remaining uncertainty

The actual panel input callback reads the selected source file and textarea value, returns immediately when the same content is already bound, and otherwise updates the source map and calls changed(). renderState does not write textarea.value, selection, or replace the editor. The only textarea.value writes are initial source installation and a selected-file change.

The installed Playwright implementation takes the textarea fill path through injected.fill, then keyboard.insertText and one CDP Input.insertText call. The canonical source contains one fill per intended edit; the probe likewise recorded fillCalls=1 for each case.

A further explicitly authorized one-fill CPU/layout profile attempted to collect actual ancestor event listeners, CPU self time, and Layout/RecalcStyle metrics. Astro became ready after 87.18 seconds. The panel did not reach ready/failed within the retained 45-second diagnostic readiness wait. Therefore no fill or profile was recorded. The cause of that readiness timeout is undetermined. This failed attempt was not restarted.

Artifacts: single-fill-profile-d995/status.json and probe.json. Probe JSON SHA256 8431bb05dee4cd91b385a764835490a7067a3294eee1e499b45773674bcc7690. The failed worker retired the owned browser/server, closed port 4396, removed its private TMPDIR, and confirmed clean unchanged source.

No product repair is justified yet by a specific measured hotspot. A next controlled profile should capture readiness phase/diagnostics on failure, then distinguish actual JavaScript listener work from native layout/style work for the same single fill. The cleanup deadline must not be enlarged, reset, or moved to bypass the long task, and the canonical edit must not be replaced with a synthetic shortcut.

## Repository archive binding

This diagnostic packet is retained with its complete raw receipts, passive observers, finite probe drivers, failure screenshots, and the eleven source snapshots in the [immutable evidence manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint5-browser-retirement-diagnostic/manifest.json). Every gzip file round-trips to its recorded raw SHA-256. Per-file comparisons to the archive worktree are provenance information, not execution on that newer head.

The observed 17/19 result remains a failed, instrumented diagnostic. The later CPU/layout-profile attempt contains zero cases and no executed fill or captured CPU profile. Neither result is an unobserved canonical acceptance receipt. The separate public db747 browser job stopped before its journey at font setup; this archive does not convert it or the earlier cleanup failure into a pass. The original 250-millisecond acknowledgement requirement remains intact.
