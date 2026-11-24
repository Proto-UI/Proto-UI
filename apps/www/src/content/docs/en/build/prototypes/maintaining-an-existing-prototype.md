---
title: 'Maintaining an Existing Prototype'
description: 'Start from applicable P/T spec entities to fix behavior, add regression tests, and keep exports, docs, and demos in sync.'
---

Maintaining an existing Prototype is the most direct way to contribute to Proto UI. You do not need to argue for a new component identity—just check what the Prototype currently guarantees and identify whether the issue lies in implementation, test coverage, or public docs and exports.

## Work that fits this path

- Fix runtime behavior that diverges from an existing `P-*` criterion.
- Add regression or edge-case tests for an existing guarantee.
- Repair drift across package exports, CLI registry entries, docs, or demos.
- Add Light/Dark, keyboard, narrow-viewport, or three-Adapter preview coverage for defined states.
- Update upstream provenance, version pins, or compatibility notes.
- Remove outdated or inaccurate API statements from docs.

If you plan to add new props, events, states, anatomy parts, or compatibility promises, check first whether the `P-*` spec or a related decision needs to be updated.

## 1. Locate the applicable spec entities

Search across specs, packages, and docs rather than guessing rules from filenames:

```sh
rg -n "<prototype name|entity id|criterion id>" spec packages/prototypes apps/www internal/records
```

Confirm six things:

1. the applicable `P-*` entity and its lifecycle status (`draft` or `active`);
2. the specific criterion related to the issue;
3. linked `T-*` test entities and executable test paths;
4. Base inheritance, related decisions, and explicit negative boundaries;
5. package source, tests, exports, CLI registry entries, docs, and demos; and
6. any recent notes in `internal/records` providing short-term context.

When code and spec disagree, treat the spec entity as the baseline to investigate drift, then decide whether to fix the code or update the spec.

## 2. Classify the issue

### Implementation drift

The spec and expected behavior are clear, but runtime behavior differs. Write a failing regression test first, then fix the implementation.

### Missing test coverage

Runtime behavior looks right, but a `T-*` case, focused unit test, or three-Adapter preview is missing. Add the smallest focused test without changing public semantics.

### Export or docs drift

Code and spec agree, but package exports, CLI, READMEs, website docs, demos, or generated artifacts are out of date. Update the source files and re-run the relevant generator for derived outputs.

### Spec change

When the intended behavior itself needs to change, check whether an existing decision or issue acceptance criteria already defines the target behavior. If so, update the spec revision, `T-*` tests, implementation, and docs together. If direction is still open, summarize the affected criteria, compatibility impact, and options for review first.

## 3. Keep the change coherent

For a behavior fix, trace this chain:

```text
P-* criterion
→ T-* case and executable test
→ Prototype implementation
→ Base or styled-layer inheritance boundary
→ Package exports and CLI (if affected)
→ Docs, demo, and local preview
```

Only touch the links that actually need updates, and note in the PR which ones you checked.

## Testing guidelines

- Anchor tests to `P-*` criteria or observable behavior instead of internal implementation details.
- Verify that a bug-fix test fails before your fix.
- For styled states, test both the expected style rules and that explicitly excluded APIs remain absent.
- When Adapters behave differently, locate whether the issue belongs in the Prototype or the Adapter instead of masking Adapter gaps with Prototype workarounds.
- Test teardown, remount, and async timer paths to verify clean resource cleanup.

Example focused test run:

```sh
corepack pnpm@10.32.1 vitest run packages/prototypes/base/test/separator.test.ts
```

## Docs and demos

Whenever a change affects public behavior, states, anatomy, styling, or recommended usage, update the existing website page in the same PR. Purely internal refactors or test-only PRs do not need doc edits if the existing page stays accurate.

Website demos should match what developers experience after installing the package:

- import directly from the public package subpath;
- demonstrate the state or behavior touched by the change;
- cover Web Component, React, and Vue previews where applicable;
- drive interaction through the Prototype's own anatomy, triggers, states, and defaults;
- avoid page-private CSS, scripts, or extra state that mask protocol issues; and
- provide accessible names for interactive controls.

For instance, a Dialog should open via `dialog-trigger` rather than calling an exposed method from an unrelated button. Only add minimal external glue using public APIs when the component has no natural trigger (such as imperative Toast invocation) or when demonstrating imperative controls directly (such as Transition), and note in the demo source and PR what consumers need to wire up themselves.

Adding a brand-new public Prototype is beyond routine maintenance: include a reachable website page connected to navigation and note the local preview route in the PR.

## Local checks

Run baseline checks before opening a PR:

```sh
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:types
```

If you changed docs or demos, build the site as well:

```sh
corepack pnpm@10.32.1 docs:build
```

Run any affected test suites and include the actual check results in your PR description.

## When to pause for design review

Align on a design decision first when current specs or issues do not yet settle:

- adding or changing a core `P-*` criterion;
- shifting state ownership between Base and a styled layer;
- adding a new Anatomy role identity;
- promoting a host-specific detail into a cross-host protocol;
- resolving an ambiguous conflict across specs, tests, code, and docs; or
- widening third-party design-system compatibility promises.

Next: if you are layering a design language over an existing Base protocol, read [Projecting Base into a Design Language](/en/build/prototypes/projecting-base-into-a-design-language/).
