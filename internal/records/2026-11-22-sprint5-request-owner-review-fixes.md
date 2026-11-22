# Sprint 5 request owner independent review corrections

This record follows the candidate at `63bf788f4ae5c5042194e892a026e230c67bff6d` and its [original implementation record](2026-11-22-sprint5-request-owner.md). It preserves the earlier 117-case receipt as a historical result, not as evidence that the two subsequently discovered boundaries were covered. The request and owner initialization definitions remain draft, and the four canonical SSR profiles continue to reject with `PUI4001`.

## S5-REQUEST-001: retire resources before a session exists

Independent review reproduced a setup failure after allocating a State with value `7` and registering `beforeDispose`. The request preserved the initiating Error, but cleanup did not run and the State remained readable. `executeRuntimeRequest` could not dispose the partial owner because `createRuntimeSession` had never returned it.

The Runtime instance allocator now owns rollback while constructing the kernel. The kernel supplies its already allocated lifecycle registry, RunHandle and ViewIntent to that rollback boundary if authored setup throws or returns an invalid render value. The allocator locks the terminal view, invokes reachable registered cleanup in the real callback scope, clears registered event callbacks, and retires every allocated module and its capabilities. A one-shot guard prevents the outer construction catch from disposing the same startup twice. The partial owner never becomes a published RuntimeSession.

Six regression cases throw `undefined`, `null`, `false`, `0`, an empty string and an Error. Each allocates a real State, registers two cleanup callbacks, makes the first cleanup callback throw, and also makes the diagnostic callback throw. Both registered cleanup callbacks still run; created and serialization do not run; the identical initiating value rejects the request; later State reads and writes fail as disposed. A following request succeeds, checking that failed setup did not leave an active setup or callback scope behind. Existing ordinary disposal retains its fail-fast authored callback sequence.

This repair concerns resources allocated by the Runtime before or during authored setup. It does not claim exception safety for an arbitrary user-supplied module constructor or support asynchronous authored setup.

## S5-REQUEST-002: close the producer and receiver data budgets

Independent review found that accepted raw input could expand into a carrier that its own receiver refused. A 40-level singleton array fits the raw depth limit but its tagged representation exceeds the receiving depth limit on all four targets. A React array with 4,000 values fits the raw node budget but its encoded transport exceeds it.

Each server producer now applies its actual receiver's complete carrier check before returning success. React and Vue 2 share a generated validation entry with their respective hydration entry. Vue 3 validates through its existing receiving session preparation without creating a new logical component owner. Web Component calls its existing complete carrier check before publishing the serialized result. The depth limit of 64, node limit of 10,000 and conservative byte limit of 1,048,576 remain unchanged.

The real generated-source tests include four complete JSON wire round trips, all four over-depth negatives, the React node-expansion negative, and Vue 2/Web Component byte-expansion negatives. The overflow fixtures observe actual created and disposal callbacks; a raw-input rejection cannot satisfy their expected lifecycle sequence. The Vue 2 byte fixture explicitly declares its large string Prop so the complete transport includes both its initial Props and component projection. Web Component preserves `HydrationMismatch` and includes the underlying data-budget failure as its cause.

## Recorded verification and corrections

The first follow-up test run reported **9 failures and 108 passes** after the Runtime startup repair but before the carrier repair. Six failures were actual producer-budget counterexamples: four depth cases, React node expansion and Web Component byte expansion. Two failures were positive tests calling not-yet-added validator exports. One was an inaccurate Vue 2 fixture: an undeclared large field was carried only once, so that result was correctly below the byte limit. That fixture was corrected by declaring the string Prop; its old result is not counted as a product defect.

The next run reported **3 failures and 131 passes**. Two assertions incorrectly expected Web Component to throw the underlying TypeError directly instead of its existing HydrationMismatch wrapper. The repair retains that established error type and exposes the original cause. The third failure was the undeclared Vue 2 field described above. No budget was raised and no failure case was skipped.

The final focused run completed with **193 passed across 7 files**, using one worker:

| Test file | Passed | Boundary |
| --- | --: | --- |
| `packages/compiler/test/request-owner-ssr.test.ts` | 83 | Four actual generated server paths, complete transport round trips, expansion failures and retained error/abort cases |
| `packages/runtime/test/contract/lifecycle.request.contract.test.ts` | 34 | Real request ownership, including partial setup rollback and stale State invalidation |
| `packages/runtime/test/contract/lifecycle.initial-data.contract.test.ts` | 17 | Independent finite initial-data validation |
| `packages/runtime/test/contract/as-hook.v0.contract.test.ts` | 27 | Existing Hook setup behavior |
| `packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts` | 25 | Existing module resource retirement |
| `packages/runtime/test/contract/prototype.render-syntax.v0.contract.test.ts` | 6 | Existing setup/render behavior |
| `packages/runtime/test/contract/lifecycle.same-checkpoint-order.contract.test.ts` | 1 | Existing lifecycle ordering |

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/runtime/test/contract/lifecycle.request.contract.test.ts \
  packages/runtime/test/contract/lifecycle.initial-data.contract.test.ts \
  packages/compiler/test/request-owner-ssr.test.ts \
  packages/runtime/test/contract/lifecycle.module-resources.v1.contract.test.ts \
  packages/runtime/test/contract/as-hook.v0.contract.test.ts \
  packages/runtime/test/contract/prototype.render-syntax.v0.contract.test.ts \
  packages/runtime/test/contract/lifecycle.same-checkpoint-order.contract.test.ts \
  --maxWorkers=1 --minWorkers=1
```

The matched real Vue 2 renderer dependency comes from the browser lane's dependency change, as in the original record. The fixtures still use actual emitted artifacts and framework serialization. Existing Vue warnings following intentional failed setup and the Vite ES2024 target warning remain visible in the receipt.

A focused TypeScript program used the repository's strict compiler options with ten changed Runtime/compiler production and test entry files and their 724 resolved source files. Its initial two `TS2454` diagnostics both referred to the new `maybeRender` local; explicitly initializing that local to `undefined` resolved them. The final program reported **zero diagnostics**. Prettier and `git diff --check` also completed successfully. These focused checks do not replace the final integrated workspace gates.

Complete physical hydration, application trust and revision binding remain the explicitly missing target-consumer acceptance in `T-LIFECYCLE-REQUEST-OWNER-0001`. This correction does not establish Shenko or Verdant application acceptance, migrate live State between owners, or admit a canonical SSR target. Independent review of this increment and final integrated workspace gates remain the integration owner's responsibility.
