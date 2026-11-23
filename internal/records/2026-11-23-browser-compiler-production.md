# Browser compiler production build repair — 2026-11-23

The original integrated S1 workflow [45146637895](https://github.com/Proto-UI/Proto-UI/actions/runs/45146637895) failed the normal website production build at Vite's Worker import: its default IIFE output cannot represent the QuickJS module graph's code splitting. The client already constructs a module Worker. The website now explicitly emits that Worker as ESM; the trusted compiler sandbox's separate IIFE bundle is unchanged.

That repair exposed a second production error. Astro relocates `browser-assets.ts` and its local imports into server chunks. Their previous `../../` URL then resolved to `apps/www`, so static source routes attempted to read `apps/www/internal/compiler/website-demo-migrations.json`. The repository manifest actually lives at the repository root. Browser asset preparation, compiler building and input hashing now share one module-location-based ancestor lookup, bounded by the real pnpm workspace and exact repository/compiler/website package names. It does not derive the repository from the caller's working directory or copy manifests into the wrong location. An unrelated workspace remains an error.

## Verification

- The regression bundles the actual asset source at the relocated website depth and compares every registration and the complete Base Button source graph with the source module. The second case rejects a missing workspace and a foreign workspace. Both pass with no skips.
- A separate negative replay bundles the three exact prior files from `e76d97b8` through esbuild at that depth. It retains the original ENOENT at the incorrect website-local manifest path.
- The complete normal command `NODE_OPTIONS=--max-old-space-size=4096 corepack pnpm@10.32.1 --filter apps-www build` succeeds, including the original formal style generator, Astro static source/target asset routes, website pages, Pagefind and sitemap cleanup. This is a production build result, not a native browser interaction result.
- The Retry import checker still admits only the exact reviewed Astro configuration hash; no general plugin or raw-import exception is introduced. Its original 2,386 controls ran: 2,385 passed and one rejected the independently changed documentation reading viewport source. That separate S3 source binding must be repaired through its reviewed producer; it is not waived here.

Complete local build logs, the original relocated-root failure and regression output are retained in `evidence/2026-11-23-browser-compiler-production`. The original S1 artifact remains the authority for the initial Worker failure. Native WASM/browser journeys and the next exact-head CI are still required.
