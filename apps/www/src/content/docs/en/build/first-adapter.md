---
title: 'Your First Adapter'
description: 'A step-by-step guide to writing your first Proto UI adapter.'
---

This guide walks you through creating a minimal Proto UI adapter — the bridge that lets prototypes run inside a specific host framework. If you've never written a Proto UI adapter, start here.

## Before you start

You should be comfortable with TypeScript and the host framework you're targeting (React, Vue, Web Components, etc.). You don't need to understand the full Proto UI architecture — this guide covers the minimum.

An adapter's job is to answer three questions for every prototype:

- How does it **mount** in this host?
- How do **props** flow from host to prototype?
- How do **events** flow from prototype to host?

Before coding, read the [Adapter Proposal Template](https://github.com/Proto-UI/Proto-UI/issues/new?template=adapter-proposal.md) and open an issue. Adapters touch many prototypes, so alignment upfront saves time.

## File structure

Proto UI adapters live in `packages/adapters/<host>/`. A minimal adapter needs:

```
packages/adapters/<host>/
  src/
    adapt.ts          # core mapping logic
    types.ts          # host-specific types
    index.ts          # re-exports
    runtime/
      session.ts      # runtime session wiring
      effects-port.ts # effects bridging
```

The simplest complete reference is [`packages/adapters/react/`](https://github.com/Proto-UI/Proto-UI/tree/main/packages/adapters/react) — read through it before continuing.

## Step 1: Claim an issue

Find an adapter-scoped issue in the [issue tracker](https://github.com/Proto-UI/Proto-UI/issues?q=is%3Aopen+label%3Aadapter). Comment before starting. If no issue exists, create one using the [Adapter Proposal Template](https://github.com/Proto-UI/Proto-UI/issues/new?template=adapter-proposal.md).

## Step 2: Set up the package

Create `packages/adapters/<host>/` with a `package.json`:

```json
{
  "name": "@proto.ui/<host>-adapter",
  "private": true,
  "main": "./src/index.ts",
  "dependencies": {
    "@proto.ui/core": "workspace:*",
    "@proto.ui/runtime": "workspace:*"
  }
}
```

## Step 3: Wire the host input

Create `src/adapt.ts`. The adapter host needs three things from every host:

```ts
import type { Prototype, PropsBaseType } from '@proto.ui/core';
import {
  createAdapterHost,
  type AdapterHostInput,
  type AdapterHostHooks,
} from '@proto.ui/adapters-base';

function adaptPrototype<P extends PropsBaseType>(
  proto: Prototype<P>,
  hostInput: AdapterHostInput<P>,
  hooks?: AdapterHostHooks<P>
) {
  return createAdapterHost(proto, hostInput, hooks);
}
```

| Input         | Purpose                                             |
| ------------- | --------------------------------------------------- |
| `commit`      | Apply prototype output to host DOM / VDOM           |
| `schedule`    | Schedule host-side updates (e.g. microtask / frame) |
| `getRawProps` | Read raw props from the host layer                  |

## Step 4: Implement commit

`commit` receives the prototype's output and must translate it to host-native updates:

```ts
const hostInput: AdapterHostInput<MyProps> = {
  commit(dom, ops) {
    for (const op of ops) {
      if (op.kind === 'attribute') {
        dom.setAttribute(op.name, String(op.value));
      } else if (op.kind === 'property') {
        (dom as any)[op.name] = op.value;
      } else if (op.kind === 'event') {
        dom.addEventListener(op.name, op.handler);
      }
    }
  },
  schedule(fn) {
    queueMicrotask(fn);
  },
  getRawProps() {
    return rawProps;
  },
};
```

Look at [adapter-host.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/adapters/base/src/host/adapter-host.ts) for the full `AdapterHostInput` contract.

## Step 5: Wire host lifecycle

Use `AdapterHostHooks` to connect mount/unmount:

```ts
const hooks: AdapterHostHooks<MyProps> = {
  onRuntimeReady(runtime) {
    // Prototype runtime is ready — wire events, start interactions
  },
  onUnmountBegin(runtime) {
    // Cleanup before unmount
  },
  afterUnmount() {
    // Host-level teardown
  },
};
```

## Step 6: Register the adapter

Add your adapter to `packages/adapters/<host>/src/index.ts`:

```ts
export { adaptPrototype } from './adapt';
export type { HostSpecificTypes } from './types';
```

## Step 7: Test with contracts

Create `packages/adapters/<host>/test/` with contract-driven tests. Adapters are validated by running existing prototype tests through the new host:

```ts
import { adaptPrototype } from '../src/adapt';
import button from '@proto.ui/base/button';

test('button renders via host', () => {
  const session = adaptPrototype(button, mockHostInput);
  expect(session.controller).toBeDefined();
  session.dispose();
});
```

At minimum, test: Button (simplest prototype), one compound prototype, and event routing.

## Step 8: Wire into docs site

Adapters are consumed through the docs site demo system. Register your adapter in the docs site adapter registry so prototypes can be previewed through your host.

## Before opening a PR

- [ ] All existing prototype tests pass through the new adapter
- [ ] At least 3 prototypes render correctly (Button + 2 more)
- [ ] Event routing works in both directions (host → proto, proto → host)
- [ ] Cleanup doesn't leak (mount → unmount → remount works)
- [ ] PR description links the proposal issue and explains capability mapping

## Common pitfalls

1. **Over-abstracting the host layer** — map prototypes to host, don't build a second framework. Keep the adapter thin.
2. **Silent capability gaps** — if the host can't support a contract, document the gap explicitly rather than silently skipping it.
3. **Forgetting teardown** — always call `session.dispose()` on unmount. Leaked sessions cause subtle bugs.
4. **Mixing host concerns into prototypes** — the adapter translates, the prototype defines. Never put host-specific logic in a prototype.
5. **Skipping contract tests** — contracts define what "correctly adapted" means. Without them, it's guesswork.

## Next steps

- [Adapter Guide](/en/build/adapter-guide/) — deeper reference (in progress)
- [Contracts & Tests](/en/build/contracts-and-tests/) — how contract verification works
- Existing adapters: [React](https://github.com/Proto-UI/Proto-UI/tree/main/packages/adapters/react), [Vue](https://github.com/Proto-UI/Proto-UI/tree/main/packages/adapters/vue), [Web Component](https://github.com/Proto-UI/Proto-UI/tree/main/packages/adapters/web-component)
