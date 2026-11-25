# Toast stack and viewport repair — captured evidence

These five PNGs were captured on 2026-11-25 from a running Chromium fixture using the actual Shadcn Toast prototypes and the project's generated CLI CSS. Notification copy and the transformed, clipped origin are synthetic test content. The captures were visually inspected, contain no personal content, and have no embedded PNG metadata.

## Source and scope

- Published repair source: [`58d55c299695dec564d820b2989c37de1c111f42`](https://github.com/Proto-UI/Proto-UI/commit/58d55c299695dec564d820b2989c37de1c111f42).
- Baseline: [`a3d8ec3974d0a12017f64e1d1044d7865b996c84`](https://github.com/Proto-UI/Proto-UI/commit/a3d8ec3974d0a12017f64e1d1044d7865b996c84), main `710a90df2ea57d9f93d7d09e43ebfb2b7b8e5057` plus the preserved #1854 CSS prerequisite.
- [Browser fixture and executable assertions](https://github.com/Proto-UI/Proto-UI/blob/58d55c299695dec564d820b2989c37de1c111f42/packages/prototypes/shadcn/test/toast-stack.browser.test.ts).
- Capture toolchain: Node 24.22.3, pnpm 10.32.1, Playwright 1.58.2, Chromium 156.0.8078.108 with its sandbox enabled.
- The after captures used the product contents recorded in tree `815db1daaac7b2fc485c7007c90c7d7c078578d4`. Published source `58d55c2` changes only the runtime-test-plan registration relative to that tree. Product source bytes remain the same. The executed candidate patch SHA-256 is `7a175854b007ddf2a40c1073283410a2ef0b32a3c952c7d63a54ceb16b9da5e3`.

The browser fixture creates twelve independent messages and observes page-edge positioning, default and custom visible limits, opening order, scrolling, expansion and native Tab navigation. Separate cases sample every frame during a 500ms leave interval. The candidate suite passed eight Chromium scenarios and one CSS closure check; the focused run passed 424 tests across 28 files. These screenshots document the fixture observations; complete website, every theme, screen-reader and non-Web platform acceptance remain separate evidence.

## Captures

| File | Observation | SHA-256 |
| --- | --- | --- |
| [before-1280-bottom-right-ab57738b7e83.png](before-1280-bottom-right-ab57738b7e83.png) | Baseline: twelve creations remain clipped by the transformed origin at 1280 × 900. | `ab57738b7e8388973e544554942022904cf40a5a0d058b9126eea4a35f191820` |
| [after-1280-bottom-right-collapsed-1e040225b022.png](after-1280-bottom-right-collapsed-1e040225b022.png) | After: message 12 is frontmost at the bottom-right page edge at 1280 × 900. | `1e040225b022b744ca362dd6587b56963a4c9a225589aefd4722e96fc8d45324` |
| [after-1280-bottom-right-expanded-f152efec1c7a.png](after-1280-bottom-right-expanded-f152efec1c7a.png) | After: the expanded visible window orders messages 10, 11 and 12 toward the bottom edge. | `f152efec1c7a8c9e2b880b020195fd897174f5a0046d1d0194f92e490657a165` |
| [after-390-bottom-right-collapsed-6ac61b471710.png](after-390-bottom-right-collapsed-6ac61b471710.png) | After: the bottom-right stack remains outside its origin at a 390 × 844 viewport. | `6ac61b471710f26b73e635cd6ef1ec65d5f8d4410c9c13f9fc4e5058942f471b` |
| [after-390-top-right-collapsed-ad516b473d89.png](after-390-top-right-collapsed-ad516b473d89.png) | After: top-right placement puts the newest message nearest the top edge at 390 × 844. | `ad516b473d8913d834ecf2f509ab84d99aaab5beeb2ab45a8f8e6dd7d1571e1a` |

## Provenance and retention

The repair, tests, evidence selection and this record received material Codex assistance. The PNGs are unmodified browser captures; source and file hashes were checked before publication.

Retention owner: the maintainers of [Toast repair PR #1895](https://github.com/Proto-UI/Proto-UI/pull/1895), from `fix/toast-stack-viewport-bc47`. This dedicated `evidence/toast-stack-viewport-bc47` branch is retained for that PR's review history. Keep it available and never merge it into `main`. Cite each PNG using the full evidence commit SHA so links do not follow a moving branch. This evidence publication does not record a formal review, CI acceptance, merge or deployment.
