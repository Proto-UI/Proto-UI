# Sprint 1: value input reset and readout repairs

This record continues the user's request to complete Sprint 1, specifically the original `issue.1098.002` Number Field and `issue.1098.003` / `.004` Progress/Meter conditions. It preserves the original full host, input and assistive-technology acceptance scope. The changes are bounded prototype repairs; no public API, lifecycle admission or Compiler operation is changed.

## Authority and reproduced failures

Number Field follows the draft `P-BASE-NUMBER-FIELD-NULLABLE`, `P-BASE-NUMBER-FIELD-LOCALE` and `P-BASE-NUMBER-FIELD-OWNER` criteria, with evidence mapped by `T-NUMBER-FIELD-EDITING-0001`. Explicit reset restores the creation value, including null, and cancels an interrupted editing transaction. The runtime must retain a mounted owner for a later independent edit.

Progress/Meter remain draft prototypes. Their current public protocol says Props updates reach all passive range readouts; this is consistent with active `C-PROPS-0001` and the existing `range-readout.test.ts` / `progress-contract.test.ts` consumers. Readout and accessibility projections must describe the current owner values together. This repair does not promote either draft entity or establish native assistive-technology acceptance.

The four modified product files were unchanged from PR #1745 source `81c103bd462b73910f7279122fab5f282d172d56` when the original reset, range-owner and Bengali probes ran. Independent review then found further currency-symbol cases in the first candidate. Original files, intermediate formatter sources and their hashes are retained in the archive; later tests are not relabeled as baseline executions.

| Reproduction | Actual old result | Required result and correction |
| --- | --- | --- |
| Number Field starts with null; a public numeric State observer synchronously resets during `requestValue(25)` | The suspended request writes `empty=false` after reset, yielding canonical 25 | Reset invalidates suspended commands before publishing its own state. The owner stays null, the editor is empty, and the retired request emits no change. |
| Controlled Number Field drafts 25 while its owner remains 20; a `valueChange` callback resets during `commitValue()` | The interrupted commit still emits `valueCommit(20)` | Reset cancels that commit. A later independent command on the same mounted owner remains usable. |
| A Progress or Meter value observer synchronously replaces `{value:25}` with `{value:80,max:200,valueText:'Latest owner'}` | The new value is 80 but the interrupted old synchronization overwrites percentage to 25 | Each synchronization has a generation; replacement or retirement stops the old publication. Current percentage is 40, AX value/max are 80/200, and the Value part reads the latest text. |
| Bengali (`bn-BD`) percent formatting of 1234567.875 | Formatting emits `১২৩,৪৫৬,৭৮৭.৫%`, but parsing that exact output returns invalid | Determine grouping widths from the selected numeric style. Bengali decimal and percent grouping differ; decimal parsing remains covered independently. |
| Independent review: Austrian German and Swiss French EUR display, including negative values | `de-AT` currency uses a different grouping separator from ordinary decimal; `fr-CH` currency changes both group and decimal symbols. The first candidate rejects its own output. | Derive symbols and widths from the selected currency style. The probe retains a fraction independently of display rounding; zero-fraction and significant-digit output do not remove the user's fractional editing grammar. |
| Independent review: Indian English EUR accounting display of ±1234567.75 | Accounting formatting uses three-digit groups, while the first symbol repair probes ordinary currency's 3/2 grouping and rejects the displayed value | Preserve the resolved `currencySign` as well as currency/style/display in the grammar probe. Positive and negative accounting values now round-trip; malformed groups and arbitrary affixes remain rejected. |

The root/value-observer Progress/Meter comparisons use real public State subscriptions and actual Web Component/runtime integration in Happy DOM. The part-observer probes passed without modifying part implementations, so the repair stays in the two Root prototypes. These are synchronous reentry observations, not physical input or rendered-pixel evidence.

## Implemented behavior

- Number Field's continuation epoch advances for explicit reset and mount retirement. Existing checks at State, Context and event boundaries now stop suspended pre-reset work. Normal synchronous controlled acceptance, reset restoration, ordinary drafts, IME grammar retention and scrub cancellation keep their existing tests.
- Progress/Meter check the current synchronization after every observable State write and before Context publication. Unmount/dispose invalidates an interrupted publication; mount reconciles all range facts from current Props.
- Localized parsing uses the selected decimal/currency/percent style's symbols and grouping widths, including the selected currency display and accounting pattern. The separate grammar probe keeps a fractional separator even when display precision hides it. Strict grouping and affix validation remain; canonical precision is unchanged.

## Executed evidence

All focused runs used Node 24.22.3, Vitest 2.1.9, Happy DOM 15.11.7 and `--no-file-parallelism`. The existing esbuild `ES2024` warning is retained in the raw logs. No timeout, case assertion or test selection was weakened.

| Execution | Result |
| --- | --- |
| Original Number Field reset probe, before repair | Two actual assertion failures; full log preserved |
| Original Progress/Meter owner probe, before repair | 0/2 passed; both percentages were stale |
| Four complete Number Field files, first repair | 95/95 passed |
| Two Progress/Meter files, first repair | 25/25 passed |
| Four root/value observer comparisons | 4/4 passed |
| First nine complete numeric files, before independent currency review | 158/158 passed, zero pending: capabilities 30, editing 17, format 46, reset 3, numeric family 12, inputs 7, public parts 16, Progress contract 23, range owner 4 |
| Two additional existing range compatibility files | 37/37 passed: five-family readouts and finite arithmetic, separate from the nine-file result |
| Austrian German / Swiss French review regressions, before symbol repair | 46/50 passed; four real assertion failures, exit 1 |
| Four complete Number Field files after the currency-symbol repair | 100/100 passed, zero pending |
| Eleven complete numeric files after the currency-symbol repair | 199/199 passed, zero pending; this supersedes the overlapping 158 + 37 observations for that source |
| Indian English accounting follow-up, before final `currencySign` repair | Positive and negative standalone probes both invalid; exit 1 |
| Complete formatter file after the final accounting repair | 51/51 passed, zero pending; the other product files are unchanged from the eleven-file run |
| Independent twelve-locale / five-style / six-value round-trip probe | First candidate 359/360; final formatter 360/360, exit 0 |
| Existing `tsconfig.numeric-parts-public.json` type probe, initial and reviewed source | Exit 0 |
| Independent four-locale percent round-trip probe | Baseline exit 1 with Bengali failure; candidate exit 0 |

These runs overlap and are not added as independent coverage. In particular, the 199-case execution precedes the last accounting-only formatter change; the subsequent complete 51-case formatter execution and independent 360-value oracle bind that final change. Final-source integrated CI still belongs to the integration owner. The archive contains raw logs, JSON results, original/intermediate product files, standalone locale probes and source hash bindings. [Manifest and raw archive](./evidence/2026-11-24-sprint1-value-input-repairs/manifest.json).

Two independent agents read the four product changes and their focused tests. One identified the currency-symbol defect, and the other identified the accounting-pattern defect through the independent 360-value oracle; both findings were reproduced and repaired above. The final review found no remaining blocker in this bounded source/format scope. This engineering review is not GitHub approval, native execution or acceptance of the full original Issue.

## Native and remaining acceptance

The previously valid 20/20 Number Field native journeys and their 40 uncontrolled/controlled owner records retain their original `e8171371e937d3f0738141c82f5d5cf90820afa1` identity, documented in [the original S1 record](./2026-11-22-sprint-1-reliable-regression.md). They are not relabeled as executions of these changed product files.

The current container's shared browser prerequisite was independently found unavailable before a real page could execute (`socket() EPERM`, Chromium SIGABRT); this slice did not repeat that unchanged failed launch. The integration owner must run the canonical Number Field browser producers on the final published source and a supported native runner. The existing S1 producer already specifies WC/React/Vue/Vue2, three release families under 150 seconds and two experimental families under 90 seconds, after generating canonical styles. No local native pass is claimed here.

Equivalent producer invocations, retaining those owner limits, are:

```sh
corepack pnpm@10.32.1 --filter apps-www generate:proto-ui-style
PUI_BROWSER_RUNTIMES=wc,react,vue,vue2 PUI_BROWSER_FAMILIES=base,shadcn,brutalist PUI_BROWSER_KINDS=number-field PUI_EVIDENCE_DIR=<output>/number-field-0.3 node --import tsx scripts/analysis/component-capabilities-browser.mjs
PUI_BROWSER_RUNTIMES=wc,react,vue,vue2 PUI_BROWSER_FAMILIES=bootstrap-2-3-2,liquid-glass PUI_BROWSER_KINDS=number-field PUI_EVIDENCE_DIR=<output>/number-field-experimental node --import tsx scripts/analysis/component-capabilities-browser.mjs
```

Use `scripts/test/sprint1-evidence.mjs` for the canonical bounded execution and receipt validation; the shell commands above identify the exact underlying producers, not a replacement for its deadlines or report gate.

The ready development children are the explicit-reset repair, style-specific localized parsing repair and latest-owner dynamic range repair, subject to independent review and actual integration/tracking readback. Physical OS IME, hardware touch/pen, screen readers, complete native geometry/paint, the remaining Calendar/Date Picker/OTP/Slider conditions and all applicable backend parity remain separately open. `asAxisInput` is still explicitly unsupported in `packages/compiler/src/hook-admission.ts`; this record supplies no Compiler acceptance.
