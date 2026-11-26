# Web Component custom-property replay write guard

## Final scope and authority

This is a bounded implementation optimization for nonempty CSS custom properties in the existing Web Component normalized `surfaceStyle` channel. Every standard CSS declaration, and every empty custom-property value, retains the original `setProperty` call. No contract is changed or draft entity promoted. `C-HOST-SURFACE-PROJECTION-0001` (draft), especially C, E and F, describes presentation targeting and source-owned migration. `A-WEB-COMPONENT-0001` preserves direct raw-props delivery without implicit render.

The investigation follows passive Surface/Text consumer work in PR #777 and documentation validation in PR #815. A diagnostic CPU sample from `2e4880639f90d0df6848ce6936a97c01be5be95e` identified native-control initialization/replay and `syncOwnedSurfaceStyles` as a candidate hot path. The instrumented sample is attribution evidence, not a normal performance pass or measurement of the speedup here. The Shadcn consumer copies 45 `--pui-*` theme tokens onto each Surface/Text; the adapter optimization is generic to `--*`, with no theme- or homepage-specific branch.

## Why preserve ordinary CSS setters

The first local candidate, `00fd3eaa67d977fd4a13b498880fbbe0ebf18b89` (also temporarily cherry-picked as `2e990132`), skipped all equal value/priority writes. Independent review rejected it before publication:

- A target with `margin-left: 5px` serializes absent shorthand `margin` as an empty value/priority. Applying `surfaceStyle: { margin: '' }` must still call the setter to clear the longhand. The broad guard incorrectly retained `5px`. Padding and a single input array containing longhand then empty shorthand have the same boundary.
- Equal nonempty standard declarations can still need CSSOM logical/physical declaration reordering. For example, replaying an owned `margin-left` after an external `margin-inline-start` must reach the native setter. Value/priority equality alone cannot replace [CSSOM's declaration-setting algorithm](https://drafts.csswg.org/cssom/#set-a-css-declaration).

An intermediate empty-value exception fixed the first counterexample but still failed the logical/physical setter-delivery control. The final candidate avoids reimplementing these general CSSOM rules: it only skips nonempty custom-property writes with exactly matching live value and priority. The rejected local candidate is retained as historical evidence, not an accepted intermediate product commit. Its initial green unit results did not establish complete semantic safety.

## Preserved behavior

`site-native-controls.ts` first calls `setElementProps`, then replays through Custom Element `setProps` in a microtask. The latter calls `setElementProps` and explicitly updates the controller. Removing replay would change render timing because `applyRawProps` alone does not render; neither path is changed here.

The guard still normalizes inputs, records ownership and original value/priority, delivers raw props, and allows explicit update. It compares the actual live declaration rather than caching props identity. External custom-property value or priority changes are reasserted. An already matching replacement target still gets an ownership record so a later change restores its original value on cleanup. Omission/unbind preserves an external overwrite that no longer matches the adapter's applied declaration.

No new Prototype, navigation deferral, scheduling change, timeout adjustment, normalization rule, or theme/family shortcut is introduced. Differently serialized equivalent custom-property values still fall back to a write.

## Discriminating evidence

Baseline product: `ec6e5710d0aaeee6d5844f9c996c1d7ca594aa31`. Environment: Node 24.19.0, pnpm 10.32.1, Vitest 2.1.9, happy-dom, one worker.

The exact final 14 focused tests were exercised against three implementations:

- Original `ec6`: 3 expected custom-property write-count failures, 11 passes. Reproviding two custom properties via same object, copied object and CSS string makes six redundant writes; an already equal replacement target makes one. The raw-props/update integration also detects its redundant custom-property replay. All standard declaration controls pass.
- Rejected `00fd`: 5 failures, 9 passes. It suppresses the empty custom-property setter, both logical/physical replay setters, and both margin/padding empty-shorthand removals.
- Final custom-property-only candidate: all 14 pass. Partial shorthand, external important longhand mutation, mixed-priority clearing, single-input array ordering, custom-property reassertion/priority, target migration, cleanup and explicit render timing are covered.

Logical/physical tests assert the adapter continues delivering the setter. Happy-dom does not establish native logical-property computed-style ordering; native Chromium probing was unavailable in the review environment. This is a verification limit, not evidence that the CSSOM boundary can be ignored.

Candidate commands and results:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/adapters/web-component/test/surface-projection.test.ts \
  packages/adapters/web-component/test/props-reprovide.test.ts \
  --maxWorkers=1 --minWorkers=1
# 2 files, 14 tests passed.

corepack pnpm@10.32.1 exec vitest run \
  packages/adapters/web-component/test --maxWorkers=1 --minWorkers=1
# 78 files, 269 tests passed, including the focused cases.

corepack pnpm@10.32.1 exec vitest run \
  apps/www/src/components/site-native-controls.test.ts \
  apps/www/src/components/site-header-surface.test.ts \
  apps/www/src/components/PrototypePreviewer/runtime-preview-surface.test.ts \
  packages/adapters/base/test/host-surface-projection.test.ts \
  packages/adapters/react/test/previewer.demo-renderer.test.ts \
  packages/adapters/vue/test/previewer-textarea.demo.test.ts \
  packages/web-conformance/test/surface.journey.test.ts \
  packages/web-conformance/test/text.journey.test.ts \
  packages/prototypes/brutalist/test/textarea.test.ts \
  packages/prototypes/shadcn/test/textarea.test.ts \
  --maxWorkers=1 --minWorkers=1
# 10 files, 129 tests passed, including Surface/Text across WC/React/Vue/Vue2.

corepack pnpm@10.32.1 -s check:types:workspace
# Passed.
```

Changed files also passed Prettier and `git diff --check`. Initial setup failures from absent worktree dependency links and an unsupported Vitest spy matcher were corrected before recording the intended baseline failures. An early consumer command included six nonexistent per-family test filters; only its six actual consumer files ran, followed by the real Surface/Text journey files. Final commands above contain only existing files.

## Remaining verification and provenance

These tests establish eliminated custom-property writes and preserved adapter delivery, not native cascade/paint fidelity or an end-to-end startup improvement. Search's original one-second deadline, real browser family/theme transitions, production build, full repository checks and independent review remain required on integrated PR #815. Historical Search timeout evidence is not superseded by these results. This logic change supplies executed evidence without an invented UI capture; integrated browser validation owns revision-bound visual evidence.

The localized guard and tests were AI-assisted using OpenAI tools against existing Proto UI source, with CSSOM documentation consulted for the rejected broad optimization. No third-party implementation, new dependency or private code was imported. Automated checks are listed above; independent human/product approval is not claimed.
