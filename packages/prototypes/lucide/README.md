# @proto.ui/prototypes-lucide

Lucide-based icon prototype helpers for Proto UI.

## Purpose

Provides:

- a standalone `lucide-icon` prototype (`asHook` + prototype form)
- per-icon static entrypoints for tree-shaking (`@proto.ui/prototypes-lucide/icons/*`)
- `renderLucideIcon()` helper for compatibility name-based rendering
- generated manifest/snippets/loaders for docs and lazy loading scenarios

## Source Attribution

- Icon visual definitions are derived from [Lucide](https://lucide.dev/).
- This package is a Proto UI-side consumption layer and is **not** an official Lucide package.
- Please keep upstream Lucide license/attribution in distribution and documentation workflows.
- The current generated baseline is `lucide-static@1.8.0`; the generated manifest exports the exact package, version, and license metadata.

## Package Role

Prototype-oriented icon utilities for Proto UI render templates.

## Install

```bash
npm install @proto.ui/prototypes-lucide@0.3.0-alpha.0
```

## Internal Structure

- `src/icon/`
- `src/icons/` (generated single-icon modules)
- `src/shapes/` (generated shape-only modules for preview/lazy rendering)
- `src/index.ts`
- `src/manifest.generated.ts`
- `src/snippets.generated.ts`
- `src/loaders.generated.ts`
- `icons.config.json`
- `scripts/generate-icons.mjs`

## Generation

Generate icon modules from `lucide-static` using `icons.config.json`.

- `icons: "all"` means generate all upstream Lucide icons.
- `icons: [...]` means generate only the provided subset.

```bash
pnpm --filter @proto.ui/prototypes-lucide run generate:icons
```

Generated outputs include:

- `src/icons/<icon-name>.ts`
- `src/shapes/<icon-name>.ts`
- `src/icons/index.generated.ts`
- `src/icon/icons.generated.ts` (compat registry)
- `src/manifest.generated.ts`
- `src/snippets.generated.ts`
- `src/loaders.generated.ts`

The generator formats every emitted TypeScript file with the repository Prettier configuration before writing it. Running generation repeatedly without changing the config or upstream package must therefore leave the working tree byte-for-byte unchanged.

## Recommended Consumption

- Static, tree-shakable import:
  - `import { renderLucideCheckIcon } from '@proto.ui/prototypes-lucide/icons/check'`
- Dynamic on-demand import by name:
  - `import { loadLucideIcon } from '@proto.ui/prototypes-lucide/loaders'`
  - `import { loadLucideIconShape } from '@proto.ui/prototypes-lucide/loaders'`
- Manifest/snippet for docs:
  - `import { LUCIDE_ICON_MANIFEST } from '@proto.ui/prototypes-lucide/manifest'`
  - `import { getLucideIconSnippet } from '@proto.ui/prototypes-lucide/snippets'`

## Related Internal Packages

- `@proto.ui/core`

## License

The Proto UI integration code is MIT-licensed. Generated icon definitions are derived from `lucide-static` and retain the upstream Lucide/Feather notices in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md). The current upstream package declares ISC and includes an additional MIT notice for Feather-derived icons. Do not interpret the Proto UI package license field as replacing those upstream notices.
