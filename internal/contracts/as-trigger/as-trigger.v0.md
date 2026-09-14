# as-trigger.v0.md

> Status: Draft - transitional projection
>
> Normative source: `spec/contracts/C-AS-TRIGGER-0001.yaml` and `spec/decisions/D-TRIGGER-GROUP-SURFACE-0001.yaml`.

## Positioning

`asTrigger()` is a core privileged asHook. It is not a general event helper and does not create a one-way proxy from one trigger instance to another.

Its narrow responsibility is to let directly and continuously nested trigger instances form one logical trigger group. The host supplies logical instance, parent, and prototype relations and projects the resulting domain-neutral group roles:

- members: every continuous trigger instance in the group;
- anchor: the outermost continuous member by default;
- surface: the innermost continuous member by default;
- semantic target: the current bindable target that carries the group's semantic activation registrations.

Every member retains its own behavior declarations. The anchor is a stable structural role rather than a physical hit range, and the surface does not absorb another member's `host:*` events.

## Invocation and host capabilities

`asTrigger()` is setup-only, installs once for the caller prototype, and records the canonical privileged trace identity `as-trigger`.

The host relation boundary is supplied through:

- `AS_TRIGGER_INSTANCE_CAP`;
- `AS_TRIGGER_PARENT_CAP`;
- `AS_TRIGGER_GET_PROTO_CAP`;
- `AS_TRIGGER_MERGE_GROUP_CAP`;
- `AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP`.

Logical instance and group identities are opaque and are not required to implement `EventTarget`. Group registrations must survive setup before a physical surface exists and migrate when the current surface view is attached, detached, or replaced.

## Merge rule

If the current trigger has a direct logical parent whose prototype also carries the trigger identity, both are members of one group. Merging continues through every directly continuous trigger ancestor.

The outermost member is the default anchor and the innermost member is the default interaction surface. A missing parent, missing prototype, non-trigger parent, or unprovable direct relation stops the merge; a standalone trigger forms a one-member group and is both anchor and surface.

A group must be a single continuous chain. Sibling Trigger branches under one Trigger are diagnosed and rejected before replacing the accepted chain, surface or route; registration order must not choose a winner. Separate Trigger groups under a non-Trigger parent remain valid. See `C-AS-TRIGGER-0001-L`.

## Event boundary

Semantic activation registrations from group members converge on the current surface target. One valid host activation sample is interpreted at most once for the group. `host:*` registrations remain bound to each member's own host root.

For Web pointer input, the physical hit origin must be the current surface root or its content. Hitting the extra host box of an anchor or another non-surface member is rejected rather than redirected into surface activation.

## Non-goals

`asTrigger()` does not itself define Focus, A11y, disabled arbitration, overlay, boundary, or hit-testing policy. The adapter publishes group roles; the corresponding domains consume them under their own contracts.

## Related spec entities

- `C-AS-TRIGGER-0001`
- `D-TRIGGER-GROUP-SURFACE-0001`
- `T-AS-TRIGGER-0001`
- `C-AS-HOOK-PRIVILEGED-0001`
- `C-EVENT-0001`

- `M-AS-TRIGGER-0001`
- `HC-TRIGGER-GROUP-0001`
- `T-AS-TRIGGER-0002`
