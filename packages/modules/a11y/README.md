# @proto.ui/module-a11y

Proto UI module that records accessibility semantic object IR for host projection.

Each logical A11y instance also owns an opaque semantic-object reference. Module-internal semantic owners can project ordered direct-reference relations without exposing protocol keys or host ids; the Web projector scopes target identity to each owner document, rebinds it across owner-document movement, fails closed when a referenced binding is missing or ambiguous, replays the current snapshot across projector replacement, re-resolves only dependent structured sources, and releases only its own id/IDREF contributions across view replacement and terminal disposal.

This lower-level transport does not implement the separate anatomy family/domain/role/key matcher or Tabs migration tracked by #549 and PR #553.

This package is intentionally not a Web ARIA wrapper. Adapters decide how to map the semantic object snapshot to their host accessibility surface.
