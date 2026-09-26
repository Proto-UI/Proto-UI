# @proto.ui/module-a11y

Proto UI module that records accessibility semantic object IR for host projection.

Each logical A11y instance also owns an opaque semantic-object reference. Module-internal semantic owners can project ordered direct-reference relations without exposing protocol keys or host ids; the Web projector scopes target identity to each owner document, rebinds it across owner-document movement, fails closed when a referenced binding is missing or ambiguous, replays the current snapshot across projector replacement, re-resolves only dependent structured sources, and releases only its own id/IDREF contributions across view replacement and terminal disposal.

Web scalar cleanup restores the host baseline after the last matching contribution is released and preserves later host-authored changes. Heading clear, detach and disposal use the same ownership ledger, so releasing one view does not remove a matching host or live shared `aria-level`; rematerialization projects current facts onto the new target.

An explicit id replaces generated-ID ownership on its physical target before scalar baseline capture, including when another record in the same registry generated the id. Terminal cleanup therefore does not restore the retired generated id as host data; an identically spelled host-authored baseline remains preserved.

Changes to a shared explicit-id contribution re-resolve surviving generated-reference dependents against the current binding and reservation. This includes writer updates and a detached writer's terminal disposal; generated identity is not retained as a host baseline.

Same-domain part relationships add an A11y-owned matcher over Anatomy facts. Declare the current part's protocol key and the counterpart role during setup:

```ts
const accessible = asAccessible();
def.anatomy.claim(family, { role: 'trigger' });
const value = def.state.string('value', 'account');
accessible.part(family, { key: value });
accessible.relation('controls', {
  target: { kind: 'part', family, role: 'content', key: value },
});
```

The Content declares its own part key and a reciprocal `labelledBy` target with role `trigger`. Each instance must already claim its role in the same Anatomy family. The `key` can be a string or State; matching uses exact equality, so `a+b` and `a b` remain distinct. A11y supplies the opaque domain, logical identity and view epochs internally. Authors receive no registry, host target or generated ID. A missing key, missing counterpart, duplicate counterpart or unavailable endpoint leaves the relationship unprojected. Internal diagnostics retain the current failure rather than accumulating a log.

Part relationships append their owned IDREF tokens and reject `mode: 'replace'`. An identical token already supplied by the host or another owner survives lease release. Either endpoint's L1 detach withdraws the relationship before host removal while retaining its logical reservation. Rematerialization transfers that reservation only after the successor has a physical binding. Same-epoch target notifications synchronously rebind ownership, and Web ID observation rechecks live authored IDs and collisions before the next paint. A conflicting authored ID is preserved; generated IDs restore each view's exact previous value only if that value is still owned.

Base Tabs uses this service for reciprocal Trigger/Content relations; it no longer creates IDs by escaping `value` or carries a root ID through Context. Selection, roving focus and presence remain with their existing owners. The dedicated [part relationship contract](../../../spec/contracts/C-A11Y-PART-RELATIONSHIP-0001.yaml) and [test map](../../../spec/tests/T-A11Y-PART-RELATIONSHIP-0001.yaml) remain draft; the implementation does not imply stable admission or complete accessibility certification.

This package is intentionally not a Web ARIA wrapper. Adapters decide how to map the semantic object snapshot to their host accessibility surface.

Prototype authors obtain an `AccessibleHandle` through `asAccessible()` from `@proto.ui/hooks`. The module retains the instance-scoped semantic IR and setup guards; State owns dynamic facts and the host capability owns projection. In 0.3, `def.a11y` and `A11yDefAPI` are removed without aliases.
