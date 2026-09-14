# Interaction Boundary Contract (v0)

> **Status**: Draft - implementation-ready (contract-first)  
> **Version**: v0
>
> This human-readable projection describes the Proto UI **Interaction Boundary** contract. The corresponding `spec/contracts` and `spec/tests` entities are the machine-readable truth source.
>
> Normative source: `C-BOUNDARY-0001`; Module/host ownership and evidence are cataloged by `M-BOUNDARY-0001`, `HC-BOUNDARY-CLASSIFICATION-0001` and `T-BOUNDARY-0002`. This document is a transitional projection.

---

## Layering Note (Normative)

Interaction Boundary answers:

- which regions belong to the same interaction domain
- whether a sampled interaction is `inside`, `outside`, or `unknown`
- how higher-level consumers derive outside behavior

It does **not** answer:

- how native events are registered or dispatched
- whether a region participates in hit-testing
- what dismiss / modal / focus-trap policy a component chooses

In Proto UI terms:

- `event` describes **what happened**
- `hit participation` describes **whether something can be hit**
- `boundary` describes **which interaction domain the hit belongs to**
- `overlay / dismiss / modal / focus` consume the result

---

## 0. Scope & Non-goals

### 0.1 Scope (v0)

In v0, Interaction Boundary provides:

- setup-time acquisition of a boundary handle
- registration of multiple regions into the same boundary
- classification of a sampled interaction as:
  - `inside`
  - `outside`
  - `unknown`
- subscription hooks for boundary-derived outside interactions
- structural support for disjoint regions that do not form one DOM subtree

### 0.2 Non-goals (Explicitly Out of Scope for v0)

The following are **not** v0 goals:

- a public general-purpose overlay query API
- full modal policy definition
- scroll lock semantics
- interaction blocking semantics
- gesture abstraction
- prescribing one adapter implementation strategy

---

## 1. Terminology

- **Boundary** A logical interaction domain owned by one component instance or one coordinated capability.

- **Region** A host-resolvable interaction subject registered into a boundary.

- **Classification** The result of asking whether a sampled interaction belongs to a boundary.

- **Inside** The interaction is known to belong to at least one region of the boundary.

- **Outside** The interaction is known not to belong to any region of the boundary.

- **Unknown** The host cannot safely prove either `inside` or `outside`.

- **Outside-derived behavior** A higher-level consumer action such as dismiss, close, or focus-exit that is driven by boundary classification.

---

## 2. Core Semantics

### 2.1 Boundary Is Not the Component Tree

A boundary:

- **MUST NOT** be defined as "the component subtree"
- **MUST** support multiple regions
- **MUST** support regions that are structurally disjoint in the host tree

Examples:

- trigger + portaled overlay content
- anchor + floating content
- dialog trigger + dialog content

### 2.2 Classification Result Is Ternary

Boundary classification **MUST** produce one of:

- `inside`
- `outside`
- `unknown`

`unknown` is a first-class result, not an error and not a temporary placeholder.

### 2.3 `unknown` Must Be Preserved

If the host cannot safely classify an interaction:

- the boundary layer **MUST** return `unknown`
- adapters **MUST NOT** fabricate `outside`
- consumers **MUST NOT** silently coerce `unknown` to `outside`

`unknown` exists to preserve correctness across:

- portals / relocated hosts
- adapter-specific target indirection
- platform limitations
- incomplete host visibility

---

## 3. Region Registration

### 3.1 Multiple Regions

A boundary **MUST** allow multiple registered regions.

The minimum v0 expectation is that a consumer can treat several structural roles as one interaction domain, for example:

- `trigger`
- `anchor`
- `content`

### 3.2 Region Ownership

Region registration is a boundary concern, not an event concern.

This means:

- region registration **MUST NOT** be expressed as "hidden event listeners"
- boundary registration **MUST NOT** require consumer-authored `contains(...)` checks

### 3.3 Registration Lifecycle

Region registration:

- **MAY** occur during setup and/or later host-binding phases
- **MUST** be cleaned up automatically when the owning instance unmounts

The precise implementation mechanism is adapter-defined.

---

## 4. Observable Behavior

### 4.1 Classification API

The future boundary capability **MUST** expose a way to classify a sampled interaction against the current boundary.

The concrete API shape may vary, but its observable result must preserve:

- `inside`
- `outside`
- `unknown`

### 4.2 Observation API

`boundary.observe('pointer.press')` is a setup-only, idempotent request for a host pointer sample stream.

The layering is normative:

- Event owns host registration, routing, lifecycle gating, and callback-scope delivery
- Boundary owns region membership and the single `inside | outside | unknown` classification
- Overlay and component protocols consume Boundary notifications and choose dismiss policy

Observation does not turn region registration into a hidden listener. It requests samples for the boundary as a whole; registered regions remain pure interaction-domain membership.

### 4.3 Outside Subscription

The boundary capability **MUST** support subscription to outside-derived notifications.

Normative rule:

- any "outside" notification emitted by the boundary layer **MUST** be derived from boundary classification

This implies:

- components **MUST NOT** need to invent their own private outside-detection logic
- the same interaction should not be classified independently by multiple component-specific implementations

### 4.4 No Fake Outside via DOM Containment

Component protocols **MUST NOT** define outside behavior by ad-hoc DOM containment checks as their primary model.

This is especially important for:

- portaled content
- multi-root interactions
- cross-adapter routing

DOM containment may still exist as one adapter implementation detail, but it is not the contract.

---

## 5. Relationship to Other Systems

### 5.1 Relationship to Event

Boundary sits conceptually **before** event consumption.

Event is responsible for:

- registration
- dispatch
- callback delivery

Boundary is responsible for:

- interaction-domain ownership
- inside/outside/unknown classification

Therefore:

- boundary semantics **MUST NOT** be pushed into the event contract

### 5.2 Relationship to Hit Participation

Boundary and hit participation solve different problems:

- hit participation: "can this region participate in hit-testing?"
- boundary: "if an interaction was sampled, which domain does it belong to?"

They are related but independent capabilities.

### 5.3 Relationship to Overlay / Dismiss / Focus

Overlay, dismiss, and focus behaviors are consumers of boundary.

Examples:

- outside press close
- focus outside close
- top-most overlay outside handling

These behaviors **MUST NOT** redefine boundary semantics for themselves.

---

## 6. Weak Stack (v0 MVP)

v0 Boundary **MUST** support a weak "top-most boundary" coordination model for stacked consumers.

The minimum required downstream behavior is:

- one outside interaction **MUST NOT** accidentally close multiple stacked consumers
- when multiple stack-active consumers could classify the same sample as `outside`, only the top-most active boundary may emit outside-derived notification
- lower active boundaries **MUST** preserve correctness by surfacing `unknown` for that sample instead of fabricating their own `outside`

This v0 MVP does **NOT** require:

- a public general-purpose stack inspection API
- a full modal / blocking policy model
- hit participation semantics

---

## 7. Adapter Freedom and Constraints

Adapters may choose different implementation strategies for boundary classification.

They may use:

- native containment checks
- logical parent links
- portal ownership metadata
- host bridge services

But adapters **MUST** preserve the same observable guarantees:

- multi-region support
- no tree-only assumption
- `unknown` preservation
- cleanup on unmount

---

## 8. Authoring Guidance (Normative Direction)

Proto UI should expose Interaction Boundary through a small number of foundational capabilities, not through many special-purpose hooks.

The current foundational capability is:

- `asBoundary()`
- `boundary.observe('pointer.press')`
- `boundary.subscribeOutside(...)`

The following are **not** foundational boundary capabilities and should remain higher-level compositions:

- `asClickOutside(...)`
- `asDismiss(...)`
- `asModal(...)`

---

## 9. Summary

Interaction Boundary is the Proto UI capability that defines **interaction-domain ownership** independently from event routing, hit-testing, or policy.

Its key v0 requirements are:

- multiple regions
- non-tree-bound semantics
- ternary classification
- strict preservation of `unknown`
- outside behavior derived from one shared boundary source
