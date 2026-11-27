# Explicit passive Shadcn action profiles, 2026-11-23

The existing public `shadcnActionAppearance` helper, Text input and type surface accepted nine named profiles, while Surface's runtime schema and recipes only accepted Rhea and Luma. The original complete command-profile test reproduced the gap: six cases passed and the passive appearance case failed on Vega's missing `rounded-md`. This was a real family projection gap.

The existing draft definitions also bounded passive appearance to two profiles and explicitly excluded legacy passive paint. The repair therefore first revises the draft Surface/Text definitions and the direct Button's cross-reference to admit a finite, source-bound passive subset. It does not infer new semantics from the existing implementation or change the historical direct Button API comparison baseline.

## Definition and implementation

The explicit vocabulary now admits Vega, Nova, Maia, Lyra, Mira, Luma, Sera, Rhea and New York v4, with `new-york` as the existing legacy alias. Surface only consumes supplied presentation props. It adds no semantic state, listener, scope subscription, role, focus request, activation or navigation API. `none` retains ordinary Surface defaults and does not acquire action motion.

The modern recipes follow the retained official `cn-button` and default/secondary/ghost clauses at `3d98900e9b73c45f035f8109e9d41ba6a51685e7`, preserving the existing Rhea/Luma adoption. The eight source-specific corners and focus recipes remain distinct. The separate New York subset follows the official Button at `02cad61166c4c20edbc8a3f71bd720eed4c1f49b`, Git blob `e3345d985d14c33e3cb9d8c45cf973807326c944`. It uses its own hover and focus paint, and acquires no modern transparent border, background clipping or pressed translation. All contributions withdraw on profile/fact changes and omission. The source clauses and exact legacy source are retained with their hashes in the evidence archive; the existing MIT notices apply.

The helper's existing geometry and Text implementation did not change. Their existing nine-profile behavior is now explicitly bounded in the draft definition. This is the primary/secondary/minimal passive appearance subset, without upstream invalid, expanded, nested SVG, disabled or extra-size guarantees.

## Executed evidence

The source-bound local baseline ran all seven original cases without filtering: **6 passed, 1 failed, 0 skipped**, in 6.083 seconds. After the implementation, all seven original cases and two additional controls passed: **9 passed, 0 failed, 0 skipped**, in 6.951 seconds. Before/after source hashes were stable for both runs. The original case still checks all nine profiles, native anchor identity/href/focus, content nodes, passive roles/exposes and restoration after omission.

The two added cases independently check the pinned focus width/opacity, all three emphasis variants, idle withdrawal, the legacy alias and dark minimal paint. They do not read expectations from the implementation's profile maps. They also verify that `current` does not synthesize action hover and that an ordinary pressed Surface gains no action translation.

The four changed entities passed the actual `validateSpecEntity` schema, and the prototype catalog passed with 1011 declaration files, 1402 static authoring entries and 466 cataloged prototype entities. Its seven bounded-map controls also passed. The added test's metadata now records the executed result and links both Surface and Text; these entities remain draft.

[The manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-passive-action-profiles/manifest.json) binds the original failure, successful candidate, catalog/schema receipts and source evidence in a byte-verified archive. Later passing-status and reciprocal relation metadata do not change the tested implementation or test source.

## Independent review and remaining gates

The Sprint 3/4/5 agent independently read the six-file source/definition change, the actual helper/Text/maps and the pinned official source clauses. It found no ownership or modern/legacy boundary blocker. That review did not rerun the tests and is not a GitHub approval. The integration owner retains final review.

These are DOM/token and definition checks. Native pixels, browser navigation, motion, assistive technology, non-Web targets, integrated workspace types and the complete generated family closure remain separate acceptance gates. No existing test budget or assertion was relaxed, and this record does not mark those gates or the full Sprint complete.
