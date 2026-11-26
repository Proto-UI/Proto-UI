# Sprint 5 actual native execution at 0b7b212d3

This record binds the actual hosted results to `0b7b212d3193ea5c7ae219c0501036ee1255e3f2`, not to a later unexecuted tree. [Run 45249588810](https://github.com/Proto-UI/Proto-UI/actions/runs/45249588810) was dispatched once with independent Adapter acceptance enabled and browser acceptance disabled. The original run and failures are retained.

## Observed jobs

| Job | Actual result | Accepted evidence boundary |
| --- | --- | --- |
| `native-consumer (macos-15)`, 137955391295 | Failed | Default generated SDK `cargo check` passed; ordinary test-crate compilation failed with two `E0433` errors for `external_scroll`. Later native consumer steps were skipped. |
| `native-consumer (ubuntu-24.04)`, 137955391702 | Failed | The same SDK success and missing-crate failure occurred independently on Linux. |
| `adapter-native / adapter-macos`, 137955391646 | Passed | Actual Adapter workspace, peer, selected T0 suites, native readOnly projection and own-window AccessKit checks executed successfully. |
| `flutter-scroll-consumer`, 137955391560 | Passed | The real pinned Flutter SDK executed 14 Dart Scroll widget tests; its Vitest wrapper passed once with no skipped wrapper case. |
| Website shader, browser Compiler, package budgets | Skipped | They were outside this dispatch. No successful acceptance is inferred. |

The successful default checks are real successors for the original ControlLabel/SDK compilation failures. They do not turn the failed native jobs green. Both ordinary failures concern dependency assembly, before their Rust tests can run. The separate [consumer-closure repair](2026-11-24-sprint5-native-consumer-closure.md) restores the actual authored producer entry and preserves independent later-consumer execution while still failing the overall job for any failed consumer. That candidate needs its own new run.

## Independent Adapter evidence

The downloaded archive's `source-sha.txt` equals the stated head. `suite-exits.tsv` records zero exit status for the workspace, peer, Button, Toggle, Switch, view intent, Tabs, Transition, Checkbox, ControlLabel and macOS AccessKit lanes. Existing ignored tests in the broad workspace remain ignored and are not reported as executed passes.

The actual native-node test `current_readonly_fact_reaches_the_native_node_without_losing_its_other_semantics` passed. Both `readonly_absence_and_invalid_values_do_not_invent_a_boolean_fact` and `readonly_preserves_boolean_facts_without_changing_actions_or_check_state` also passed. The separate own-window AccessKit suite passed **23/23**. This verifies the actual host projection and selected native actions; it does not establish VoiceOver speech, physical touch/pen, or every applicable assistive-technology condition.

The two real captured PNGs, `control-label-action-enabled.png` and `control-label-action-disabled.png`, were opened and visually inspected. Both labels are readable in the upper native content region; the recorded pixel checks passed. The manifest preserves their SHA-256 values, exact artifact paths, dimensions and bounded visual observation. Disabled semantics are checked by the native action/AX assertions, not inferred from an appearance change. The PNGs remain run artifacts; no permanent inline screenshot upload is claimed.

## Flutter boundary

The byte-verified SDK is Flutter `3.47.5`, Dart `3.13.4`, framework revision `6a19cca56475dbfba1478ee68d7bd0c2ef891da1`. Its actual version identity, 14-case widget event log and acceptance receipt are archived. `publicFlutterProfileActivated` remains `false`. These are real Flutter widget consumers for the existing Scroll subset; they do not claim the complete promised Flutter operation set, a physical mobile device, Qt acceptance, or public profile activation.

## Provenance and retention

All four downloaded ZIP files matched the SHA-256 digests returned by GitHub:

| Artifact                 | ZIP SHA-256                                                        |
| ------------------------ | ------------------------------------------------------------------ |
| macOS native 14855740884 | `00b06f4f2a1579f7b7066f86f08db34c9737662b056b7ef8e12af58553f14a4d` |
| Linux native 14855027669 | `48a63f31949b41d5dc80f46157db75f28be77f6cc782bc476020fbd387dac265` |
| Adapter 14855053749      | `1c70afc8f0e42dc08e4cfd11658ed734eed69225ca7a8a76a9a0823d0fd4dc7b` |
| Flutter 14855440999      | `ed1f6fde3f52661355560e43025c2620e9ad375867bdfc1f242e45435d3544c6` |

The metadata reports December 23, 2026 expiry for these supplementary artifacts. The maintained [evidence manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint5-native-execution/manifest.json) retains raw and compressed hashes for the selected logs, exact platform metadata and source-bound results. This record is evidence reconciliation, not independent GitHub approval, human architecture acceptance, or closure of the ten Sprint 5 Issues.
