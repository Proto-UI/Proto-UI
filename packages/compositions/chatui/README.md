# `@proto.ui/compositions-chatui`

Private repository package for bounded Agent Harness ChatUI composition dogfood. It is excluded from release scans and has no CLI or public documentation entry.

## Code Block

`CodeBlock` exposes three package-local composition parts:

- `CodeBlock.Root` — exactly one root;
- `CodeBlock.Header` — optional, at most one;
- `CodeBlock.Content` — exactly one.

Each part has one anonymous authored-children slot. Header layout accepts one App-authored child group; labels, metadata, and existing Proto UI controls remain owned by the App. Content projects App-authored plain children and applies whitespace-preserving wrapping with safe long-token breaking.

The composition does not own code data, language or filename truth, syntax tokens or highlighting, copy or Clipboard behavior, selection, async processing, accessibility role or name, host measurement, or a Scroll Area. Apps that need copy behavior place an existing Proto UI Button in Header and handle its semantic event outside this package. Apps that need real scrolling compose an independently governed Scroll Area.
