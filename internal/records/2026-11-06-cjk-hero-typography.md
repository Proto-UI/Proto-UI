# Chinese homepage slogan: bounded typography composition

## Request and authority

The maintainer reported that the Chinese homepage title looked too heavy and tightly spaced and asked for a bounded repair with precise progress. This is a sanitized paraphrase of direct feedback. The private reference image is not published, and its operating system, actual fallback font and source revision are unknown.

Baseline: `9e58834d167618216ed9b39278eb8dded2f2f596`. This increment consumes the existing draft `P-BASE-TEXT-INPUTS`, `P-BASE-TEXT-CONTENT`, `P-BASE-TEXT-PASSIVE` and `P-SHADCN-TEXT-PROJECTION` criteria. It does not promote their lifecycle, change a Prototype API, or assert official shadcn CJK parity. The previous document-reading record is context, not normative authority.

The existing Shadcn slogan recipe and native fallback agree: 30px below the wide breakpoint and 48px at wide, weight 600, line-height1.1, tracking -0.025em/-0.05em. Geist does not establish Chinese glyph identity. A font stack or installed-font inventory is not rendered-font evidence.

## Chosen application boundary

Only the site-context Shadcn slogan whose authored effective language matches `:lang(zh)` now consumes public Text `weight: medium`, `tracking: normal`, `leading: tight`: the intended declarations are 500/0/1.25. This is a local composition candidate responding to feedback, not an upstream Chinese typography mandate. Responsive size, original copy, native h1 ownership, font stacks/assets and synthesis policy stay unchanged. English, Brutalist and other roles retain their recipes.

`heroLanguage` is an internal application input. The typography participant derives it from the original slogan element, respects inherited language and explicit local overrides, and includes it in source revision/refresh checks. Non-slogan language mutations do not trigger this new refresh criterion. A slogan language change in any family may still rebuild the passive Text batch; only the Shadcn/site Chinese slogan receives changed presentation. Unchanged style is not a promise of zero lifecycle work.

The homepage observer includes the document element and `lang`, so changes on html, an ancestor or the slogan can request a same-generation passive update. Existing coordinator ownership, rollback and retirement remain the implementation owners. No whole-page commit is introduced for the language update.

The native fallback repeats the intended three declarations only on the Shadcn Chinese slogan before `data-typography-owner` exists. It adds no font-family or font-size override and never selects the enhanced Text surface. The source assertion proves declaration agreement, not Astro SSR, browser cascade or no-JavaScript acceptance.

## Executed evidence

The JSON companion binds final source/test files, every retained validation phase and output hashes. Final seven-file source manifest: `8d95d4c4b431b53194ca9f074761796f791ed911e835742887c425368c29801d`; patch: `26ebc006ecdba7f83bd46c5fa5827ad594efbbe9c871189e97880c864bc07fed`.

- Final three suites: 80/81, exit1. The single failure is the existing native-document stylesheet compilation test, which cannot resolve absent `tailwindcss` in the locked dependency subset. Baseline two suites were 65/66 with the same missing dependency. All 15 added cases pass; this is not a green full-suite result.
- Four-adapter owner suite: 36/36 using actual WC/React/Vue/Vue2 Text participants. The four new cases check language forwarding, a local English override, source node identity and cleanup. HappyDOM 15.11.7 lacks `:lang`, so these tests explicitly supply only that host query. They do not prove browser language matching, pixels or fonts.
- Automatic language suite: 7/7, exit0, no unhandled errors. Real homepage MutationObserver delivery drives html/main/h1 language changes, English override removal, non-slogan non-refresh, preparation coalescing and destroy/late-mutation retirement. It preserves source nodes, an authored native form's draft/focus/caret and page snapshot. It deliberately excludes the gallery integration fixture.
- The original destroy test uses WC and pauses after actual materialization completes but before its wrapper returns. It proves no late activation, disposal and source restoration at that boundary, then no new materialization after subsequent language mutations. r9 adds five more teardown cases covering the earlier prototype-loading boundary, synchronous destroy before observer delivery, root removal during a pending refresh, `astro:before-swap` during a pending refresh, and a pending refresh under the real React adapter. Those r9 cases are added source only: they have NOT been executed, so the executed automatic-language suite result remains 7/7 from r8, not a claimed 12/12. Vue/Vue2 pending-refresh teardown and native browser ordering remain untested; the four-adapter ownership suite already covers per-adapter disposal.
- Single-line controls remove only lang observation, the slogan restriction, the Chinese predicate, or language forwarding. They produce 5/6,1/6,7/7 and4/7 failing selected cases respectively. The last two commands intentionally select seven cases; 67 other tests are filtered out, not passed. These controls ran on r6; their product targets and selected tests are unchanged in r8. The seventh destroy case was added and passed in r8, without an invented negative-control run.
- Seven-file Prettier including Astro passes. Scoped TypeScript with repository strict settings, pinned Vite ambient declarations, six modified/new TypeScript roots and transitive imports passes on baseline and final candidate. This is not a complete Astro/workspace build or type check.
- Four existing regression suites were run unchanged on baseline and r7: both 110/116 with the same six size expectation failures and 62 reported unhandled host errors. Five failures are in homepage state size expectations and one is the app-private semantic-role size expectation. HitParticipation diagnostics require a positioned/non-replaced principal box in the unstyled host fixture. r8 changes only the new separate language test, so these old-suite results are reused explicitly, not called a fresh r8 full run.

The affected old suites are `site-typography.test.ts`, `Homepage/homepage-typography-state.test.ts`, `Homepage/homepage-text-layout.test.ts` and `apps/www/src/prototypes/site-typography.test.ts`. Their failing expectations and all original assertions are retained. No skip, threshold relaxation or swallowed error was added to make them green.

### Retained failed attempts

The initial four-adapter tests failed because HappyDOM returned false for all `:lang` queries. An explicit host-query fixture exposed a separate incorrect expected token: the actual public tighter leading token is `leading-[1.1]`, not `leading-tighter`. Both failures remain recorded.

One runner invocation labeled r4 actually mounted r2 due to a dispatch bug. Its receipt exposes the actual hashes; it is recorded only as an r2 repeat. Later dispatch asserts the exact manifest before execution. No r4 test credit is taken from that run.

Early automatic-language cases reused the real gallery fixture: all six assertions passed but 18 unhandled Rhea hit-layout errors kept exit1. A document CSS utility fixture did not fix the shadow-root host boundary and also stayed red. The final dedicated language fixture avoids this unrelated gallery dependency, while separate unchanged gallery regressions retain their baseline/candidate failures.

Type setup initially lacked Vite's ImportMeta declarations; an attempted `types` entry could not resolve through the restricted typeRoots. Supplying the actual pinned Vite client declarations fixed the harness on both versions. The formatter initially imported an unavailable Astro plugin default export; its namespace export was then used. Formatting wrapped the new selector, and its source assertion was updated to accept formatter whitespace. None of these attempts is hidden or represented as a product defect.

## Environment and native blocker

Execution used Node 24.22.1, TypeScript 5.9.3, Vitest 2.1.9, HappyDOM 15.11.7, Prettier 3.8.1 and Astro plugin 0.14.1. Existing 105 locked packages were reused without downloads. Source, candidate and dependency files were hash-checked before/after, mounted read-only, with no account mount, a cleared environment and prohibited networking denied. Heavy stages shared one process lock, one worker, a 1024 MiB Node heap and a 120-second phase bound. A separately verified read-only Homepage directory copy provided the new test mount without changing the shared baseline.

A safe probe of installed Chromium with its sandbox enabled aborted before entering the data-page fixture: ProcessSingleton `socket()` returned EPERM and the process received SIGABRT. The browser sandbox and network boundary were not disabled. There is no new browser assertion, rendered-font report or screenshot from this attempt. Old Noto captures are not relabeled as current evidence.

## Coordination and remaining acceptance

[The bounded publication claim](https://github.com/Proto-UI/Proto-UI/issues/803#issuecomment-6677598105) preserves the broader #803 history and current owners.

- #1285 head `8c07367eb19c4a280f7b6d0d5dc118f81c05db35` overlaps only `site-typography.ts`. Preserve its primary-nav marker. Applying the two patches in either order yields the same overlap-file SHA256 `a52d1278fe1153d7df74ccf68f11069df20c474934445be6108d9e87c253542c`.
- #1296 head `ae3ba5b1c6394819c3c328e40500ddfb3a509f5a` overlaps only `Homepage/homepage-runtime-client.ts`. Preserve its family controls; the language observer hunk is separate. Both patch orders yield `d1a7ea9c62fa3be373dff47ed76e8d13d53b48189047c5e3139379aecdd58b17`.
- Those are static composition results, not execution of either combined version. No full-file overwrite or other-owner takeover is authorized by them.

Independent AI static review found no new blocker in the bounded candidate and requested the now-passing destroy case. That review does not constitute a GitHub approval, full lifecycle review or visual acceptance.

Next work for the continuing contributor: run the five r9 teardown cases and the existing suites in the pinned host environment (they were authored without execution, per the review worker's no-test constraint); supply the verified lock-compatible Tailwind dependency; complete actual Astro SSR/noJS and hydrated captures in a supported authorized sandbox; inspect computed declarations and per-glyph rendered fonts; compare Chinese/English and other-family controls over light/dark, 320/390/desktop,200% text and all four runtimes; cover Vue/Vue2 pending-refresh teardown orderings; resolve the old fixture/expectation debt separately; and validate the final combined Header/navigation/CJK source. Obtain actual remote checks and independent review before normal integration. Do not close #803, waive its existing conditions, treat a Draft as completion, or deploy from this evidence.
