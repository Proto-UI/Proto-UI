# Base Slider Values A/B: new reconstruction plan

Date: 2026-10-11 UTC. This plan now includes newly executed reconstruction evidence below. It is not the lost historical patch or an acceptance record.

## Recoverable and missing

The former local Values worktree, complete patch, manifests, test logs and independent-review archives are absent from the currently accessible workspace. The implementation responsibilities, public API decisions, review failures and corrective direction remain available in task correspondence. Those facts support a new implementation; they cannot recover identical source bytes, test bodies, artifact hashes or exact historical trees. Every reconstructed source file and test must receive a new identity, execution and independent review.

The State author alone restored the formal 764d02f baseline and the generic number-list prerequisite. This reconstruction is based on published d2d3ea63c485fbfe4a4a794dc797e28cf665db80, including the separately reviewed own-output-slot setter repair (source tree37934baae3675ca88b0038e3a3acfd7be9d7fe01). It will not duplicate the clone or change State, Props, Adapter, Compiler or CLI generator behavior. Publication belongs to the sole publisher.

## Scope and public entries

Restore an additive draft family with six static entries and matching hooks: sliderValuesRoot, sliderValuesTrack, sliderValuesThumb, sliderValuesIndicator, sliderValuesLabel, sliderValuesValue. Use SLIDER_VALUES_FAMILY, not an inheritance/profile trick that relaxes the original scalar family's max-one structure. Existing scalar Slider entry files, callback types, behavior and capture/retirement fixes remain unchanged.

Root Props accept a finite number or readonly finite number array for value/defaultValue. Both valueChange and valueCommit carry a JSON payload with union-valued value, activeThumbIndex and reason. The new API requires union-capable callbacks. Existing scalar exports still require number callbacks. Compile-time negative controls must test those actual exports, not only a structural substitute.

Resolved Props are the portable input boundary: type:any remains the existing JSON domain. Consume only props.get() and props.watchAll(). Mode is selected at creation solely by non-null resolved value, including legal hook default layers. Do not branch on getRaw, watchRaw or isProvided. A composed setDefaults({value:50}) is controlled constant50; setDefaults({defaultValue:50}) initializes an uncontrolled owner. Canonical null is empty. Nonempty malformed JSON selects controlled mode but is diagnosed by the Root; later valid resolved data may recover. Non-JSON host data follows the generic Props fallback before reaching Root, so Root cannot reconstruct or promise diagnosis of NaN, accessor or sparse-array raw spelling.

## Facts, projections and ownership

- The current number.list State is the only accepted business-value owner. It stores unwrapped scalar data as a vector plus shape, or array data in original order. Normalize negative zero according to number.list. [] stays an empty array, not a manufactured fallback slot.
- Display is a fresh scalar-clamped or array-sorted projection derived directly from current values. Context and parts receive that projection. There is no separately writable display list and no closure array as an owner.
- Creation/reset data, session start and last uncanceled proposal are explicitly declared number.list history/interaction facts. None restores display as a second owner.
- getValue returns a safe copy of the unwrapped current owner in its shape. getDisplayValue returns the fresh display projection. Invalid configuration/input makes editing unavailable and exposes an honest diagnostic.
- Capture fixed ownership mode before validating policy or owner. Capture a safe creation owner even when policy is initially invalid. If resolved creation data is wrong-shaped JSON, the first later safe owner establishes the creation/reset snapshot. Later uncontrolled defaults do not rewrite it.
- Root authoritative controlled Props may change vector cardinality and scalar/array shape. A real controlled/uncontrolled mode transition is unsupported and diagnosed; it is not silently transferred.
- Empty owner has zero editable slots. Consumers render zero Thumbs. Retained caller-owned Thumb nodes are disabled while unmapped; Root does not claim to remove/hide them.

## Notification, veto and publication

valueChange is a pre-publication proposal notification. Receiver-scoped cancelValueChange() is valid only during that Root's synchronous notifying phase. Its declared veto State is read after emit; callback false/throw does not cancel. Late calls and nested edits are rejected. It cannot authenticate who called a receiver's method. Four synchronous Adapter carriers require new evidence; asynchronous decision-return hosts are not admitted.

A controlled owner ignoring/delaying a proposal is not cancellation. An uncanceled changed proposal advances declared interaction history and may commit without Props echo. There is no receipt token or equality-based causal ACK. A same-owner no-op or later canceled request does not erase a prior uncanceled proposal. A changed interaction returning to its start may still commit. Logical cancellation discards pending completion but does not roll back values already accepted by an uncontrolled owner.

Use declared idle/notifying/publishing phase, dirty flags and revision facts. Owner Props arriving during callbacks/publication must be reconciled, not discarded as nested edits. Re-check readiness, revision and parts after callbacks before immediate keyboard commit/focus. Individual state observers may see publishing; an idle edge is a quiescent boundary, not a cross-slot transaction. A bounded reconciliation guard may explicitly disable editing on nonconvergent feedback rather than claiming convergence.

## Keyboard and parts

Thumb slots use explicit index or public Anatomy order. An index selects a sorted slot, not a host node identity. Require complete unique live slot mapping before indexed edits. Membership/reindexing invalidates the prior logical session while surviving nodes remain retained. Each enabled Thumb is ordinarily Tab reachable; do not add roving focus. A live orphan still throws its required-context error; public retirement/anatomy availability may guard only callbacks made invalid by retirement. Tests distinguish dynamic Thumb removal, Root-first teardown, retained remount and genuinely live missing context.

Thumb requests route through Root. Keyboard arithmetic follows a separate operational Number implementation: min-relative rounding, root/neighbor constraints, all-adjacent minimum-distance validation, absolute largeStep, and RTL reversing only horizontal left/right movement. Owner acceptance does not quantize, repair spacing or rewrite input order. Do not import the historical BigInt model into production. The helper author must explicitly document representable-domain/precision diagnostics instead of arbitrary epsilon or global finite-value promises.

Root, Thumb, Indicator, Label and Value project orientation, direction and applicable disabled/readOnly policy. Multiple Indicator segments select indices. Root inherits Field disabled/readOnly only; grouped Field control registration was never delivered.

Track is structural in this slice. No AxisInput recognizer is added until the public origin/session association gap is solved by its owner. Nearest-thumb seeking, off-center grabs, pointer push/swap/none collision processing, pointer focus transfer, capture/cancel cleanup, visual family parity, native browser/AT evidence and Compiler translation remain unfinished.

## New checkpoints

1. Preserve this plan and known review witnesses. Bind it to the State author's new checkout when available. Read current AGENTS and the applicable C/P/T definitions before edits.
2. Rebuild and independently test the pure numerical helper and safe owner/display split. Its restored tests are newly executed evidence, never old R4 evidence.
3. Rebuild the Root/public contract and minimal true Runtime ownership/publication tests. Re-run creation-policy, JSON-shape, portable fallback and legal default-composition witnesses before adding parts.
4. Rebuild indexed parts, real Adapter veto/retirement tests and ordinary static registry entries. Generate actual facades using unchanged generator code. Recheck legacy scalar type/behavior and known outstanding defects separately.
5. Freeze each coherent checkpoint with a new manifest and complete patch against its declared prerequisite. Let the sole publisher save reviewable progress early; no external publication by this author. Final independent review must bind the actual new tree, not historical R4 hashes.

## Validation obligations

Targeted tests; actual scalar/vector type positives and negatives; workspace types; definition/schema/authoring checks; catalog evidence integrity; old scalar capture/finite-input regressions; Base package build; real generated facades; package measurement under the actual applicable policy; normal hooks. Preserve failures and report every unhandled error as failure.

The earlier Vue2 generated scalar and Values facades shared TS2322, the prototype catalog had 550 existing diagnostics, and old scalar owner50/request60/request50 committed50 while the newer proposal process committed60. These are historical observations to re-establish, not current results or permission to fix them inside this reconstruction. No completion ledger count increases for an A/B slice.

## Newly executed reconstruction evidence

The new diff contains 25 owned files: 6 static prototype entries; shared setup, types, Context/family and independent numeric helper; additive exports and ordinary CLI metadata; 6 test/type files plus the numerical and publication suites; 4 C/P/T updates and this record. It contains no Core, State, Props, Adapter, Compiler or generator semantic change. State source is the already published prerequisite.

Fresh targeted execution passed 398 tests in 14 suites: 185 reconstructed tests, 200 existing Slider/model regressions, 10 State prerequisite tests and 3 catalog-integrity tests. The reconstructed set is 75 numeric, 25 owner/parts, 52 publication, 25 synchronous carrier, 3 ownership-boundary and 5 registry tests. All completed without unhandled errors. The four carrier suite uses framework/happy-dom harnesses, including fake React; it is not native-browser evidence.

New preserved red-to-green witnesses cover effective readOnly/disabled projection with invalid numeric policy, revoked Proxy rejection at the direct request boundary, an inherited numeric-index setter during local owner copying, completion-time interaction observers invalidating eligibility, and feedback-limit failure reaching retained Thumb disabled projections. The latter two came from the current independent reviewer's pre-read; their author tests were both red before the narrow fix. That reviewer subsequently found terminal Runtime disposal inside public State notifications. The initial local reproduction preserved five failures and one strict-context passing control; the revised suite includes all eight reviewer lifecycle witnesses plus five reconciliation disposal cases. A follow-on repeatable-unmount selected-slot regression was independently anticipated and reproduced red before distinguishing the lifecycle cleanup scope from old edit frames. A never-mounted terminal-disposal control also passes. Old Root frames now check the existing retirement gate after exposed notifications before their next State access or emit, without swallowing live errors. The reviewer then exposed the same boundary in part projections: two self-disposal cases and one Root-first case were reproduced red. A retained Thumb moving synchronously to another live Root also reproduced an old percentage write over its new value. Parts now declare a scalar projectionRevision fact, checking generation and observed Root availability after public notifications; this is not another current-value owner. Twenty added controls cover all ten exposed projection-State notification points for part-first and Root-first retirement. A nonfinite logical-session index was separately reproduced red and now rejects before any session writes. Those changes use only existing State, Anatomy, Context and lifecycle protocols. These are current evidence, not substitutions for the missing historical red archives.

Workspace TypeScript and the actual-export public type suite passed. Removing all seven expected-error annotations produced exactly seven compiler errors (legacy array input, nonnumeric vector, narrow new callback, scalar/vector method mismatch, union/null readout and readonly list mutation). The unchanged generator produced the real old and new six-part facades: React, Vue and Web Component strict checks passed; Vue2 old and new facades both retain TS2322 at Vue.extend binding and are not admitted as passing. Base build passed for 14 dependency-closure packages, including 652 Base output files. Dependency link/resolution receipts bind all Proto workspace dependencies to this worktree rather than the prerequisite checkout.

Spec authoring and three catalog-evidence integrity tests passed. The complete prototype catalog still fails with 550 diagnostics; an archived published d2d3ea63 baseline produced the exact same diagnostic list, with zero added or removed entries. The Finf scoped advisory package measurement completed successfully while honestly reporting withinBudgets=false: runtime 82,795/78,500 gzip bytes, React 115,065/106,000, Vue 114,884/106,000 and Web Component 140,961/132,000. This is not strict-budget success or a changed ceiling. Normal pre-commit formatting passed; its only late change was an export-line wrap.

Local evidence is frozen separately with exact base/tree, complete patch, file/hash manifest, commands, logs and limitations for independent review and the sole publisher. The old scalar asynchronous 50→60→50 completion behavior remains separately observable and unchanged. No full Slider, Range, Multiple Thumbs, family, Field, native or Compiler completion is recorded. Review and publication are still pending at the time of this record.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.
