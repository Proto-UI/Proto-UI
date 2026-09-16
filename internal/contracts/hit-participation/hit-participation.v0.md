# Hit Participation Contract (v0)

> **Status**: Draft - implementation-ready (contract-first)  
> **Version**: v0
>
> This document defines the Proto UI **Hit Participation** contract: the semantics of whether a region participates in hit-testing, when passthrough is allowed, and how this capability stays separate from event delivery and boundary classification.
>
> Normative source: draft `C-HIT-PARTICIPATION-0001`, `M-HIT-PARTICIPATION-0001` and `HC-HIT-PARTICIPATION-0001`. This document is a transitional projection.

---

## Layering Note (Normative)

Hit Participation answers:

- whether a region participates in hit-testing
- whether interaction should pass through that region

It does **not** answer:

- which interaction domain owns the hit
- what event callbacks run
- what dismiss or modal policy should be applied

In the intended ordering:

```text
Hit Participation -> Boundary -> Event -> Overlay / Dismiss / Focus consumers
```

---

## 0. Scope & Non-goals

### 0.1 Scope (v0)

In v0, Hit Participation provides:

- a way to declare whether a region participates in hit-testing
- a way to declare passthrough behavior
- a capability that exists independently from feedback/style and independently from event listeners

### 0.2 Non-goals (Explicitly Out of Scope for v0)

The following are **not** v0 goals:

- a full interaction blocking system
- gesture-specific hit categories
- modal policy definition
- a guarantee that all platforms implement identical native mechanics
- replacing platform CSS or host primitives one-to-one

---

## 1. Terminology

- **Hit Participation** Whether a region is eligible to become part of the host hit-testing path.

- **Passthrough** A declaration that the region should not retain the hit for itself and should allow interaction to continue through to what is behind it.

- **Blocking** A stronger behavior that prevents interaction from reaching lower layers.

Blocking is out of scope for v0.

---

## 2. Core Semantics

### 2.1 Happens Before Event Consumption

Hit Participation is conceptually earlier than event dispatch.

Therefore:

- it **MUST NOT** be modeled as just another event handler
- it **MUST NOT** require component authors to simulate it using callback-time cancellation

### 2.2 Independent from Boundary

Hit Participation and Boundary are separate capabilities.

They solve different questions:

- hit participation: "is this region part of the hit path?"
- boundary: "which interaction domain does the sampled interaction belong to?"

A correct design **MUST NOT** collapse these into one API.

### 2.3 Independent from Feedback / Style

Hit Participation may be implemented using host styling mechanisms, but the contract itself is **not** a feedback/style concern.

This means:

- the capability **MUST NOT** be defined as "just set CSS"
- adapters may use style as one implementation strategy
- observable semantics remain the contract, not the implementation trick

---

## 3. v0 Capability Surface

### 3.1 Minimum States

v0 should support at least:

- participating
- not participating
- passthrough

The exact API names may change, but the semantics must remain observable.

### 3.2 Passthrough Is Not Outside

Passthrough **MUST NOT** be interpreted as:

- outside classification
- dismiss intent
- close intent

Passthrough only affects hit eligibility / propagation at the hit-participation layer.

### 3.3 No Hidden Policy Semantics

Declaring hit participation:

- **MUST NOT** automatically imply modal behavior
- **MUST NOT** automatically imply overlay dismissal
- **MUST NOT** automatically imply focus management

Those remain higher-level consumer decisions.

---

## 4. Relationship to Other Systems

### 4.1 Relationship to Event

Event deals with listener registration and callback delivery.

Hit Participation deals with whether something can be hit in the first place.

Therefore:

- event contract **MUST NOT** absorb hit-participation semantics

### 4.2 Relationship to Boundary

If a region does not participate in hit-testing, the resulting sampled interaction may fall through to another region or another domain.

Boundary then classifies the sampled interaction that actually occurred.

This is why passthrough must not be rewritten as boundary `outside`.

### 4.3 Relationship to Overlay / Mask / Decorative Layers

Hit Participation is especially important for:

- masks that should receive interaction
- masks that should allow passthrough
- decorative wrappers that should not become interaction owners
- transparent overlay layers

These are capability consumers, not part of the base hit contract itself.

---

## 5. Adapter Freedom and Constraints

Adapters may implement hit participation using different platform-native mechanics.

They may use:

- CSS-like pointer policies
- native host flags
- target filtering bridges
- platform-specific hit-testing primitives

But adapters **MUST** preserve the observable distinction between:

- participating
- not participating
- passthrough

Adapters **MUST NOT** claim stronger semantics than the host can guarantee.

---

## 6. Authoring Guidance (Normative Direction)

Proto UI should expose Hit Participation through a small number of foundational capabilities.

The intended direction is:

- `asHitParticipation(...)`

The following should remain higher-level compositions instead of foundational primitives:

- `asBlockOutside(...)`
- `asClickThroughMask(...)`
- `asModalBlock(...)`

---

## 7. Summary

Hit Participation is the Proto UI capability that answers whether a region **participates in hit-testing** and whether it allows **passthrough**.

Its key v0 requirements are:

- it happens before event consumption
- it is independent from boundary
- it is independent from feedback/style
- passthrough is not equivalent to outside or dismiss
- stronger blocking semantics are intentionally deferred

## Shared target ownership

Distinct owners may share a target with the same effective mode. Different modes are diagnosed and rejected before changing any existing claim or projection; `disabled` and `passthrough` remain distinct despite their Web projection. Releasing one owner preserves the others. The last owner restores the original host declaration. Rejected region registration or removal leaves the previous Module state intact and may be retried after the conflict is resolved.
