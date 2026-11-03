# Brutalist Select Item border timing: actual checkpoint and retained debt

2026-11-03. This candidate extends public Draft1236 head21d749af6fae1ce7f106979ee555d8661ace9f32, tree588e1e53bfba6f925357795574de2a32beba8b84. It is an explicit Proto extension, not pinned-upstream parity. No Base semantic, action, focus, geometry or positioning owner changes.

## Actual evidence at 04:24 UTC

- The generic collector correction is already independently published at21d749af. Its actual105/105 and sole-product96+9 cases are separate evidence; broader alias/controlflow support remains open. Whole-file formatter warnings and all earlier failures remain recorded in the [collector checkpoint](https://github.com/Proto-UI/Proto-UI/pull/1236#issuecomment-6594837009).
- Two unchanged official generator runs with the same collector produced511 tokens without Item and512 with Item. Only `transition-[border-color]` was added; original themes are byte-identical. The eight removals versus original519 were traced to Select direct-any and Dropdown all(any) false conjunctions; bare intent and other legal variants remain. [Actual comparison and source attribution](https://github.com/Proto-UI/Proto-UI/pull/1236#issuecomment-6595190740).
- Initial Item5 execution failed0/5 on both sides before product assertions because its test Host lacked `scheduleDelay`. A fixture-only eight-line addition copies the repository's existing asynchronous setTimeout/cancellation contract; RuntimeSession disposal and original afterEach cleanup remain. No timing assertion or product was changed to repair the fixture.
- The corrected fixture completed exact5 collections on both sides. The old Item failed all5 actual timing/preference-lease assertions; candidate passed5/5. All source/dependency/lifecycle guards clean, cleanup0. Candidate receipt SHA2563ee44c71c55706392a6b56530269ad99c1758dc28b2d08fe7613f4cfa08b084a; control907c11d5a937603070414c21d633ba30b760bda8fc962e9917fc02759fd7bb1c.

## Remaining before this candidate's publication

- Complete original Button/Select and CLI renderer regressions, sole finite CSS reversion, scoped types, official formatting, spec/lifecycle validation and generated-output check. Preparation does not count as execution.
- The new finite CSS atom affects only border-color, preserving existing150ms/easing defaults. Production document/shadow CSS emitter tests are not browser frames or screenshot evidence.
- Exact new-head native motion, composited contrast, unchanged geometry/hit targets and screenshots remain pending. No new-head screenshot exists. Original af3 native1pass/1fail and2.765625px anchor shift remain unresolved; the published diagnostic prefix and original assertions are preserved.
- The optional next native append must preserve the entire current32983-byte source prefix, not overwrite it with the older14707-byte carrier. Broader #398/#559/#1159 and current-main integration remain open.

Keep Draft. No full CI acceptance, formal approval, readiness, merge or broad Issue closure is claimed. The original design/rejection notes below are verbatim historical preparation, not current completion claims.

---

# Brutalist Select Item incoming border motion — static draft

2026-11-02; source #398/#1159/#559, parent #890. Candidate source parent af3a15a9d1308653c01dfbc6b997a1beca33d75c. Static only, not executed or accepted.

## Historical r1 preparation — rejected before execution

Pinned upstream Select Item has no transition: this is an explicit Proto extension requested for consistent actionable feedback, not an upstream parity claim. Existing active/hovered/focused/focusVisible/pressed paint and selected-only check ownership are retained. Only incoming enabled no-preference highlight gets transition-colors; outgoing/disabled/reduce/unknown gets transition-none. No timer, state mutation, extra action/focus owner, geometry or default-flat Trigger change.

- [x] Fresh PR/owner coordination and finite six-path claim in existing #398; Header/Rhea no overlap.
- [x] Draft criterion and independent T mapping specify immediate outgoing paint, live preferences, actual contrast/geometry obligations.
- [x] Prepared product projection and five real-runtime feedback controls; none executed.
- [ ] Preserve existing two native cases and append actual two-Item pointer handoff frames, same-node no-preference/reduce round trip, composited color contrast, immediate old-highlight exit and failed raw artifacts.
- [ ] Independent static review, exact scoped baseline/candidate/reversion, type/spec/format checks.
- [ ] Actual new-head native CI and screenshots, independent acceptance and current-main integration.

Contrast uses actual user-agent computed foreground/background, not antialiased screenshot glyph colors; normal-size enabled text requires an unrounded ratio at least 4.5:1. Unsupported gradients/filters/opacity must fail the measurement rather than silently assume white. Reference: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html . This conservative probe does not certify unrelated themes or disabled contrast.

No old logical/native/Vercel result is borrowed for this candidate. Existing old Select beta.active failure remains a separate recorded blocker if reproduced; motion must not conceal two-highlight semantic errors.

## Static r1 design rejection — 16:38 UTC, not a shipped regression

Independent static review found canonical dark resting colors #262626 / #f5f5f5 versus highlighted #5294ff / #000000. Continuous foreground and background interpolation reverses their relative luminance order, necessarily crossing equal luminance (approximately 1:1 contrast) between endpoints. Sparse frames cannot disprove this continuous counterexample. The transition-colors r1 candidate is therefore blocked before execution/publication; all five prepared token tests are insufficient to establish safe visual motion.

Next design under review: animate only transparent-to-black border color, keep existing background/foreground pair instantaneous, and immediately remove outgoing timing. Existing finite canonical CSS vocabulary does not yet admit transition-[border-color]; broad transition-colors or transition-[color,border-color] is not a safe substitute. No new theme-specific prototype condition, timer or interpreter is proposed. Any minimal atomic CSS vocabulary extension requires its own reviewed scope and document/shadow output controls before the revised Item can execute.

## Revised r2 static design — 16:43 UTC

Replace r1 color-pair interpolation with the single finite ordinary utility transition-[border-color]. The utility adds only CSS transition-property:border-color with existing 150ms/easing defaults, with no component identity dispatch or runtime interpretation. Foreground/background keep their original instantaneous pair, avoiding the continuous luminance-crossing counterexample. Positive document/shadow output assertions and unsupported neighboring-property negative controls are prepared. The official token generator has not run; the copied manifest remains unchanged and is deliberately not called current. Generated theme must remain byte-identical.

Native evidence must show text/background always at original endpoints, real nontrivial incoming border interpolation, immediate outgoing border reset, unchanged rectangles/hit targets, and full live preference round trip. All intermediate contrast assertions remain required; this is not yet visually verified. The r1 rejected source directory and static review history remain intact.

## Actual delivery checkpoint — 2026-11-03 05:15 UTC

The earlier preparation and 04:24 remaining-work lists above are historical checkpoints. The following results supersede their pending local checks without erasing the original failures. This remains a Draft contribution, not complete native or repository-wide acceptance.

- Fixed current source before this record-only appendix: tree `87be5bd0697c1b06a7e74132cb95d562e574906e`, based on published `21d749af6fae1ce7f106979ee555d8661ace9f32`. The seven product/test/spec/generated files retain the exact validated bytes; this appendix changes only the record.
- Final original Button/Select collection18 and same-original-plus-Item collection23 both match their complete inventories. Actual original17/18 and candidate22/23 retain the identical Select `keeps selection check-only while active and focused items receive the accent pair` failure at `select.test.ts:381:44`; all five added Item cases pass. This does not repair or conceal the existing Select active-state assertion failure.
- Item sole-product discrimination with the repaired asynchronous Host fixture is old0/5 versus candidate5/5 at real timing/preference-lease assertions. The earlier both-sides0/5 missing-scheduler failure remains a fixture failure, not product evidence.
- Complete production CSS emitter regression is baseline74/74, same-test sole-CSS rollback74/75 with only the new finite-border case failing, and candidate75/75. Document and shadow emitters both accept the exact border-only atom and reject the three unsupported neighboring property lists. These are production CSS string checks, not native animation frames.
- Both exact scoped TypeScript checks exit0. The final official workspace schema/graph plus changed/new entity authoring check, official eight-file formatting check, and unchanged canonical style generator `--check` all exit0. Last receipts: spec `71896c48`, format `cfcd5038`, style closure `53eef1d6`. Original105 dependencies, source/lifecycle guards and cleanup0 remain bound to every actual phase.
- The actual unchanged-generator pair is511 without Item versus512 with Item, exactly one new `transition-[border-color]` and unchanged theme. Against the previously checked-in519 manifest, this published512 output also removes the eight source-attributed false conjunctions documented in the linked official-pair comment. No token list was edited by hand and legal Radio/all/dark variants remain.
- Complete-scalar formatting comparison retained exit1 for three test `ArrayLiteral.multiLine` layout flags, with no comparator weakening or whitelist. Both product AST snapshots and all raw literals, parentheses, flags and comments matched; six negative controls were rejected. The three exact array-layout changes were independently read, then the formatted files were validated as a new candidate with the actual source runs above. This is not a strict-equivalence pass.
- Preserve the first eight-file formatting exit1: the first official YAML output was not stable. A second official output adds only one blank line; complete parsed values are equal and the subsequent official check passes. Preserve the two original spec errors as well: the new test lacked its draft rationale and the prototype's new test edge inherited an earlier version. The corrected edge explicitly starts at0.3.0-alpha.1 and the new test explains its remaining native evidence gap; no lifecycle or implementation status was promoted.

The entire published32983-byte native diagnostic file is unchanged in this eight-path increment. Exact new-head native border interpolation, instantaneous foreground/background contrast, geometry/hit stability, four-runtime behavior and screenshots remain pending. Original af3 native1pass/1fail and the2.765625px anchor shift remain unresolved. No old image, deployment status, scoped logical pass or generated CSS is substituted for new UI evidence. Keep the wider Issues and current-main integration open.
