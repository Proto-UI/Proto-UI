# Sprint 2 compiler local-helper, generated-type and owner evidence

This archive preserves the bounded work after `f8138caf5c`: closed local nominal inputs (`1d6c099200`), complete generated types and real Tabs Content consumers (`ca76c11435`), and lifecycle identity/input authority (`f5a2621d2f`). It is evidence for those slices, not acceptance of all original #732 or #1145 conditions.

`receipts.tar.gz` contains 35 original reports, logs and drivers. `manifest.json` records every uncompressed file's SHA-256, the archive hash and the final changed source hashes. The archive was read back and every member hash was checked. Source hashes in this manifest identify the archived final source; the independent review reports retain the actual source hashes for their separate red/green runs.

## Completed final checks

| Evidence | Actual result | Scope |
| --- | --- | --- |
| `local-owner-frozen-ingress-final.log` | 69/69, three files | Local helper 23, lifecycle module 24, frozen arrays 22 |
| `local-tabs-consumer-final.log` | 4/4 | Unchanged Shadcn Tabs Content plus an independent provider of its actual Context and Anatomy family, using ordinary four-profile generated project imports |
| `lifecycle-module-types-final.log` | 4/4 | Complete enhanced lifecycle artifacts, including supporting TypeScript/JavaScript under strict TypeScript and `checkJs` |
| `local-final-typecheck.json` | 15 roots, zero diagnostics | Changed compiler/test roots and their complete imported graph |

The runtime/source command used one worker, no file parallelism and a 1,024 MB heap:

```sh
NODE_OPTIONS=--max-old-space-size=1024 corepack pnpm@10.32.1 exec vitest run packages/compiler/test/local-nominal-helper.test.ts packages/compiler/test/lifecycle-module.test.ts packages/compiler/test/frozen-primitive-arrays.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

The Content consumer and lifecycle artifact files then ran as separate processes with the same options:

```sh
NODE_OPTIONS=--max-old-space-size=1024 corepack pnpm@10.32.1 exec vitest run packages/compiler/test/local-tabs-consumer.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
NODE_OPTIONS=--max-old-space-size=1024 corepack pnpm@10.32.1 exec vitest run packages/compiler/test/lifecycle-module-types.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

The source/test program ran the archived `local-final-typecheck.mjs` from the repository root with a 1,024 MB heap and an output-report path. Its original report with one `TS2345` is retained separately: the test artifact helper's parameter was `string`, wider than the existing generated-profile union. Narrowing that annotation produced the zero-diagnostic final report; it changed no runtime code.

## Independent review and failures retained

`review-lifecycle-cross-callback-*` contains a separately authored driver, exact source and reports for a real Core Runtime session and all four generated Web consumers. Retaining the module in `created` and comparing it in `mounted` initially returned `same:false` only on WC. After the owner repair, Core and every generated target returned `same:true`, with one mount each. The reports carry their own source hashes. The strengthened repository fixture additionally checks Props callbacks, detach/reopen, terminal stale calls and the Boolean input boundary.

`review-local-nominal-boundaries.*` contains independent closed-wrapper/returned-closure positives and external-wrapper, getter, array, late-store and external-callback negatives. Two positives passed source/cold IR; six negatives reported `PUI1006`. Its separate explicit public lifecycle parameter observation is followed by the new shared source/cold-IR refusal; it is not described as a successful pre-fix check.

The first local-generic candidate oscillated between incompatible nominal payload hints and reported `PUI1999`; `local-helper-generic-context-red.json` preserves that result. The final source reports a bounded `PUI1006` instead and tests both heterogeneous refusal and repeated same-payload success. Preliminary consumer fixture errors, actual generated type errors, process exits and failed strict attempts remain in their original logs.

## Real Content artifact recovery

The small helper fixture passed four complete strict artifacts. Actual Content/provider artifact recovery used selected fresh React, Vue 3 and Vue 2 test processes, one successful case per profile. The WC Vitest process exited under memory pressure; its recovery was a separate producer plus a plain TypeScript program checking 17 emitted roots with zero diagnostics. `local-types-wc-standalone.json` is that separate receipt. The exited process is not a passing test.

Those real Content artifact recoveries precede the later owner-identity follow-up. The enhanced lifecycle fixture's later strict four-profile run and the final real Content four-profile runtime run check that follow-up separately. The archive does not relabel an earlier tree as a complete current suite.

The Content provider intentionally has no Trigger. The real missing `labelledBy` target diagnostics remain visible, and this fixture supplies no accessibility acceptance. Full Tabs Root still refuses its opaque `get` assertion. These Happy DOM, source/IR and type checks do not establish physical browser/AT, complete native/SSR behavior, the original full library/profile denominator or an independent full differential campaign.
