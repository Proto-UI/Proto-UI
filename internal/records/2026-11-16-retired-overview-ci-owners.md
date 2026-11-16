# Retired overview CI owners and retained native evidence

## Source and authority

The repair starts at `10d4897a7ee5cc3b0123f74e708e4b1e01d74af2`. Commit `19da90383954ee1fc6255bcc18f35b9b2b04292e` deliberately removed the bilingual library and family overview routes, `PrototypeLibraryOverview.astro`, `library-cards-first-frame.browser.test.ts`, and `library-card-font-boundary.browser.test.ts`. Its stated direction is to route navigation to real component demos. Both removed browser suites visited `/zh-cn/ui-libraries/`; these are retired subjects, not missing checkout files.

The callable `library-card-evidence.yml` survived that deletion. Its first-frame and font-boundary jobs still required those sources. The optional historical font comparison also included Quick Start and visual-density arms, but all arms shared a frozen historical delta and the deleted Card9 source guard. It was a specific historical comparison, not an independent current regression owner. The full-cycle production aggregator still invoked its unconditional font-boundary job, so a current dispatch could not complete successfully.

## Reconciliation

Remove the retired workflow and the aggregator's final `library-card-font-boundary` call. Do not restore overview routes or convert missing sources into skipped or passing evidence. The schedule audit now rejects literal browser-suite paths missing from any reachable cycle workflow, including conditional jobs. Its fixture proves failure, then success with an existing source, then failure again after removal. The runtime inventory's missing and duplicate source controls remain intact.

| Retained subject | Current owner |
| --- | --- |
| Quick Start first frame and fragment control | Existing two browser suites in the shared runtime plan |
| Site Typography and document/native text ownership | `site-typography.browser.test.ts`, shared browser plan and dedicated typography workflow |
| Homepage and visual-density comparison | `homepage-visual-evidence.yml` |
| Real Shadcn Card demo and compatibility journeys | `demo-shadcn-card.browser.test.ts`, existing dedicated owner |
| Complete Liquid Card candidate and opaque no-JavaScript fallback | `library-liquid-card-producer.browser.test.ts`, `liquid-card-candidate-evidence.yml` |
| Compiler WC native browser suite | `compiler-wc-native-evidence.yml` invokes `wc-native-isolation.mjs --run-native`; that runner selects the suite in its actual Vitest argv |

The Liquid candidate previously extracted `readCards` from the deleted Card9 suite. Preserve that function as `library-card-observer.ts`; the declaration, after removing its new `export` modifier, has the unchanged SHA-256 `b877f6b4368568f921500f4e469ed4b0388cccb57f9f5651413a9be721c6719d`. The browser suite still records that executed function's digest and rejects an absent source or declaration. Its optical, font, readability, response, native input and no-JavaScript assertions are unchanged.

The surviving gallery is mounted only by the two private Liquid candidate routes. Its six native anchors now use absolute locale-specific destinations: Base, Shadcn, Bootstrap and Liquid Button; Brutalist's component Button; and Lucide Icons. Remove the stale `<base>` that made the Liquid relative link resolve under `button/liquid-glass/`. A source-data test checks all twelve destinations against their real MDX files. This does not create or restore a public overview page.

Remove only the Typography suite's final overview-card density case, which still required the deleted renderer's `.prototype-card` and overview-only text roles. The preceding 33 current journeys stay byte-for-byte unchanged. Its collection contract loses only that retired name. Existing local contracts are reconciled with the already-authored rich-list-item ownership and locale-aware Hero helper; counterexamples reject missing or duplicate owners. The two Liquid navigation guards now require the Button destination that the retirement commit already selected.

The compiler suite's registry points to its actual isolation runner, consistent with other script-owned production evidence. Its exported suite constant is consumed by the real `spawnSync` argv. The owner contract checks the workflow's `--run-native` call, the constant's value and actual argv consumption; mutations of each binding fail. Existing isolation execution refusals remain unchanged. This repair changes no compiler lowering or host isolation policy.

## Evidence boundary

The browser registry retains 99 shared development suites and 33 dedicated suites. The full-cycle reusable-workflow closure shrinks from 21 to 20 files only because the obsolete overview workflow is removed. The shared browser shards remain `13, 13, 13, 12, 12, 12, 12, 12`.

Focused evidence covers Node governance and owner checks, native-input diagnostic controls, suite collection, source/route binding, the preserved observer's strict TypeScript compilation, Astro source compilation, and existing Card/typography unit tests. Failed baseline and setup receipts are retained with the passing focused receipts. These local checks do not establish native browser, optical, font-paint, complete CI, scheduled recovery, or release acceptance.

The historical font record, recorded inventories, and the compiler inventory's `09f98199449b5eb233372aeaf77fffb8d02b78bb` input snapshot are not active owners and are left unchanged. This additive record explains their historical paths without rewriting their evidence. Independent review and a full cycle remain bound to the final integrated head; no dispatch, publication, tag, deployment or GitHub permission change is performed by this repair.
