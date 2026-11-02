# Textarea runtime readiness verification timeout: located cause

Recorded 2026-11-03 UTC. Bounded part of #1155 ("定位 Textarea 运行时就绪验证超时"). This is a non-normative diagnosis record. It does not close #1155, does not accept any native/browser result, and does not change any product, renderer, Compiler/IR or spec semantics.

## What was located

The Textarea runtime-readiness verification lives in `apps/www/src/content/docs/zh-cn/demo-base-controls.browser.test.ts`. The suite spawns the documentation dev server and then gates the whole browser phase on a single readiness probe:

- `TEXTAREA_ROUTE = '/en/ui-libraries/base/textarea/'` (line 23)
- `spawnServer()` starts `corepack pnpm@10.32.1 --filter apps-www dev --host 127.0.0.1 --port <port> --strictPort` (lines 109-127)
- `waitForServer()` calls `waitForServerReadiness(url, { timeoutMs: 120_000, ... })` (lines 84-95), and `startServer()` probes `${url}${TEXTAREA_ROUTE}` (line 131)

`apps/www`'s `dev` script is `corepack pnpm@10.32.1 run generate:proto-ui-style && astro dev --host ... --port ... --strictPort`. The readiness probe therefore measures **two different things**: the style/CLI generation that runs before the server exists, and the Astro server start plus the first compile of the Textarea route.

The same shape exists in `apps/www/src/content/docs/zh-cn/browser-harness.ts` (line 79) and `apps/www/src/content/docs/zh-cn/demo-brutalist-controls.browser.test.ts` (line 108), and `scripts/test/run-runtime-tests.mjs` already carries a comment naming the same cause: "Astro dev compiles a route on first request, so a suite probing a cold route can exceed its own hook timeout"; it answers with `READY_TIMEOUT_MS = 180_000` (line 27) rather than by separating the phases.

## Measurements

All measurements were taken on the preparation seat against `/workspace/worktrees/pr1160-resizable-demo` at the head that carries the #1100 registration tests. The seat runs Node `v22.23.2`; the repository requires Node 24 (`AGENTS.md`, `AGENTS.md` CI baseline) and the dev server prints `WARN Unsupported engine: wanted: {"node":"24.x"}`. The numbers below are therefore a **local, non-conforming-engine** observation, not a CI result.

| Phase | Observed | Notes |
| --- | --- | --- |
| `pnpm --filter apps-www run generate:proto-ui-style` alone | 166 s | Measured with the same `date +%s` wrapper; the four generation steps completed and wrote `shadcn-theme.css`, the 1415-token stylesheet and `proto-ui-style.css`. |
| Textarea route readiness through the production `waitForServerReadiness` gate, budget 120 000 ms, generation inside the window | **not ready** at 120 004 ms | `ready:false`, `ECONNREFUSED 127.0.0.1:45811` for the whole budget. The captured server output shows the generation steps had completed and `astro dev` had not yet served the route. |
| Same gate, budget 400 000 ms | ready at 117 219 ms | `ready:true`. A later standalone generation run then took 166 s, so the phase cost is highly variable with build-artifact and CPU state. |

Two consecutive runs of the identical gate therefore landed on opposite sides of the 120 s boundary (117 219 ms ready versus still refused at 120 004 ms). The observed margin against the budget is smaller than the run-to-run variance.

## Cause

The 120 000 ms readiness budget is charged for the style/CLI generation, which is build tooling unrelated to the server being ready. The generation alone was measured at 166 s — longer than the entire budget — so the probe can time out before the server has started, and the Textarea route's own first compile is paid for with whatever budget the generation left over. The Textarea route is affected because it is the route these suites probe first and cold.

The shared runner `scripts/test/run-runtime-tests.mjs` already carries a larger budget for the same class of wait, and `scripts/test/run-runtime-tests.test.mjs` (lines 449-457) deliberately pins both numbers: the runner's `180_000` and the three browser suites' `120_000`. That difference is a guarded intent, not an oversight, so raising a browser budget alone would contradict a live guard.

## Split-phase measurement

The same production `waitForServerReadiness` gate was re-run against the same Textarea route with the generation performed **before** the server was spawned and `astro dev` started directly:

| Phase | Observed | Budget |
| --- | --- | --- |
| `generate:proto-ui-style` outside the readiness window | 123 586 ms | — |
| Server start + Textarea route first compile, inside the readiness window | **39 225 ms** | 120 000 ms |

`ready: true`. Splitting the phases leaves roughly a three-fold margin against the existing budget, where the folded spawn could not reach readiness at all inside it. `pnpm --filter apps-www exec astro dev …` is equivalent to the tail of the `dev` script: pnpm appends the extra arguments to the end of the script command, which is why the observed server command was `astro dev --host 127.0.0.1 --port <port> --strictPort`.

## Applied fix

`runStyleGeneration` is exported from `apps/www/src/content/docs/zh-cn/browser-harness.ts` and awaited before the server spawn in that file, in `demo-base-controls.browser.test.ts` and in `demo-brutalist-controls.browser.test.ts`. The server spawn now runs `--filter apps-www exec astro dev` directly.

The guarded budgets are unchanged: the browser suites keep `timeoutMs: 120_000`, the shared runner keeps `READY_TIMEOUT_MS = 180_000`, and the `[browser-harness] readiness failed:` wiring is byte-identical. No assertion is relaxed and no product behavior changes. A new guard in `scripts/test/run-runtime-tests.test.mjs` requires every browser readiness owner to await the generation and to spawn `astro dev` directly, so the folded spawn cannot be restored silently; the guard's two patterns were checked against the old and the new source and discriminate them in both directions.

`scripts/test/run-runtime-tests.test.mjs` passes 127 tests after the change.

## Not yet established

The measurements are local and under Node 22, so they are not a CI result. The split-phase fix still needs exact-head CI on the Node 24 baseline, and the browser suites themselves need Chrome, which this seat does not have. No native receipt, screenshot or browser acceptance is claimed here.

## Not claimed

No CI run, native receipt, screenshot or browser result is claimed for the #1155 Textarea item. No product behavior, readiness assertion or timeout semantics is changed by this record. The unrelated Shadcn Textarea paint endpoint investigation in `2026-10-25-textarea-paint-endpoint-diagnostic.md` (#954) is a different failure and is not affected by this one.
