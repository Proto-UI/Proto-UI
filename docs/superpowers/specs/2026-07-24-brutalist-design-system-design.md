# 2026-07-24 Neo-Brutalist design-language prototype library

> Historical design: its square-only geometry, mono/display pairing and depth rules are superseded by [the 2026-10-03 source-aligned design](2026-10-03-neobrutalism-source-aligned-design.md). The original approval history below is retained; it is not current visual direction.

> Spec. Unified UI/UX design system and implementation design for a Brutalist preset parallel to Base / Shadcn in Proto UI. Not normative project catalog truth; promote stabilized protocol into `spec/**` entities during implementation.

---

## 1) Goal

Ship a credible **Neo-Brutalist** design-language prototype library that:

1. Inherits Base interaction protocols (same delta pattern as Shadcn).
2. Owns a fixed visual grammar: 0 radius, pure black structure, paper surfaces, hard offset shadows, heavy + mono type pairing, light **and** dark modes.
3. Catalogs prototypes and tests under `spec/prototypes/` and `spec/tests/`.
4. Implements `@proto.ui/prototypes-brutalist` for eight families: Button, Switch, HoverCard, Toggle, Tabs, Dialog, DropdownMenu, Select.
5. Wires a CLI style preset (generated token closure + theme CSS) and registry entries.
6. Adds `apps/www` demos with browser verification.
7. Opens a draft PR against Proto-UI.

Status of deliverables in catalog: **`draft`** entities only. Do not present as stable public guarantees.

---

## 2) Style research summary

Sources consulted:

- [superdesign.dev/styles/brutalism](https://superdesign.dev/styles/brutalism) — pure web-brutalism vs neo-brutalism (hard offset shadow = neo).
- [neubrutalism.com](https://neubrutalism.com) — visual DNA: thick borders, hard shadows, flat color, bold type, zero blur, light/dark commercial grammar.
- [ekmas/neobrutalism-components](https://github.com/ekmas/neobrutalism-components) — Tailwind/shadcn-based kit; light/dark CSS vars (`border` stays black; accent keeps black text; dark uses loud main on dark paper; shadow offsets as tokens).

**Product name:** Brutalist (`P-BRUTALIST-*`, `brutalist-button`).  
**Visual dialect:** Neo-Brutalism (not pure Craigslist-style web brutalism).

---

## 3) Visual system

### 3.1 Structural constants (both color schemes)

| Token | Value | Notes |
| --- | --- | --- |
| Radius | `0` | Stricter than ekmas default `5px`; `rounded-none` everywhere |
| Control border | `2px solid` | Canonical stroke for buttons, toggles, switch track |
| Overlay / panel border | `3px solid` | Dialog, dropdown, select, hover-card content |
| Shadow S | `3px 3px 0 0` | chips / small controls |
| Shadow M | `5px 5px 0 0` | buttons, cards, panels |
| Shadow L | `8px 8px 0 0` | overlays, hero panels, large focus lift |
| Shadow blur | `0` | never soft Material elevation |
| Hover | slight lift (shadow grows) **or** reverse-shadow variant | physical, not opacity fade |
| Press / active | translate into shadow axis + `shadow-none` | snap; no long easing |
| Focus | hard ring / outline with offset | dark: light ring; light: black ring |
| Display type | Archivo Black | headings / CTA weight in demo chrome; control weight via bold tokens |
| Mono type | Space Mono | labels, meta, value readouts |
| Forbidden | gradients, blur, glass, rounded cards, soft shadows, comfort `transition-all` as primary affordance |  |

### 3.2 Light mode

| Role                                | Value                            |
| ----------------------------------- | -------------------------------- |
| `--background` (paper)              | `#f4f1ea`                        |
| `--secondary-background` (elevated) | `#ffffff`                        |
| `--foreground` (ink)                | `#000000`                        |
| `--border` / shadow color           | `#000000`                        |
| `--main` (primary fill)             | `#ffd23f`                        |
| `--main-foreground`                 | `#000000` (always ink on accent) |
| `--destructive`                     | `#ff6b6b` + ink text             |
| `--muted` / secondary surface       | paper or white panel with border |
| `--overlay`                         | `rgba(0, 0, 0, 0.75)` flat       |
| `--ring`                            | `#000000`                        |

### 3.3 Dark mode

Inspired by ekmas yellow dark tokens: dark paper, light ink, **black borders and black hard shadows remain**, accent stays loud with **black** label text.

| Role                     | Value                     |
| ------------------------ | ------------------------- |
| `--background`           | `#1c1914` warm near-black |
| `--secondary-background` | `#2a241c` elevated panels |
| `--foreground`           | `#f4f1ea`                 |
| `--border` / shadow ink  | `#000000`                 |
| `--main`                 | `#ffd23f`                 |
| `--main-foreground`      | `#000000`                 |
| `--destructive`          | `#ff6b6b` + black text    |
| `--ring`                 | `#f4f1ea`                 |
| `--overlay`              | `rgba(0, 0, 0, 0.85)`     |

**Dark rule:** do not invert hard shadows to white. Black structure on dark paper is intentional graphic contrast.

### 3.4 Theme delivery in Proto UI

1. CLI theme file `brutalist-theme.css` with `:root` and `:root.dark` / `[data-theme='dark']` semantic variables.
2. Prototypes prefer CSS variables for fill/border/text.
3. Prototype `def.rule` + `w.meta('colorScheme').eq('dark')` only for deltas that cannot be pure CSS vars (same pattern as Shadcn outline/destructive).
4. Generated token CSS closure from scanning `packages/prototypes/brutalist/src` (same scanner as Shadcn).

### 3.5 Component visual API (v0 claim)

| Control | Props / surface |
| --- | --- |
| Button | `variant`: default, outline, secondary, destructive, reverse; `size`: default, sm, lg, icon |
| Toggle | size + pressed solid fill / invert |
| Switch | square track + square thumb (no pill radius) |
| Tabs | ruled strip; active = solid main or ink block |
| Dialog / Dropdown / Select / HoverCard | secondary surface + 3px border + L shadow; mask = flat overlay |

- No `asChild` (governed by `D-AS-CHILD-OMISSION-0001`).
- No ghost/link variants in v0.
- Transparent content slots must not be claimed as Radix Slot equivalents.

---

## 4) Architecture

### 4.1 Package layout

```
packages/prototypes/brutalist/
  package.json          # @proto.ui/prototypes-brutalist
  README.md
  src/
    index.ts
    button/
    toggle/
    switch/             # root + thumb
    tabs/               # root, list, trigger, content
    dialog/             # parts matching implemented Shadcn/Base surface
    dropdown/
    hover-card/
    select/
  test/
```

- Dependencies: `@proto.ui/core`, `@proto.ui/prototypes-base` only.
- Family subpath exports mirror Shadcn (`/button`, `/switch`, …).
- Prototype names: `brutalist-button`, etc.
- Public exports for CLI: `brutalistButton` → facade `BrutalistButton`.

### 4.2 Inheritance model

- Each control calls the corresponding Base `as*` hook during setup.
- No Base negative patches in v0 unless a `P-BRUTALIST-*` criterion explicitly declares abandonment/replacement.
- Visual layer only: props + `feedback.style` + rules from Base state handles + optional colorScheme meta.

### 4.3 Spec catalog

| Kind | IDs |
| --- | --- |
| Prototypes | `P-BRUTALIST-BUTTON`, `P-BRUTALIST-TOGGLE`, `P-BRUTALIST-SWITCH` (+ THUMB), `P-BRUTALIST-TABS` (+ LIST / TRIGGER / CONTENT), `P-BRUTALIST-DIALOG` (+ implemented parts), `P-BRUTALIST-DROPDOWN-MENU` (+ parts), `P-BRUTALIST-HOVER-CARD` (+ parts), `P-BRUTALIST-SELECT` (+ parts) |
| Tests | `T-BRUTALIST-*-0001` per family → `packages/prototypes/brutalist/test/*.test.ts` |
| Decision | `D-CLI-BRUTALIST-PRESET-CLOSURE-0001` (generated source closure, twin of Shadcn) |
| Test (CLI) | `T-CLI-BRUTALIST-PRESET-CLOSURE-0001` |
| Lifecycle | all `draft`; `since` aligned to current workspace version (`0.2.0-rc.3` or active catalog version) |

Compound anatomy: mirror Base + existing Shadcn part graphs for the eight families. Include Dialog close-icon / content preset only if implementing the same convenience surface as Shadcn; otherwise document raw parts only.

### 4.4 CLI

1. Registry helpers `brutalist` / `brutalistCompound` with `stylePreset: 'brutalist'` and package `@proto.ui/prototypes-brutalist`.
2. Entries: `brutalist-button`, `brutalist-toggle`, `brutalist-switch`, `brutalist-tabs`, `brutalist-dialog`, `brutalist-dropdown`, `brutalist-hover-card`, `brutalist-select` (IDs aligned to Shadcn registry shape).
3. Generator: `scripts/styles/generate-brutalist-style-tokens.ts` → `packages/cli/src/generated/brutalist-style-tokens.ts`.
4. `BRUTALIST_THEME_CSS` light + dark.
5. `init` style choices: keep default `shadcn`; add `brutalist-style` option; skip remains.
6. `add` warns when component expects brutalist preset but styles disabled.
7. Stale check + init/source parity tests twin of Shadcn preset closure.

### 4.5 Governance

- Workspace package; www dependency; prototype-modules registration; CLI registry.
- **Do not** expand launch-package freeze / first-release product promise without explicit PR callout.
- Document package in package-surface map style docs if/when editing those files for consistency; optional in first PR if out of path.

### 4.6 Website demos

- Parallel Shadcn demo patterns under `apps/www` (docs MDX + `.demo.ts` + demo_components as needed).
- Register all brutalist prototypes in `prototype-modules.ts`.
- Demo chrome: light/dark toggle; page loads brutalist theme tokens.
- Families demoed: Button, Switch, HoverCard, Toggle, Tabs, Dialog, DropdownMenu, Select.

---

## 5) Testing and verification

### 5.1 Unit / contract tests (TDD)

Harness: same as Shadcn (`executeWithHost`, `getRuleStyleTokens`, capability stubs).

| Case | Expectation |
| --- | --- |
| Identity + inheritance | name, Base `as*` once, no undeclared negative patch |
| Variant / size | tokens present; prop removal restores defaults |
| Interaction styles | hover / focusVisible / pressed / disabled from Base handles |
| Color scheme | dark meta affects visuals only |
| Structural grammar | `rounded-none`, hard border, hard shadow utilities in claimed set; no soft radius / gradient in claimed set |

Compound families: root + key parts smoke (thumb, content shadow, etc.).

### 5.2 CLI

- Generate + `--check` stale.
- Init with brutalist preset equals scanner CSS over official brutalist sources.
- `add react brutalist-button` (+ one compound) facade smoke.

### 5.3 Browser

- Run docs/www dev server.
- Exercise all eight families in light and dark.
- Confirm 0 radius, hard shadows, paper/ink contrast, press shadow collapse.

### 5.4 Spec tooling

- Entity validation / prototype catalog checks as required by AGENTS.md.
- Regenerate agent project understanding if entity graph changes demand it.

---

## 6) Implementation order (TDD-first)

1. Scaffold package + package.json exports + workspace wiring.
2. **Button** tests → implement → green (template).
3. Toggle, Switch, Tabs.
4. HoverCard, Dropdown, Select, Dialog.
5. Spec P/T entities (can land with or immediately after each family; must match criteria).
6. CLI generator, theme CSS, registry, closure tests.
7. www demos + browser verification.
8. Draft PR.

---

## 7) File / change checklist

### New

- `docs/superpowers/specs/2026-07-24-brutalist-design-system-design.md` (this file)
- `packages/prototypes/brutalist/**`
- `spec/prototypes/P-BRUTALIST-*.yaml`
- `spec/tests/T-BRUTALIST-*.yaml`
- `spec/decisions/D-CLI-BRUTALIST-PRESET-CLOSURE-0001.yaml`
- `spec/tests/T-CLI-BRUTALIST-PRESET-CLOSURE-0001.yaml` (or fold into CLI test entity naming convention)
- `scripts/styles/generate-brutalist-style-tokens.ts`
- `packages/cli/src/generated/brutalist-style-tokens.ts`
- www demo content paths for brutalist library

### Modified

- `packages/cli/src/registry/components.ts`
- `packages/cli/src/legacy/type.ts` (and related init/theme writers)
- `packages/cli/src/commands/add.ts` (preset warning)
- CLI tests / package scripts for `styles:preset:generate` / check
- `apps/www/package.json`, `astro.config.mjs` deps/aliases as needed
- `apps/www/src/components/PrototypePreviewer/prototype-modules.ts`
- Root workspace / lockfile via package add
- Optional: package-surface governance docs

### Explicit non-goals

- Launch freeze promotion
- Compiler / zero-runtime path
- Vendored editable local prototype source
- asChild / Radix Slot parity
- Full ekmas component inventory beyond the eight families
- Form, Input, Table, Chart, etc.

---

## 8) Risks

1. **Arbitrary shadow utilities** (`shadow-[5px_5px_0_0_#000]`) must pass the style token scanner and CSS renderer — follow existing arbitrary-token paths or map through theme CSS custom properties.
2. **Dark black-on-dark structure** is intentional; demo copy must explain it.
3. **Entity volume** — keep criteria limited to tested, current API (delta-style open questions for future gaps).
4. **CLI default** remains Shadcn; brutalist is opt-in to avoid breaking existing onboarding.

---

## 9) Success criteria

- [ ] Design system readable as one unified Neo-Brutalist UI/UX spec (this document + catalog criteria).
- [ ] Eight families implemented on Base with TDD contract tests green.
- [ ] P/T entities draft and validated.
- [ ] CLI brutalist preset generates offline token+theme CSS with source closure check.
- [ ] www demos work in light and dark; browser-checked.
- [ ] Draft PR open with clear scope and non-goals.

---

## 10) Approval record

- Scope: package + CLI style preset (user selected).
- Style: Neo-Brutalist with light/dark (user confirmed).
- Architecture section approved (user: lgtm).
- Visual dual-theme section approved (user: 还不错).
