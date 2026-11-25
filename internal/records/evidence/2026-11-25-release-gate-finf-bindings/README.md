# Finf representative journeys follow their current public demos

The full CI run `45537881490` still searched for retired labels and root refs in the representative forms, modal, disclosure, and reservation journeys. Current recipes independently identify the intended controls. This correction uses an exact, unique `data-demo-id` for every case and the current accessible names for Form, Checkbox Group, Drawer, Popover, and Alert Dialog. The payload key remains `displayName`; the visible field label is `Display name`.

Alert Dialog readiness follows its single actual Trigger's `aria-haspopup` and `aria-controls` relationship, which exists while the content is closed. The controlled Accordion action is `Apply change`; refusal and subsequent owner acceptance remain asserted. Popover still follows its own trigger and named dialog, including native closing, reversal, reduced motion, settled capture, and the deliberate wrong-width/nonsettling controls.

The Brutalist runtime tab has an authored keyboard focus ring. The old no-visible-shadow assertion was incorrect for that focused state. The updated journey separately requires a shadow-free resting selected tab and the exact 2px ring with 2px background offset under real keyboard focus, normalized via an independent hidden CSS probe. The subject is never restyled or blurred to make this assertion pass. Other families retain their prior shadow check. Geometry, runtime events, selected count, native focus, replaced surface identity, and the original deadlines remain unchanged.

## Validation and limits

The four original non-browser suites passed **137/137** after their locator mocks followed the same protocol. The first candidate run, **122/137**, is preserved: its failures exposed obsolete mock locators, not native outcomes. The invalid-field negative controls and the capture-failure controls remain. The review record includes a separate agent's read-only examination of the demo identity, focus recipe, and closed Alert Dialog trigger relationship.

The official-only browser guard is unchanged. No local run fabricated `GITHUB_ACTIONS` or a candidate SHA. The 42 original browser cases still require their official workflow on the committed candidate; the unit result is not a native result.
