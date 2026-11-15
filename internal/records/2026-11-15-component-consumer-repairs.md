# Component consumer repairs: Label, Tooltip and Drawer

Date: 2026-11-15. Candidate baseline: `7d30a788f4bd79189cbe2dd499ded9ff22ba91e1`. This record describes an uncommitted development candidate for issues #1454, #1455 and #1456. It does not record independent acceptance, merge or release admission.

## Authority and bounded implementation

- Existing draft `C-CONTROL-LABEL-0001` supplies the typed `InstanceAssociations.controlLabel` channel, actual-label naming and guarded target-operation requests. Button, Toggle and ToggleGroup Item now join the existing five target families. Direct press and Label activation share the target operation; disabled, controlled value, focus and current-request checks retain their original owners. No label Prop or generic host-attribute forwarding is introduced.
- React reports undeclared host-looking inputs in development without forwarding them. Declared Prototype props, documented Adapter channels and a custom `getProps` mapping retain their behavior. Production bundling is tested without a Node `process` global. The new React diagnostic contract remains draft.
- Draft `P-BASE-TOOLTIP-TRIGGER` already requires additive description and preservation of target role, name and activation. The authored `useTooltipTrigger()` hook adds tooltip intent and description to an existing command on the same semantic node, borrowing its focus owner. It has no options or outward exposes. The standalone Trigger and `asTooltipTrigger` entry retain their own focusable behavior and public exposes.
- Draft Drawer extent and consumer contracts now use the existing four-edge AvailableLayout owner for left/right as well as top/bottom. Horizontal default maximum remains 20 root-text units. Explicit logical/available maxima, region resizing and drag projection share the same model. Vertical family defaults remain unchanged. The Root wrapper stays the compatibility default; documented opt-in `display: contents` prevents an empty grid row when a consumer needs a layout-neutral Root.

## Evidence

All local commands used Node v24.22.1 and Corepack pnpm 10.32.1. Browser evidence used the remote normal-user environment, Node v24.21.0, system Chrome and Playwright `chromiumSandbox: true`; no sandbox policy was disabled.

| Evidence | Result and scope |
| --- | --- |
| Initial Label and horizontal Drawer regression | 9 failed / 24 passed of 33. The new targets lacked declarations and six horizontal cases lacked shared geometry. |
| Initial naive Tooltip hook composition | Failed with duplicate `Expose.disabled`; this prevented documenting a nested or conflicting focus owner as the repair. |
| Final affected runtime selection | 18 suites / 211 tests passed. Includes React association reentry, diagnostics and production bundle, Base Button/Toggle, Base/Brutalist Tooltip, group lifecycle, Drawer model, all-five-family gesture geometry, admission and structure. |
| Native component consumers | 18 / 18 passed: React and Web Component, Base/Shadcn/Brutalist, three issue families. Real Tab/Shift-Tab, Enter, Escape, pointer activation, accessible names/descriptions, controlled refusal, disabled ownership, Drawer geometry/drag/resize and grid layout. |
| Runtime suite discovery and CI inventory | 125 / 125 passed. New native suite is registered once in `BROWSER_SUITES`; it is not a manual-only fixture. |
| Prototype catalog | Passed: 997 declaration files, 1385 static author entries, 462 P entities and seven bounded map checks. |
| Affected TypeScript graph | Passed with a focused config including production owners, new unit tests, typed public composition and native fixture/suite. Full workspace type checking was separately killed with exit 137 by the local resource limit; this is not a full workspace pass. |
| Spec lifecycle authoring | Passed against the recorded baseline. All additions remain draft; bounded native implementation entries remain active with explicit coverage limits. |

The first broad 19-suite run contained 14 failures: 11 obsolete Drawer hardcoded-token assertions, one new production-bundle fixture path error, and two pre-existing Shadcn Tooltip animation-token assertions. Drawer assertions now inspect CSSOM geometry while retaining width, edge and scroll/Close checks; the bundle fixture now resolves its actual file path. The two Shadcn assertions were independently reproduced on the original Tooltip source and are owned by the integration/CI repair. They were omitted, explicitly, from the final 18-suite selection rather than reported as passing.

Native evidence was captured at 1200×800 and the drawer additionally at 600×800. The suite uses actual prototypes, adapters and collected styles through a standalone esbuild fixture. It is functional/accessibility/geometry evidence, not a fully themed family visual acceptance, assistive-technology pass or complete Web/Vue/Vue2/native-platform admission. The captured Shadcn React Drawer was inspected: the right edge, default width and header/main layout were coherent. The other captures were produced for review; this record does not claim a visual review of every capture.

## Deliberate integration blocker and patch boundaries

ControlLabel target support is kept as a separate patch. It adds a real association atom to Button even when a particular instance has no association. Independent compiler review found that the existing `react-dom-source-v1` strategy now rejects this previously compiled Button path with `PUI1003`. The runtime semantics are valid, but this is a new compilation regression and a merge blocker for the combined candidate until the compiler can preserve the bounded association contract or an independently governed compatible solution is supplied. A no-op lowering, ABI disguise or component-name special case would not satisfy the contract.

There is no existing external opt-in hook that can safely reuse Button's private activation operation: directly emitting its outward click signal would bypass the target-operation and lifetime contract. This candidate does not add another opt-in API to conceal the compiler gap.

The second patch contains Tooltip, Drawer, React diagnostics and shared consumer/type evidence. Its combined native suite tests the Label targets from the first patch; the two patches together form the validated candidate. The parent integration owner is responsible for final source binding, full integration evidence, independent review and publication. No commits, issue comments, PR creation or uploaded evidence are performed by this implementation workstream.
