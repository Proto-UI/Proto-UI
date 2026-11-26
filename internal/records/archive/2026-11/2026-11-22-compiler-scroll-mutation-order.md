# Compiler scroll fixture: finish mount mutation delivery

This dated follow-up repairs the remaining asynchronous mounting boundary in the test fixture at `795b1b4958333cf904547e484acb4de9d4b3ee80`. It preserves [the earlier frame-order repair and its evidence](./2026-11-22-compiler-scroll-fixture-order.md). Scroll semantics, compiler output, host implementation, dependencies and test expectations do not change.

## Actual failure

[Shenko Nightly 44968307539, compiler job 137042231258](https://github.com/cyjin-yl/shenko/actions/runs/44968307539/job/137042231258) ran the complete compiler selection against pin `795b1b49`: 182 suites passed, one failed and two were skipped; 2912 tests passed, one failed and nine were skipped. The React ordinary-consumer rejection case observed `scrollTop = 300` at the unchanged expectation of 50. The real browser and sandbox prerequisites passed before the compiler selection; this failure belongs to the Happy DOM fixture.

The original job used Node 24.22.1, pnpm 10.32.1 and the recorded runner/browser environment. The local diagnostics also used Node 24.22.1, pnpm 10.32.1, Vitest 2.1.9 and Happy DOM 15.11.7. They ran in an isolated local checkout, without changing the active Shenko deployment or running another model request. [The retained original CI receipts](./evidence/2026-11-22-compiler-scroll-mutation-order/original-ci/compiler-summary.json.gz) include the full artifact identity and original counts. That original failure remains a failure.

## The missing boundary

The previous helper temporarily captured animation frames and drained them inside `owner.act`. An empty frame map did not imply that mounting had finished all work which could _schedule_ another frame.

Happy DOM's `MutationObserverListener.report` delivers mutations through its owner window's timer. The emitted `endFollowContentChanged` handler can schedule an end-follow animation frame when those mutations arrive. Thus the helper can observe zero frames, return and restore ordinary scheduling while a mounting mutation is still pending. Later, the valid end-follow frame sees the injected request geometry (`scrollHeight = 400`, `clientHeight = 100`) and writes the end position 300.

That work is independent of the rejected reveal. The draft [target-reveal identity and lifetime criteria](../../spec/contracts/C-SCROLL-TARGET-REVEAL-0001.yaml) reject invalid targets before a host request; the draft [end-follow criteria](../../spec/contracts/C-SCROLL-END-FOLLOW-0001.yaml) allow existing valid end work. The host test `preserves an older pending end request after an invalid reveal` in `packages/compiler/test/native-scroll-reveal.test.ts` already covers the distinction. A fixture should finish its mount work before imposing an absolute position oracle for an unrelated rejected request.

## Controlled observation

The diagnostic intercepted the real Happy DOM owner timer and delayed only mounting `MutationObserverListener.report` deliveries by 100 ms. This delay is an explicit schedule injection in the temporary diagnostic, not part of the fix. The original four rejection outcomes and the 50/70 position assertions remained intact. Both control runs also waited for the delayed work immediately before the original 50 assertion, making the late work observable rather than depending on a favorable timer race.

| Observation | Old helper | Helper with mutation drain |
| --- | --- | --- |
| Mount boundary | Returns in round 0 with zero frames but seven pending mutation timers | Delivers all seven mutations, executes their three captured frames, returns in round 1 with both queues empty |
| End-follow's actual write on the observed surface | After request geometry: 50 → 300 | Before request geometry: 0 → 0 |
| Four invalid requests | Each returns `rejected/unavailable`, synchronously 50 → 50 | Each returns `rejected/unavailable`, synchronously 50 → 50 |
| Original position oracle | Fails: actual 300, expected 50 | Passes: 50 |
| Later valid reveal | Not reached after the failed assertion | `dispatched`, 50 → 70 |

The negative trace binds the late frame to `endFollowContentChanged` and its actual `applyScroll` setter stack. The positive trace retains the same diagnostic and scheduling injection; the only source difference is the four-line final fix. This establishes a reachable legal ordering with the same failure. The original Nightly did not capture these setter or scheduler events, so this is not a reconstruction of its exact timer schedule or proof that it had only this possible cause.

Two earlier instrumentation probes targeted Vitest's populated global timer aliases. They intercepted no mutation timers and passed all 28 cases. Their receipts and patches are retained as ineffective probes, not as evidence that the hypothesis was tested or as additional independent successes for the fix.

## Repair and limits

After each existing `owner.act` frame batch, the fixture now awaits the public `happyDOM.waitUntilComplete()` API before testing whether its captured frame map is empty. Mutation delivery can enqueue frames while that await drains real Happy DOM tasks. The next existing loop round then executes those actual frame callbacks before request geometry is injected.

The eight-round frame budget, explicit continuously-rescheduling failure, `finally` scheduler restoration, test selection and test deadline remain unchanged. The public drain does not add a sleep or replace actual callbacks. A Happy DOM task that never completes would still fail under the existing test deadline; the eight-round bound specifically limits successive captured frame batches. The final test contains no private owner-window access, delay injection, setter spy, diagnostic request wrapper or added pre-oracle await.

All 29 original `expect` expressions and matcher calls are textually identical under a TypeScript AST comparison, including expected values. All seven original titles are identical, with no `only`, `skip` or `todo`: four profiles still execute 28 cases. Both existing users of `mountSettledScrollFamily` receive the corrected mount boundary. Production and contract sources remain unchanged.

## Source-bound validation

Each row executed the entire original 28-test file, with one worker and no test-name filter.

| Run | Passed / failed / skipped | Wall seconds | Interpretation |
| --- | --- | --: | --- |
| First timer-alias probe | 28 / 0 / 0 | 13.658 | No actual mutation timer intercepted |
| Document-window alias probe | 28 / 0 / 0 | 13.268 | Same ineffective interception boundary |
| Actual owner timer, old helper | 27 / 1 / 0 | 13.722 | Controlled negative reproduces the original assertion |
| Same timer control, repaired helper | 28 / 0 / 0 | 13.683 | Controlled positive drains mounting before geometry |
| Final source, ordinary timing, no instrumentation | 28 / 0 / 0 | 13.115 | Exact final executable test passes |

The final test SHA-256 is `bc44131a01668c3a75675d91891d032f4e66f4ff87a5bc218f6fd99bdd484b88`. Selected input hashes were unchanged during every run. [The machine summary](./evidence/2026-11-22-compiler-scroll-mutation-order/summary.json) binds each run to its exact base plus retained patch; it does not relabel the base Git HEAD as a clean tested candidate. Original logs, complete Vitest reports, patches and full traces are retained with raw and stored hashes in [the manifest](./evidence/2026-11-22-compiler-scroll-mutation-order/file-manifest.json). Compressed files use gzip `mtime = 0` without changing decompressed bytes.

```sh
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/scroll-reveal-consumers.test.ts --maxWorkers=1 --minWorkers=1
corepack pnpm@10.32.1 exec prettier packages/compiler/test/scroll-reveal-consumers.test.ts --check
git diff --check
```

This completes the bounded fixture repair and its local red/green evidence. It does not estimate a failure rate, establish real browser layout, or replace the complete compiler suite on the new immutable upstream revision. Actual upstream CI/DCO and published independent review remain separate acceptance steps. The next downstream pin and generated manifest must be produced normally from the reviewed commit; an unchanged generated UI payload would not by itself imply an identical Shenko binary, because the generated manifest is also embedded.

## Agent provenance

Request paraphrase: diagnose the repeated compiler rejection failure, preserve the old failure and every expectation, and fix the actual mounting boundary without patching a running Nightly or changing runtime semantics. The OpenAI ChatGPT coding agent authored this fixture change, diagnostic and dated record from the public repository and its installed dependencies. No proprietary source was copied and no human approval, uploaded screenshot, external publication or merge is claimed by this record. Internal setter and scheduler traces are the applicable evidence for this scheduling defect; no image is presented as proof of browser behavior.
