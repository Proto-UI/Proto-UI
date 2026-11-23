# Compiler general CI: source identity and current acceptance fixtures

This bounded repair starts at `e76d97b8398fa2c4da00955671288c12d5863a03` and addresses 26 failures reproduced from the original `d039` general CI report. It does not close the separate eleven `lowered-hook-coverage` failures, the whole general suite, browser acceptance, or native platform acceptance.

## Authority and decisions

| Original failure | Governing boundary | Repair and retained negative control |
| --- | --- | --- |
| Lexical import and same-path replacement, four failures | `packages/cli/README.md`, authored hook state selectors; `HookSourceModuleContext` immutable-source and reached-value contract | Symbol caches now include operation-local immutable AST identities, including the reading source. An old module remains independently queryable after a replacement. Actual import fixtures provide real target modules; namespace imports retain namespace identity. Unreadable imports are not granted value authority. The erased-export fixture selects the actual `kept` declaration by name. |
| Four portable callable fixtures | `internal/compiler/source-language.md`, Functions and hook installation; `packages/compiler/README.md`, Dead values and reached support | The positive control calls the real callable legally during setup so it survives inert unused-value pruning. The existing hostile portable-IR mutation then places that same callable into its illegal later path. The original PUI2002 rejection and callable-demand check remain. |
| Two GPUI ControlLabel expectations | `internal/compiler/control-label-native-lowering.md`, Remaining explicit boundaries | The accepted explicit-association slice is a positive source/direct-emitter control, with actual native declaration and current-request operations. The Qt, Flutter and SSR rejection controls remain. This is emission evidence, not native execution. |
| Six native support migration fixtures | Draft `C-TEXT-CONTROL-SELECTION-0001-OBSERVATION` and `-FACTS` | The unchanged old CLI corpus is retained byte-for-byte. Exact snapshot comparison admits only the contract's optional `selection` field and, when present, compares it with the actual textarea selection. Existing input, pointer, keyboard, detach/remount and outer activation assertions remain. The unmigrated old-Trigger/new-Text routing counterexample still has to fail at its intended routing boundary. |
| String arity expectation | `internal/compiler/source-language.md`, Native String conversion; existing `string-coercion.test.ts` zero/one-operand and unsupported controls | Two arguments still reject with PUI1006/unsupported-input. The fixture now names the governed zero-or-one contract instead of the retired exactly-one wording. |
| Eight ancestor Context profile expectations | `diagnostic-registry.ts` PUI1006 typed-member boundary; unchanged unimplemented ancestor operation boundary | Both ancestor operations still reject on all eight profiles, while ordinary Context controls parse. The test also checks the exact source slice `def.context` or `run.context` at original line 5. |
| SSR cycle diagnostic wording | Existing generated owner initialization data boundary | Accessors remain unobserved and rejected; a cyclic input still rejects with the explicit owner-initialization cyclic-data error. No initial-data admission changes. |

No semantic contract lifecycle is promoted. No unsupported profile, missing producer, arbitrary field, or callback phase is admitted by these test changes.

## Executed evidence

The original ten-file command reproduced **440 passed, 37 failed, one existing skipped case**, out of 478. The repaired nine-file subset originally had **263 passed, 26 failed and that same skipped case**, out of 290.

After the repair and final formatting, the complete nine-file command ran **290 passed, zero failed and one existing skipped case**, out of 291, exit 0. The additional case independently queries old and replacement exports after each cache is populated. The single skip is the pre-existing capture-stage-only old CLI corpus producer; normal verify mode reads the retained historical corpus. All 77 actual migration verification cases execute; a skipped capture is not called a pass.

The exact commands, Node version, file hashes, original failure report, final report and migration traces are retained in [validation.json](evidence/2026-11-23-compiler-general26/validation.json) and its adjacent compressed raw evidence. Vite's existing unrecognized-ES2024 warning is retained in stderr. Local installed dependencies are symlinked from the session's matching integration workspace; no generated corpus or helper payload was edited.

These results are bound to the listed candidate source hashes on the stated base. A later merge with `origin/main` requires its own checks. Parent review and final integration remain separate actions; this record supplies no fabricated GitHub approval or final Sprint completion.
