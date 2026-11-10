# Proto UI Website

This app contains the Proto UI documentation site, whitepaper, examples, and live prototype previews.

It is built with Astro and Starlight, but the app is not a generic Starlight starter. Its job is to explain Proto UI as an interaction protocol and show how the current prototype libraries can be rendered through React, Vue, and Web Component adapters.

## Project Structure

```txt
apps/www/
├── src/content/docs/        # bilingual docs, specifications, whitepaper, and demos
├── src/components/          # site components and prototype preview infrastructure
├── src/styles/              # generated Proto UI tokens, shadcn theme, and global styles
├── scripts/                 # docs-side generation helpers
└── astro.config.mjs
```

## Commands

Run commands from the repository root:

| Command                        | Action                                   |
| :----------------------------- | :--------------------------------------- |
| `pnpm docs:dev`                | Start the docs dev server                |
| `pnpm docs:build`              | Build the production docs site           |
| `pnpm docs:preview`            | Preview a production build               |
| `pnpm --filter apps-www check` | Run Astro type and content checks        |
| `pnpm --filter apps-www astro` | Run Astro/Starlight maintenance commands |

## Content Notes

- English docs live under `src/content/docs/en/`.
- Chinese docs live under `src/content/docs/zh-cn/`.
- Prototype demos are registered through `src/components/PrototypePreviewer/`.
- Contrast audit anatomy and numeric surfaces use the selected lease's retained consumer content and owned detached parts. Inline runtime Tabs panels surround that content; the picker, its enclosing Roots and its detached control popups are reader chrome. This scope check preserves missing, duplicate and foreign-content failures and does not establish component conformance, cue necessity or accessibility acceptance.
- Generated CSS token files in `src/styles/` should be regenerated through package scripts instead of edited by hand.
- Homepage passive typography refresh preserves the interactive gallery generation and its draft state. A failed page publication reactivates the typography batch current at publication before retiring the failed batch; source or viewport changes during preparation remain eligible for refresh. Real Prototype integration fixtures load the generated stylesheet so physical host checks observe the same positioned roots as the site.
- Build-time style snapshots use finite reviewed recipe registries. Each Runtime session owns a detached Context root with no logical parent, so setup-phase providers and subscriptions can resolve within that snapshot. A created session is disposed after mount/evaluation failures, including mounted-hook failures; this is not a rollback guarantee for construction exceptions before `createRuntimeSession` returns. This is style projection, not an interactive SSR host or a substitute for Adapter-owned child topology.

Popover [browser evidence](src/content/docs/zh-cn/finf-representative-features.browser.test.ts) waits for stable native geometry, paint and animation status within the original 1,000 ms settlement bound, then checks measurements immediately before and after each settled capture. Default Shadcn captures also require the authored native `pui-enter` animation to have finished in the current observed panel/open interval; two frames before that animation appears do not establish its endpoint. Its `fill: both` recipe keeps a finished animation observable to a late probe. The trace records this expectation, panel/open intervals and native animation identities so an older entry cannot satisfy a new one. Screenshots allow animations without forcing completion. Failure handling preserves the original error, available captures and DOM/ARIA diagnostics.

In official clean-head native CI, `PUI_FINF_POPOVER_NEGATIVE_CONTROL=wrong-width` and `PUI_FINF_POPOVER_NEGATIVE_CONTROL=nonsettling` select real width and native-animation faults. The [companion helper suite](src/content/docs/zh-cn/finf-representative-features-evidence.test.ts) explicitly simulates DOM, animations and image payloads; helper results alone do not establish native acceptance.

On a published candidate ref containing the manual runner, select `popover_evidence` when dispatching [the existing workflow](../../.github/workflows/finf-representative-features-evidence.yml):

```sh
gh workflow run finf-representative-features-evidence.yml --repo Proto-UI/Proto-UI --ref "$CANDIDATE_REF" -f popover_evidence=normal
```

`all` is the default and preserves the full matrix; reusable calls also retain it when their Popover input is undefined. `normal` selects only the Shadcn and Brutalist Popover cases. `wrong-width` and `nonsettling` each select only Shadcn Popover, set the corresponding real fault and intentionally leave the test/job failing with retained artifacts. Unknown choices fail before setup. Fault variables are unset for `all` and `normal`.

The original `0607c6c5c386b8a932ab850e92a8873b2121dc45` baseline has no dispatch inputs. Dispatch a published ref bound to that commit without `popover_evidence` to retain its unmodified full-matrix run; this manual runner does not override the source SHA or relax clean-head admission.
