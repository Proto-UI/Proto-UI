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
- Generated CSS token files in `src/styles/` should be regenerated through package scripts instead of edited by hand.
- Build-time style snapshots use finite reviewed recipe registries. Each Runtime session owns a detached Context root with no logical parent, so setup-phase providers and subscriptions can resolve within that snapshot. A created session is disposed after mount/evaluation failures, including mounted-hook failures; this is not a rollback guarantee for construction exceptions before `createRuntimeSession` returns. This is style projection, not an interactive SSR host or a substitute for Adapter-owned child topology.
