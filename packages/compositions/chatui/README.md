# `@proto.ui/compositions-chatui`

Private repository package for bounded Agent Harness ChatUI composition dogfood. It is excluded from release scans and has no CLI or public documentation entry.

## Code Block

`CodeBlock` exposes three package-local composition parts:

- `CodeBlock.Root` — exactly one root;
- `CodeBlock.Header` — optional, at most one;
- `CodeBlock.Content` — exactly one.

Each part has one anonymous authored-children slot. Header layout accepts one App-authored child group; labels, metadata, and existing Proto UI controls remain owned by the App. Content projects App-authored plain children and applies whitespace-preserving wrapping with safe long-token breaking.

The composition does not own code data, language or filename truth, syntax tokens or highlighting, copy or Clipboard behavior, selection, async processing, accessibility role or name, host measurement, or a Scroll Area. Apps that need copy behavior place an existing Proto UI Button in Header and handle its semantic event outside this package. Apps that need real scrolling compose an independently governed Scroll Area.

## Message

`Message` is a separate private entry at `@proto.ui/compositions-chatui/message`, implementing the [accepted first-slice boundary](https://github.com/Proto-UI/Proto-UI/pull/569#pullrequestreview-5099159751).

| Part              | Cardinality within one Message domain |
| ----------------- | ------------------------------------- |
| `Message.Root`    | Exactly one                           |
| `Message.Leading` | Zero or one                           |
| `Message.Header`  | Exactly one                           |
| `Message.Content` | Exactly one                           |
| `Message.Footer`  | Zero or one                           |
| `Message.Actions` | Zero or more                          |

Each part projects one anonymous App-authored children slot. Root and parts are real Prototype instances with package-local anatomy. Missing required parts and duplicate bounded parts produce the existing Anatomy family diagnostics; the composition does not manufacture or reorder children.

Root accepts only three visual/layout inputs:

| Prop        | Values                                   | Default   |
| ----------- | ---------------------------------------- | --------- |
| `alignment` | `start`, `end`, `stretch`                | `start`   |
| `tone`      | `default`, `user`, `assistant`, `system` | `default` |
| `spacing`   | `default`, `compact`                     | `default` |

Alignment places the block at the leading edge, trailing edge, or full available width. Tone selects a visual recipe chosen by the App; it does not infer a sender or message kind. Spacing changes the composition's padding and gaps. Recipe updates use Props and Rule visual feedback without owning message content or streaming state.

The App owns message IDs, ordering, sender, timestamps, status, streaming, content interpretation, action availability and callbacks. It supplies text and a real independent `CodeBlock` through Content, and existing Proto UI controls through Actions. A retry callback belongs to the App and its Button; Message exposes no command or event API.

Message remains role-neutral and declares no accessible name or live region. An App-authored semantic wrapper outside the composition supplies the role and accessible name through the host framework. The same Message entry is consumed by Web Components, React 18–19, and Vue 3; package-local tests cover authored content, nested Code Block, identity-preserving streaming updates, App-owned retry, and the absence of composition-owned accessibility semantics.

This entry adds no Base Message subject, P/T entity, public package identity, CLI component, or public documentation route. Composer, transport, persistence, editing, branching, and Agent-domain behavior remain outside this slice.

The private App consumer fixture lives in `apps/www/test/fixtures/chatui-message`, outside the public content routes. From the repository root, run:

```sh
corepack pnpm@10.32.1 --filter apps-workspace exec vite --config ../www/test/fixtures/chatui-message/vite.config.ts --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/?runtime=wc`, `?runtime=react`, or `?runtime=vue`. The fixture controls App content, layout input, host direction, theme and retry; it uses generated Proto UI token CSS and does not patch Message's internal layout. `apps/www/test/message-composition.browser.test.ts` exercises the same consumer at desktop and narrow widths and writes disposable screenshots and geometry evidence.
