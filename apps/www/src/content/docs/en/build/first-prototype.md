---
title: 'Your First Prototype'
description: 'A step-by-step guide to writing your first Proto UI prototype.'
---

This guide walks you through creating a complete Proto UI prototype — from setup to PR. If you have never written a Proto UI prototype before, start here.

## Before you start

You should be comfortable reading TypeScript. You do not need to understand the full Proto UI architecture — this guide covers the minimum.

Pick a small, self-contained component for your first attempt. Good candidates: `badge`, `avatar`, `divider`, `label`. Avoid compound components (dropdown, dialog, tabs) until you have done a single-part prototype first.

## How a prototype is structured

A Proto UI prototype is a single file under `packages/prototypes/base/src/<name>/`. A minimal prototype needs only one file:

```
packages/prototypes/base/src/<name>/
  <name>.ts       # setup + definePrototype + asHook
  types.ts        # (optional) props / exposes types
  index.ts        # re-exports
```

The simplest reference in the repo is [`button.ts`](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.ts) — read it before continuing.

## Step 1: Claim an issue

Find an open issue tagged `prototype` in the [issue tracker](https://github.com/Proto-UI/Proto-UI/issues). Comment to claim it before you start. If no suitable issue exists, open one describing what you plan to build.

## Step 2: Create the source file

Create `packages/prototypes/base/src/<name>/<name>.ts`. Start with this skeleton:

```ts
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';

interface MyPrototypeProps {
  disabled?: boolean;
}

type MyPrototypeExposes = {
  disabled: import('@proto.ui/core').ExposeState<boolean>;
};

function setupMyPrototype(def: DefHandle<MyPrototypeProps, MyPrototypeExposes>): void {
  // Step 3–6 go here
}

export const asMyPrototype = defineAsHook({
  name: 'as-my-prototype',
  mode: 'once',
  setup: setupMyPrototype,
});

const myPrototype = definePrototype({
  name: 'base-my-prototype',
  setup: setupMyPrototype,
});

export default myPrototype;
```

## Step 3: Define props

Use `def.props.define()` to declare what the Maker can pass in:

```ts
def.props.define({
  disabled: { type: 'boolean', empty: 'fallback' },
});
def.props.setDefaults({ disabled: false });
```

## Step 4: Set up interaction state

Use `def.state.fromInteraction()` for basic interaction states:

```ts
const hovered = def.state.fromInteraction('hovered');
const focused = def.state.fromInteraction('focused');
const pressed = def.state.fromInteraction('pressed');
def.expose.state('hovered', hovered);
def.expose.state('focused', focused);
def.expose.state('pressed', pressed);
```

Or use `asButton()` for the full button interaction suite (hover, focus, press, click):

```ts
import { asButton } from '../button';
// inside setup:
asButton();
```

## Step 5: Handle events

Bind to events with `def.event.on()`:

```ts
def.event.on('press.commit', (run) => {
  if (run.props.get().disabled) return;
  // handle the press
});
```

Standard event names: `press.commit`, `pointer.enter`, `pointer.leave`, `native:focus`, `native:blur`.

## Step 6: Expose state and methods

Everything the outside world needs to read or call must be explicitly exposed:

```ts
def.expose.state('disabled', disabled);
def.expose.method('focusSelf', (run) => () => {
  // focus logic
});
```

## Step 7: Register the prototype

Add your prototype to `packages/prototypes/base/src/index.ts`:

```ts
export * from './<name>';
export { default as myPrototype } from './<name>';
```

## Step 8: Write a test

Create `packages/prototypes/base/test/<name>.test.ts`. Register your prototype as a web component for testing:

```ts
import { AdaptToWebComponent } from '@proto.ui/wc-adapter';
import myPrototype from '../src/<name>/<name>';

AdaptToWebComponent(myPrototype as any, { registerAs: 'wc-base-my-prototype' });
```

Write at least: a render test, a prop defaults test, and one interaction test.

## Step 9: Add a demo

Create `apps/www/src/content/docs/zh-cn/demo-base-<name>.demo.ts`:

```ts
export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'base-my-prototype',
    className: 'px-3 py-1.5 rounded border',
    children: ['Hello'],
  },
};
```

## Step 10: Add docs

Create `apps/www/src/content/docs/en/ui-libraries/base/<name>.mdx` (and `zh-cn/` equivalent):

```mdx
---
title: 'My Prototype'
description: '...'
---

import PrototypePreviewer from '@/components/PrototypePreviewer/PrototypePreviewer.astro';

<PrototypePreviewer
  demoId="demo-base-<name>"
  initialRuntime="wc"
  runtimes={['wc', 'react', 'vue']}
  hasCode={true}
/>

Description of what this prototype provides.
```

## Before opening a PR

- [ ] Tests pass: run the test suite for your package
- [ ] Type check passes
- [ ] Demo renders in all three runtimes (wc, react, vue)
- [ ] Both en and zh-cn docs are present (or explicitly skipped)
- [ ] PR description links the issue and describes the interaction boundary

## Common mistakes

1. **Skipping `asHook`** — if your setup might be reused, always export `asHook` alongside the prototype.
2. **Putting visual style in the prototype** — prototypes define interaction semantics, not CSS. Style belongs in the demo and the consuming app.
3. **Over-engineering the first version** — start with the smallest useful surface. You can add `expose.method`, `context`, or `lifecycle` later.
4. **Forgetting to register in `index.ts`** — the prototype won't be importable by consumers until re-exported.

## Next steps

- [Prototype author checklist](/zh-cn/build/prototypes/checklist/) — review before submitting
- [Writing a compound prototype](/zh-cn/build/prototypes/writing-a-compound-prototype/) — when your component needs multiple parts
- [Why you usually don't need a new prototype](/zh-cn/build/prototypes/when-not-to-write-a-new-prototype/) — before you start your second one
