# Independent verification addendum: final intrinsic-continuity candidate

This addendum closes the process-receipt items left pending at the cutoff of independent-intrinsic-continuity-review.md. The earlier review remains unchanged. This is technical evidence verification, not a platform approval or native acceptance.

The reviewer read `/tmp/contents-intrinsic-validation.json` (7252 bytes, SHA256 `3892a22b7d0a5a8e31d2060437fd4acf481421e059f88d9712123c0b3f4fb08b`), verified all **16 referenced files** against their recorded sizes and hashes, and rechecked all seven source files against the frozen review. Every comparison matched. In particular, the final host is 35b27b569d761dba6a251e96d8c0a34f08cbc386792678b803054f368ce4956d and the formatted host test is 3806258d0f683b2f2ef6e7b4a0f9145411025a697d7136dadc6cde7558a820ca.

## Completed checks

| Check | Recorded exit | Raw log SHA256 |
| --- | ---: | --- |
| positioning and four Adapters, final formatted files | `0` | `9e5fbf478765bfa00f34fd43fd7830296a1fbceca9fa75190f23a16978ffacb0` |
| workspace types only, final formatted files | `0` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| formatting of five implementation/test files | `0` | `17aa973d3f004560237d9a95171210b0671deff23d61628eecf7322ff5938f20` |

The final selected positioning and four-adapter run completed **26 files / 337 tests passing**. Its recorded process completion is session 1595 / chunk ea3d8a, with the independently read terminal summary in the retained log. The command was:

```sh
corepack pnpm@10.32.1 exec vitest run packages/modules/positioning/test packages/adapters/react/test/positioning.integration.test.ts packages/adapters/vue/test/positioning.integration.test.ts packages/adapters/vue2/test/positioning.integration.test.ts packages/adapters/web-component/test/positioning.integration.test.ts --maxWorkers=1 --minWorkers=1 --reporter=verbose
```

The final workspace typecheck completed **exit 0**, session 96470 / chunk acadd0. Its empty log is bound to that completion receipt; success is not inferred from the empty file. The command was:

```sh
NODE_OPTIONS=--max-old-space-size=4096 corepack pnpm@10.32.1 -s check:types:workspace
```

Final Prettier verification of the five implementation/test files completed **exit 0**, session 73786 / chunk 1b26fc. The receipt retains the earlier formatting failure and its exact formatting-only difference; it does not relabel earlier test bytes as the final formatted source.

## Other evidence boundaries retained

The baseline core controls remain 2 failed / 1 passed / 23 filtered against the stated b110 host. The separately authored public-lease baseline remains the originally executed three-case source, 1 failed / 2 passed. The active-RO gate and equivalent-configuration fourth case were later additions. The await-context regression was **not** run red against old ddbe. The reviewed final controls pass, but no missing historical run is inferred.

The five current local generated CSS/shadow files were also compared byte for byte with the actual b110 native after-test copies; all matched. This is a comparison of files as found, not a claim that a new generator or native browser ran for this candidate. The companion JSON retains every generated file path and hash.

No new native execution is included. F-WHEEL-004, F-INTRINSIC-001 and F-INTRINSIC-002 remain source-level resolved; browser retention across the complete matrix still requires source-bound hosted evidence. The final typecheck is workspace-only, not full check:types or docs/Astro checking. The reviewer verified evidence and source without rerunning the tests, modifying product files or sending an external review.
