# GPUI numeric accessibility: registration admission repair

This is a non-normative continuation record for PR #1710, reviewed from `5712266648fdbce2f6662636cb83f01eb849adb1`. The governing direction remains the draft `C-COMPILER-GPUI-A11Y-VALUE-0001`, especially `SCHEMA` and `INGRESS`. Neither this repair nor a passing consumer promotes that contract or the private compiler profile.

## Reproduced failures

An action declared in `if (false)` still establishes a checked structural schema for a later listener. Demand pruning removed the action, however, and GPUI emission reconstructed the listener guard from surviving declarations or the second callback parameter. Zero- and one-parameter callbacks could therefore run on invalid direct host input and spend their `once` registration. Conversely, a later action could incorrectly guard an earlier generic listener.

Independent serialized-IR controls exposed two related admission problems. An explicitly `null` payload marker was treated like missing metadata, and prevalidating hook bodies could establish a route before source parsing would discover that hook. Local function binding hoisting also moved declarations ahead of earlier listeners when structural order was reconstructed from the hoisted statement array.

The same review found that the public legacy Qt, Flutter and React emitters accepted consumption of the GPUI numeric payload when invoked directly, although `compilePrototype` rejected those unsupported target requests. The direct public entry points need the same explicit capability boundary, with each target's actual emitted closure taken into account.

## Owning-layer repair

Input registrations carry their derived checked schema through pruning. The IR boundary independently derives it from the complete structural definition graph; a claimed marker, callback arity or diagnostic source span is not proof. Missing older metadata is normalized in a copy, while malformed or inconsistent metadata rejects. Hook and helper discovery follows the source parser's structural order, including nonexecuted branches and first references.

Hoisted local function declarations retain a checked structural statement position. The representation preserves ordinary binding hoisting, validates the reversed leading function prefix, and remaps positions when statements are pruned. This is compile-time metadata; no IR interpreter or component policy is added to the native output.

GPUI emission uses the validated registration schema for its finite-number guard before callback invocation and `once` consumption. The generated fixture now exercises all three callback arities after an unreachable declaration and generic-before/numeric-after registration order in real native consumers. Unsupported source emitters reject consumed numeric payloads at their public entry points rather than emitting an incompatible representation.

## Evidence boundaries

The original failing source controls and malformed-IR controls are retained in the continuation evidence. The expanded source suite and independent ordering probes cover dead declarations, hook and module discovery, local hoisting, malformed markers, statement pruning and shared-node context conflicts.

The numeric fixture is still authored TypeScript passed through `compileFile` and the checked artifact writer, with generated Rust left unedited. Its eight native tests must execute on the published candidate. Earlier evidence from PR #1710's six-test fixture is historical evidence, not a pass for the two new native controls. Current commands, counts, source SHA and CI receipts belong in the candidate evidence report and PR description.

The historical whole-repository run is not green. A controlled comparison of three complete files at `16393dd` and `5712266` reproduced the same ten failed assertions, but that establishes baseline status only for those assertions. Other failures require their own attribution. Workspace type checking, the affected compiler matrix, native bridge execution and OS accessibility delivery are separate evidence layers.

At the pre-publication checkpoint, the complete workspace type check passed. The final twelve-file focused run passed 410 assertions with one explicit `capture-old` phase test skipped. It includes the 53 numeric-schema cases, 28 direct-emitter cases, existing pointer and parameter-default capture controls, Runtime transport and the complete native-support migration file. The broader compiler run found eight changed diagnostic strings: the new prepass still rejected forged capture identities but replaced the established message. The repair restores that message without removing the identity check or weakening the assertions; all eight pass in the focused rerun.

The broader run itself remains recorded as failed: 3,186 passed, 20 failed and 34 non-executed assertions. Besides those eight repaired diagnostics and the two controlled existing failures, nine Rust cases could not start Cargo, one migration case timed out, and six browser suites failed to launch Chromium because socket creation was denied. The migration file passes on the bounded rerun; the original timeout is retained. Thirty-three browser assertions and the one explicit phase test account for the 34 non-executed cases. Cargo and Chromium setup failures establish no generated-code or browser behavior result.

This continuation changes the upstream compiler and its consumers only. Verdant's domain commits, application wiring and fixed compiler pin remain owned by the downstream workstream. A source or framework consumer cannot substitute for its platform accessibility and physical input acceptance.
