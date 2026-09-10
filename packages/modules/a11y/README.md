# @proto.ui/module-a11y

Proto UI module that records accessibility semantic object IR for host projection.

Each logical A11y instance also owns an opaque semantic-object reference. Module-internal semantic owners can project ordered direct-reference relations without exposing protocol keys or host ids; the Web projector scopes target identity to each owner document, rebinds it across owner-document movement, fails closed when a referenced binding is missing or ambiguous, replays the current snapshot across projector replacement, re-resolves only dependent structured sources, and releases only its own id/IDREF contributions across view replacement and terminal disposal.

Web scalar cleanup restores the host baseline after the last matching contribution is released and preserves later host-authored changes. Heading clear, detach and disposal use the same ownership ledger, so releasing one view does not remove a matching host or live shared `aria-level`; rematerialization projects current facts onto the new target.

This lower-level transport does not implement the separate anatomy family/domain/role/key matcher or Tabs migration tracked by #549 and PR #553.

This package is intentionally not a Web ARIA wrapper. Adapters decide how to map the semantic object snapshot to their host accessibility surface.

Prototype authors obtain an `AccessibleHandle` through `asAccessible()` from `@proto.ui/hooks`. The module retains the instance-scoped semantic IR and setup guards; State owns dynamic facts and the host capability owns projection. In 0.3, `def.a11y` and `A11yDefAPI` are removed without aliases.
