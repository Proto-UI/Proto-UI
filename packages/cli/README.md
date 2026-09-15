# @proto.ui/cli

Proto UI command line tooling for initialization, component facade generation, and style presets.

## Purpose

Provides command line tooling for initializing Proto UI workspaces and generating framework integration assets.

## Package Role

CLI package used by applications and maintainers to scaffold Proto UI configuration and generated files.

## Install

```bash
npm install @proto.ui/cli@0.3.0-alpha.0
```

## Opt-in Shadow style companion

The source CLI generates the companion consumed by the Web Component Adapter's explicit experimental `shadow: { mode: 'open', presentation: 'split', styleArtifact }` profile. Pass the imported value as `styleArtifact`; generating it alone does not select that profile. Existing boolean `shadow` options remain unchanged. See the [Adapter guide](../adapters/web-component/README.md) for admitted prototypes, recipes and customization limits. Installing an already-published CLI version does not imply that it includes this source change.

```bash
proto-ui shadcn --styles-dir ./src/styles \
  --shadow-out ./src/styles/proto-ui-shadow-style.generated.js

# The same option is available for proto-ui brutalist and source scanning:
proto-ui tokens --input ./proto-ui/prototypes \
  --out ./src/styles/proto-ui-tokens.generated.css \
  --shadow-out ./src/styles/proto-ui-shadow-style.generated.js
```

The command generates document CSS and a same-closure ESM `.js`/`.d.ts` pair. The companion has one named export:

```js
import { protoShadowStyleArtifact } from './styles/proto-ui-shadow-style.generated.js';
```

It is a frozen, synchronous version-1 value with `kind`, `version`, `environment`, and `cssText`; no DOM or runtime renderer is required to import it. The declaration preserves literal ABI types and readonly fields. Use it as ESM (for direct Node imports, place it in a package with `"type": "module"`). No Promise, lazy loader, JSON import, or package-root builder API is introduced.

`--shadow-out` requires an explicit `.js` path relative to the working directory, not to `--styles-dir`; its declaration replaces that suffix with `.d.ts`. Presets still generate their theme and entry CSS. Without the option, no companion is written; `init` and `add` do not generate one or select a split Adapter.

Source scanning separates directly proven Template-only style occurrences from Root recipes. Those tokens receive ordinary Shadow-local CSS; shared Root uses, opaque helpers and unclassified handles remain subject to conservative Root preflight. Preset and flat token inputs remain conservative because they carry no target provenance. Template CSS membership never grants runtime Root admission, and generating that CSS does not enable automatic WC Template-handle projection.

All target paths and generated content are checked before replacing any file. Targets must be distinct regular files or new paths, not file symlinks or directories; path collisions are conservatively case-folded across platforms. The complete set is staged first. Caught replacement failures attempt to restore old files and remove new outputs; if recovery fails, the error lists retained backup directories. Empty output parent directories may remain after failure. This is not an atomic multi-file transaction for crashes or concurrent writers.

Rerun the same command after changing tokens; keep CSS, JavaScript and declarations together. There is no runtime generation-digest check. Generating a preset closure does not establish that every prototype or Root token in it is split-compatible. Theme custom properties remain document/host-owned and inherit into Shadow roots.

## Internal Structure

- `src/commands/`
- `src/config/`
- `src/generated/`
- `src/index.ts`
- `src/legacy/`
- `src/registry/`
- `src/services/`
- `src/utils/`

## Related Internal Packages

- None

## License

MIT
