# Draft shared Shadcn style scope

This is selection transport, not a declaration that every component supports all styles.

`styleScope` provides a shared family Context through the existing core API. Its `styleProfile` accepts `vega`, `nova`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`, `new-york-v4`, or `inherit`. `new-york` is a compatibility alias. Omission defaults only to `inherit`, never a concrete choice that would mask a parent scope.

A family prototype calls `setupShadcnStyleSelection(def, itsCompatibilityStyle)` once during setup and uses the returned derived State in existing `def.rule` conditions. Explicit consumer choice wins, then nearest scope, then the consumer's existing baseline. Composite scopes use `setupShadcnStyleScope`, whose ancestor subscription deliberately excludes its own provider. No per-page prop chain, new behavior IR, DOM class reading or global theme store is involved.

The scope's null inherited value means no concrete selection is available. It does not redefine heterogeneous existing component defaults as New York. Consumers must declare their supported mappings; merely accepting a style ID must never be advertised as visual parity or silently mapped to another style.

The current fixture composes a real `asTabsTrigger()` consumer with only Nova/Rhea source-bound radius contributions and a test-only compatibility radius. Tests preserve actual selected value, selected/value handle identities, host nodes and focus while contributions withdraw. Production Button, Dropdown, Tabs, Select, Input, Textarea, Switch and search-family consumers are follow-up work, not completed by this carrier.

Context subscribes and cleans up through the existing module lifecycle. Creation, mount and actual update callbacks re-read current ancestry. A callback does not create a missing notification: arbitrary live reparent, provider removal without update, or alive-view detach/remount remain explicitly unaccepted until host/lifecycle evidence exists. Portals must inherit logical owner scope rather than their physical destination; this slice makes no new native portal claim.

Source membership and bounded canary values depend on the source manifest introduced by PR #929, pinned to shadcn-ui/ui `3d98900e9b73c45f035f8109e9d41ba6a51685e7`. New York remains separate legacy. See draft `P-SHADCN-STYLE-SCOPE` and `T-SHADCN-STYLE-SCOPE-0001` for acceptance limits.
