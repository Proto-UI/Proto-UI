# Context Contract Index

This directory is a readable legacy projection. Applicable `spec/**` entities take precedence; the Context catalog remains **draft**, not a stable release guarantee.

- [Context module](../../../spec/modules/M-CONTEXT-0001.yaml): author facade, privileged port, instance-owned resources and standard Runtime composition.
- [Identity capability](../../../spec/host-caps/HC-CONTEXT-IDENTITY-0001.yaml) and [ancestry capability](../../../spec/host-caps/HC-CONTEXT-ANCESTRY-0001.yaml): opaque owner identity and current logical parent facts.
- [Read authority](../../../spec/contracts/C-CONTEXT-0007.yaml), [update authority](../../../spec/contracts/C-CONTEXT-0008.yaml), and [lifetime](../../../spec/contracts/C-CONTEXT-0012.yaml).
- [Vertical evidence](../../../spec/tests/T-CONTEXT-0003.yaml): Module, Runtime, React, Vue 3, Vue 2 and Web Component scope journeys.

Context carries component-to-component values in the nearest self-inclusive provider scope. A subscribed consumer may update that scope; a provider may `update` its own value without subscription. Reads and `tryUpdate` retain their separate subscription requirements. Host ownership determines ancestry; DOM containment is not a universal rule.

`with-tree.v0.md` retains the readable topic layout and examples. `with-tree.v0.impl-notes.md` is non-normative implementation background. Connection-change notifications and compiler-stage extraction remain outside this slice.
