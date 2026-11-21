# Native candidate source binding receipt

The candidate projection now binds to source commit `e3bba6b2e0f52250ad711a65e192f5ca739ae91c` (tree `0815a6206b45d34619140a76bd470c982b913b69`). The real generator ran from a clean checkout of that commit. The full local coverage gate then completed successfully against the generated projection: two matrices passed, followed by **4,491 Node controls: 4,490 passed, zero failed, one skipped, zero cancelled and zero todo**.

## Actual commands and source boundary

| Command | UTC start → finish | Duration | Exit |
| --- | --- | --- | --- |
| `node scripts/coverage-matrices/prototype-coverage.mjs --refresh-candidate e3bba6b2e0f52250ad711a65e192f5ca739ae91c --write` | 2026-11-21 19:58:25.125 → 19:58:47.169 | 22.044 s | 0 |
| `corepack pnpm@10.32.1 -s check:coverage-matrices` | 2026-11-21 19:59:58.213 → 20:07:06.264 | 428.051 s | 0 |

The generator reported 71 comparison rows, 22 Base projection rows, 141 consumer rows and 101 verified migrated links. Its three outputs were produced by the existing generator. Only `prototype-coverage-matrix.json` and `prototype-coverage-matrix.md` differ from the source commit; `finf-delivery-checklist.md` remains byte-identical. Prettier changed JSON formatting only, confirmed by deep comparison of parsed values before and after formatting. All three outputs passed the formatting check, and `git diff --check` passed.

Both gate snapshots retained the same HEAD, tree, 5,955 bound-source hashes and three generated-output hashes. The only working-tree changes during the gate were the two expected generated files; this does not claim that the working tree containing those projections was clean. No product or test source changed while the gate ran.

The Node stage took 268.201 seconds. Its single skip is the existing portable-suite boundary: `portable suite does not run Linux media integration`. That test explicitly requires `node --test scripts/coverage-matrices/test/decode-video-evidence.integration.mjs` separately in Linux CI. This local receipt does not claim to have run that integration step.

## Bounded projection audit

The candidate revision, source-object proof and source-binding object now reference e3bba6. The complete **5,955-path inventory and its order are unchanged**, with no additions or removals. Exactly four existing source hashes were renewed:

| Bound source | Review basis |
| --- | --- |
| `internal/website/self-hosting-coverage-matrix.md` | Existing blocked hover diagnostic owners, the reviewed overlap-paint helper and finite page/helper fingerprints. |
| `packages/prototypes/shadcn/test/drawer-presence.browser.test.ts` | Wait for the real Button's initialized enabled state before the existing cold-entry interaction; preserve geometry and projector assertions. |
| `packages/prototypes/shadcn/test/drawer-www-entry.test.ts` | Prove that the transparent wrapper does not open the Drawer and the authored Button does. |
| `packages/prototypes/shadcn/test/fixtures/drawer-www-entry.ts` | Resolve and click the unique authored `wc-shadcn-button` action. |

The companion JSON records all four previous/current hashes, the actual output hashes and the candidate commit-object proof audit. Every new binding matched current file bytes. All other candidate fields and all historical/main references and gates remain deeply equal. There is no source-mapping change in this refresh.

The consumer portfolio remains **141 rows: 78 Website and 63 harness**. All 585 candidate entities remain draft, with zero active; all 456 GPUI rows remain `required-unassessed`. Website states remain 40 blocked, 17 infrastructure-exempt, 14 native/static and seven research. No ownership, acceptance state, criterion or evidence requirement was promoted.

## Preserved failed attempt and remaining native evidence

The preceding a423 source attempt is preserved as a failure: the full command exited 1 after 159.611 seconds with eight hover-page raw-import findings, before Node controls started. The separate exact-body diagnostic policy had retained the previous page hash. [The finite renewal record](2026-11-22-hover-import-binding-renewal.md) preserves that omission, the full failed log hash and the independent review showing that all 15 static module specifiers and all eight admitted raw Proto declarations remained unchanged. The e3bba6 gate is a new result; it does not overwrite the a423 failure.

The earlier [native cycle 44937449914](https://github.com/Proto-UI/Proto-UI/actions/runs/44937449914), bound to `4c2c34019a97b50ea7d486b31c3ee140bc46130e`, has finished all 98 jobs: 42 success and 56 failure, with zero cancelled or timed-out job conclusions. Those results remain attached to 4c2; individual test timeout evidence remains intact. The final commit containing the current projections still needs its own clean native full-cycle result. This local source-binding pass provides no new browser, optical or product acceptance.

The successful full-gate log SHA-256 is `9316c932035880842be326c8c1fc5fe4526c42ae1b3dee30eaef3f92d3f3ef5f`. Exact timestamps, commands, source snapshots, generated hashes, unchanged counts, the earlier failed receipt and retained local log locations are in [the machine-readable receipt](2026-11-22-native-candidate-binding.json).
