# as-overlay.v0.md

> Status: Draft - v0
>
> Human-readable projection of `spec/contracts/C-AS-OVERLAY-0001.yaml`.

---

## 0. Positioning

`asOverlay()` declares that the current prototype instance participates in overlay governance.

It is responsible for:

- overlay open/close/toggle lifecycle
- overlay content registration
- optional trigger/anchor registration as structural roles
- dismiss policy
- consumer-owned focus integration (generic entry/restore remains deferred)
- overlay stack and nesting participation
- host-mediated placement negotiation

It is not responsible for:

- defining trigger interaction semantics such as click, hover, or contextmenu
- defining item selection semantics
- defining modal/backdrop/scroll-lock policy in general
- inventing a host-specific portal mechanism

### 0.1 Transitional Semantics Note

The returned handle exposes setup-only options such as `modal`, `closeOnOutsidePress`, and `closeOnFocusOutside` through `overlay.configure(...)`.

Normative direction:

- `modal` should be treated as a **policy declaration**
- outside press consumes Boundary classification; focus-outside awaits a reliable neutral sample
- overlay should remain a consumer of those semantics rather than the foundational owner of them

This means:

- the presence of a `modal` option does **not** imply that overlay is the permanent home of low-level interaction interception semantics
- temporary implementation details in adapters or prototypes do not redefine the long-term layering model

---

## 1. Why It Exists

Overlay behavior crosses multiple subsystems:

- Event: neutral Escape input; Boundary: outside press classification
- focus: entry, restore, local boundary behavior
- state: open/closed facts
- host/layout: anchor-relative placement and visibility

These concerns should not be re-authored independently inside every dropdown, popover, tooltip, or context menu protocol.

---

## 2. Scope of v0

`asOverlay()` in v0 targets **anchored non-modal overlays** first.

Examples:

- dropdown menu content
- popover content
- context menu content
- select/listbox popup content
- combobox popup content
- tooltip / hover-card content

v0 does not require modal dialog features such as:

- backdrop semantics
- inert outside tree
- scroll locking
- universal top-layer behavior

These may be defined later by a separate modal overlay contract or an explicit extension of this one.

---

## 3. Invocation Model

`asOverlay()` is a privileged, no-argument, once-installed asHook.

- the first call installs overlay capability for the current instance
- later calls reuse the same underlying handle
- setup configuration is expressed through `handle.configure(...)`
- repeated calls must not reinstall the capability

```ts
const overlay = asOverlay();
overlay.configure({
  closeOnOutsidePress: true,
  portal: true,
});
```

### 3.1 Presence Coordination

Overlay logical open is not itself a mount fact.

- without a binding, Overlay uses one immediate driver that projects logical open through `run.lifecycle.setPresent()`
- `keepMounted()` explicitly retains the structural view for protocols that are not yet lazy-mount safe
- a component may bind a perceptual Presence driver such as `asTransition()`
- after binding, the immediate driver is disabled and only the binding may submit structural ViewIntent
- submitting the same binding again is idempotent; a competing binding is a contract error
- `keepMounted()` and external Presence binding are mutually exclusive

```ts
const overlay = asOverlay();
const transition = asTransition();

overlay.bindPresence({
  enter: transition.controls.enter,
  leave: transition.controls.leave,
  present: transition.isPresent,
});
```

The following facts remain distinct:

- Overlay logical open
- perceptual presence (`entering`, `entered`, and `leaving` are present)
- lifecycle ViewIntent
- current view-epoch mount phase

Boundary stack participation follows logical open. Modal activity follows perceptual presence. Portal and layer resources remain attached through leaving and are finally revoked when the current view epoch detaches.

The primary authoring entry is expected to be content/root-oriented hooks such as:

- `asDropdownContent(...)`
- `asTooltipContent(...)`
- `asPopoverContent(...)`

Direct use of `asOverlay()` by authors should be possible, but is not the primary expected path.

---

## 4. Trigger Relationship

`asOverlay()` does **not** own trigger interaction semantics.

The following are outside the responsibility of `asOverlay()`:

- open on click
- open on hover
- open on focus
- open on `context.menu`

Those behaviors should be defined by component-specific trigger hooks such as:

- `asDropdownTrigger(...)`
- `asTooltipTrigger(...)`
- `asDialogTrigger(...)`

However, `asOverlay()` may still recognize **trigger** as a structural role for purposes such as:

- focus restoration
- outside-interaction classification
- aria/linkage metadata
- default anchor resolution

---

## 5. Structural Roles

An overlay may involve these structural roles:

- `content`
- `anchor`
- `trigger`

v0 requirements:

- `content` is required
- `anchor` is optional
- `trigger` is optional

If no explicit anchor is registered, the trigger may act as the default anchor.

The contract does not require trigger and anchor to be the same node.

---

## 6. Open State

`asOverlay()` should minimally provide:

- `open`
- `defaultOpen`
- imperative `open()`
- imperative `close()`
- imperative `toggle()`

State changes should carry a reason-like classification where practical.

Example reasons:

- `trigger.press`
- `trigger.hover`
- `context.menu`
- `escape`
- `outside.press`
- `focus.outside`
- `item.commit`
- `controlled.sync`

The exact reason type may be refined later, but the contract should preserve the distinction between different close/open causes.

---

## 7. Dismiss Policy

v0 should support setup-time policy for at least:

- `closeOnEscape`
- `closeOnOutsidePress`
- `closeOnFocusOutside`
- `closeOnAnchorPress`
- `closeOnTriggerPress`

Component protocols may override these defaults.

Dismiss policies are opt-in. `closeOnEscape`, `closeOnOutsidePress`, and `closeOnFocusOutside` default to `false`; an adapter-independent Overlay must not require a global event target merely because the capability was installed for logical state or Presence coordination.

Examples:

- dropdown: usually closes on item commit, escape, and outside press
- tooltip: usually does not use trigger press toggle semantics
- context menu: usually closes on outside press and escape

### 7.1 Outside Is a Derived Consumer Signal

The current contract is:

- `outside` is a derived result of interaction-boundary classification
- `Boundary.observe('pointer.press')` requests the sample stream through Event
- Overlay may enable that observation when `closeOnOutsidePress` is configured

Therefore:

- `asOverlay()` should not require each component to invent its own outside detection logic
- "outside press" and "focus outside" are overlay consumer behaviors, not foundational overlay-owned primitives
- component protocols with controlled state or exception policy may subscribe to the same Boundary signal instead of enabling automatic Overlay close

Escape is not a Boundary classification. When enabled, Overlay consumes the neutral `key.down` event stream directly. Focus-outside observation remains deferred until a reliable cross-host focus sample contract is defined.

---

## 8. Focus Policy

`entry` and `restore` are retained configuration fields; the current generic Overlay does not execute these policies. Dialog, Dropdown and other consumers retain their own Focus and Root request protocols. `closeOnAnchorPress` and `closeOnTriggerPress` are likewise not automatic generic dismissal implementations.

Focus-outside remains deferred until a reliable neutral sample contract is admitted. These boundaries are cataloged in `M-OVERLAY-0001-D`; configuration shape alone is not evidence of behavior.

---

## 9. Placement

`asOverlay()` exposes an opt-in anchored policy and delegates geometry to the Positioning module and its host capability. Overlay owns orchestration and lifetime, not measurement.

The anchored model includes:

- `placement`
- `align`
- `sideOffset`
- `alignOffset`
- `strategy: absolute | fixed`
- `avoidCollisions`
- `collisionBoundary: clippingAncestors | viewport`
- `collisionPadding`

The default collision boundary is the floating target's clipping ancestors and the root boundary is the visual viewport. Collision avoidance performs flip and shift. Resolved side and alignment are host projection facts and may differ from the authored request.

An author-facing `AnatomyPartView` may be submitted as an anchor identity. Resolving that identity to a host target is an internal Anatomy-to-Overlay operation and must not reveal the raw target to prototype authors.

The following are explicitly non-required in v0:

- arrow middleware
- cursor-follow placement
- top-layer guarantees
- custom Element collision boundaries
- sticky and hide-when-detached policy

Adapters may provide stronger behavior, but the base contract should remain conservative.

---

## 10. Stack and Nesting

Overlays frequently nest:

- submenu inside dropdown
- tooltip inside popover
- combobox popup inside dialog

`asOverlay()` should therefore participate in a runtime overlay stack.

v0 should minimally support:

- knowing whether the current overlay is open
- parent/child overlay nesting participation
- excluding related trigger/content regions from naive outside-press dismissal

The contract does not require a public arbitrary overlay-query API.

---

## 11. Portal Is Independent From Collision Detection

Anchored positioning must not require Portal. Inline placement uses the floating target's real containing and clipping ancestors.

Portal is a separate opt-in capability used when a floating view must escape ancestor clipping or stacking context. Moving to a Portal changes host geometry and therefore the effective clipping ancestors; it does not change logical ownership.

Portal capability is defined at the adapter/runtime level rather than as a private positioning trick.

For renderer-owned hosts, portal projection must remain renderer-owned. React adapters must use `createPortal`, Vue adapters must use an equivalent renderer primitive when available, and an Overlay host bridge must not imperatively reparent a node that the renderer still owns. Logical parent links remain adapter metadata and do not authorize DOM mutation behind the renderer.

The logical prototype tree should remain the semantic source of truth.

---

## 12. Handle Shape

Example shape:

```ts
type OverlayHandle = {
  open: ObservedStateHandle<boolean, any>;

  openOverlay(reason?: OverlayReason): void;
  close(reason?: OverlayReason): void;
  toggle(reason?: OverlayReason): void;

  configure(patch: OverlayConfigPatch): void;
  updatePosition(patch: OverlayPositionPatch): void;

  registerContent(target: unknown): void;
  registerAnchor(target: unknown): void;
  registerAnchorPart(part: AnatomyPartView): void;
  registerTrigger(target: unknown): void;

  getPositionSnapshot(): AnchoredPositionSnapshot | null;
};
```

Notes:

- `open` is observed state; `openOverlay` is the command
- `configure(...)` must be setup-only
- `updatePosition(...)` updates only runtime geometry policy and does not redefine dismiss, focus, modal, or Portal policy
- registration targets are adapter-facing and need not be public author primitives
- `registerAnchorPart(...)` preserves the author-facing Anatomy target-safety boundary

---

## 13. Design Principle

The core boundary is:

- `asOverlay()` governs overlay existence, explicit dismissal, and delegated placement
- trigger hooks govern which interaction requests state change

This separation keeps overlay as a reusable structural capability while allowing dropdown, tooltip, dialog, and context menu to define their own trigger semantics.

## 14. Cataloged host resources and Escape

`M-OVERLAY-0001` coordinates optional `HC-OVERLAY-PORTAL-0001`, `HC-OVERLAY-MODAL-0001` and `HC-OVERLAY-LAYER-0001`. Missing providers acquire no corresponding resource. Replacement releases through the old provider before the active mounted view reconciles through the new one. The Web modal realization shares body scroll-lock ownership and restores the original inline overflow only after the final release; it does not supply inertness or a focus trap. The numeric layer scheduler preserves/restores inline z-index and its priority; role offsets do not establish an absolute hierarchy.

`C-AS-OVERLAY-0001-P` defines one eligible owner per Escape sample within a shared input scope. Overlay owns selection, Event carries opaque privileged scope/sample identity, and ordinary Event broadcasts remain unchanged. Synchronous controlled reopen cannot pass the same sample to another Overlay. Repeated open does not reorder an already eligible candidate.
