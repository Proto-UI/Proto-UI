# Finf Dialog available-space candidate

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Observed defect and scope

PR #858 source 30d477c1b0eb88662ef2e0bf28a952d678404a4d native React 390px Dialog had x=0, width=390, right=390. The pinned Shadcn f31ed819 source already reserves two rem of total horizontal space. This patch acts at public Base/Styled Prototype, Positioning host and compiler boundaries, not website-only CSS.

AvailableSpace is a parallel active-content lease: logical rect or unknown, revision and view epoch. Web computes size and center from the same visible root-content region and safe insets; browser API objects stay private. Only live opted-in content acquires shared observation. Mask is unchanged and full-window; Sheet edge policy is not inferred.

Direct Base is bounded with scrollable overflow. Shadcn and Brutalist reserve one rem per edge with a 32rem width ceiling, and vertical overflow remains scrollable. Exact Shadcn intermediate breakpoint/composition parity remains open. GPUI must translate logical geometry into native constraints; CSS var/min/calc success is not native-host conformance.

## Validation at candidate preparation

- Width-token negative control failed before implementation.
- Same-target obsolete release and reader-triggered replacement controls both failed against the initial host and pass after ownership repair.
- 62 focused controls pass: Positioning/Overlay, four actual Adapter catalogs with simulated viewport facts, CLI lowering, Shadcn prototype.
- Workspace TypeScript and isolated native-probe TypeScript pass.
- Official style token generation completed; compiler rejects no new tested geometry token.
- Spec authoring stays draft; native implementation is planned until source-bound execution.
- Local native browser unavailable under the existing socket restriction. New official-CI probe preserves immediate and settled images, real same-instance viewport changes at 390/430/320/1024, short viewport, explicit long text/200% font fixture, CDP scale/restore, and close/reopen cleanup. These are browser emulations, not physical keyboard/notch evidence.
- Entry focus is recorded, not repaired or certified by this geometry patch. The separate #832 source-vector regression remains a Finf obligation.

## Remaining acceptance

Run the frozen joint Finf source in official native CI, inspect original PNGs and measured rectangles, close any geometry/scroll/hit defects, complete GPUI translation and physical occlusion evidence separately. Do not claim all nine coverage dimensions from Web unit tests.

## Overlay diagnostic fixture correction in this batch

Finf c071ebd63ddcc7c023cbe9d3c64e667672190f81, GitHub merge checkout 2b26fcd2504381711baa35b2553081f7c028fb47, run 37509949749 / job 112436105135: 8 Dialog lock journeys passed; all 8 Select journeys reached a zero-classic-scrollbar precondition failure. Their 40 recorded positions had zero collision-adjusted horizontal error and actual nested scroll reached 48px. The 72 PNG hashes were verified (artifact 11436701973, ZIP SHA256 fea07a2256e2ce51d838412c8f25537c80da6302edb1086bda8984e991380d81); a React RTL original was inspected.

Installed Playwright Chromium launch code explicitly adds `--hide-scrollbars` in headless mode. The diagnostic now omits that default argument while keeping all real geometry assertions and its classic-width precondition. This corrects a test setup omission, not a product geometry defect or retroactive pass. The next official run must establish actual nonzero scrollbar width.

Final local preparation additionally passed 121 runtime inventory/runner controls, the two source coverage matrices, and spec authoring. Production attempt one was killed (137) during gzip computation after 4162 modules; a same-source isolated retry built all 284 pages in 28.45 seconds and passed the actual production bundle graph. The failed attempt is retained and is not presented as a pass.

Additional Base/Brutalist Dialog suite: Base16 and Brutalist5 initially passed, while one Brutalist visual control still expected the replaced fixed-center/max-w-lg tokens. Its geometry assertions now name the available-region center/size tokens and scroll overflow; all existing Mask, paint, transition, presence and accessibility assertions remain. The resulting22/22 pass, bringing the non-overlapping focused total to84. This was an obsolete test expectation, not a new product failure.
