# Workspace ambient declarations

[`runtime-retry-urls.d.ts`](runtime-retry-urls.d.ts) describes the website's `virtual:proto-ui/runtime-retry-urls` module. The implementation is supplied by the [Astro/Vite plugin](../apps/www/scripts/runtime-retry-urls.mjs), and [`apps/www/src/env.d.ts`](../apps/www/src/env.d.ts) explicitly includes this declaration.

This directory serves repository tooling and application type checking. Public protocol types belong to [`packages/types/`](../packages/types/README.md); package-owned declarations belong beside their implementation.

Keep the virtual module declaration aligned with the plugin's exported URL keys. The plugin's focused tests and the workspace/docs type checks verify the relevant consumers:

```sh
node --test apps/www/scripts/runtime-retry-urls.test.mjs
corepack pnpm@10.32.1 check:types
```

These declarations describe a generated module; changing them does not change its runtime behavior. Follow the [`spec/` catalog](../spec/README.md) for protocol semantics and the [documentation policy](../internal/governance/documentation-policy.md) for placement.
