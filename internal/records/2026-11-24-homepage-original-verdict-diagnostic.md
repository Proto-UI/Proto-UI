# Homepage original-verdict diagnostic

## Original diagnostic

This diagnostic starts from `78af4d4c9dc822e66a525b1ddc2794d618b1afc3`. The Homepage/component/browser-test and generated style sources are unchanged from the recorded native baseline `24dfb9f112b11c2f0c6789dfab3aa86b528656ee`.

The unchanged baseline failed the real family Popover wheel check (`scrollTop` stayed zero) and the Brutalist family commit's original 1000 ms assertion. Its native dataset write brackets place the actual family marker update about 1.078 seconds after the polling interval began. This proves delayed query delivery alone does not explain that run; it does not identify which product stage caused the delay.

The passive wheel observer and its eight injected-layout controls originate in the same repository's separate diagnostic candidate `9bd8a7da39e47141900dcf7fc243703c9796fb5a`, read without modifying that checkout. This candidate additionally records the actual WheelEvent client coordinates. The original Homepage wheel coordinates, native input, scroll-offset assertion, document-scroll assertion, and 1000 ms deadline remain unchanged. No readiness wait is added here. Initial and post-verdict geometry, current dialog/surface identity, composed event path, trust and final cancellation are retained around that original observation.

`PROTO_UI_HOMEPAGE_PROFILE=1` additionally enables a sampled CDP CPU profile immediately before the original Brutalist preference selection. The original family polling verdict and post-verdict pending-query ledger remain unchanged. The profile is stopped and written after the verdict and its existing collection; it may perturb timing and is diagnostic evidence only. It does not advance publication, bypass atomic preparation/rollback, or extend the deadline.

These changes contain no product fix and no native acceptance claim. The stronger readiness oracle from the separate candidate has not been applied as a presumed root-cause repair. A native run of the unchanged assertion with these observations must precede attribution to positioning, input delivery, renderer preparation, Anatomy order work, or query scheduling.

Local verification: the eight observer controls and eleven existing `site-contents-evidence.test.ts` controls pass (19/19) with a 768 MiB heap. A token comparison confirms that the entire original wheel input/assertion block is unchanged inside the diagnostic wrapper. The browser test passes TypeScript syntax transpilation, and `git diff --check` passes. These checks are not native browser acceptance. The old Happy DOM WheelEvent does not expose client coordinates; absent coordinates are recorded as null, never invented as zero.

## Retained native observations and recovered successor

The original diagnostic ran on clean `6635347b3376e90fdb7dc9618c815aa12b66341d`. Both selected Homepage cases still failed. In the first `shadcn / wc / click` wheel tuple, initial and final observations were ready, positioned, visible, connected, current-dialog/current-surface, and hit-in-content. Content measured 374 × 776, with scrollHeight 6230 and maximum offset 5454. A trusted deltaY 500 event at (195, 448) hit a native `summary`, included Content and surface in its dispatch path, and was uncancelled when read after the original verdict. Content offset and document Y remained zero. This excludes missing readiness or scroll range for that receipt; it does not identify the browser's chosen scrolling box or exclude an unobserved reset.

The observer retains the actual WheelEvent and reads its current `defaultPrevented` during later snapshots. It does not freeze cancellation in a capture listener or its microtask. The exact original observer SHA256 is `5cb63d1997b7c567784b96d4f78e7cd2f687c57c9a33b11a102f4c457c0a7b12`.

The profiled 663 preference case also committed its family marker after the original verdict. Sampling identified work in WC rule traversal, Typography's selection boundary read, and later publication/layout work. These samples do not justify removing selection preservation, publishing before preparation, or extending the deadline. Profiling can perturb timing; this run is not an unprofiled latency estimate.

The local execution environment then changed: the previously available `/tmp/pui-40da-*` checkouts and `/workspace/scratch/40da939bdb35` files were absent from the newly attached executor. The cause was not established. Remote source and native receipts survived; the old local `15c276080f55b88faa564ab331e839f2506c7bcf` reconstruction commit was not present in the recovered Git objects. The successor described here was reconstructed on published `6eb7b37da6675a31bb35bb272f3ee1567b30f655` and must receive its own commit/hash binding. No byte identity with the unavailable 15c commit is claimed.

Between fde and 6eb, another owner strengthened the native wheel oracle. It now polls readiness before input, uses the observed surface center, checks current dialog/surface identity and movement direction within the original explicit 1000 ms post-input budget, and checks a trusted uncancelled event. It also added separate authored-viewport browser controls and removed the optional preference CPU profiler. Those changes are preserved. Therefore the original-diagnostic description above is historical: this successor does not claim the current wheel schedule is token-identical to fde or that the added readiness poll fixes the observed product failure. The preference polling budget and query accounting remain unchanged.

The reconstructed helper adds stable local element identities, current hit ancestry, retained native dispatch ancestry, and current overflow/overscroll, dimensions, offsets, and layout properties. Passive capture listeners retain at most 32 scroll observations, including noncomposed events in encountered open shadow roots; duplicate delivery of the same event is recorded once. Each observation retains its delivered offset separately from its target's current snapshot offset. CSS and geometry are read in snapshots, not in the wheel listener. These facts can distinguish nested movement and subsequent reset without declaring which element owns native scrolling. Disposal removes every added listener, and reading a disposed observer does not reacquire them.

Actual WheelEvent client coordinates are restored as separate fields from the planned surface-center coordinates. A local injected-input control proves those values are not substituted from geometry; absent Happy DOM fields remain null. The authored native browser control additionally asserts real event coordinates, but that native assertion has not yet run on this successor.

### Recovered validation boundary

The twelve current observer controls and eleven existing Contents evidence controls pass: 23/23, zero pending, with Node 24.22.3, Vitest 2.1.9, one worker, and a 768 MiB heap. The observer controls include nested offset progress/reset, noncomposed shadow delivery and disposal, retained dispatch identities after replacement, and event-coordinate distinction. Layout, offsets, and events are controlled host-model inputs; they do not prove native default scrolling. The observer also passes a focused strict TypeScript check. The local Vitest output retains the existing esbuild warning about the repository's ES2024 target; no warning-free claim is made.

The formal fde type job `138415142448` was reported by the integrator as two errors, including the current-dialog callback's `Node | null` versus `Element | null` mismatch. Both native observer callbacks now narrow the sole returned node with `instanceof Element`, passing null otherwise. There is no cast or suppression and no matcher, input, or deadline change. An actual Playwright-type fixture reproduces the old callback error and accepts the narrowed callback. The second, unrelated Surface props error belongs to the integrator's separate repair. No complete Astro or full-site type pass is claimed by this focused change.

Commands run from the recovered worktree:

```sh
NODE_OPTIONS=--max-old-space-size=768 node node_modules/vitest/vitest.mjs run apps/www/src/content/docs/zh-cn/contents-wheel-evidence.test.ts apps/www/src/components/site-contents-evidence.test.ts --maxWorkers=1 --minWorkers=1 --reporter=default --reporter=json --outputFile=/workspace/scratch/40da939bdb35/homepage-review-evidence/recovered-wheel-controls.json
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --lib ES2022,DOM --module ESNext --moduleResolution Bundler --types node apps/www/src/content/docs/zh-cn/contents-wheel-evidence.ts
```

The recovered source comparison, logs, and before/after callback type fixtures are retained in `/workspace/scratch/40da939bdb35/homepage-review-evidence`. The next acceptance action is the current native Homepage wheel and preference cases on the integrator's frozen successor, with profiling disabled. Neither a product repair nor native acceptance is claimed here.
