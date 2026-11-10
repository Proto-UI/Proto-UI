# Issue #852: three additional native interaction journeys

Date: 2026-11-10 UTC. Non-normative bounded audit continuation on current main.
Product code, palette, thresholds, recipes and all existing planned capture
states remain unchanged. Applicable Prototype entities stay **draft**; no
product regression is claimed or certified by this record.

## Scope admitted

This record binds the observer and driver design for the three journeys
tracked by Issue #852. Native evidence is produced only when the shared
collector patch (`audit-brutalist-contrast.mts`, `astro.config.mjs`, second
esbuild probe bundle, planned-state additions, evidence-debt replacement) is
applied and the audit runs against the declared instrumented consumer. Until
that evidence exists, every journey here is designed and controlled-tested
only; no achieved target is claimed.

### 1. Dialog outside press

- Authority: `P-BASE-DIALOG-CONTENT-DISMISS`, `P-BASE-DIALOG-CONTENT-FOCUS`,
  `P-BASE-DIALOG-CONTENT-PRESENCE`, `P-BASE-DIALOG-MASK-DEFAULT-ACTION` (all
  draft).
- Journey: with the exact owned normal Dialog open, `outsidePoint()` picks the
  first candidate point (of twelve around the Content rect, one CSS pixel
  outside each edge at 0.25/0.5/0.75 fractions) whose topmost hit is the
  physical Mask and inside the viewport. One native left `pointerdown` on the
  exact owned Mask plus one trusted `pointerup` at the same coordinates is
  required; the Mask's authored `pointer.down` default-action prevention
  (`dialog.mask.preserve-focus` / `dialog-mask.background-pointer`) must be
  observable. The closed phase requires the same physical Content and Mask to
  be completely withdrawn (disconnected or `data-pui-view-detached` and not
  painted-visible), no replacement roots, `data-open` cleared, and real focus
  on the exact owned Trigger.
- Intentional broken-dismissal control: before the journal binds, one native
  press strictly inside the owned Content (topmost hit inside Content whose
  closest `data-pui-root` is Content itself) must leave the Dialog open and
  painted. Its pointerup never enters the journey journal.
- Alert-mode boundary retained in semantic evidence, not exercised: the
  authored demo is a normal dialog (`alert: false` default).
  `packages/prototypes/base/src/dialog/content.proto.ts` returns early from
  `boundary.subscribeOutside` when `alertProp.get()` is true, so an outside
  press on an alert dialog must be refused by source. This refusal is recorded
  as retained semantic source evidence; no alert recipe is driven.

### 2. Button Space / Enter activation

- Authority: `P-BASE-BUTTON-KEYBOARD-ACTIVATION`,
  `P-BASE-BUTTON-KEYBOARD-SPACE-PREVENT-DEFAULT`,
  `P-BASE-BUTTON-DISABLED-SUPPRESS-ACTIVATION`,
  `P-BASE-BUTTON-DISABLED-REJECT-FOCUS`,
  `P-BASE-BUTTON-CLICK-SIGNAL` (all draft).
- Outward signal protocol: the command signal is the public consumer callback
  delivered through `DemoRuntimeApi.setProps(ref, { onClick })`, which Base
  Button emits from `press.commit` (`run.expose.emit('click')`). DOM `click`
  events are never counted as commands. The observer binds the exact physical
  authored Buttons through `ctx.refs[ref]` identity plus
  `getPublicInstance(ref)` presence; a missing or ambiguous observer session
  fails loudly.
- Declared instrumented consumer: `demo-brutalist-button.demo.ts` authors no
  setup and no `on*` props. Under `PROTO_UI_CONTRAST_AUDIT=1`, a Vite
  `serve`-only `enforce:'pre'` transform wraps the verbatim recipe in
  `withContrastButtonCommands`, which adds a consumer `setup` that subscribes
  `onClick` on `solidMain`, `disabledSolid` and `disabledSurface` through
  `ctx.api.setProps` and withdraws it with `ctx.api.removeProps` on teardown.
  The transform throws unless the served source is byte-identical to the
  authored file; the receipt endpoint
  `__pui_contrast_native_journeys` (GET only, guarded by the provenance
  middleware's loopback/origin checks and server header) retains literal
  original bytes, transformed bytes, and both SHA-256s plus the helper SHA.
  This is a declared instrumented consumer for the outward-callback
  observation only; the canonical recipe, product props and input/default
  handling are unchanged and no uninstrumented recipe is claimed tested.
- Journey: on the same physical `solidMain` Button holding real focus —
  `beginContrastButtonKey(' ')` then a native Space: exactly one keydown/keyup
  pair, `keydown` default action prevented (the authored
  `button.space-activation` request), real scroll offsets unchanged on the
  scrolling element and every scrollable ancestor, command delta exactly 1;
  `beginContrastButtonKey('Enter')` then a native Enter: command delta exactly
  1; `beginContrastButtonKey('a')` then a native `a`: command delta 0 and no
  cancellation. Disabled controls: `disabledSolid`/`disabledSurface` sessions
  must stay at zero commands through the whole journey, must receive a native
  pointer attempt at their actual bounds, and must be skipped by a bounded
  native Tab traversal (32 steps) that exits the previewed content. If the
  host makes disabled nodes unreachable, the exact attempt and hit result are
  retained rather than a targeted disabled key claim; the independent
  semantic `press.commit` rejection requirement stands separately.

### 3. Hover Card Trigger-to-Content pointer bridge

- Authority: `P-BASE-HOVER-CARD-CONTENT-HOVER-BRIDGE`,
  `P-BASE-HOVER-CARD-CONTENT-OVERLAY`, `P-BASE-HOVER-CARD-CONTENT-PRESENCE`
  (all draft).
- Journey: with the exact owned Content open under a native Trigger hover,
  one trusted `pointerleave` on the exact Trigger followed by one trusted
  `pointerenter` whose hit is the same owned painted Content at its centre is
  required, in order. The retained phase requires the same physical Content
  element (unique owned match, no replacement), `data-open` retained, Content
  `:hover` and Trigger not `:hover`, a hit-tested owned point, and unchanged
  focus (Escape-free: focus must stay where it was before the move, not on
  Trigger or inside Content). The closed phase requires one trusted
  `pointerleave` from the same Content after the enter, `data-open` cleared,
  complete withdrawal of the original Content, and no `:hover` on either
  part.
- Intentional broken-bridge control: before the journal binds, one native
  pointer move to a viewport corner that hits neither Trigger nor Content
  must close the card (bypass moves must never be counted as retained). The
  reopened Content is re-resolved through fresh exact owned lookup; the
  retained `contentReused` fact records whether the element identity is the
  same or a replacement.
- Replacement/owner borrowing rejected: `unique()` and `noReplacement()`
  require the audited generation's owned Content to be the sole owned match;
  a foreign owner or duplicate can never inherit the journey.

## Shared observer contract

`apps/www/scripts/contrast-native-journeys.browser.ts` is the self-contained
observer source bundled as a second esbuild IIFE
(`globalName: 'puiContrastJourneys'`) alongside `puiContrastProbe`; it
consumes the canonical `readContrastAuditSubject` lease and
`readContrastPaintedVisibility` model, never rediscovers subjects, and keeps
all Element references inside the page. Every `read*` returns a serializable
observation with `achieved`, owner/generation, input journal facts (trusted,
exact target, coordinates, `defaultPrevented`) and the named draft criteria.
`beforeAccepted`/`retainedAccepted` are driver-set admission latches so a
later phase can never be satisfied by a binding that never verified the
prior phase. `contrast-native-journeys.mjs` re-exports the browser source and
adds `withContrastButtonCommands`, which is reachable only through the opt-in
serve transform — never through the injected global or the `.browser.ts`
bundle.

## Controlled tests

`contrast-native-journeys.test.mjs` (happy-dom, Node test runner) evaluates
the exact self-contained source that the IIFE probe bundle transforms and
exercises observer discrimination only — it is never native evidence: accepted and
rejected Dialog outside presses including unaccepted-phase presses,
opacity-like retained Content, wrong-focus restoration and duplicate owned
Mask; hit-tested exterior point rejection; Hover bridge retain/close and
replacement/foreign-owner/later-open rejections; Button Space/Enter/`a`
command deltas, untrusted synthetic key rejection, and DOM-click not counting
as a command; transform admission including literal-original requirement,
single-`export default` binding and embedded original SHA.

## Evidence-debt and record placement

Three `evidenceDebt` entries are replaced only when native journey coverage
lands: the Dialog outside-press/focus-restoration follow-up line, the Button
Space/Enter activation follow-up line, and the Hover Card bridge follow-up
line. `plannedStates` gains the eleven journey state names per family.
Validation disposition, per-case journey records and the transform receipt
belong to each generated audit report and its evidence directory; this file
records only the admitted design and its source bindings.
