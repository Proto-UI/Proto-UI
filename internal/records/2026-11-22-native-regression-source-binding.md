# Bind the follow-up regression candidate to reviewed source

The existing portfolio generator refreshed candidate source from `85153d83969c65a812185e44e045fa0fe7e803c9`. The [JSON companion](2026-11-22-native-regression-source-binding.json) retains the exact generator invocation, all changed bindings, derived field differences, output hashes, formatting proof and full local gate receipt. These are product-source bindings and local verification, not a substitute for the final native workflow's exact commit.

All **5,955 source bindings** match the inspected live bytes. Relative to the previously committed `fc17170c…` candidate, 46 bound sources changed and 11 were added; none was removed. Relative to the intermediate `b418cf0…` projection, only the three reviewed Drawer fixture/test sources changed. The intermediate generation and interrupted check remain historical diagnostics.

The actual generator, not a manual fingerprint edit, produced all three portfolio files. Prettier then changed only the JSON representation: deep comparison confirms identical values before and after formatting. The recorded output hashes identify the formatted bytes that are committed.

## Preserve the distinction between source mapping and acceptance

The top-level change is limited to `candidateSource`. The 78 existing website rows, 141 consumer rows, 585 draft prototype identities, 456 required-unassessed GPUI cells and Shadcn style coverage retain their acceptance status and criteria. Historical main evidence is unchanged.

There are real derived source changes inside the new candidate, so this is not described as a hash-only update. Upstream component work added the Base Calendar, Carousel and NumberField helper sources, increasing the Base source-file count from 260 to 263. It also added the `P-BASE-NUMBER-FIELD` inheritance relation to `P-BRUTALIST-NUMBER-FIELD`. The generator consequently changes that one source-mapping cell from `required-missing` to `bounded-draft-mapping-needs-full-acceptance` and includes the related projection identities. Its acceptance remains `unverified`; the GPUI cells remain `required-unassessed`. A newly described source relationship does not earn runtime acceptance.

## Actual local gate

`corepack pnpm@10.32.1 -s check:coverage-matrices` exited **0** against the frozen source commit plus its three generated projections:

- Website/matrix validation: **OK (2 matrices)** after 165.406 seconds.
- Node controls: **4,491 total; 4,490 passed, 0 failed, 1 skipped**, 271.907 seconds.
- Complete command: 437.661 seconds; HEAD stayed at `85153d83969c65a812185e44e045fa0fe7e803c9` throughout.

The one portable-suite skip explicitly delegates real Linux video decoding to `decode-video-evidence.integration.mjs`. Both native general jobs retain that separate required decoder admission. The local skip is not counted as a pass.

The final preparation also includes the separately reviewed upstream `a4583a087…` / PR #1670, which changes one production-browser test's handling of malformed redirect evidence. That file is outside this product binding set and all eleven measured package closures. Its merge still changes the repository commit and full-source identity. The final candidate must therefore prove its own clean strict measurement and complete native receipts, while retaining this gate under its actual source and execution conditions.
