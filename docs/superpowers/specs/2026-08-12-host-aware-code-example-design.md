# Host-Aware Multi-File Code Example Design

**Issue:** #344 **Target:** `0.3.0` **Status:** Approved implementation boundary

## Decision

Add one documentation-only `CodeExample.astro` component. It composes the existing `PrototypePreviewer/CodePanel.astro` once per file and adds two nested, scoped tab systems:

1. host tabs, restricted to the existing `RuntimeId` values and canonical `AdapterIds` order;
2. file tabs scoped to each host.

This is documentation chrome, not a new Proto UI prototype. No files under `spec/**` or `packages/prototypes/**` change. `PrototypePreviewer` keeps its current public props, runtime loader, generated code maps, and demo renderer.

## Public API

```ts
export type CodeExampleFile = Readonly<{
  name: string;
  lang: CodeLang;
  code: string;
}>;

export type CodeExamplesByHost = Partial<Record<RuntimeId, readonly CodeExampleFile[]>>;

export interface CodeExampleProps {
  files: CodeExamplesByHost;
  initialHost?: RuntimeId;
  label?: string;
  class?: string;
}
```

Rules:

- Render hosts in `AdapterIds` order.
- Require at least one supported host and one file for every present host.
- Require nonblank filenames unique within each host.
- `initialHost`, when supplied, must exist in `files`.
- The first file is each host's initial file.
- Generate DOM IDs from component instance plus host/file indexes, never filenames.
- No arbitrary host IDs, host-order prop, editor state, executable callback, slot protocol, persistence flag, or initial-file prop.

## DOM and accessibility

Render an outer `<section data-code-example>` with an accessible label. Its horizontal host `role="tablist"` contains buttons with `role="tab"`, `aria-controls`, `aria-selected`, and roving `tabindex`. Every host tab owns one `role="tabpanel"` linked back through `aria-labelledby`.

Each host panel contains one horizontal file tablist with the same tab relationship. Each file panel is the existing `CodePanel`, rendered as a tabpanel. All source is server-rendered and Shiki-highlighted; inactive host and file panels use the native `hidden` attribute.

Exactly one tab in each tablist has `aria-selected="true"` and `tabindex="0"`; the rest retain `tabindex="-1"`. Click and native Enter/Space activate. ArrowLeft/ArrowRight focus and automatically activate the adjacent tab. Home/End focus and activate the first/last tab. Boundaries do not wrap and remain unhandled. Up/Down are ignored. One scoped resolver serves both tablist levels, and file key events never operate the ancestor host list.

## Adapter preference contract

Centralize the existing site contract in `apps/www/src/components/adapter-preference.ts`:

- key: `preferred-prototypes-adapter`;
- default: `wc`;
- event: `proto-adapter:change`;
- detail: `{ adapter: RuntimeId }`.

`AdapterSelect.astro`, existing preview consumers, and `CodeExample` import the same typed constants and validation. This is not a new preference mechanism.

State behavior:

1. SSR uses `initialHost` when present, otherwise the first available host.
2. Client initialization reads the canonical preference. A supported stored host becomes active; unsupported or malformed values retain the SSR fallback.
3. A valid global adapter event updates every still-global CodeExample that supports the host.
4. Direct host-tab activation creates a component-local override. It neither writes storage nor dispatches the global event.
5. A local override ignores later global adapter events for that component instance. It disappears on navigation/reload.
6. File selection remains independent per host and never affects preference state.

Fix `AdapterSelect.astro` while centralizing the contract: eliminate the duplicate fixed `id="adapter-select"`, generate a unique label/control ID, and initialize relative to its own `[data-adapter-select]` root. Preserve write-before-dispatch behavior.

## CodePanel reuse and highlighting

Extract the duplicated server-side Shiki transform from `CodePanel.astro` and `PrototypePreviewer.astro` into `PrototypePreviewer/code-highlight.ts`. Retain dual `github-light`/`github-dark` themes, escaped raw-code storage, the existing pre class, line-number compatibility, copy feedback, collapse detection, and expand behavior. Extend the language union only for real documentation file types.

Move or expose CodePanel's DOM controller as a scoped, idempotent client helper. It must initialize on `astro:page-load`, measure a panel after it becomes visible, preserve local expansion state when switching away and back, and allow `PrototypePreviewer` to reset measurement after replacing code HTML.

Delete the current detail-less `proto-adapter:change` dispatch in `previewer-client.ts`; it is not a preference change and breaks consumers that expect `{ adapter }`. Call the targeted CodePanel refresh helper instead. Guard existing adapter-event consumers against malformed detail.

## Overflow ownership

- `CodeExample`, host panels, and file panels: `min-width: 0; max-width: 100%`.
- Host and file tab-strip wrappers: local `overflow-x: auto`; tabs remain one line.
- CodePanel code viewport: local `overflow-x: auto`; `<pre>` keeps content width while filling short lines.
- Copy and expand controls remain attached to the non-scrolling panel shell.
- Never mask defects with page/body/Markdown `overflow-x: hidden`.

## First real adoption

Migrate the bilingual RC Trial “Use multiple hosts” / “同时使用多个宿主” sections:

- `apps/www/src/content/docs/en/start-here/rc-trial.mdx`
- `apps/www/src/content/docs/zh-cn/start-here/rc-trial.mdx`

Use two supported hosts (`react`, `wc`) and two existing snippets per host (`install.sh` plus `Demo.tsx` for React; `install.sh` plus `main.ts` for WC). Preserve explanatory content.

Do not initially migrate generated Shadcn Button/Tabs wrappers. `apps/www/scripts/example_code_generation/scan-mdx.ts` intentionally discovers `data-adapter-panel` plus `PrototypePreviewer`; changing that pipeline is outside this issue.

## Verification

Focused client tests cover:

- stored/global host initialization and unsupported-host fallback;
- live global synchronization across instances;
- sticky local override with no storage write or global event;
- independent per-host file memory;
- exact ARIA, `hidden`, focus, and roving `tabindex` transitions for click, arrows, Home, and End;
- non-wrapping boundaries and nested tablist isolation;
- idempotent initialization;
- exact selected raw code copied;
- short/long expand measurement, hidden-to-visible refresh, per-file expansion retention, and Previewer replacement reset.

Browser smoke on the migrated RC Trial route:

- 320px: host strip, file strip, and long code scroll only locally; page width does not grow; copy/expand remain reachable;
- keyboard-only nested tab traversal and hidden-panel focus exclusion;
- header preference live sync, local override isolation, and reload reset;
- exact clipboard source for each host/file;
- light/dark Shiki colors through the existing theme mechanism;
- Starlight client navigation away/back without duplicate handlers.

Run focused Vitest, `corepack pnpm@10.32.1 --filter apps-www build`, type checks, and the repository test suite before delivery.

## Risks

- **Malformed adapter event:** remove the internal false event and still validate detail at every consumer.
- **Duplicate AdapterSelect targeting:** scope initialization and IDs before relying on live sync.
- **Hidden panel measurement:** refresh the activated panel explicitly; do not rely on ResizeObserver alone.
- **Generated-doc coupling:** leave generator-discovered preview wrappers unchanged.
- **HTML size:** this component is for bounded examples, not arbitrary project trees or an editor.
- **Astro navigation:** use the repository's `astro:page-load` plus per-root initialization guard and clean root-owned observers/listeners when roots disappear.

## Current-main adoption adjustment

The original RC Trial route was removed when the stable `0.2.0` public documentation gate landed. The reusable component contract above is unchanged. Its first real adoption now replaces the separate React-only command and import snippets in the bilingual stable Quick Start:

- `apps/www/src/content/docs/en/start-here/quick-start.mdx`
- `apps/www/src/content/docs/zh-cn/start-here/quick-start.mdx`

The adopted example keeps two files for each of React and Web Components, uses `@latest` / `0.2.0` rather than the retired RC pin, and preserves the stable onboarding claims. Browser verification targets the corresponding bilingual Quick Start routes instead of restoring the obsolete RC Trial pages.
