# WC Adapter Contract: Commit Semantics (v0)

> Historical v0 explanation, not a mode-independent current contract. The full-rebuild description below does not apply to retained Shadow split owner resources, equivalent native-slot commits, or a retained native editor. Current authority is [D-WEB-COMPONENT-SHADOW-PROFILE-0001](../../../spec/decisions/D-WEB-COMPONENT-SHADOW-PROFILE-0001.yaml), [D-WEB-COMPONENT-SHADOW-STYLE-0001](../../../spec/decisions/D-WEB-COMPONENT-SHADOW-STYLE-0001.yaml) and [C-HOST-VIEW-ATTACHMENT-0001](../../../spec/contracts/C-HOST-VIEW-ATTACHMENT-0001.yaml). Their lifecycle status and scoped criteria take precedence; see the [current Adapter guide](../../../packages/adapters/web-component/README.md) for mode selection.

## Status

- Version: v0
- Target: `@proto.ui/adapters.web-component`
- Applies to: Light DOM + Shadow DOM modes

## Glossary

- **Template**: platform-agnostic render blueprint produced by a Prototype render function.
- **Commit**: adapter operation that materializes Template into host DOM.
- **Host root**:
  - Shadow mode: `el.shadowRoot`
  - Light mode: the custom element itself (`el`)
- **Owned nodes**: nodes created by the adapter from Template in the last commit.
- **Projected nodes** (Light DOM slot): nodes provided externally (user children) moved into the slot range.

## Core Guarantees (Normative)

### G1. Full rebuild (replaceChildren)

The adapter MUST implement commit as **full rebuild**:

- Each commit replaces all children of host root.
- The adapter does NOT perform incremental patch/diff in v0.

Rationale: v0 optimizes for deterministic semantics and simplicity.

#### Observable implications

- Any external nodes inside the host root are removed unless the adapter explicitly re-inserts them (e.g. Light DOM slot projection).
- Event handlers attached directly to DOM nodes created by the adapter are lost after rebuild (unless re-attached by Prototype logic on next mount/update).

### G2. DOM node generation rules

For each TemplateChild:

- `string | number` MUST become a `Text` node with `String(value)`.
- `null` MUST produce no DOM output.
- `TemplateNode` with `type: string` MUST create a corresponding Element via `document.createElement(type)`.

### G3. ReservedType: slot (Shadow mode)

In Shadow mode, `slot` MUST become a real `<slot>` element with native slot semantics.

In v0, only **default slot** is supported:

- Named slot is forbidden at the Template level (core contract).
- Multiple slots are forbidden (adapter contract).

### G4. ReservedType: slot (Light DOM)

In Light DOM mode, `slot` MUST NOT render a `<slot>` element. Instead, the adapter MUST project external nodes into the slot position.

#### Projection rules

- Projection source: the custom element’s direct childNodes that are NOT owned by the adapter.
- Projection destination: the slot position inside the committed DOM tree.
- Projection MUST preserve node identity (move nodes, do not clone).
- Projection MUST preserve order.

#### Slot limitations (non-negotiable for v0)

- At most one slot per commit.
- No named slot.
- No slot arguments.

### G5. External child projection after connected (Light DOM; MO)

After the element is connected, if user code appends/removes direct children of the custom element:

- Newly appended external nodes MUST be projected into the slot range automatically.
- This behavior is implemented via MutationObserver (MO) or an equivalent mechanism.
- Scheduling is host-defined; observers may deliver on a macrotask.

This guarantee only applies when the current committed template contains a slot.

### G6. Style carrier (feedback-only)

Template style is supported as a **feedback-only** carrier:

- If TemplateNode has `style.kind === "css"`, adapter MUST set inline `style` attribute to `style.cssText`.
- If TemplateNode has `style.kind === "tw"`, adapter MAY ignore unless configured with a resolver.

This is not a CSS system; it is an IR carrier for v0.

## Explicit Non-Goals (v0)

- No incremental patch/diff.
- No template-level PrototypeRef composition (see `template/no-prototype-composition.v0.md`).
- No fragments (if present in core types, adapter may ignore or reject; official WC adapter treats it as unsupported in v0).
- No attribute/prop mapping from TemplateProps other than style carrier.
- No event binding from Template (events belong to Prototype role/cap systems, not Template).

## Contract Tests Mapping

The following tests MUST exist and remain green:

### Slot (Light DOM)

- `packages/adapters/web-component/test/contracts/slot-light-dom.v0.contract.test.ts`

### Slot (Shadow DOM)

- `packages/adapters/web-component/test/contracts/slot-shadow-dom.v0.contract.test.ts` (recommended; may be added later)

### Full rebuild semantics

- `packages/adapters/web-component/test/contracts/commit.full-rebuild.v0.contract.test.ts`

### Style carrier

- `packages/adapters/web-component/test/contracts/template-style.carrier.v0.contract.test.ts`

## Rationale (Informative)

Proto UI prioritizes strict cross-host semantics. v0 commit chooses “rebuild + projection” because it:

- is deterministic,
- is easy to reason about and debug,
- keeps adapters minimal,
- avoids a half-baked diff algorithm that would become a permanent compatibility burden.
