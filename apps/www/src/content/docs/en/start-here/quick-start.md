---
title: 'Quick Start'
desp: 'Initialize Proto UI and install components into your project'
description: 'Initialize Proto UI and install components into your project'
---

:::caution[Not Installable Yet] The Proto UI CLI is not ready yet, so it is **not currently installable and should not be used via the commands below**.

The CLI is expected to be ready by **April 15, 2026**. For now, the commands, folder structure, and setup flow in this document are provided only to explain the intended future workflow. Do not run these installation commands yet. :::

## Install the Proto UI CLI

You can use the Proto UI CLI directly with `npx`. There is no need to install it globally in advance.

```bash
npx @proto.ui/cli --help
```

---

## Initialize your project

Run this in your project root:

```bash
npx @proto.ui/cli init
```

After initialization, a `proto-ui/` folder will be created at the project root.

A typical structure looks like this:

```txt
your-project/
├── src/
├── proto-ui/
│   ├── adapters/
│   ├── prototypes/
│   └── components/
├── package.json
└── ...
```

Where:

- `adapters/`: the adapters used by the current project
- `prototypes/`: the prototypes installed in the current project
- `components/`: the assembled entry point for ready-to-use components

You usually do not need to maintain these files manually. The CLI manages them for you.

---

## Add a component

Once initialization is done, you can install Proto UI components one component at a time.

For example, to add a `shadcn-button` in a React project:

```bash
npx @proto.ui/cli add react shadcn-button
```

This command will:

1. Detect the host adapter you selected (`react`)
2. Install the corresponding Prototype (`shadcn-button`)
3. Assemble everything locally
4. Generate a component entry point that your current project can use directly

---

## Use it in your project

After installation, you can import the component directly in your project:

```tsx
import { Button } from 'proto-ui/components';

export function Demo() {
  return <Button>Click me</Button>;
}
```

If you install multiple components, they will all be exposed from `proto-ui/components`.

---

## Keep adding more components

Proto UI is adopted one component at a time.

You can continue with commands like:

```bash
npx @proto.ui/cli add react shadcn-input
npx @proto.ui/cli add react shadcn-dialog
```

Then keep using them from the same entry point:

```tsx
import { Button, Input, Dialog } from 'proto-ui/components';
```

---

## It does not ask you to migrate your whole project at once

You can use Proto UI only in new features, or replace just one or two components in an existing project.

A more common way to start is:

1. Initialize Proto UI first
2. Install the simplest component first, such as Button
3. Try it in one local page or feature
4. Then decide whether to keep expanding

---

## Next

If you want to understand the most basic model behind it:

- Go to [How It Works](/en/start-here/how-it-works/)

If you want to decide whether it is worth introducing:

- Go to [Why Proto UI](/en/start-here/why-proto-ui/)

If you want to learn more about its underlying principles and boundaries:

- Go to [Whitepaper](/en/whitepaper/component-as-protocol/)
