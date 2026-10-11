# Label public-page drag selection uses rendered text lines

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Bound source and observed failure

The bounded #872 repair starts at `63a8d4240d8dfc2a36f8cbab367e8a9c43f41fd7`, tree `2feebcf1159b9bf4c8dfc4edf64ef7ce587cc93b`. [Homepage run 37801215870](https://github.com/Proto-UI/Proto-UI/actions/runs/37801215870), capture job `113393634654`, checks out that exact head. Its candidate capture is 20/20; the focused tests are 28 passed / 4 failed. These are separate results.

All four reported Label failures first occur at runtime `wc`: Shadcn, Brutalist, Bootstrap 2.3.2 and Liquid Glass select zero characters at the original `> 5` assertion. The loop stops at that failure, so these logs do not prove four failing adapters per family. Base reaches all four adapters and has actual selected-text screenshots.

The original `[label-selection]` diagnostics locate Shadcn's description block at `(352,562.5)`, size `576×52`. Its text line rectangles are `(352,565.5,566.4375,19)` and `(352,591.5,219.734375,19)`. The old horizontal drag uses `y=588.5`, outside both text lines. The other three failing families have the same dimensions with block `y=608.5`, text lines at `611.5` and `637.5`, and old drag `y=634.5`, again between them. Both hit tests identify the description DIV; every reported ancestor has `user-select:auto`. The final active element is BODY.

The original comprehensive artifact `11561991290` is bound to that head/run; ZIP SHA-256 `937b065d3efb973e9c856fd2621683a1b2e5adbeb624859154360dcf568686d6` matches GitHub's digest. The actual `runtime/control-label/label-*-failure.png` images show the wrapped descriptions, and `label-base-wc.png` shows selected text. These original images are failure/control evidence, never new-candidate screenshots.

This establishes a driver geometry defect. The old trace does not include pointer-phase selection/default-cancellation observations, and does not establish that a corrected native drag succeeds or that no product defect exists.

## Authority and bounded correction

Draft `C-CONTROL-LABEL-0001-INPUT/-CONTENT`, `HC-CONTROL-LABEL-0001-INPUT`, and `P-BASE-LABEL-ACTION/-CONTENT` require passive copyable content, rejection of dragged activation, and no blanket pointer cancellation/Selection clearing. `P-BASE-TEXT-PASSIVE` independently keeps Text free of focus/action ownership. The observed long description is an authored box, not a Label or Text prototype; it remains independent content. `T-CONTROL-LABEL-0001` still marks real native evidence planned. No lifecycle admission is changed.

`measureLabelTextDrag` reads only real text-node Range rectangles and picks points inside one visible line. It never writes the document Selection, host styles, focus or component state. The existing public documentation, real prototypes, five families, four-adapter loop, `> 5` threshold, 20 mouse-move steps and 180-second test timeout remain. No separate demo page or product-layer workaround is introduced.

The same real page now tests both its naming-only Label and independent description. Each drag records pointer-down, moved-before-release and after-release observations, plus bounded passive pointer/mouse/selectstart/selectionchange event facts. JSON includes actual glyph geometry, point hit tests, defaultPrevented, trusted input facts, Selection, active element and control states. Native acceptance requires selection longer than five characters both before and after release, identical text after release, both endpoints within the dragged subject, unchanged controls, and a subsequent ordinary Label click plus Space using the existing target focus/value owner. This supplements the pre-existing input/textarea, disabled, controlled, switch/radio, naming and keyboard checks.

Every successful subject has an actual selected-text PNG; every attempted drag retains JSON, including failure. The existing official artifact directory owns these files. Failure logs retain the same `[label-selection]` prefix.

## Local evidence and outstanding acceptance

Four injected geometry replays retain the old centerline negative: 2 pre-existing checks pass and 4 new point-in-text checks fail. With text-line coordinates, the helper/provenance checks pass. Geometry replay is not native input or rendering evidence. Serialization tests execute helper function source in a clean VM and check retained DOM/Selection/focus plus listener retirement; an initial callback serialization error was found and corrected before delivery.

Focused host, family-projection and all four Adapter integration tests use the existing happy-dom harness. They test operation/default/lifetime ownership, not native Selection or assistive technology. A first optional Vue 2 integration attempt could not resolve its workspace `vue` dependency; restoring the existing workspace dependency link permits the same test without source changes.

No local Chrome, build, full suite, remote write or CI rerun is part of this increment. Independent review and official successor CI must still establish the exact integrated head's native public-page journeys, Selection traces and screenshots. If the glyph-targeted drag remains empty or is cleared on release, the retained stages should distinguish hit geometry from product input/default-action ownership before any further repair.
