# Scroll Area preview geometry follow-up

Date: 2026-10-03. PR: #777. Failing hosted head: `f91f6a85b4a93dcb424c07582cb8ac71bd907679`.

The [full CI run](https://github.com/Proto-UI/Proto-UI/actions/runs/37098282671/job/111132579391) finished with 28 of 30 browser suites and 149 of 151 tests passing. Its two remaining geometry failures are retained as baseline evidence; this record does not claim a new hosted pass.

## Consumer layout correction

At a 320px viewport, the Brutalist Scroll Area projection scope measured 244px in WC, React and Vue. The WC automatic grid track, toolbar and content expanded to 269.671875px, yielding a 237.671875px Root; React and Vue retained 244px tracks and 212px Roots. The 25.671875px mismatch belongs to the website preview's intrinsic grid sizing, while the outer clipped frame can keep document overflow at zero.

The bounded consumer correction gives the fixed-family scope `grid-template-columns: minmax(0, 1fr)` and its toolbar grid item `min-width: 0`. Existing content shrinking and public Scroll Area dimensions remain unchanged. Source tests fail on both missing declarations before the correction. The browser test retains its ancestor measurements, width mapping, document overflow check and 0.5px runtime parity tolerance; it additionally checks toolbar/content inside scope, runtime control inside toolbar, Root inside the padded content box, and scrollbar inside Root.

This follows draft `P-BRUTALIST-SCROLL-AREA-CONSUMER-SIZING` and `P-BRUTALIST-SCROLL-AREA-DEMO-RESPONSIVE-SIZING`, exercised by `T-BRUTALIST-SCROLL-AREA-0001`. No Prototype, Adapter or Scroll host semantics change.

## Focus measurement correction

The Shadcn failure recorded a 487px viewport-relative y difference across Tab and focus. The original log contains no document scroll offset, so it cannot establish whether scrolling, layout movement or both caused that difference. The draft `P-SHADCN-SCROLL-AREA-VIEWPORT-FOCUS-FEEDBACK` criterion still prohibits geometry changes.

The test now captures the raw viewport rectangle and document scroll offsets in one browser evaluation per sample, prints both before/after measurements, and compares x/y/width/height in the same document coordinate space with the original 1px tolerance. It preserves Tab, normal focus and the existing inset-ring checks. Pure measurement tests distinguish a synthetic 487px document scroll from a real 2px change on each of the four geometry axes. Synthetic fixtures prove the coordinate conversion, not the cause of the hosted failure.

## Validation boundary

On Node 24.19.0, the two new unit suites and existing Brutalist/Shadcn Scroll Area Prototype suites pass: 4 files, 22 tests. The source-only red run confirms the two missing consumer CSS declarations. Focused TypeScript checking of all five changed/new TypeScript files under the root workspace options passes; `pnpm --filter apps-www exec astro check` reports 266 files, zero errors, warnings or hints. Formatting and whitespace checks pass. An initial direct `tsc -p apps/www/tsconfig.json` probe exposed a missing-node union narrowing error in the new assertions, which was repaired, alongside broader `verbatimModuleSyntax` and Starlight/HAST diagnostics outside this slice; that probe is retained as a failed result, not a repository-wide type pass.

Neither unit result proves rendered containment. Local browser and server execution are unavailable under the current task boundary; new exact-head Actions geometry logs and screenshots remain required follow-up evidence. The original failed hosted results are not replaced or reclassified as passing.

Co-author by OpenAI Dots
