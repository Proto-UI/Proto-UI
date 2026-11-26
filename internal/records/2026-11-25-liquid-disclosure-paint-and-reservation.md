# Liquid disclosure paint and reservation repair — 2026-11-25

This record documents a bounded 0.3 CI repair for Liquid Glass Collapsible and Accordion, plus the real application fixture used by their hover acceptance suite. It does not promote any draft contract or claim Apple, GPUI, release or full-family optical acceptance.

## Source and authority

The shared candidate starts at `124e329cfc3cd710c1f1d267d640f1b97ef2f4c9`. The eight changed source/test files and their SHA-256 digests are recorded in the companion `receipts.json`.

The applicable draft definitions are:

- `P-LIQUID-GLASS-COLLAPSIBLE-TRIGGER`, especially material intent and command interaction.
- `P-LIQUID-GLASS-ACCORDION-TRIGGER`, especially inherited semantics, material eligibility and command interaction.
- `C-LIQUID-GLASS-COMMAND-INTERACTION-0001`: hover is independent of persistent state and focus; disabled and collapse-blocked controls retain readable same-state opaque fallback and their existing semantics.
- `C-MATERIAL-PAINT-RESERVATION-0001` and `C-MATERIAL-PAINT-FOOTPRINT-0001`: consumer padding is not a reservation extent, and genuine overlapping output must still force safe fallback.

Base remains the sole owner of activation, expansion, disabled state, focus and cancellation. The repair changes family paint and test-application composition only. No Host source, geometry, preference, input or lifetime guard is relaxed.

## Observed failures and repairs

### Collapsible opaque fallback

The original native trace captured a transition to `opaque-fallback` while the computed background was still transparent. The family declared `transition-colors`, so the prior optical background interpolated toward the mandatory opaque fallback. Merely waiting for that transition would hide a bad published fallback frame.

The family now uses `transition-none`. Its original shadow was immediate, so this preserves that behavior while making fallback colors immediate. The native diagnostic samples the preference transition frame by frame and requires alpha 255 on every fallback frame. Contrast, original geometry and input behavior remain asserted.

### Accordion reservation

The application fixture placed its 40px inset inside Heading's dedicated reservation. Its measured reservation part was 414 by 130 while the Trigger was 334 by 50, producing the legitimate `paint-reservation-part-not-exact` rejection.

The same application inset now wraps Heading, whose reservation contains its sole Trigger. This keeps consumer padding outside the dedicated extent and leaves the reservation implementation unchanged.

The tight negative fixture already had a visible portal destination. Reservation added real clearance, so ordinary document flow no longer placed that destination 1px below the target. The fixture now positions that existing output from measured target and scene geometry. A ResizeObserver updates only changed destination coordinates and is disposed with the fixture. It does not change target styles, source admission facts or material budgets. The negative still requires the original `source-overlapping-content` reason, an exact 1px gap and a positive gap smaller than the paint outset.

### Expanded and focus-visible paint

The original collapse-blocked fixture is necessarily expanded. Its 1px inset ring was persistent expanded feedback: the captured 32 baseline frames showed identical paint through native hover, down, up, leave and blur. An assertion requiring no ring in that same state had confused persistent and interactive feedback.

A separate real defect remained: the expanded rule also wrote ring color and inset during keyboard focus. The independent 2px focus width could survive while its intended color and placement were overridden.

The repair retains expanded font weight. Expanded ring rules run only while `focusVisible` is false; the existing `COMMAND_FOCUS` recipe owns the complete visible focus paint. Blur restores the same expanded ring. No new focus owner or input callback is introduced.

The official browser case now compares native hover, press, release and blur with the actual same-state expanded baseline. It still requires a 2px focus ring and additionally checks the actual theme ring color and absence of the expanded inset. A read-only requestAnimationFrame observer checks every sampled frame; it never writes DOM, style or application state. The original geometry, opacity, background, foreground, request refusal, ARIA and eligibility checks remain.

## Preserved evidence

The companion directory is `internal/records/evidence/2026-11-25-liquid-disclosure-paint-and-reservation/`. JSON and runner sources are gzip-compressed without changing their decompressed bytes; receipts include raw and stored hashes.

| Evidence | Result and scope |
| --- | --- |
| Official job `138949906827`, run `45537881490` | Original Actions failure log, preserved unchanged. It includes other parent-owned Liquid failures and is not relabeled as a local failure. |
| `liquid-hover-paint-before.json` | Real route baseline with source hashes: transparent fallback transition, invalid ordinary reservation and no-longer-tight negative geometry. |
| `liquid-blocked-ring-before.json` | React/light persistent-ring and focus-conflict trace, 32 frames. It has no independent input map; it was taken against the same frozen baseline server and is not represented as a separately source-bound matrix. |
| `liquid-disclosure-owned-candidate.json` | 32/32: four runtimes, two themes, Collapsible, ordinary Accordion, blocked Accordion and tight negative. Browser page errors: none. Duration 45.627 seconds. |
| `liquid-blocked-frame-audit-candidate.json` | 8/8: four runtimes and two themes; 233 paint frames, native interaction and blur restoration; browser page errors: none. Duration 23.615 seconds. |
| Eight `*-focus.png` images | Real focus paint with surrounding context. WC light and dark images were visually reviewed: legible label and continuous visible blue outer ring, with no expanded inset substituted for focus. |

Both successful native diagnostics ran Chromium 156.0.8078.79 against the existing loopback application server on port 4347, with `PROTO_UI_BROWSER_TEST=1`. The remote Git base was `5f0844907895a4ae0db506fe6a5d0bf162318329` with explicit source overlays; each report records relevant input hashes. Those hashes match this candidate's affected production/fixture/browser files. This is focused dirty-tree evidence, not a clean integrated 124e or official Actions acceptance result.

Two intermediate diagnostic failures remain archived:

- `liquid-disclosure-candidate.json`: 0/32 because the tsx transformation injected an unavailable `__name` helper into a Playwright-serialized function. This is a runner failure, not evidence of a product violation.
- `liquid-disclosure-serialized-candidate.json`: 24/32; the independent runner initially sent disabled state to Accordion Trigger instead of its real Item owner. Correcting that runner input produced the final 32/32. The erroneous input is not attributed to the component.

The final runners are included. Their bundled browser callbacks use esbuild `keepNames:false` to avoid the serialization defect.

## Recovered portable evidence

A transient local execution-container reset removed the old temporary checkout and unit logs. The eight source files, all native JSON, runner sources and eight images survived remotely and were restored byte for byte. The original remote archive has SHA-256 `992cfab0f702f46cc185c7841f5ac270ae9b65722b21863526579ec2e1139be1`.

Portable checks were rerun on the restored shared 124e candidate using Node 24.22.3 and Corepack pnpm 10.32.1, one Vitest worker:

- Collapsible material, Accordion material, shared interactive-surface and hover fixture: **143/143**, exit 0. The four files contributed 3, 6, 33 and 101 cases.
- Hover fixture, source layout and capture: **193/193**, exit 0. The three files contributed 101, 19 and 73 cases. This overlaps the first command and is not an additive test total.
- A private diagnostic copy used the unchanged candidate regression tests with exactly three 124e baseline sources restored: the two Trigger prototypes and the hover fixture. **106/110 passed; four failed at the intended assertions**: regular and prominent expanded focus pollution, Collapsible transition policy, and padding inside the reservation. It did not fail at dependency loading or setup. Shared candidate files were not modified during this negative control.

The regenerated raw results and exact negative input digests are archived. Historical unit counts from the lost temporary logs are not substituted for these new receipts.

## Acceptance boundary and next checks

The complete official preflight prefix, including Actions-only, exact candidate SHA, tracked/untracked cleanliness and loopback checks, is byte-identical to 124e. Its SHA-256 is `e7fa2f6dc19132ace20f68f0d40785e231aba72530a63e2be1d1482725ce3aad`. No official suite was run by setting pretend Actions variables or removing those guards.

The full eight-part hover suite and final integrated official browser jobs remain the parent's CI acceptance step. Button, Form and Select fixes belong to the parent and are not claimed by this slice. The two local native matrices do not stand in for unexecuted full-suite cases.

Complete current-candidate TypeScript and Astro checks remain assigned to the types owner. A previous local full Astro attempt was killed by the resource-limited environment, and its temporary log was lost in the reset; it is not a passed or current-candidate type result. The clean-124e type pass predates these eight changed files and is not reused as their acceptance.

Generated style closure is checked separately from paint. Any generated-file change must come from the repository generator and its owning integration step. The current check result and remaining status are recorded in `receipts.json`.

The local images have not been uploaded by this child agent. Publication, independent review, exact-head integration and release tracking remain parent-owned actions under the existing user request.
