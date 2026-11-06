# Default associated Label activation

Baseline: `55af32928e3a0869411c2d64b82bb15d1b9adf1f`, including #1324–#1327. The newer Bootstrap homepage manifest additions are preserved alongside this repair's separate Shadcn Radio Label registration; the other changes do not overlap the repair. User-directed repair of the visible Checkbox/Radio Group label mismatch, while retaining the existing draft control-label protocol.

## Cause and decision

The Shadcn Checkbox recipe already uses an independent Label and an explicit pair. The Shadcn Radio Group recipe instead rendered ordinary sibling text plus an `sr-only` duplicate inside Item. RadioGroupItem already has the shared ControlLabel target operation; adding another click or value owner would duplicate existing semantics.

The requested default belongs in Base Label: `activation` defaults to `true`, with explicit `false` for passive naming. The five family projections inherit it. The low-level Module's pre-sync disabled activation baseline is unchanged. Pairing still requires the typed association (or an already-defined anatomy pair); no DOM parent, proximity or group-title inference is introduced. The Shadcn recipe now pairs its visible Label and Item and removes the hidden name.

## Compatibility and validation boundary

Existing paired Labels that omitted activation become actionable. Consumers wanting naming only must pass `activation=false`. The default selection policy consequently suppresses accidental selection; `selection=text` keeps an actionable Label copyable. No keyboard role or Tab stop is added. Target controlled values, disabled state, focus, event counts and lifetime remain with their existing owners.

Tests cover default omission, false/true/removal transitions, all five Label projections, the five target types, controlled Radio proposals and disabled Item/Group behavior. The four-Web Shadcn native fixture adds visible-label mouse/touch assertions and WC-native signal counts (the framework adapters expose callbacks, measured separately in Adapter tests) without replacing its existing keyboard and direct-control journeys. Source, synthetic host tests, native input and assistive-technology evidence remain separate. At preparation, candidate execution and revision-bound screenshots are pending; no passing or stable-admission claim is made. Broader #1094/#1160 parity/AT goals remain open.
