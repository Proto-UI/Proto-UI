# Base Radio Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved, independently consumable Base Radio Group protocol with group-owned selection, Focus Roving keyboard behavior, accessible Web projections, catalog evidence, documentation, and three-adapter demos.

**Architecture:** One `base-radio-group` anatomy family contains Root, Item, and Indicator. Root composes Collection and Focus Roving and is the sole value owner; Item composes Collection Item, Focusable, Trigger, and A11y and only requests selection; Indicator consumes Item context as visual feedback. Existing Core/Module contracts remain unchanged, and form behavior remains absent.

**Tech Stack:** TypeScript, Proto UI prototype DSL, Collection/Focus/A11y/Event modules, Vitest + happy-dom, Web Component/React/Vue adapters, Astro/Starlight docs, YAML spec catalog, pnpm 10.32.1.

---

## Global constraints

- Worktree: `/tmp/proto-ui-maintenance-design`.
- Branch: `codex/feat-base-radio-group`, based on current `main` commit `d86f85bfda28b1a5e2db9936135de927380fe91d`.
- Normative design: `docs/superpowers/specs/2026-08-12-base-radio-group-semantic-design.md`.
- Approved checkpoint record: `internal/records/2026-08-12-base-radio-group-semantic-checkpoint.zh-CN.md`.
- New catalog entities are `draft`, `since: 0.3.0`; do not edit `internal/releases/0.2.0-rc.7/**` or bump package/repository versions.
- Do not add `orientation`, `loop`, Toolbar flags, form props, native/hidden inputs, Shadcn projections, generic single-selection contracts, Label/Description parts, or a standalone Base Radio prototype.
- Do not introduce `any`, `: any`, or `as any`.
- Generated files must be produced only by their generators.
- TDD is mandatory: each production behavior follows an observed failing focused test.

## File map

### Create

- `packages/prototypes/base/src/radio-group/shared.ts` — family/context IDs and shared radio-group types/helpers.
- `packages/prototypes/base/src/radio-group/types.ts` — Root/Item/Indicator props, exposes, state handles, and asHook contracts.
- `packages/prototypes/base/src/radio-group/root.proto.ts` — value owner, Collection provider, Focus Roving owner, group A11y projection.
- `packages/prototypes/base/src/radio-group/item.proto.ts` — item registration, derived checked/disabled, focus/trigger behavior, selection request, radio A11y projection.
- `packages/prototypes/base/src/radio-group/indicator.proto.ts` — Item-context-derived checked/disabled visual feedback.
- `packages/prototypes/base/src/radio-group/index.ts` — family exports.
- `packages/prototypes/base/test/radio-group.test.ts` — Base behavioral and surface contracts.
- `packages/adapters/web-component/test/radio-group.test.ts` — Web Component role/state/tabindex/keyboard journey.
- `packages/adapters/react/test/radio-group.test.ts` — React parity journey.
- `packages/adapters/vue/test/radio-group.test.ts` — Vue parity journey.
- `spec/prototypes/P-BASE-RADIO-GROUP.yaml` — Root/group normative entity.
- `spec/prototypes/P-BASE-RADIO-GROUP-ITEM.yaml` — Item normative entity.
- `spec/prototypes/P-BASE-RADIO-GROUP-INDICATOR.yaml` — Indicator normative entity.
- `spec/tests/T-BASE-RADIO-GROUP-0001.yaml` — Root executable mapping.
- `spec/tests/T-BASE-RADIO-GROUP-ITEM-0001.yaml` — Item executable mapping.
- `spec/tests/T-BASE-RADIO-GROUP-INDICATOR-0001.yaml` — Indicator executable mapping.
- `apps/www/src/content/docs/demo-base-radio-group.demo.ts` — adapter-neutral demonstration template.
- `apps/www/src/content/docs/en/ui-libraries/base/radio-group.mdx` — English contract and demo.
- `apps/www/src/content/docs/zh-cn/ui-libraries/base/radio-group.mdx` — Chinese contract and demo.

### Modify

- `packages/prototypes/base/src/index.ts` and `packages/prototypes/base/package.json` — public Root/Item/Indicator exports.
- root `package.json` only if its existing Base export map requires an explicit family projection.
- `packages/cli/src/registry/components.ts` — one `base-radio-group` compound entry with three parts.
- `apps/www/astro.config.mjs` — bilingual Base sidebar entry.
- `apps/www/src/components/PrototypePreviewer/prototype-modules.ts` — three lazy loaders.
- `apps/www/src/content/docs/en/ui-libraries/base/index.mdx` and `apps/www/src/content/docs/zh-cn/ui-libraries/base/index.mdx` — catalog overview link/summary.
- `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md` — generator output only.

## Task 1: Write the failing Base protocol tests

**Files:**

- Create: `packages/prototypes/base/test/radio-group.test.ts`

- [ ] **Step 1: define a real runtime harness**

Follow `packages/prototypes/base/test/tabs.test.ts` and `checkbox.test.ts`: create hosts and anatomy in real Runtime sessions, materialize Root/Item/Indicator, and read exposed state/events rather than matching source text.

- [ ] **Step 2: add family and exact-surface tests**

Assert family roles/cardinalities and relations exactly:

```ts
expect(RADIO_GROUP_FAMILY.roles).toEqual({
  root: { cardinality: { min: 1, max: 1 } },
  item: { cardinality: { min: 1, max: 100 } },
  indicator: { cardinality: { min: 0, max: '*' } },
});
expect(RADIO_GROUP_FAMILY.relations).toEqual([
  { kind: 'contains', parent: 'root', child: 'item' },
  { kind: 'contains', parent: 'item', child: 'indicator' },
]);
```

Assert Root has only approved props/exposes, Item has no checked/defaultChecked owner, and Indicator has no event/focus/trigger/control surface.

- [ ] **Step 3: add selection-state tests**

Cover uncontrolled empty/default/matched/unmatched values; one accepted request updates value and emits exactly once; same/empty/missing/disabled/ambiguous duplicate requests return false without signals; controlled requests signal without final mutation; prop update changes controlled state; structure removal/re-add and selected-item disable preserve value; duplicate authoring produces at most one checked item.

- [ ] **Step 4: add interaction and focus tests**

Cover Space selection and default prevention; Enter no-op; pointer commit selection; pointer cancellation no-op; disabled group/item no transient state or selection; selected-or-first focus entry; empty Tab-style/programmatic entry without selection; both-axis wrapping, Home/End, disabled skipping, programmatic `focusSelf()` without selection, and two independent groups.

- [ ] **Step 5: add Indicator derivation tests**

Assert every Indicator under an Item tracks checked/effective-disabled, multiple indicators are allowed, and Indicator owns no action or A11y control object.

- [ ] **Step 6: run RED**

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/radio-group.test.ts
```

Expected: FAIL because `../src/radio-group` and its exported prototypes do not exist.

## Task 2: Implement shared types and the Root protocol

**Files:**

- Create: `packages/prototypes/base/src/radio-group/shared.ts`
- Create: `packages/prototypes/base/src/radio-group/types.ts`
- Create: `packages/prototypes/base/src/radio-group/root.proto.ts`

- [ ] **Step 1: define the anatomy and contexts**

`shared.ts` defines `RADIO_GROUP_FAMILY`, a Root context carrying value/controlled/disabled/canonical/current facts, and an Item context carrying checked/effective-disabled. Use `createAnatomyFamily` and `createContextKey`; do not put request callbacks into Context.

- [ ] **Step 2: define exact public types**

Use these prop shapes:

```ts
export interface RadioGroupRootProps {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  a11yLabel?: string;
}

export interface RadioGroupItemProps {
  value: string;
  disabled?: boolean;
}

export interface RadioGroupIndicatorProps {}
```

Root exposes `value`, `disabled`, `valueChange`, `requestValue`, Collection count/items, and Focus Roving methods. Item exposes only derived states, `focusSelf`, and `select`. Indicator exposes `checked`, `disabled`, and `isChecked`.

- [ ] **Step 3: implement Root composition**

Claim Root anatomy; compose `asCollection`, `asFocusRoving`, and A11y using the same patterns as Tabs Root/List. Configure Focus Roving as arrow navigation, both axes, loop true, selected entry. Root props defaults are `defaultValue: ''`, `disabled: false`, `a11yLabel: ''`.

- [ ] **Step 4: implement value ownership**

Track controlledness with `isProvided('value')`. Canonical matching scans ordered Collection items and selects only the first non-empty matching value. `requestValue(value)` rejects disabled root, empty/missing/disabled/already-selected values, and every duplicate-ambiguous value; otherwise uncontrolled Root updates before emitting once, while controlled Root emits without updating final state.

- [ ] **Step 5: implement Root synchronization**

On prop, Collection, and lifecycle changes, publish Root context and reconfigure selected/current roving facts without rewriting value. Disabled or removed selected items remain value matches for checked derivation but are excluded from focus entry.

- [ ] **Step 6: project group A11y**

Root owns role `radiogroup`, dynamic disabled, and a non-empty `a11yLabel` text alternative. Do not project form, required, invalid, orientation, or raw `aria-*` props.

- [ ] **Step 7: run GREEN for Root cases**

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/radio-group.test.ts
```

Expected: Root selection tests pass; Item/Indicator tests remain RED until Tasks 3–4.

## Task 3: Implement Item selection, focus, trigger, and radio semantics

**Files:**

- Create: `packages/prototypes/base/src/radio-group/item.proto.ts`

- [ ] **Step 1: compose Item capabilities**

Claim Item anatomy; configure `asCollectionItem`, `asFocusable`, and `asTrigger`. Item value metadata is the authored non-empty value. Effective disabled is `root.disabled || item.disabled` and drives Focusable/Trigger participation.

- [ ] **Step 2: derive canonical checked state**

Read Root context and ordered Collection snapshots. Checked is true only for the first Item whose non-empty value equals Root value. Publish checked/effective-disabled through Item context.

- [ ] **Step 3: route accepted selection**

Resolve nearest Root anatomy part and call its exposed `requestValue`; emit Item `select({ value })` only when Root accepts. Space and successful pointer press commit call this route. Enter and cancellation do nothing.

- [ ] **Step 4: synchronize current focus identity**

`focusSelf()` marks its Item current before the focus request. Focus changes caused by Focus Roving select the moved-to Item; ordinary entry/programmatic focus does not. Use pressed state to distinguish pointer-down focus. Blur re-reads sibling focused exposes, selects a roving sibling when appropriate, and otherwise resets current to selected-enabled-or-first-enabled.

- [ ] **Step 5: project radio A11y**

Item owns role `radio`, boolean checked, effective disabled, content-derived name, and activate action. No hidden native input or form state is created.

- [ ] **Step 6: run focused GREEN**

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/radio-group.test.ts
```

Expected: Root and Item cases pass; Indicator cases remain RED.

## Task 4: Implement Indicator and public source exports

**Files:**

- Create: `packages/prototypes/base/src/radio-group/indicator.proto.ts`
- Create: `packages/prototypes/base/src/radio-group/index.ts`
- Modify: `packages/prototypes/base/src/index.ts`
- Modify: `packages/prototypes/base/package.json`
- Modify if required by existing package policy: root `package.json`

- [ ] **Step 1: implement Indicator**

Claim Indicator anatomy, consume nearest `RADIO_GROUP_ITEM_CONTEXT`, expose derived checked/disabled state and `isChecked()`, and define no event/trigger/focus/A11y-control behavior.

- [ ] **Step 2: export a clean family surface**

Export Root, Item, Indicator, their `asRadioGroup*` hooks, public props/exposes/contracts, and `RADIO_GROUP_FAMILY` through family, Base source, and package export maps. Do not export private Context values.

- [ ] **Step 3: run the complete Base test**

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/radio-group.test.ts
```

Expected: all Radio Group Base cases pass with no warnings.

## Task 5: Add catalog entities and executable mappings

**Files:**

- Create: `spec/prototypes/P-BASE-RADIO-GROUP.yaml`
- Create: `spec/prototypes/P-BASE-RADIO-GROUP-ITEM.yaml`
- Create: `spec/prototypes/P-BASE-RADIO-GROUP-INDICATOR.yaml`
- Create: `spec/tests/T-BASE-RADIO-GROUP-0001.yaml`
- Create: `spec/tests/T-BASE-RADIO-GROUP-ITEM-0001.yaml`
- Create: `spec/tests/T-BASE-RADIO-GROUP-INDICATOR-0001.yaml`

- [ ] **Step 1: author Root criteria**

Catalog exact identity/anatomy, sole value ownership, empty/unmatched behavior, controlled request semantics, structure preservation, disabled behavior, Collection/Focus Roving ownership, group naming/A11y, exact API, and deferred form/Toolbar/visual boundaries. Add exact source anchors to Root/shared/types and test-case anchors.

- [ ] **Step 2: author Item criteria**

Catalog required non-empty unique value authoring, canonical checked derivation, effective disabled, accepted-request event behavior, Focus Roving participation, pointer/Space/Enter behavior, radio projection, and absence of item-local value/form ownership.

- [ ] **Step 3: author Indicator criteria**

Catalog optional repeatable anatomy, Item-context derivation, exact expose surface, and absence of independent action/focus/A11y/form semantics.

- [ ] **Step 4: connect existing authority**

Relate to existing Collection, Focusable/Roving, Trigger/Event, A11y, Anatomy, Context, State, Props, Expose, and Base-independence entities. Checkbox/Tabs/Select are evidence/reference only, not runtime dependencies.

- [ ] **Step 5: validate the catalog**

```bash
corepack pnpm@10.32.1 check:prototype-catalog
```

Expected: all new P/T entities load, relations resolve, anchors exist, and known debt remains zero.

## Task 6: Write failing adapter parity journeys

**Files:**

- Create: `packages/adapters/web-component/test/radio-group.test.ts`
- Create: `packages/adapters/react/test/radio-group.test.ts`
- Create: `packages/adapters/vue/test/radio-group.test.ts`

- [ ] **Step 1: create one equivalent journey per adapter**

Mount Root with three Items and Indicators; label each Item with ordinary content; disable the middle Item; use the adapter’s existing Tabs test harness, never a new fake renderer.

- [ ] **Step 2: assert initial projection**

Root has `role="radiogroup"` and accessible label. Items have `role="radio"`, exact `aria-checked`, effective `aria-disabled`, and exactly one enabled `tabindex="0"`; other enabled Items retain `-1`.

- [ ] **Step 3: assert live behavior**

Space selects focused unchecked Item; Enter does not; ArrowLeft/Right/Up/Down wrap and skip disabled; Home/End choose boundaries; controlled prop updates change checked projection; disabling Root removes interaction and updates projection.

- [ ] **Step 4: assert independent groups and Indicator boundary**

A second Root does not affect the first. Indicator adds no nested `radio`, tabindex, or activate behavior.

- [ ] **Step 5: run RED**

```bash
corepack pnpm@10.32.1 exec vitest run packages/adapters/web-component/test/radio-group.test.ts packages/adapters/react/test/radio-group.test.ts packages/adapters/vue/test/radio-group.test.ts
```

Expected: FAIL until adapter registration/public exports and a11y/focus projections are complete.

## Task 7: Complete adapter projection parity

**Files:**

- Modify only existing generic adapter projection code if the new tests expose a missing general contract; otherwise no adapter production file should change.
- Modify: `packages/prototypes/base/src/radio-group/*.ts` as the source fix when the issue is family wiring rather than generic host behavior.

- [ ] **Step 1: classify each RED failure**

If Tabs already proves the generic A11y/Focusable projection, fix the Radio Group source. Change a generic adapter only when an existing capability cannot project a contract-valid Radio state, and add/extend a generic contract test for that adapter behavior.

- [ ] **Step 2: preserve adapter equality**

Do not add adapter-specific semantic differences. All three adapters must expose the same roles, checked/disabled state, focus participation, and keyboard outcomes.

- [ ] **Step 3: run GREEN**

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/radio-group.test.ts packages/adapters/web-component/test/radio-group.test.ts packages/adapters/react/test/radio-group.test.ts packages/adapters/vue/test/radio-group.test.ts
```

Expected: all focused Base and adapter tests pass.

## Task 8: Add CLI compound registration

**Files:**

- Modify: `packages/cli/src/registry/components.ts`
- Modify generated component preset only through its existing generator if the registry check requires it.

- [ ] **Step 1: register the family**

Add one Base compound entry `base-radio-group` containing `radioGroupRoot`, `radioGroupItem`, and `radioGroupIndicator`, with public export names and Web Component element names following existing Base Tabs/Select naming conventions. Style preset remains `null`.

- [ ] **Step 2: verify the public facade**

```bash
corepack pnpm@10.32.1 check:component-presets
corepack pnpm@10.32.1 exec vitest run packages/cli/test/cli.test.ts
```

Expected: generated preset is current and the Base component can be projected without a style preset.

## Task 9: Add bilingual docs and the three-adapter demo

**Files:**

- Create: `apps/www/src/content/docs/demo-base-radio-group.demo.ts`
- Create: `apps/www/src/content/docs/en/ui-libraries/base/radio-group.mdx`
- Create: `apps/www/src/content/docs/zh-cn/ui-libraries/base/radio-group.mdx`
- Modify: `apps/www/src/content/docs/en/ui-libraries/base/index.mdx`
- Modify: `apps/www/src/content/docs/zh-cn/ui-libraries/base/index.mdx`
- Modify: `apps/www/astro.config.mjs`
- Modify: `apps/www/src/components/PrototypePreviewer/prototype-modules.ts`

- [ ] **Step 1: build one adapter-neutral demo**

Render a named group with three Items and Indicators, one disabled option, visible checked styling through data/state selectors, and an exposed current-value readout. The same demo must run through Web Component, React, and Vue preview adapters.

- [ ] **Step 2: document the normative boundary**

Both locales explain group-owned value, empty/unmatched preservation, keyboard behavior, disabled behavior, accessible naming, Indicator visual-only semantics, and the deferred form/Toolbar/orientation/loop boundary. Do not claim Shadcn/Radix parity.

- [ ] **Step 3: wire navigation and preview loaders**

Add one Base sidebar route and three prototype module loaders. Update Base index summaries without creating a competing prose contract.

- [ ] **Step 4: verify docs types/build**

```bash
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 --filter apps-www build
```

Expected: Astro reports zero errors/warnings/hints and production pages build.

## Task 10: Regenerate authoritative projections

**Files:**

- Modify by generator: `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md`
- Modify other generated catalog/preview artifacts only when their documented generator emits them.

- [ ] **Step 1: generate Agent projection**

```bash
corepack pnpm@10.32.1 spec:docs:agent
```

- [ ] **Step 2: validate projections and package surfaces**

```bash
corepack pnpm@10.32.1 check:agent-doc
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:package-manifests
corepack pnpm@10.32.1 check:component-presets
```

Expected: generated projections are current and every public export resolves.

## Task 11: Real-browser smoke test

**Files:** none unless the smoke reveals a bug, in which case return to RED before fixing.

- [ ] **Step 1: serve production-equivalent docs**

Run the existing website command on an isolated port and open the English Base Radio Group route in Chromium.

- [ ] **Step 2: exercise all adapters**

For Web Component, React, and Vue: verify one named `radiogroup`; three `radio` objects; exact checked/disabled state; one `tabindex=0`; Space selection; Enter no-op; both arrow axes; Home/End; wrapping and disabled skipping; live value readout; and independent state after switching adapters.

- [ ] **Step 3: verify keyboard and theme behavior**

Use keyboard only to enter/move/select, confirm focus is visible and never lands on Indicator, toggle Light/Dark, and confirm semantic behavior is unchanged.

Expected: all three live projections agree and no console error occurs.

## Task 12: Final verification, review, commit, and PR

**Files:** all files above; no new scope.

- [ ] **Step 1: run the focused contract suite**

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/radio-group.test.ts packages/adapters/web-component/test/radio-group.test.ts packages/adapters/react/test/radio-group.test.ts packages/adapters/vue/test/radio-group.test.ts packages/cli/test/cli.test.ts
```

- [ ] **Step 2: run full repository verification serially**

```bash
corepack pnpm@10.32.1 install --frozen-lockfile
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:component-presets
corepack pnpm@10.32.1 check:agent-doc
corepack pnpm@10.32.1 --filter apps-www build
```

- [ ] **Step 3: inspect scope and request independent review**

Compare against `d86f85bfda28b1a5e2db9936135de927380fe91d`. Reject any Shadcn, form, Toolbar, release-version, or unrelated source change. Reviewer must check the approved design, every changed file, exact public surfaces, at-most-one checked invariant, controlled ownership, structural churn, adapter parity, and docs claims.

- [ ] **Step 4: commit and push only after fresh evidence**

```bash
git add docs/superpowers/specs/2026-08-12-base-radio-group-semantic-design.md \
  docs/superpowers/plans/2026-08-12-base-radio-group-implementation.md \
  internal/records/2026-08-12-base-radio-group-semantic-checkpoint.zh-CN.md \
  packages/prototypes/base packages/adapters packages/cli/src/registry/components.ts \
  apps/www spec internal/agent/PROJECT-UNDERSTANDING.zh-CN.md package.json
git commit -s -m "feat(base): add Radio Group semantic protocol"
git push -u origin codex/feat-base-radio-group
```

- [ ] **Step 5: open the PR**

PR body links #349, states draft `0.3.0` catalog lifecycle, lists explicit deferred boundaries, includes RED/GREEN/final verification and browser evidence, and requests normal review. Do not claim Shadcn or native form compatibility.
