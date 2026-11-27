# Sprint 3 website: remaining original conditions and responsible workstreams

## Status and source

The complete 0.3 website acceptance remains **open**. The 24 reading regressions and the 364-case bounded consumer dispatch address their named repairs; they do not complete every public Preview, Code, Usage, installation, responsive or accessibility condition. None of the remaining release obligations below is moved to 0.4.

The adjacent [machine-readable child ledger](../../2026-11-22-sprint3-website-readiness.json) records every current release-family row through the existing inventory's canonical keys. Each compact family key expands to both `en` and `zh-cn`; a locale-specific difference is retained as an exact row key. Run the commands below to resolve each key to its actual MD/MDX source path, source hash, Preview identities/hosts and actual CLI entries. The ledger binds the complete input manifest, including policy aliases, package exports, all localized pages, Code modules, the CLI registries and inspected producers. It does not copy the large raw matrix into another source of truth.

The initial diagnosis used product source at `830287f95959a4a1a4fb797df68b0bd6889e0bae`. The current ledger incorporates the public Tooltip Usage source integrated at `c8a5cfdfbd3054f6ea11794c68d316d6c151ccfa`; its shared complete-file producer is also a hashed input. Diagnostic files are separately hashed inputs. The recorded checkout observation is retained when identical source inputs are checked on a later commit; changed inputs require regeneration and review. A passing diagnostic check means the obligations are accurately recorded, not that the product passed acceptance.

```sh
node scripts/docs/release-website-readiness.mjs --check \
  --details /tmp/sprint3-website-readiness-details.json
node --test scripts/docs/test/release-website-readiness.test.mjs
```

After an actual source change, use `--write` instead of `--check`, inspect the changed row dispositions and retain the original execution receipts. `--details` is an optional full source/route output; the committed ledger remains compact.

## Complete current release inventory

The policy and package exports yield **170 families, 340 localized routes, 450 Preview instances and 1,582 declared Preview/host cells**. Lucide's generated glyphs share its one protocol/gallery, rather than being counted as thousands of unrelated family pages.

| Source disposition | Localized routes | Required next work |
| --- | --: | --- |
| All Preview Code panels disabled; no CodeExample or fenced code | 164 | Author matching, complete public Usage for the supported composition and hosts. |
| All Preview Code panels disabled; existing fenced code | 8 | Reuse the existing Collapsible and Input Shell examples and complete the missing host/setup/Preview relationship. |
| Code enabled, but no matching candidate source on the page | 140 | Supply the source; `codePanel=true` or `hasCode=true` does not produce missing code. |
| A candidate Preview source exists | 16 | Review private aliases, inputs, surrounding setup, omitted hosts and actual composition, then execute it. |
| CodeExample exists | 12 | Execute the displayed Base Button, Shadcn Button, Lucide and three Tooltip family files in the declared installed consumer. |
| **Total** | **340** | Every row retains its exact key and an open child. |

The first two rows together are **172 routes / 86 families / 740 declared host cells**. Among these, only the two localized Shadcn Hover Card pages have a discoverable existing Code map. That map still contains website-private aliases and WC tags, so even these two pages do not have an accepted installation-ready fix consisting only of enabling the panel.

Across the complete inventory, **1,472 declared Preview/host cells lack a matching enabled Preview source candidate**. This is specifically a Preview-source observation: independent CodeExample files and fenced examples are retained separately. It is not a claim that every one of those cells lacks all prose or code, nor that the remaining source candidates are runnable.

The current code-map scan finds **10 exported maps, 24 demo identities and 91 map/host entries**. Comments, string contents and non-exported variables do not count as maps. Duplicate maps cannot be combined to invent a host that the actual first-match Preview resolver would not select. Declared source remains unverified, including modules that contain private `@prototype-libs/*` aliases.

The original `830287f` diagnosis remains historical: 144 enabled-without-source routes, 18 source-candidate routes, six CodeExample routes, 90 map/host entries and 1,474 missing Preview-source cells. The six localized Tooltip pages now display the shared complete files, and the Base map adds its missing Vue 2 entry in both locales. These source changes explain the current counts; they do not convert the earlier execution into a later-source run or establish installed/native acceptance.

## Delivery and producer responsibilities

| Actual current registry disposition | Localized routes | Responsible workstream and required producer |
| --- | --: | --- |
| Public component target | 138 | Sprint 2 delivery owner: [#1458](https://github.com/Proto-UI/Proto-UI/issues/1458) / [#1154](https://github.com/Proto-UI/Proto-UI/issues/1154). Sprint 3 must then verify the chosen fixed version and real npm/pnpm/npx/dlx consumer. Registry presence alone does not prove publication or installation. |
| Workspace/source-only target | 186 | #1458 must supply the supported fixed-source consumption route. The public `add` path rejects these entries; they cannot be presented as installed admission merely because source metadata exists. |
| No component target | 16 | Website and delivery owners must use the actual public package subpath and Adapter where supported. A missing facade does not imply a missing package export. Do not invent an `add` command. |

The eight families in the last row are Base Checkbox, Input, Scroll Area and Tooltip; Brutalist Checkbox and Tooltip; Shadcn Style Scope; and Lucide Icon. Lucide already has direct-Adapter file examples, which still need their exact declared-version consumer acceptance. The 164 routes without a Code panel, CodeExample or fenced code split into 26 public-target, 136 workspace-only and two no-target routes.

The existing [example-code CLI](../../../../apps/www/scripts/example_code_generation/cli.ts) has a useful **explicit `authored-code.ts` route**. Its bounded `--folder` path requires every folder demo ID and all four hosts, and can generate maps after the real public Usage has been authored. The Button source and complete-file wrapper, and the Lucide direct-Adapter files, supply existing patterns to reuse.

The legacy static-tree route emits only WC, React and Vue. It does not translate `setup`/ref callbacks or provide Vue 2, and the generator's folder scan does not include the top-level Finf demo wrappers. These include real controlled request/accept/reject behavior, such as Accordion. Emitting the static tree alone would lose that behavior. There is no approved bulk generation shortcut that makes those incomplete examples acceptable.

Generated consumers retain the separate producer obligations of [#732](https://github.com/Proto-UI/Proto-UI/issues/732), [#733](https://github.com/Proto-UI/Proto-UI/issues/733), #1055, #1061 and #1145. Authoring readable public Adapter examples can proceed while those producers work. Adapter examples, ordinary generated-target consumers and real Shenko/Verdant applications retain their own source/target/consumer identities and cannot accept one another.

## Original conditions and owners

The JSON child IDs carry the exact row sets and workstream owners. They subdivide the original conditions rather than introducing a replacement completion rule.

- **#1042 acceptance 1–3:** the Sprint 3 website/documentation owners supply one disposition for every current row, meaningful bilingual Usage, real delivery names and exact-candidate Preview/source/host results. The five source-disposition children above are open.
- **#1042 acceptance 4–6:** the website, #420/#568 runtime/navigation and original Copy #1438 / Search #1435 owners retain the full supported Button composition matrix, state/focus, cold/failure/no-JS, native links, themes, keyboard, viewport and enlarged-text obligations.
- **#1141 original 78-family catalog drift:** the current 0.3 execution owner must reconcile the original catalog, availability, family routes, navigation and receipts under the original #1090 source keys. The current 170-family export inventory does not replace that older object set.
- **#1141 Dropdown anatomy replay:** its original owner retains the production `retained-shell` / `readContrastAuditSubject` 24-frame oracle, probe-only negative control, owner/generation/physical portal/current lease, `extras == 0` and independent paint assertions. This website source ledger does not accept that work.
- **#1175 M4/M5 and forced boundaries:** the website/acceptance coordinator and actual device/AT operators must reconcile every original row and obtain applicable forced-colors, real zoom, mobile and OS AT results. CSS viewports, CSS text scaling and browser AX do not substitute for them.
- **Historical material:** the original archive owners and history coordinator must recover #1042's 518-route / 5,784-cell matrix and #1175's fixed Camoufox driver/archive. The current search did not recover them. R5 remains 76 phases with 0 passes / 76 failures, and 155 subjects with 5 passes / 145 failures / 5 unknown. New runs do not overwrite those facts.
- **Exact-candidate independent acceptance:** the integration owner and eligible independent reviewers retain #1042 acceptance 7 and the original #1141/#1175 CI, DCO, native evidence and review requirements. Parent tracking follows the same results; it is not another duplicate implementation.

## Source-count history and next concrete host proof

The earlier inventory at agent source commit `4e3406b9c8f594875fe5f272caa56501c2e2a226` recorded **1,578** declared host cells. Its source slice was integrated as [fbf691e1067ec90d0eea0548fe1db3205c475fc1](https://github.com/Proto-UI/Proto-UI/commit/fbf691e1067ec90d0eea0548fe1db3205c475fc1). That count remains historical. The subsequent Tooltip source change, agent commit `5b8685717153c0b21ce15f220bd75f1e3f2e01ef`, was integrated as [9c3a4d789e0144f98ac53bb73cd3a72907e2f6d8](https://github.com/Proto-UI/Proto-UI/commit/9c3a4d789e0144f98ac53bb73cd3a72907e2f6d8). It adds Vue 2 to Base and Brutalist Tooltip in both locales: four actual new declarations, producing the initial **1,582** count. Both integration commits are ancestors of the published `830287f95959a4a1a4fb797df68b0bd6889e0bae` candidate.

The JSON retains the original agent SHA, the published integration SHA and per-path SHA-256 equality evidence. The reading source slice has 15 byte-identical paths and the Tooltip slice has ten. Their shared `scripts/test/runtime-test-plan.mjs` deliberately differs: integration also retains Transition in the first slice and the reading suite in the second. Both plan hashes and the specific additional suite are preserved. These mappings identify delivered source slices; they do not relabel the original measured checkout or make native receipts interchangeable. The Tooltip declaration change does not prove complete Tooltip Usage. The separate Tooltip worker owns that known four-host source repair.

There are **26 localized Base routes / 13 families** whose public Preview declarations omit one or more public hosts. Twelve omit Vue 2; Base Checkbox declares only WC. The exact omitted rows and hosts are retained in the JSON. Their undisplayed hosts are not silently marked unsupported or accepted.

**Base Select is the next bounded candidate.** Its public pages name WC/React/Vue, its Code map already has a Vue 2 branch, and the real Vue 2 Adapter has a Base Select protocol test. The existing `packages/adapters/vue2/test/select.test.ts` was run on the unchanged product inputs at 830287 during this diagnosis: **4/4 host-unit cases passed**. Only one is Base; Bootstrap/Liquid and the separate Shadcn case keep their own scope. It uses real Vue 2 and the real Adapter with synthetic DOM input and is not native-browser acceptance.

```sh
corepack pnpm@10.32.1 exec vitest run packages/adapters/vue2/test/select.test.ts \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Before changing the public host list, the next implementation should exercise the **actual** `apps/www/src/content/docs/zh-cn/demo-base-select.demo.ts` through the existing Vue 2 website renderer. A bounded native proof must retain its three options, `Framework selector` name, actual committed label/value, trusted open/navigation/selection/Escape, same-instance runtime retirement, and removed portal cleanup. Then change the two localized host declarations and their existing three-host registration test together, and run all four public hosts in both locales on the production candidate. Preserve the current baseline, unsupported outcomes and original assertions. The current Brutalist Select first-frame suite does not provide this Base-page proof.

No Base Select page, renderer, CLI or compiler was changed by this diagnosis. The seven focused diagnostic tests cover false source discovery, missing map hosts, private/workspace target separation, duplicate map ambiguity, altered source bindings, omitted rows and invented closure; their passing result accepts the detector's bounded behavior only.
