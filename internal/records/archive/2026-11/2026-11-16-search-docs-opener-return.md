# Search: return to the current Docs opener after replacement

## Scope and cause

The original production journey at `11fbc20a238c99caefebd043a3fa52e417d52842` failed after clicking the current Close control, at `close-focus`. This was not the separate IME Escape journey. The original 1000 ms focus assertion, getters, actions and readiness markers remain unchanged.

The owning defect was in the website consumer. Docs uses independent controllers for its command and Dialog projections. Replacing the runtime retires the old opener and Dialog controls, while the durable Search session remains open. Focus Scope can restore a captured logical owner only while that owner exists. It does not infer the corresponding opener in a new projection. Search already provided an explicit, guarded current-opener handback for Homepage replacements, but did not arm it for Docs.

The applicable definitions are [Dialog Content](../../spec/prototypes/P-BASE-DIALOG-CONTENT.yaml), [Dialog Close](../../spec/prototypes/P-BASE-DIALOG-CLOSE.yaml), [Focus Scope](../../spec/contracts/C-AS-FOCUS-SCOPE-0002.yaml), and [Focus Target](../../spec/host-caps/HC-FOCUS-TARGET-0001.yaml). Their draft lifecycle and semantics are unchanged. This repair does not change the compiler, public API, package version or release admission.

## Repair

[The durable Search participant](../../apps/www/src/components/site-search-commands.ts) now identifies a replacement by the actual activated Dialog candidate. The command controller's `data-search-generation` marker cannot identify a Dialog replacement reliably, because the controllers commit independently.

When a different Dialog candidate activates while Search is open, it arms the existing explicit opener-return bridge. That bridge still waits for real panel presence removal and uses the current live opener's public `focusSelf` action. Its current-owner, session, focus-epoch and newer-intent guards are retained. Disposing an old candidate clears the tracked identity only if it still owns that identity. Participant disposal also clears it. Homepage rollback and remembered focus rules retain their existing scope.

## Discriminating evidence

The added [public-mode cases](../../apps/www/src/components/site-search-commands.public-mode.test.ts) start the real Docs controllers and dispatch the real runtime-preference event. They require the old opener and input to retire, preserve the query, click the current Close, and assert focus on the actual new opener. Coverage is Shadcn and Brutalist with WC, React, Vue and Vue 2 destinations. Three further cases cover newer focus during closing, owner disposal and an interrupted close.

This is a Happy DOM model running the actual compositions. The fixture explicitly focuses Close before `.click()`, because Happy DOM does not supply native pointer focus. The original production trace records the trusted Close focus and click; the model does not count as native-input or visual acceptance.

| Run | Product | Result | Duration |
| --- | --- | --- | --- |
| Initial fixture | Original | 2 focus failures and 9 setup failures | 19.051 s |
| Corrected, unformatted fixture | Original | 8 focus failures, 3 controls pass, 23 unselected | 24.672 s |
| Final formatted fixture | Original | 8 focus failures, 3 controls pass, 23 unselected | 22.514 s |
| Complete public-mode file | Repaired | 34 pass, 0 failed, 0 skipped | 27.417 s |
| Selected strict types | Repaired | Exit 0, no diagnostics | 11.815 s |

The first fixture waited for connection alone before injecting its query; this did not establish panel entry and input focus. Its setup failures are retained. The corrected fixture waits for actual entered state and input focus; it adds no sleep or timeout extension. The final red and green runs use the exact same test bytes (`ec9afa184127006536bb3667533a68a939a79a2ede417399af8607a0650efc61`). Product SHA-256 changed from `0ac9e2a7b2077b0da8f10366f29822308bc91151351b3095256fb181335cff14` to `aff1fd51f1a6a68b9e24b977b5845fd9f4f8e59276b67b43d6d0af7be26402ab`. Each executed run records commands, source snapshots, raw logs and outcomes. All 13,190 tracked files were unchanged during the full green and strict runs.

The complete focused command is:

```sh
NODE_OPTIONS=--max-old-space-size=2048 corepack pnpm@10.32.1 exec vitest run apps/www/src/components/site-search-commands.public-mode.test.ts --no-file-parallelism --maxWorkers=1 --minWorkers=1
```

The strict command is `corepack pnpm@10.32.1 exec tsc -p <selected-types.tsconfig.json> --noEmit --pretty false`. That config extends the root configuration without compiler-option relaxation and selects the two modified TypeScript roots, `apps/www/src/env.d.ts`, and their import closure. It is not a whole-repository typecheck.

The local evidence directory is `release03-docs-opener-return-20261116/` beside the repository checkout. `docs-red-final-receipt.json`, `docs-green-v1-receipt.json` and `selected-strict-v1-receipt.json` bind the results. Raw green log SHA-256: `b262b066726b84b59e5c0fa6f01c443f76ac72fc470e7028960d3a1382858b28`.

## Native evidence and remaining work

The preceding v14 production run remains 2 pass / 2 fail / 0 skipped at the original revision. Its Brutalist journey passed all four runtime transitions before the Close-focus failure. The inspected 1440 × 960, Chinese, light-theme failure capture shows the Docs page after the Search panel has closed. Its JSON records generation 5, a hidden panel and `BODY` as the final active element. The native timeline includes the trusted Close focus and click. The final snapshot does not identify every getter result during the failed poll.

The local v14 capture is `brutalist-failure-close-focus.json`, SHA-256 `eaeb8fa17fa1e813b8280ad6e07f7c818a882172aceabd0115b95863df6c8f51`. It is historical evidence, not a fixed-candidate capture or an uploaded asset. The request paraphrase is to finish the remaining 0.3 maintenance work while preserving existing behavior and its original acceptance conditions.

This slice has completed local discriminating implementation validation. Independent review, integration and the unchanged original production journey on the integrated candidate remain required. The integration owner coordinates that native run and fresh visual evidence; this record does not claim browser, full repository, upload or release acceptance.
