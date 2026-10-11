# Form completion snapshot and synchronous callbacks (draft)

Status: draft, uncataloged prototype slice. This defines the portable Form owner boundary; it does not activate a stable guarantee or require Compiler/IR implementation changes.

Form owns each submission attempt and its enabled named Field snapshots. Field owns canonical values and validation. A successful completion emits the values from the same snapshot whose current validation results were accepted, with that attempt's submission ID. It must not reread values after publishing pending/submitted/context notifications. A synchronous observer may edit a field; that edit remains the current value, but cannot replace the already validated event payload.

Notifications may also cancel/reset/disable the Form, detach its view, or start another submission. Those actions retire the older completion's authority: after each callback boundary the old completion must stop before further state/context/event publication. A nested submission remains legal and owns its own ID and validation; this rule does not introduce a global prohibition on reentry. Ordinary completion does not itself cancel a newer submission created by a notification.

Acceptance: observe pending=false and submitted=true with value edits; observe pending=false with cancel, reset, disable, and a newer submission; verify old payloads never gain unvalidated values and retired attempts never emit. Validation errors must continue to propagate.

Related definitions: C-STATE-0006 (draft synchronous state observation), C-ANATOMY-0005 / C-ANATOMY-0009 (draft domain and exposed-call scope), and C-LIFECYCLE-0008 (active repeatable view/terminal instance lifetime).
