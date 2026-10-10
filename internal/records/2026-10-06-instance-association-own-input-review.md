# Explicit association input and WC retained-parent review

Date: 2026-10-06. Source: Finf [#872](https://github.com/Proto-UI/Proto-UI/pull/872), commit `fc5effc99779aca637acaa06789937cef1414cf1`.

## Confirmed association validator defect

[Review r4200497373](https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4200497373) identified two ways that input could cross the existing explicit-association boundary: an inherited `controlLabel` value was read as authored input, and an unsupported non-enumerable own string key escaped `Object.keys` validation. Paired controls reproduce both. The same inherited-reference problem also affects the empty snapshot previously returned for omitted input.

The correction checks all own string keys while retaining the existing symbol-key rejection. It reads `controlLabel` only when that property belongs to the input itself. Omitted input now normalizes to an own `controlLabel: null` field, the same empty association value as an explicit empty input. This small output-shape change prevents a consumer from reading an inherited reference from the normalized snapshot; it does not create an association.

An explicitly owned non-enumerable `controlLabel` remains valid when it contains the genuine public factory reference. Unsupported hidden fields remain errors, and an exception from an explicit own getter retains its original identity. Opaque references still fail JSON Props validation and serialization. No callback, raw host reference or new association family is admitted.

Authority: the draft `C-CONTROL-LABEL-0001-IDENTITY` and `-LOWERING` direction governs the separate association input. Active `C-PROPS-0003` and `C-PROPS-0008` still govern JSON Props; this correction adds no exception to them.

## Retained-parent claim was not reproduced through the WC L1 path

[Review r4200497384](https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4200497384) assumes that hiding a previous parent's view makes `getLogicalRoot(previousParent)` null while its logical domain stays valid. In the current Web Component Adapter, L1 `setPresent(false)` detaches the internal view but retains the custom-element root and its logical token. `unbindProtoInstance` occurs in terminal `retireOwner` cleanup, not ordinary L1 view hiding.

Three controls use actual custom elements and their existing owner lifecycle. A real Anatomy subscriber rejects moving a second item into a destination that already owns one item. With the previous parent either visible or L1-hidden, the original code preserves the child's token, original Context value, accepted Anatomy membership and the exact subscriber error. A permitted move from an L1-hidden parent adopts the new Context and domain without replacing the child's token. The subscriber explicitly enforces its placement constraint; an Anatomy cardinality diagnostic alone is not represented as an automatic exception.

No WC production change is made for this claim. A manually unbound marker or a terminally retired parent is a different boundary and is not presented as a reproduced L1 failure. These controls do not prove all possible host integrations or retirement interleavings safe. The draft `C-LIFECYCLE-0006`, `C-CONTEXT-0004` and `C-ANATOMY-0005` boundaries remain unchanged.

## Evidence

- Original source, valid paired controls: **3 failed, 17 passed** across the Core validator and two rejected-adoption controls. All three failures belong to the association validator; both supported WC rejection paths already pass.
- The original paired test setup was corrected to declare the required optional Context subscription, use an actual rejecting Anatomy subscriber, and avoid assuming an order for the unordered `parts` query. Setup mistakes are not counted as product defects.
- Corrected candidate plus Core, Control Label, four Web Adapter Label, WC Context/Anatomy/L1 and Adapter-base instance-tree regressions: **14 files, 129 passed**, including the additional valid-adoption control. A missing existing Vue dependency link prevented one initial suite from loading; restoring that local link allowed the full stated run, without adding dependencies.
- Workspace types passed after restoring the existing workspace-app dependency link. GPUI Label peer/transport controls and catalog evidence integrity: **3 files, 24 passed**. The catalog's first path check ran before the new test was indexed and failed; adding the actual test to the candidate index resolved that check. No native browser, assistive-technology, GPUI native host, package-size or complete Finf acceptance claim follows from these source tests.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
