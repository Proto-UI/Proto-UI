# Docs startup query observation

This is a bounded C-group diagnostic increment for PR #921 on `d92141c57ebab192f3741e7336c1ec0f24b61c5c` (tree `8dda1bb967cc066db4036e7e085cb7d5c93ebd75`). It changes test observations, not Website, Runtime, Adapter or family semantics.

## Same-failure evidence

The original main CI run `40041038837` used checkout `6baaeba8797abfa90c9f5dc63e56947979bd1cea`, whose tree equals the source tree above. Its Search suite reported 16 passed and 14 failed. Reading its previously uncollected runtime artifact adds the following facts without changing those verdicts:

- Six initial Search failures have their first active-command and fully-ready observations 127–857ms after the original one-second deadline. Their original readiness evaluation entered 71–693ms late and found no command. Observer delivery is not synchronous node creation or paint, and does not establish continuous absence throughout the deadline.
- Eight Docs role failures each retain one original request. The uncached injected-script `rawEvaluateHandle` observation spans 1089.954–1736.144ms. Browser selector observations span 2.9–4.7ms; the original getter brackets are zero or 0.1ms. Zero means equal sampled timestamps at the recorded resolution; no tick length was measured. The long span still contains protocol, engine, scheduling and observation costs; it is not a demonstrated compilation or transport cause.
- The Brutalist reconnect failure retains its original three reads and writer/MO observations. A late successful value is not a passing one-second poll or proof that the complete UI committed before its deadline.
- Both S4 locale failures occur in the original 60-second global previewer startup wait before the settings journey. The Matrix does not request lazy previewers; its default is eager. `data-inited` is written before asynchronous rendering, so it alone is not mount completion. The artifact has no per-previewer missing-state journal.

The lifecycle entities keep their existing status. In particular, `C-LIFECYCLE-0008` is active; the related draft lifecycle and host-projection entities are not promoted by these observations. There is no new stable Website latency guarantee.

## Diagnostic boundary

The pinned Playwright 1.58.2 observer now brackets the original utility-script and Chromium delegate calls, actual CDP transport send and session response. Actual CDP IDs and session IDs are related to the original query/call/attempt. The Node send method returning is not browser receipt; the browser selector/getter entries remain the browser-side execution observations. Original arguments, Promise objects and thrown values are retained. No context, injected script or selector is resolved early, and no additional CDP request is issued by these wrappers.

Docs separately installs a native CSS/MutationObserver target journal before the original navigation. Its bounded rows and first-target/first-role milestones are separate from the original SDK query and verdict. It adds an init-script setup command and observer/console work; it is not zero-overhead timing. Brutalist uses the same passive SDK wrappers around its original data-family queries and retains its existing mutation, utility-realm, native-input and physical-owner controls.

S4 retains the original nonempty-previewers / initialized / nonempty-host predicate and its short circuit. The same callback records its first miss, plus a bounded change journal and the last sample. It does not enumerate every missing previewer or strengthen the existing skeleton-accepting predicate. Collection and file waiting happen after the original verdict, each with a two-second observation bound; underlying operations are not canceled. Missing diagnostics cannot replace the original error.

Original assertions, one-second polls, case/hook deadlines, input sequences and keyboard-owner checks remain. Focused controls and actual-browser combination results must be bound to the final candidate separately. This record does not claim that the new diagnostics have fixed the original production failure, that all CI is green, or that an independent maintainer has approved the head.

## S4 collection follow-up

The first source-stable local combination actually completed with 294 passes and three original S4 150-second case timeouts; no cases were skipped. Both locale records include 18 `shadcn-tabs-trigger` / `transition-all` / `used-value-rounding` page errors. These are concrete Adapter admission diagnostics, not proof that they explain every timeout. The two locale journal reads did not retain a journal. The Chinese read exceeded its separate two-second collection budget; the English completed collection omitted the settled status, so its null projection cannot distinguish fulfillment from rejection. The original records remain unchanged.

The follow-up retains the actual Node predicate function text and hash, records the original navigation/wait/journey/close phases, and preserves the collection's real fulfilled/rejected/budget-expired status. Same-predicate changes stream through console before late collection. A separate pre-navigation MutationObserver reads only the first eight delivered targets per batch, at most 128 emitted rows, with bounded ancestor lookup for recognized previewer/host nodes. It performs no whole-matrix query or layout read. Skipped records and observation costs remain explicit; this is neither a complete missing-root census nor an acceptance oracle.

Both public Playwright calls use main world by default. The pinned SDK's timeout path can await an abort evaluation after its progress race rejects, and Vitest's case timeout does not cancel the original async body. Without actual internal phase observations, neither behavior is asserted as the cause of this run. The new phase and delivery observations must be verified separately; the first 297-case result remains failed.

## Timed-out case ownership

The same local phase trace records the next locale starting before the previous context's close completed. Vitest's timeout leaves the original asynchronous body alive, so a `finally` after a stalled SDK await is insufficient as the only resource boundary. A separate real Vitest-runner control retains the intentional timeout in both versions: without the finish hook the next case sees the prior modeled resource open; with the hook that check passes while the original timeout still fails. This is a resource model, not a browser reproduction.

The two S4 browser files now register imported `onTestFinished` immediately after context creation. Both the hook and original `finally` share one memoized original `context.close()` Promise. This matters because a second raw Playwright close call can return before the first close finishes. The hook does not replace the original assertions or cancel the async body, and its configured hook timeout or a rejected close remains a failure; absolute hard reclamation is not claimed. Actual browser close events and the following case's start remain separate observations to verify.
