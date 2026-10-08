# Bounded interaction design reference

Design reference adapted from draft interaction rules, not a stable or complete specification. Only the standalone Web task is covered. No internal ownership, library API, controlled-state, dynamic fallback, signal-count, materialization-default, or cross-adapter guarantee is asserted. Reciprocal retained-panel relationships and cleanup are explicit task requirements; this reference does not establish full accessibility or screen-reader conformance.

All claims are task-scoped draft design guidance. Native disabled tabs need not receive focus. Manual activation, retained panels, live UI settings, explicit horizontal orientation, stable identities, and the removal/After flow are fixed by this task rather than promised general defaults.

### C01

Maintain one selected tab and one visible panel in the four-tab reference; initially Overview is selected. Selection and focused navigation are distinct.

### C02

Interpret Left/Right in Horizontal and Up/Down in Vertical; the other axis does not navigate tabs. Live Orientation changes update explicit aria-orientation without resetting selection or tab/panel identities.

### C03

Wrap navigation defaults to false: clamp focus at eligible endpoints. When true, wrap between them. Both modes skip disabled tabs in both directions. Home/End focus the first/last enabled tabs in either orientation and wrap mode; retain one enabled roving tab stop.

### C04

Keep manual activation: arrow, Home, and End focus movement do not change the selected tab or visible panel; activation is a separate commit.

### C05

Enabled pointer, Enter, and Space activation select the target tab. Prevent Space keydown default actions such as scrolling. Repeating selection is stable, with no duplicate elements, deselection, visibility drift, or identity changes.

### C06

Disabled Unavailable suppresses pointer and keyboard selection, stays out of roving navigation and sequential Tab order, and cannot alter the selected panel. If focusable by the host, its activation and arrow keys do not move roving focus.

### C07

Preserve the named tablist, tab and tabpanel roles, tab selected states, and disabled semantics. Retain all four panels and their unique stable IDs. Each tab controls its own panel, reciprocally labelled by that tab; only the selected panel is visible.

### C08

Remove reference removes all reference tabs, panels, and their interaction behavior; surviving settings are inert and do not recreate the reference or throw. After remains keyboard reachable by restored focus or Tab from the surviving removal control. This cleanup requirement is task-owned, not a general teardown guarantee.
