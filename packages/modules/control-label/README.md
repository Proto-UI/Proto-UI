# Control Label

Draft portable association owner for independent labels and opt-in controls.

The App Maker supplies a factory-branded ControlLabelRef through the typed InstanceAssociations input, outside JSON Props. Label naming and activation are independent. Pairing requires exactly one live participant of each kind plus one host accessibility tree scope; missing or duplicate participants fail closed. Targets retain their existing disabled, controlled value, focus and outward event logic.

The Web provider uses disposable current-view leases and pointer and trusted non-pointer intent interpretation. Eligible click intent is synchronous to preserve the originating user-activation turn. Cancellation is checked at the host listener; a later listener cannot roll back a committed operation. This is a bounded custom intent, not a native HTML label default-action implementation. Shared tree-scope observers cover shadow-tree detachment without one full-document observer per participant. It never queries for a nearby control, dispatches synthetic clicks, clears selection or stores DOM objects in portable state. Existing A11y owns semantic identity and derived IDREF projection. Unsupported host capabilities remain diagnostic.

See C-CONTROL-LABEL-0001, M-CONTROL-LABEL-0001, HC-CONTROL-LABEL-0001 and T-CONTROL-LABEL-0001. Current tests distinguish owner and synthetic Adapter fixtures from still-pending native-browser/assistive-technology admission. Private-source design families are not automatically published packages.

The Module passes initial activation and current-lease setActivation updates to each host. Native hosts can project an enabled action on the same visible text node; passive naming-only labels have no such action. Neither text styling nor select-none is an authority for activation. Old cleanup cannot revoke a reentrantly installed newer association.
