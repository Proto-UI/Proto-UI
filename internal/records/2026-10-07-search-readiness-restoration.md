# Search readiness restoration and independent module loading

## Scope and retained history

This candidate starts from `c8d0ca8cecd6ac12b27678df40a86722d4795068`. It addresses [#848](https://github.com/Proto-UI/Proto-UI/issues/848) and the directly related cold-open dependency in the Search service. It changes no shared Adapter props, projection publication, public Button semantics, Pagefind wire behavior or entity lifecycle.

The original failures and the later `e64c695be` props-revert A/B remain historical evidence. Both A/B trials reported 29/30 with the same light-390 miss; they do not support the proposed rollback as a repair. They do not prove that the optimization can never contribute to any delay. The current baseline already passes the restored gate before the module-loading change. No historical initial-ready root cause is established here.

The two metrics have different boundaries:

- `site-search-commands.browser.test.ts` measures the active open Button within 1000ms after the navigation's `networkidle` stage. It does not measure whole-page startup or Pagefind input latency.
- `.github/workflows/search-startup-profile.yml` is a capture diagnostic for two pinned historical application trees, scoped to #777/manual invocation. Successful capture may retain a failed readiness verdict. It is not a current-product production 1-second gate. The separate production recovery suite uses real built Pagefind assets; its command polls do not establish an end-to-end open-to-input 1-second guarantee.

Earlier dated records are preserved. This record does not relabel old captures, change the historical profiling lane or close #848's unresolved attribution question.

## Changes and discriminating controls

The initial-ready budget and the self-contained browser waiter's literal both return from 5000ms to 1000ms. Every original browser case, assertion and case timeout remains. Successful and failed readiness observations are now persisted after the browser decides the verdict, without file I/O moving the deadline.

The observer records each command's projection owner and generation. The waiter accepts a historical ready timestamp only for the current active command's owner/generation. A controlled serialized-waiter regression supplies an old owner ready at 999ms and a new owner at 1500ms: the original helper reports 999ms; the repair reports 1500ms and rejects it. This is clock/DOM injection evidence of an oracle defect, not an observed browser delay. Existing on-time observations with late RPC completion still pass.

After a successful index HEAD probe, runtime and default-UI imports now start together. UI construction still waits for both and for the current open session. The existing 5000ms service import deadlines, close/disposal fences, handled late rejections, silent intent failures and cached preparation remain. There is no unconditional startup preparation or hidden Pagefind UI construction.

An actual Astro-script service test holds HEAD, then holds the runtime import. The original source starts runtime once but UI zero times; the repair starts both once and constructs nothing until runtime resolves. Network/module completion is injected, while the existing command Buttons and Adapter paths are real. The reconnect test's former serial-import premise is corrected to require an unchanged UI-import count after disposal, no stale construction, and exactly one construction on the new open. A first run retaining that obsolete premise failed; it is not counted as successful validation.

## Executed local evidence

On 2026-10-07, Node 24.21.0, pnpm 10.32.1, macOS arm64 and installed Chrome 154.0.8037.98 were used. Vitest thread/fork concurrency was limited to max 2/min 1; this is not the default hosted configuration.

- Before the product patch, the strict 1000ms current-baseline matrix passed 30/30. The selected Shadcn light 390px case passed five fixed attempts. Those early successful runs retained assertions but not numeric readiness JSON.
- The final owner-bound matrix passed the same 30/30. Eight initial-ready JSON records name the current owner/generation and preserve the 1000ms deadline. Their readiness preceded the post-`networkidle` start by 510–579ms. The selected light-390 case plus four additional fixed attempts passed 5/5, at −579/−574/−564/−563/−592ms. Negative deltas mean the command was already ready before that stage, not a negative load duration.
- Five Search files passed 100 tests, including the two new red/green controls, all existing service failure/lifetime cases and style/source contracts. An earlier incomplete filter collected only three files/90 tests; it is not reported as five-file coverage. A fake DOM lacking `HTMLElement.dataset` caused two harness failures after owner observation was added; the fixture now supplies the real host contract.
- `docs:build` passed: 286 pages built, Pagefind 1.4.0 indexed 281 pages. The existing 18 no-`html` projection notices and other build notices remain in the log. This builds the CLI as part of style generation, not all public packages.
- A separate local production-preview diagnostic passed 14/14: five Shadcn cold opens and one Brutalist cold open, plus runtime-held, close-held, HEAD503/retry and public-hover-intent controls for each family. Runtime GET was held while the real default-UI bundle returned; no input existed until release. Closing before release produced no late input; reopening produced one. Intent prepared modules without opening or constructing UI. Native Ctrl+K and actual queries returned same-origin Button documentation results whose destinations responded 200. Only HEAD503 and held runtime GET completion were injected.

The five local Shadcn cold-open observations were 88/75/79/141/74ms from the runner sending Ctrl+K to observing the visible focused input. They include transport and observation overhead and are descriptive candidate-only diagnostics, not a paired speedup, an uninstrumented benchmark, or an explanation of #847's earlier adverse immediate-open result. The diagnostic uses the original generated index/UI assets and a separately owned local preview/Chrome; it does not invoke or bypass the Linux-only managed production runner. Its first `.ts` invocation failed at ESM setup before preview/browser launch; the unchanged script ran as `.mts` successfully. Owned browser and preview cleanup were awaited.

## Acceptance boundary

The named local command-readiness and service-control scope is complete. Exact-head hosted CI, supported Linux production recovery, Windows behavior and historical delay attribution remain separate. Existing historical failures are not overwritten by current passes. Local review and submitted source do not constitute maintainer approval or merge readiness.
