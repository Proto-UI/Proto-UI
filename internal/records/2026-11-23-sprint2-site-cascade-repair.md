# Sprint 2 Sidebar cascade and settled visual observations

This bounded repair continues PR #1716 from 4a11517171aa0a019c4bcbd2314c779e25f21de5. It restores the source changes first committed locally as 7567339956c6eb88c9bd9dee1173d98e70b890ba before the transient executor became unavailable. This restoration does not claim that the original Git object or its raw local logs survived. It does not promote a draft spec entity, claim a fresh 304-case result or accept a later integrated head.

## Existing authority and diagnosed ownership

- spec/prototypes/P-BRUTALIST-SURFACE.yaml is draft. Its existing projection criterion gives the family its own finite radius recipe.
- packages/prototypes/brutalist/src/surface/root.proto.ts maps default radius to rounded-base; the light and dark inputs in packages/prototypes/brutalist/src/theme.ts both supply 5px.
- apps/www/src/styles/sidebar.css already maps the native Sidebar fallback to --site-brutalist-radius, explicitly matching the passive Surface default.
- The unlayered square-chrome rule in site-library-family.css also selected Sidebar anchors and summaries, overriding the correct components-layer rule. Removing those two selectors restores the existing responsibility; other application chrome retains its own square recipe.

The prior hosted run 45146671689, job 137597556472, at source d0392fb31513b12f55b9e99b1fcf26a6338569c9 passed its original functional inventory but retained fallback 0px and enhanced 5px Sidebar observations. Artifact 14805214684 and its original visual review remain historical evidence, not a pass for this repair.

## Discriminating observations

The existing desktop and mobile cases now compare every Brutalist group/leaf corner with the actual family radius bank. Two equally wrong square rows no longer pass. Original four-point native hit ownership, target heights, disclosure, focus, identity and native wheel assertions remain unchanged.

Tabs captures observe the target's actual pending/running CSS animations until completion and retain equal radius samples separated by two animation frames. They neither cancel animations nor inject CSS or a fixed sleep. Original profile, selection, disabled, focus and retained node assertions remain; settled Rhea must return to its initial radius and settled Nova must differ. Each of the five states receives a distinct capture ID, retaining both Nova visits and both Rhea states. The original 42 test cases remain 42; the expected successful image inventory increases from 84 to 100 because no state is overwritten.

Capture metadata retains the actual document theme and separately records browser color preference. Mobile metadata also names script mode. A no-JS SSR dark document under a light browser preference is not labeled as light fallback evidence. No theme protocol or test input is changed.

## Historical local checks and remaining evidence

Before executor loss, Node 24.22.3, repository pnpm 10.32.1 and Vitest 2.1.9 ran the existing site-library-family.test.ts and site-navigation-controls.test.ts: 26/26 passed, no skip. Prettier and git diff --check passed; TypeScript transpileModule reported no syntax diagnostics for the edited fixture. These were source/Happy DOM checks and a syntax check, not a workspace type check or native geometry acceptance. The reused dependency tree emitted existing ES2024/esbuild and absent Astro base-tsconfig warnings.

Those raw local files are no longer available after executor reset; no replacement logs or source-bound remote pass are invented here. The local Chromium launch failed before any page ran with process_singleton_posix.cc: socket() failed: Operation not permitted (1).

The restored integrated candidate must run the unchanged 42-case site selection with these stronger observations and receive independent visual review of its own captures. Root owns the remote/hosted execution and PR acceptance handoff. Record those results separately at the actual restored head.
