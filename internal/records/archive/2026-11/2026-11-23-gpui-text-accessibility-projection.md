# Native TextControl AccessKit projection — 2026-11-23

This is a bounded implementation/evidence record, not a spec lifecycle promotion. The selected base is `c917694201586b8ee1e6f1ed491ae87466ad680d`; `C-TEXT-CONTROL-0001` and `T-COMPILER-GPUI-AUTHORED-INPUT-0001` remain draft. Current user-directed work covers the native host translation and its consumer evidence.

## Definition and primary host evidence

The editor remains the host-owned plain-text target defined by `C-TEXT-CONTROL-0001-F/G/I`: its canonical text, selection and bounded editing lease are preserved. No component name, source path, application policy, new portable action or second text editor is introduced.

The fixed GPUI [default profile guide](https://github.com/zed-industries/zed/blob/62e5991dd0f0c8a3af8d5e7e9c4652490d468db8/crates/gpui/src/_accessibility.rs) and [consumer profile guide](https://github.com/cyjin-yl/z3rm/blob/e5f2f9db75e97613232b5c1946333e61fa3828ab/crates/gpui/src/_accessibility.rs) document `Element::a11y_synthetic_children`, real `TextRun` children and a parent `TextSelection`. The installed/published [AccessKit consumer](https://github.com/AccessKit/accesskit/blob/c88605b96d04431f9c3c792464a0f2f253480e94/consumer/src/text.rs) requires a text-input role **and a text run** for `supports_text_ranges()`. The same release's [AT-SPI bridge](https://github.com/AccessKit/accesskit/blob/c88605b96d04431f9c3c792464a0f2f253480e94/platforms/atspi-common/src/node.rs) adds the Text interface only when that consumer predicate succeeds. A parent value alone is insufficient. The actual default native metadata resolves AccessKit 0.24.1 and accesskit_consumer 0.38.0.

## Reproduction and repair

The original `text_accessible()` only populated the root's value, placeholder and flags. `NativeTextElement` and `Semantics` supplied no accessible runs or selection. Before changing production projection, three regressions passed those original real AccessKit nodes into `accesskit_consumer::Tree`:

- nonempty canonical text had no text ranges;
- an empty editor had no text ranges;
- a valid native UTF-16 reversed selection was absent from the accessible node.

All three failed for those reasons after successful Rust compilation. The RED artifact retains the original production projection; only native tests and the test-only consumer dependency were added. The GREEN helper supplies the new production projection's children to the consumer, so RED and GREEN are not claimed to be byte-identical test fixture files. Their text/range/selection assertions are retained. Neither artifact's emitted Rust was edited.

The native semantic root now appends synthetic text runs after authored child-merging policy. This host editor content remains infrastructure, including an empty value and a trailing empty LF line. Each run carries actual text and Unicode-scalar UTF-8 lengths. Native/source UTF-16 selections become AccessKit run-relative character positions, including non-BMP text, combining characters, hard breaks, and reversed anchor/focus.

The native paint path registers `SetTextSelection` on the semantic root. The callback keeps a weak owner and the exact published snapshot: owner epoch, editing epoch, window, frame, hitbox, root/run IDs and text must still match. Unknown positions, another window, a replaced publication, an unpublished text change, reset, detach and terminal disposal cannot mutate a later editor. Readonly selection is allowed; disabled/composing selection is rejected. The source and assistive paths share the existing native selection executor and platform selection-notification policy.

## Executed evidence

Evidence paths below are relative to the isolated remote run directory `proto-draft-48bf-20261123`, not repository source files.

| Layer | Result | Retained evidence |
| --- | --- | --- |
| Original production projection | 0/3 pass, 3 expected failures; metadata 0 | `text-a11y-red/`, `evidence/text-a11y-red.log` |
| Default GPUI 62e5991 emitted SDK | 29/29 pass, including six text projection/lease tests; metadata 0 | `text-a11y-green/`, `evidence/text-a11y-green.log` |
| Workspace GPUI e5f2f9d with modern Element ABI and native selection notification | 28/28 SDK tests (the one legacy-only test is correctly excluded), 15/15 generated a11y-value consumers; metadata 0 | `text-a11y-e5/`, `evidence/text-a11y-e5.log`, `evidence/text-a11y-e5-consumer.log` |
| Focused compiler/compatibility/label/a11y-value Node suites | 108/108 pass in four files | `evidence/text-a11y-node.log` |

The native selection tests draw actual `Semantics` and `NativeTextElement` to establish a physical window/frame/hitbox. The consumer helper supplies an accessibility publication because GPUI's TestPlatform does not activate an OS AT connection. This proves real AccessKit consumption and host lease execution, not an OS accessibility-tree observation.

Current emitted SDK content identities (same source used by the producers):

- default/profile: `a6c8132ebab6c7a4997e3acf2c97f31f610ae7940d09a83926cfc806d0743ea3`
- workspace/modern Element ABI: `fa06806ac4d3860f457786700ed6870fb8bd7761857b8128ecaac070c5f748e2`

## Explicit acceptance boundary

TextRun glyph bounds, character positions/widths and visual soft-wrap runs are not fabricated. No input-frame rectangle is assigned to individual characters. This slice does not establish `GetCharacterExtents`, caret magnifier positioning, word/visual-line navigation fidelity, operating-system IME delivery, or the actual AT-SPI Text interface in a running Verdant process. Those require their own native layout/platform evidence. The maintained compiler note and draft executable mapping preserve this boundary.
