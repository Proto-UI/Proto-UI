# Owned Decoration Target (Draft)

> Status: Draft (`#935`, `#938`, `#956`, `#957`, `#963`, `#972`). Authoritative rules belong in `spec/contracts/C-FEEDBACK-STYLE-0001/0004` and `C-RULE-INTENT-FEEDBACK-STYLE-0001`. Historical per-PR development logs live in git history.

## Purpose

Allow a prototype to style one or more adapter-owned decorative leaves (such as a Tabs active-line indicator) without exposing raw DOM nodes, arbitrary tag/attribute injection, or component-specific adapter branches.

## Authoring API

- **Declare target (setup-only):** `const target = def.feedback.style.declareDecoration()` returns a frozen, opaque, instance-scoped identity.
- **Bind leaf in template:** `r.decoration(target)` attaches that identity to one empty adapter-owned decorative leaf. No tag, props, events, text, children, slot, or `PrototypeRef` is permitted.
- **Contribute styles:** `def.feedback.style.to(target).use(tw(...))` (setup) and `i.feedback.style.to(target).use(tw(...))` (Rule). Existing semantic merge and Rule withdrawal apply independently per target without affecting host styles.

## Ownership & Lifecycle Rules

1. **Accessibility & interaction exclusion:** Adapters materialize an empty neutral leaf (`aria-hidden="true"`, `inert`, no `tabindex`, `pointer-events: none`). It never enters focus navigation or the accessibility tree.
2. **Pre-bind validation & replay:** Setup contributions recorded before first commit replay once the full target set validates and binds. Duplicate, foreign, missing, or unsupported targets fail closed before mutating caller nodes.
3. **View generations (`detachView` vs `dispose`):**
   - Detaching a view revokes its physical sinks while retaining logical contributions for a subsequent mount generation (supporting React StrictMode / `Activity`, Vue 3 & Vue 2 `KeepAlive`).
   - Terminal `dispose()` closes the registry permanently; stale physical callbacks are ignored.
4. **Fixed-blueprint reuse:** When an owner with declared targets commits an identical immutable Template snapshot (structure, static tokens, slots, and target identities), the adapter reuses the live view, lease, physical leaves, and slot projector without rebinding. Structural changes remain rejected before mutation.
5. **Same-document portals & caller relocation:**
   - Same-document logical portals (WC relocation window, React `createPortal`, Vue `Teleport`, Vue 2 native portal) paint through a lease-bound transport gate without re-running unrelated template rebuilds.
   - Light-DOM Web Component parent commits may relocate existing caller subtrees under a single-use synchronous receipt while preserving focus and native input/textarea selection ranges (excluding `contenteditable`).

## Scope & Limits

- **Supported runtime adapters:** Light-DOM Web Components, React, Vue 3, and Vue 2 runtime paths.
- **Out of scope / unsupported:** Shadow profiles, native text/image/link surfaces, cross-document transfers, arbitrary author reparenting, generic keyed diffing, runtime `patch`/`suppress` targeting, and portable compiler lowering (tracked separately under `#902`).
- **Acceptance status:** Covered by runtime and framework DOM unit suites; native browser accessibility and cross-target compiler lowering remain open under draft status.
