# Independent addendum: prepared workspace typecheck and generated inputs

## Final local result

The owner author's final canonical **workspace** typecheck returned exit code **0** after fresh style generation. This supplements the frozen positioning-scroll source review; the original review files and the two earlier failed typecheck logs remain unchanged.

This result is **not** the full `check:types` command, the docs/Astro check, a native test result, or platform acceptance of the product repair. The unchanged public native matrix still needs to execute against the new positioning-host source.

## Exact execution boundary

I read `/tmp/contents-scroll-host-validation.json` (9551 bytes; SHA256 `f38ff948fc9baa46546e54b01fa4c635945fa09905cf1512907ac2cd5dcb992a`) and verified all ten referenced log sizes and hashes. The execution statuses are from the author's tool execution/completion record; I did not rerun generation or TypeScript.

| Stage | Exact command | Result |
| --- | --- | --- |
| Initial workspace check | `corepack pnpm@10.32.1 -s check:types:workspace` | Exit134; Node default heap exhaustion. |
| Larger heap before input generation | `NODE_OPTIONS=--max-old-space-size=4096 corepack pnpm@10.32.1 -s check:types:workspace` | Exit2; two TS2307 diagnostics for the absent generated shadow module. |
| Canonical fresh generation | `corepack pnpm@10.32.1 --filter apps-www generate:proto-ui-style` | Exit0; 1472 source tokens generated. |
| Final workspace check | `NODE_OPTIONS=--max-old-space-size=4096 corepack pnpm@10.32.1 -s check:types:workspace` | Exit0; completion session83570 / chunkda0842, empty output log. |

The final zero-byte log has SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. The exit status is established by the recorded completed command, not inferred from the log's emptiness. Increasing Node's heap is an ordinary compiler memory setting; no browser sandbox or system security setting was changed.

## Fresh generated input equality

I independently compared every current generated file with the corresponding retained **actual92d native-run** output, checking both direct byte equality and recorded hashes. All five match. The current host, test and workflow hashes also still match the frozen source review.

This local comparison shows that the candidate's fresh generated CSS/shadow inputs did not change relative to the observed failing92d run. It does not substitute for the next native run's own before/after source and generated-output receipts.

| Generated output | Bytes | SHA256 |
| --- | --- | --- |
| `proto-ui-shadow-style.generated.d.ts` | 261 | `76d772bac1c5de84e6fb455683513c74c6d40b55de2744caaf3dfc4e4ead94b8` |
| `proto-ui-shadow-style.generated.js` | 629704 | `08415c4d6276a790c2a5538aa8bc70279ad4a060624dc8e3e024fd36e44f7036` |
| `proto-ui-style.css` | 294 | `446d2249e0672bdee7ddf77de55c7a8f2140adfb60c41d13ec0183d5f7199d88` |
| `proto-ui-tokens.generated.css` | 249803 | `e503f7dff500dd7894d122b808f623f971fb590bb88fba7859126ee3ca20e1d7` |
| `shadcn-theme.css` | 6473 | `3de2d4ce2a38e83086128c8863d3391eb74159adde7b1a8b7f450f93fd643f96` |

## Preserved frozen review

- `independent-positioning-scroll-fix-review.md`: 7602 bytes, SHA256 `8b7975d269c4941c1e1d20e03b356f236185af640ec50134b71e2b38de6e8c0f`.
- `independent-positioning-scroll-fix-review.json`: 4587 bytes, SHA256 `009ad3e3b228b7269f2a735d38b2bb2dabbc187eca5b3febf37b09fec5e96bd4`.

Their earlier cutoff correctly described the final prepared check as outstanding. This addendum records its later completion without rewriting that history, the 2GB OOM, or the intermediate missing-input diagnostics. The source-review conclusion and its native-acceptance limitation are otherwise unchanged.
