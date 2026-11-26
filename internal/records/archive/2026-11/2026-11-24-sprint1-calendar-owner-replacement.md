# Sprint 1: Calendar owner replacement and remaining #1098 entry points

This non-normative record preserves a reproduced Calendar defect, its bounded repair, and an executable-entry reconciliation for the remaining OTP, Calendar, Date Picker and Progress/Meter conditions in #1098. It does not complete that Issue, activate a draft definition or convert earlier native evidence into acceptance of this changed source.

## Reproduced defect and repair

[C-CALENDAR-SELECTION-0001](../../spec/contracts/C-CALENDAR-SELECTION-0001.yaml) remains draft at `0.3.0-alpha.2`. Its MODES and CONTROLLED criteria give the supplied mode-specific prop authority over accepted selection; PICKER requires partial/rejected selection to stay open and correlates accepted completion with the still-current opening session.

Calendar's Props synchronization read one snapshot, then wrote its public `value`, `month`, `disabled` and `direction` states. A synchronous public State subscriber could replace Props during one of those writes. The nested synchronization accepted the new multiple/range selection or policy, but the interrupted outer synchronization continued with its old snapshot. In particular, it combined a live `isProvided('values'/'range')` result with the old snapshot's missing field, overwriting the newly accepted selection with `[]` or `{}`. Month and disabled subscribers similarly exposed stale policy/direction writes. Date Picker inherits this Calendar implementation, so its visible day facts and canonical value display were also affected.

`packages/prototypes/base/src/calendar/calendar.proto.ts` adds an owner-local synchronization revision and checks revision, Runtime identity and view epoch after every observable State write. A superseding Props synchronization, synchronous unmount or disposal stops the old continuation. The existing final `publish` path retains its own owner/revision protection. No Date Picker, shared State, Props, Context, Popover or adapter implementation changes.

`packages/prototypes/base/test/calendar-owner-supersession.test.ts` exercises the authored Calendar and Date Picker through their public Web Component Props and exposed State interfaces. Its eight composition cases distinguish selection replacement from policy/direction replacement. The multiple/range cases also perform a later legal update on the same connected owner and retained exposed API; an incomplete range still renders its anchor and keeps Date Picker open. Two additional cases use the public Runtime boundary to make State-subscriber unmount/disposal synchronous: no later `month`, `disabled` or `direction` writes may occur, and the original Props call must not throw. This avoids treating a potentially deferred DOM disconnect as synchronous retirement.

## Actual verification sequence

Local environment: Node `v24.22.3`, Vitest `2.1.9`, happy-dom `15.11.7`; test commands use `--no-file-parallelism`. Every listed test run has zero pending cases.

| Execution | Actual result | Source and scope |
| --- | --- | --- |
| Initial four selection-replacement cases, original product | 0 passed / 4 failed, exit 1 | Original empty multiple/range overwrite, Calendar and Date Picker. |
| Initial repair plus original selection and reset/lifecycle suites | 142 passed / 0 failed, exit 0 | Initial four-case fixture; preserved as an intermediate run. |
| Expanded eight cases, original Calendar source replayed in memory | 0 passed / 8 failed, exit 1 | Selection, month and disabled observer boundaries; all expected failures. |
| Repaired eight cases plus selection, controlled-month, reset/lifecycle and four-adapter journeys | 160 passed / 0 failed, exit 0 | Five files; includes 25 selection, 10 controlled-month, 113 broader reset/lifecycle and 4 happy-dom adapter journey cases. |
| Final ten cases with retirement and same-owner follow-up controls, original Calendar source replayed in memory | 0 passed / 10 failed, exit 1 | Unmount continued three public writes; disposal attempted a retired Runtime write. |
| Final ten cases on repaired source | 10 passed / 0 failed, exit 0 | Same product source as the 160-case run; stronger final fixture. |
| Scoped Calendar public TypeScript project after final fixture changes | Exit 0 | `tsc -p packages/prototypes/base/test/tsconfig.calendar-public.json --noEmit`. |

The 160-case result is not relabeled as a new 162-case run. Both the eight-case fixture actually used there and the final ten-case fixture are archived. The original-source replays replace the complete Calendar source only in Vite's in-memory transform; shared product files are never temporarily overwritten. Original and candidate source snapshots, complete reports/logs, command lines and hashes are retained.

The parent independently read the 11-line product change, initial eight cases and existing unmount/dispose ownership paths and found no blocker in that bounded review. Its requested additional retirement and subsequent-update controls produced the separate red/green results above. Formal GitHub review and current native integration remain separate receipts.

## Remaining acceptance mapped to executable entries

The preserved original Issue body remains the scope authority. This map identifies what existing executable entries can establish and which original conditions they do not establish; it is not a new task denominator.

| Component | Existing concrete entries and supported observations | Remaining original acceptance outside those observations |
| --- | --- | --- |
| OTP | `base/test/input-otp-selection.test.ts`: selection/caret, controlled refusal, detach/reconnect, Field canonical validation, coalescing and reset policy. `numeric-inputs.test.ts` includes synthetic paste-like input. The four adapter text-control selection suites share the public contract fixture. `sprint2-input-browser.mjs`'s OTP handler drives real browser keyboard selection/typing, controlled refusal and accepted follow-up, Field relationships, readOnly and blur across three release families × four hosts × two owner modes. | The OTP browser handler does not drive actual clipboard paste, an OS IME or platform autofill. Its keyboard/trusted-input observations and source's `one-time-code` attribute do not supply those witnesses or actual AT reading. Existing implementation is not reclassified as missing. |
| Calendar | `calendar-selection.test.ts`: multiple count limits, controlled proposals/acceptance, unavailable interior-range rejection, copied per-day facts, civil-date arithmetic, mode/policy and RTL activation. `calendar-controlled-month.test.ts`: refusal, focus, bounds and supersession. Semantics/family suites cover locale, week start, keyboard and family recipes. `web-conformance/test/calendar-selection.journey.test.ts` exercises four actual adapters under happy-dom. `component-capabilities-browser.mjs`'s Calendar handler drives uncontrolled range and multiple selection and checks family paint/day facts across five families × four hosts. | That native handler does not cover the complete controlled range/count-limit/unavailable-interior matrix, locale/RTL/zoom or AT. The local repair does not replace exact-source native acceptance. |
| Date Picker | Existing selection/reset/lifecycle tests cover partial versus complete range, multiple staying open, controlled refusal/acceptance, open refusal and superseded sessions. The source records request/root/open-session identity before callbacks, then matches completion to the same still-open session. `component-capabilities-browser.mjs`'s Date Picker handler checks partial/full-range closure, hidden popup descendants, canonical display, reopening paint, controlled range refusal and synchronous callback acceptance/close-reopen retirement. | That handler is not a complete single/multiple native matrix and does not assert every controlled-open refusal or focus-return condition; it supplies no AT result. Its earlier native runs preceded this Calendar source change. No defect was found in the already implemented request/open-session correlation during this bounded read. |
| Progress/Meter | Existing numeric verification covers the readout, finite arithmetic, public parts and owner-supersession suites. `range-readout.test.ts` includes five-family dynamic/clamped/indeterminate values, `valueText`, thresholds and reconnect; `progress-contract.test.ts` covers finite/omitted value, policy and parts. The shared demo cycles a value with fixed bounds/thresholds. The homepage browser plan checks selected ARIA numeric readouts. | Those native entry points and projection/contrast captures do not provide a complete dynamic-bound/format override/determinate-to-indeterminate/threshold/readout acceptance matrix. No new Progress/Meter defect or new verification is claimed here. `valueText` is the existing formatting override; no new Intl formatting API is required by this record. |

The Issue's historical source-bound S2 receipts remain valid for their measured scope: source `4541dfb`, run `45035380303`, OTP 24/24, Slider 48/48 and Date Picker 12/12; artifact `14759694693` and its originally recorded identity are preserved in the archived Issue body. Those results are neither rerun nor promoted to current-tree acceptance by this record. The original single Calendar caption result, 9/9 on `152b607e`, is likewise only that earlier path.

For an owned native environment after integration, the existing expanded Calendar/Date Picker handler is runnable without reducing its default five-family/four-host denominator:

```sh
PUI_BROWSER_KINDS=calendar,date-picker \
PUI_EVIDENCE_DIR=<owned-output> \
node --import tsx scripts/analysis/component-capabilities-browser.mjs
```

This selects 40 native journeys, not all of #1098. The runner's normal website/style preparation and browser prerequisites still apply. The previously observed local Chromium socket/launch refusal is unchanged, so an identical local native attempt was not repeated. Physical input and real AT remain distinct external evidence.

## Evidence carrier

[Manifest](evidence/2026-11-24-sprint1-calendar-owner-replacement/manifest.json) and [raw archive](evidence/2026-11-24-sprint1-calendar-owner-replacement/raw-evidence.zip) contain the original Issue body, source snapshots, exact execution reports, original-source replay config and entry-point sources. The archive is 223,878 bytes, SHA-256 `fc1b8f14974fe24ea528b8311ed2aca6ec980ef5bd4e92194a4a223d28a63c53`; all 43 entries passed CRC and every payload size/hash was read back and verified.

The repaired Calendar source SHA-256 is `a98be1f4ad13b91c69045d7de8c72e876399768d312356fea72cc71aa886cfe3`. Metadata records the shared checkout plus the dirty file snapshots actually tested. These are bounded local source-bound receipts, not a clean-head mainline, complete Sprint 1 or native-browser green result.
