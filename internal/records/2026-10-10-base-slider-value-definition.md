# Base Slider value definition: architecture-blocked runtime

Date: 2026-10-10 UTC. Baseline: PR #872, `2a67cb6173020c487591724538ca56e03f14a1ea`, tree `af287fdbda0bc5ab21e7a0ed59f328e51f5d7e86`.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Outcome and boundary

The user requested Base expansion after comparing the official Range, Multiple Thumbs, Vertical, Controlled `[0.3, 0.7]`, Disabled and RTL examples. The existing component implements only one scalar value and one Thumb. A new array prop by itself would not satisfy the request.

This change delivers draft `C-SLIDER-VALUE-0001`, `P-BASE-SLIDER-VALUES`, `T-SLIDER-VALUE-MODEL-0001`, an independently authored pure mathematical model, and a minimum generic State requirement handoff. The catalog is the proposed semantic source; this dated record explains the investigation, alternatives and outstanding decisions. No public Slider type, runtime source, Compiler, CLI, Core, family paint, native code or demo changes here. The model is not exported or imported by a component. Model results are immutable data, never an alternative state owner.

**Runtime status: architecture-blocked.** No Range, Multiple Thumbs or controlled-array example is implemented by this packet. Vertical, Disabled and RTL retain their existing scalar implementation and previous evidence limits. Nothing here changes a Finf completion count.

## Inspected upstream and license

Official documentation: https://base-ui.com/react/components/slider . The official Shadcn examples are https://ui.shadcn.com/docs/components/base/slider . The inspected fixed source locator is Base UI tag `v1.6.0`; the content hashes below bind the retrieved bytes without claiming the tag is immutable or inventing a resolved commit.

All source URLs begin `https://raw.githubusercontent.com/mui/base-ui/v1.6.0/`:

| Path | SHA-256 |
| --- | --- |
| `LICENSE` | `07fc1b39d69d14bc7d40482a628f47226258eb01265db68ae684944b916beb2a` |
| `packages/react/src/slider/root/SliderRoot.tsx` | `4b7e4f7bb6a8e996f61e6182fe0dfdac1379338b2bc416d29559ed933490fd9f` |
| `packages/react/src/slider/control/SliderControl.tsx` | `1f39b56baff57d5a8e7de215313dbfe5725aac04a29576a19fb1993a2807e492` |
| `packages/react/src/slider/thumb/SliderThumb.tsx` | `daeabeb0e7c20ec5d18d21c01fd610c793c3da4890be615f0b5245086528038f` |
| `packages/react/src/slider/indicator/SliderIndicator.tsx` | `8c845e53bf7a8069eb0c073ae18b81ee8fbfb441340982b086dab76c25c1ff6d` |
| `packages/react/src/slider/utils/getSliderValue.ts` | `d8b6ce2b0d5e4b6fce0b5ddb8f4985433c426d93f2e8bf93cf39f0650d8b5bb6` |
| `packages/react/src/slider/utils/getPushedThumbValues.ts` | `72fb5a4267cc9e8bc8551e11f7c3a1d03bc3f17bef39af1b4afceaa5e48a77c9` |
| `packages/react/src/slider/utils/resolveThumbCollision.ts` | `0538aff66a967f7cd39c9625d054c66770ff55093e383e746ffdbd8f2f02f8c2` |

The source is MIT, copyright (c) 2019 Material-UI SAS. The independently authored model's collision behavior is source-informed; the license and attribution are retained in `internal/models/SLIDER_UPSTREAM_NOTICE.md`. Only static reading/download occurred. No downloaded third-party implementation was imported, built or executed. Tests run our own model and existing repository dependencies.

### What upstream establishes, and what it does not

- Root accepts `number | readonly number[]`, sorting range values and preserving array input ownership. It exposes `largeStep`, `minStepsBetweenValues`, pointer `push`/`swap`/`none`, and a changed/uncanceled commit callback.
- Control selects an explicitly pressed Thumb or the closest enabled visual center, with later-index ties. A stack at maximum selects the earliest maximum Thumb. It owns one pointer/touch interaction and retains start values for swap handling.
- Pointer push changes neighboring values; going back does not restore them. Swap changes one adjacent pressed index per sample; its algorithm uses a start snapshot to restore affected positions. None clamps between neighbors.
- Thumb keyboard input constrains the same sorted slot. It supports absolute `largeStep`, Home/End, RTL Left/Right, and separate focusable inputs. Normal Tab traversal reaches all enabled Thumbs. A single roving tab stop would be an incorrect substitution.
- Indicator spans the first-to-last range; a scalar fill begins at the minimum. The official Indicator does not expose the proposed Proto `startIndex`/`endIndex` segment API.
- The upstream hidden native range input carries root min/max; neighboring keyboard limits are handled in JavaScript. The proposed dynamic per-Thumb ARIA interval is a deliberate accessibility direction, not a claim that the inspected source already emits those ARIA attributes.
- Root's React state, hidden inputs, DOM geometry, event-target mutation, browser focus calls and ResizeObserver are implementation details to translate through existing Proto ownership and host contracts. They cannot be pasted into a host-neutral prototype.
- Current official source's pointer commit can carry the latest applied proposal. The proposed Proto controlled protocol distinguishes a proposal from an acknowledged owner value. That difference requires explicit compatibility review; it must not be silently labeled exact upstream equivalence.

For invalid new vector Props, the proposed transaction is rejected as a whole: keep the last valid accepted values and policy together, cancel any active gesture, expose a distinguishable diagnostic and disable editing until a valid configuration arrives. Invalid initial vector input fails interactive composition admission rather than inventing `[0]` or silently dropping a Thumb. This is a proposed strict vector boundary; the current scalar Props fallback is not altered. The exact public diagnostic carrier still needs definition before implementation.

## Existing authority versus the missing primitive

| Existing definition | What it permits | What it does not prove |
| --- | --- | --- |
| `C-PROPS-0003` | JSON arrays as input | A component-owned vector state slot |
| `C-CONTEXT-0001`, `C-CONTEXT-0009-C` | Official component communication; JSON arrays in records | Context as an alternate value owner |
| `C-STATE-0001-B` | State expresses internal continuity and change history | An uncataloged mutable array closure |
| `C-STATE-0002` | Stable named slots defined during setup | Defining a new slot for each runtime-added Thumb |
| `C-EXPOSE-0001-E`, `C-EXPOSE-0007` | Classified outward methods, including an explicitly documented `getValue()` capability | An automatically serializable/compilable method body, or an array State handle |
| `C-EXPOSE-EVENT-0001/0002` | Declared signals and a JSON payload intent | Full enforced portable payload boundaries, ordering or delivery |
| `C-EXPOSE-STATE-0001` | Read-only views of real State slots with stable lifetime identity | Advertising `State<number[]>` when no such StateSpec exists |
| `P-BASE-SLIDER-THUMB`, `P-BASE-SLIDER-FIELD-THUMB` | Existing one-owner focus/pointer facts and lease cleanup | Multiple values, dynamic identity or upstream-wide admission |

`packages/types/src/state.ts` admits only bool, enum, string, number.range and number.discrete. `packages/core/src/state.ts` exposes corresponding setup-only definitions. Existing array closures elsewhere in the repository are observations, not semantic authority or evidence that a Compiler can interpret them. No currently applicable Slider entity supplies the missing collection slot.

Rejected shortcuts: a JSON-encoded string slot; a hidden mutable array plus revision counter; one state owner per Thumb; preallocating an arbitrary maximum number of scalar slots; maintaining an application/React copy; embedding slider branches in Core/Compiler/CLI; and claiming JSON event serialization makes JavaScript closures portable. The model does none of these.

## Proposed public API and compatibility review

The names below are a proposal, not shipped exports. Public changes require the typed compatibility work listed below.

| Surface | Proposed direction | Compatibility condition |
| --- | --- | --- | --- |
| Root `value`, `defaultValue` | `number | readonly number[]`; preserve caller shape | Existing numeric props retain their meaning; initial and later normalization must be tested separately |
| Existing Root `value`, `percentage` exposed scalar handles | First-slot read-only compatibility projections from the sole vector owner | Existing numeric readers and styled hooks keep their types; no independent write authority |
| New Root `values` exposed handle | A real read-only collection State view | Blocked until a generic collection State exists; do not declare a fictitious handle |
| `getValue()` | A copied shape-preserving snapshot for imperative readers | Optional convenience, not a subscription mechanism or replacement owner |
| Existing `requestValue(number)` | Retain scalar operation; reject ambiguous use in vector mode | Do not reinterpret a legacy numeric call as editing an arbitrary active Thumb |
| New `requestValues(readonly number[])` | Whole-vector request to the same Root owner | Validate shape, finite entries, spacing and membership; not a second store |
| New `requestThumbValue(index, number, reason)` | Request one explicitly named sorted slot | Root resolves collision/constraints; parts never mutate neighbors themselves |
| `beginInteraction()` | Legacy scalar call stays valid | Multi-value start must carry explicit selected index and session identity |
| `commitValue()`, `cancelInteraction()`, `resetValue()` | Root-owned completion/cancel/reset | Existing caller surface preserved; changed-only commit is separately reviewed before runtime modification |
| `valueChange`, `valueCommit` | Shape-preserving JSON outward payload plus index/reason/session data | Existing scalar callback source compatibility must be proven before widening a shared event type |
| Thumb `index`, `ariaLabel`, `valueText`, `disabled` | Index identifies a sorted slot; per-Thumb naming and policy | Omitted index remains valid only in the old scalar/one-Thumb composition |
| Indicator `startIndex`, `endIndex` | Optional explicit read-only segment; omission means scalar/outer range | This is a proposed Proto extension, not an official Base UI prop |
| Root `largeStep`, `minStepsBetweenValues`, `thumbCollisionBehavior` | Numeric increment, minimum gap, pointer collision mode | Existing implicit `step * 10` keyboard behavior must not change unnoticed when a new default is selected |

Type-level compatibility is not solved by writing a union. A callback previously accepting `{ value: number }` cannot automatically handle `{ value: number | number[] }`. A possible generic `SliderRootExposes<V = number>` preserves an old type alias's default but does not by itself specialize the actual exported prototype or all generated facades. Required review must choose and test explicit scalar/vector specialization or another honest additive public surface. No `any` cast or fabricated overload is accepted as compatibility proof. This packet changes none of those public types.

### Facts and projections

- Accepted vector: one Root-owned generic collection State slot. This alone is the current value source. Controlled input enters only through an accepted Props receipt.
- Shape: scalar/array mode, explicit and retained for outward values. It is not inferred from array length.
- Session-start snapshot and creation/reset snapshot: Root-owned historical facts. They are immutable and cannot be used as a competing current value.
- Pending proposal and its session/revision/index: request facts. They may support an owner acknowledgement, but cannot update display, ARIA, Field, commit or focus until acknowledged. A proposal can be discarded.
- Effective disabled/readOnly, orientation/direction and normalized constraints: Root policy. Per-Thumb disabled is additionally local eligibility, not a value owner.
- Active index and accepted interaction phase: Root interaction facts. Track retains only its actual AxisInput lease acceptance, never a mirrored vector.
- Thumb scalar value, percentage, bounds, label/value text, hover/focus/pressed: projections/own interaction facts on that same stable instance. Its index is a sorted value-slot identity, not a numeric value key or inferred DOM position.
- Indicator start/end/extent: numeric read-only projections. Several Indicators may observe different intervals of the same vector.
- Form value: the complete accepted shape through one Field binding. Multiple existing FieldThumb bindings cannot each register a competing field control. A proper composition must first define a single group binding and collective focus/blur semantics.

## Input policy and source comparison

The model reports `normalization.reordered` and a stable `sourceIndices` permutation; it does not silently discard source order. Each source index identifies where a sorted slot came from in that one normalization result, not an enduring Thumb identity. Equal values retain their input order. The caller's frozen or mutable array is never edited. A future runtime must explicitly define sorted-slot semantics, diagnose an input reordering, and cancel an active session before adopting any normalization that changes slot correspondence. It cannot transfer focus merely because a numeric sort moved a value. An owner update with the same normalized values still does not acknowledge an unrelated pending swap. There is no runtime implementation of these safeguards in this packet.

| Input / change | Inspected official source | Proposed Proto vector policy |
| --- | --- | --- |
| Unsorted owner array | Root `values` uses a copied ascending sort | Copy and report permutation explicitly; no silent focus/index reassignment; runtime correspondence change cancels first |
| Caller array mutation | Root sorting copies its input | Model never mutates it; immutable owned snapshots required |
| Empty array | No explicit nonempty runtime guard found in inspected Root normalization | Explicit invalid-value; no manufactured scalar Thumb |
| One-item array | Array input is retained; most geometric range branches use more than one value | Preserve array shape; geometry uses scalar fill; event type cannot silently become number |
| Duplicate values | Ascending values can contain duplicates; maximum stack has special pointer selection | Preserve stable duplicate ordering with zero gap; reject duplicates if positive spacing is required |
| Length or shape changes | React state/Thumb maps update; this inspection does not establish a cross-host session contract | Invalidate session/capture before adoption; no late sample or implicit Thumb creation |
| Minimum spacing cannot fit | Utility clamps to derived per-index limits; no explicit global feasibility admission found in the inspected utility | Explicit infeasible-spacing; never silently reduce requested gap or number of Thumbs |
| Owner input already violates spacing | Root sorting does not repair it; interaction paths validate distance | Explicit invalid-owner-spacing; normalization does not push values without a request |
| `min > max` | Development warning when min is not below max | Explicit invalid-policy in the vector model; existing scalar fallback remains unchanged |
| `min === max` | Same upstream development warning | Permitted only at zero spacing, matching the existing scalar finite-range direction; no motion |
| NaN/Infinity, sparse arrays, wrong element type | No complete uniform Root-vector validation is established by this static inspection | Explicit invalid-value; holes/invalid entries are not deleted or replaced |
| Fractional/negative minimum step count | Source prop type is number; utility multiplies it | Model requires a nonnegative integer; deliberate stricter proposal |
| Decimal steps | Source quantizes relative to min and applies fixed-decimal collision cleanup | Model checks decimal boundaries and exact quantized crossing; avoids fixed-decimal underflow |
| Very large finite bounds | Source direct range subtraction can overflow | Model uses finite convex interpolation and iterative gap bounds; exact endpoint preservation, including an endpoint off the interior step grid, is a proposed numeric refinement |
| RTL and vertical | Coordinate and keyboard mapping change | Values stay ascending; vertical maps physical top to maximum independently of direction. Track already receives normalized AxisInput positions and must not reverse them again |

### Required public-type negative controls (planned, not passed)

Before modifying public types, add compile fixtures against the exact old scalar source: numeric `value`/`defaultValue`, `requestValue(5)`, `value.get(): number`, numeric hook handles, and callbacks explicitly typed `(event: { value: number }) => void` across every supported facade. They must still compile against the chosen scalar-compatible entry without casts. Add vector-positive fixtures for readonly/frozen arrays and the specialized event shape. Negative fixtures must reject vector callbacks attached to scalar entries, number-only callbacks attached to vector entries, nonexistent array State methods, mutable writes through read-only collection handles, and ambiguous scalar requests on a typed vector entry. Run these under strict function variance; a broad `any`, erased callback or a generic alias never exercised through the exported prototype is not evidence. This packet does not yet provide those typed entries and therefore makes no backward-compatibility assertion about a future widening.

## Lifecycle and ownership decisions to realize

| Event | Required behavior | Evidence still needed |
| --- | --- | --- |
| Initial uncontrolled creation | Snapshot normalized `defaultValue` once; later defaults do not reset it | Real Root lifecycle test |
| Initial controlled creation | Adopt valid normalized `value` without emitting a user change | Controlled adapter tests |
| Controlled request | Emit a proposal; display/current State stay at owner value until valid Props receipt | Immediate, asynchronous, rejected and transformed owner replies |
| Owner accepts swap | Atomically publish new vector and active sorted index, then focus the existing target Thumb | All Runtime carriers and focus/AT evidence |
| Owner refuses or changes a proposal | No optimistic swap/focus drift; obsolete acknowledgement cannot revive the old session | Revision/session interleaving and late-reply tests |
| Same-shape accepted value update during session | Attribute only a matching pending request; unrelated update cancels/rebases the session explicitly | Owner receipt protocol design |
| Shape/length/constraints/direction/orientation changes | End old session and revoke capture before adopting new facts; require fresh start | Cross-part policy changes and late samples |
| Thumb add/remove/reindex or duplicate/missing slot | Cancel active session; fail editing closed until one live eligible Thumb per slot | Stable instance identity, remount, swapped-slot and teardown tests |
| Uncontrolled cancel | Restore start snapshot, clear session and revoke capture; emit change only if restoration changes accepted value | Root/Track/Thumb retirement and cancel tests |
| Controlled cancel | Request restoration without overwriting owner; no commit, regardless of reply timing | Controlled cancellation/late owner reply tests |
| Commit | At most one completion for the accepted session, only when accepted values differ from start | No-op, return-to-start, canceled, duplicate and rejected requests |
| Reset | Restore creation snapshot by the same ownership rules and terminate interaction | Controlled/uncontrolled reset and Field tests |
| Controlled mode removed | Retain last accepted value as uncontrolled starting point; do not replay old default | Dynamic Props ownership tests |
| Controlled mode added | Cancel old session, adopt valid owner input | Dynamic Props ownership tests |

Existing r3 lease behavior is a hard preservation target: Track revokes through public `AxisInput.sync({ disabled: true })`; a Boolean guard alone is insufficient. Root reset/cancel, required part retirement, policy changes and teardown close the actual capture. Late samples cannot resume it. Restored anatomy admits only a new start. Strict live anatomy queries remain strict. Pointer-origin plus accepted Root session determines pressed; captured leave clears hover but preserves press. Existing 73-case session coverage must continue to pass when runtime work eventually lands.

Controlled acknowledgement is an additional unresolved protocol, not solved by collection State alone. A future implementation needs a verifiable Props receipt/revision or an explicit acknowledgement token associated with the emitted request and session. Equal array contents alone cannot prove which asynchronous request was acknowledged. A stale receipt cannot revive a canceled session, while a new owner-authoritative value still replaces the current accepted input under the declared cancellation policy. These controls require a generic representable request/receipt mechanism or a reviewed existing definition, never an opaque optimistic closure. This packet supplies no such runtime mechanism.

## Minimum generic collection State requirement handoff

This is a requirement proposal for a separate task, not permission to implement Core or Compiler changes. It need not begin with an unrestricted JSON/object State; an ordered collection of an already-governed scalar value domain is sufficient for this consumer.

| Dimension | Minimum requirement | Difference from existing definition |
| --- | --- | --- |
| Type/domain | Setup-time declaration of one named ordered collection slot, with finite-number element domain, empty/default/cardinality policy and runtime validation. Dense immutable values only; no functions, handles, holes, host references or nonfinite JSON numbers. | Current `StateSpec` has no collection kind. A TypeScript array annotation supplies no runtime spec. |
| Slot identity | The slot, owned/borrowed/observed views and external handle identity remain stable across value replacement, length changes and repeatable view detach/remount. Terminal disposal invalidates them. | Existing scalar identity rules can be extended; allocating slots at runtime violates setup-only State. |
| Element identity | Numeric vector positions are ordered slots; collection State need not invent domain keys. Stable Thumb identity belongs to Anatomy and explicit index, independently of element values. | Do not couple State identity to numeric values, DOM order or a slider-specific key convention. |
| Dynamic length | Atomic whole-value replacement may change length without redefining State slots or exposing intermediate element insertion/removal. State validates its generic cardinality policy; Slider validates thumb membership. | Dynamic collection membership is currently not a State operation. |
| Ownership | One setup-defined owner writes. Borrowed and observed views retain their existing capability rules; outward handles remain read-only. Immutable snapshots cannot write through retained array references. | Plain array closures and exported mutable references bypass capability views and State change history. |
| Equality | Specify structural element equality, length/ordering significance, finite-number and negative-zero normalization, and whether equal replacements notify. Avoid reference equality after serialization. | Scalar equality is insufficient to settle array identity/equality or cross-host round trips. |
| Atomic write/notification | Validate the complete next vector before publication. One replacement has one previous/next snapshot and revision. Observers see the entire new vector, never pushed-neighbor intermediate states. Reentrant proposals must have an explicit order. | Existing scalar setters do not provide a collection replacement/notification contract. |
| Multi-fact consistency | At minimum define a publish boundary so vector, active index, session phase and Context/Expose projection cannot be observed as contradictory combinations. Determine whether existing synchronous scheduling is sufficient or a generic transaction is necessary. Do not add a Slider-only batch API. | A vector slot alone solves atomic neighbors, not atomic vector-plus-focus/session facts. This is an open design item, not an asserted existing feature. |
| Snapshot/history | Reading produces a stable immutable snapshot; later replacement does not mutate old values. A separately named snapshot slot or supported immutable capture records session start without becoming a second current-value owner. | Session snapshots cannot be invisible mutable JavaScript history. |
| Serialization | Collection spec, finite ordered values, revisions and observation records must have a canonical data representation preserving shape, order and membership. Invalid payloads fail explicitly. | JSON-compatible Props/Context and an event `json` hint do not specify State serialization. |
| Host translation | Runtime, Web, native and any future remote carriers receive equivalent read-only snapshots and notifications, with instance lifecycle and cancellation behavior intact. Host handles never enter the vector. | Current tests of one JS array cannot admit other hosts. |
| Compiler | A generic consumer must be able to identify the collection slot, declared element domain, replacement and projections, and separately represent transition logic. Unsupported translation must report an explicit capability gap. | Capturing a JS callback/closure and re-running it is not proof of interpretable portable definitions. No Slider whitelist or compiler branch is permitted. |
| Validation | Add contract tests for setup-only definition, invalid/sparse/nonfinite input, immutable snapshots, equal/reordered/length-changing values, single notifications, reentrancy, rollback/no partial publication, expose identity and terminal disposal. | The pure Slider model only supplies value examples; it cannot implement or certify this State contract. |

Suggested sequence: review requirements and compatibility; define the smallest generic State extension and its tests; implement it in its own authorized task; then implement Base Root/parts using that definition; finally map families and test actual demos, host input, accessibility and Compiler capability. A failure at any step remains visible rather than being bridged by an opaque component workaround.

## Coverage matrix and exact unfinished scope

| Requested/reference behavior | This packet | Runtime acceptance still required |
| --- | --- | --- |
| Range and multiple thumbs | Ordered model, pointer policies and draft part responsibilities | Root vector State, membership, live focus, one Field binding, all runtimes |
| Controlled `[0.3, 0.7]` | Finite decimal pure proposals | Actual Props receipt/rejection/late-update semantics and typed callback compatibility |
| Vertical / RTL | Numeric keyboard direction rules | Multi-thumb pointer coordinates and capture, rendered interval/focus, native host checks |
| Disabled / readOnly | Disabled-index nearest selection and draft policy | Per-part policy changes, focus and pointer eligibility, disabled-root/Field composition |
| Collision/minimum distance | Pure push/none/swap and spacing tests | Exact intended upstream differences, pointer sessions, controlled acknowledgements |
| Indicator / labels / Value | Interval data and naming requirements | Family CSS positioning, per-Thumb accessible names/value text, multi-value formatting |
| `largeStep` / keyboard | Pure numeric intent | Preserve old scalar `step * 10` default or explicitly review a changed default; actual key dispatch |
| Edge alignment | No new claim | Generic inset/geometry contract; do not move paint separately from input |
| Form `name` / `form` / native hidden inputs | Missing | One host-neutral Field owner plus appropriate form serialization; no browser input shortcut |
| Locale / number formatting / functional React label props | Missing | Data-only Proto equivalent and per-Thumb text/locale coverage; functions cannot be JSON Props |
| Native GPUI/Qt / assistive technology | Missing | Real host interaction and semantics, independent evidence |
| Compiler / static construction | Missing | General State and transition translation, explicit unsupported capability diagnostics |
| Shadcn visual parity / other families | Missing for new multi-value features | Source-bound paint mapping, screenshots and tested consumers |

The initial 8d30 model used quantized crossing thresholds and significant-digit cleanup instead of the inspected implementation's fixed epsilon and `toFixed(12)`. Independent review found that its cleanup invalidated endpoint preservation and its gap clamp could generate off-grid values; that model is blocked and superseded by the R2 reference policy below. It requires integer nonnegative `minStepsBetweenValues` and explicit invalid-policy results. Its keyboard gap clamp, controlled commit eligibility and dynamic accessible interval are proposed Proto semantics. These differences need review; they are not hidden as upstream parity. During model testing, the existing shared scalar quantizer was observed to move an extreme minimum slightly inward through its significant-digit normalization. The initial candidate added a model-only endpoint wrapper, later found insufficient because subsequent collision cleanup rounded endpoints again; it does not alter the runtime scalar implementation. Its iterative bounds avoided one overflow mechanism but did not establish consistent grid closure. The R2 model below replaces that arithmetic rather than treating the old green tests as acceptance. The model tests retain finite-span overflow and subnormal cases; these numeric refinements are explicitly proposed rather than claimed as inherited runtime behavior.

## Validation history

- Initial local test command ran before the intended test directory existed and found no tests; this is setup failure, not a behavioral red.
- After the test file existed, baseline red was missing model import. It demonstrates the deliverable was absent, not that mounted scalar behavior failed.
- First model run: 34/35 passing. The extreme fixture omitted its explicit min/max; corrected the test input.
- Second model run: 34/35 passing. The inherited quantizer's existing finite precision moved an extreme endpoint by approximately 4.4e-13 percentage points; changed the pure numeric projection expectation to a bounded tolerance, preserving existing implementation.
- Third model run: 35/35 passing. These are pure tests, not a runtime Slider green.
- Initial spec authoring run could not resolve `zod` in the new worktree. Reused the existing trusted workspace package links and reran rather than installing or executing the downloaded reference.
- Final exact-tree checks and packet hashes are recorded in the completion report; earlier failed logs are retained alongside it. No remote push is performed by this author.

- Expanded model boundary coverage: 48/48 passing, including explicit sorting permutation, duplicate/empty/length policy, decimal-step boundaries, symmetric/asymmetric finite-span overflow, huge finite minimum gaps, and RTL/vertical coordinate mapping without vector reversal.
- A deliberate overflow mutation reintroduced multiplication-based gap bounds without the final finite-candidate guard; its failing regression and the restored green are retained separately. It is a negative control, not a claim that this mutation was ever shipped.

- Catalog evidence integrity first rejected a `missing` implementation with no executable path. The repository's absent-future target vocabulary is `planned`, so that record is now `planned` with an explicit no-implementation note. This repairs evidence classification; the runtime remains missing and architecture-blocked.
- Whole-repository unscoped TypeScript ran out of the default 2 GiB heap. The canonical workspace command then reported the absent generated website Shadow-style declarations; generate those through the existing scripts before retrying. Neither failure is presented as a type pass.
- Prototype catalog remains red at 550 diagnostics on both exact baseline and candidate, with identical diagnostic lines. No unrelated debt was erased.
- Final model plus unchanged scalar/session/Field regression: 176/176 across six test files, including 48 pure-model and the existing 73 session cases. Synthetic scalar tests do not admit native multi-value input.
- Final canonical workspace TypeScript passed after rebuilding the existing CLI and generating the website style declarations through their generators. The unscoped OOM and missing-generation failures remain in the evidence packet; docs-wide type checks were not run for this definition-only patch.
- Catalog evidence integrity passed 3/3 after the planned-target classification repair. Spec lifecycle authoring passed for the three changed entities against the exact baseline. Agent projection generation/check are regenerated for the frozen catalog; that disposable projection is not committed.

## R2 independent-review corrections (8d30 remains blocked history)

Independent review supplied concrete counterexamples against tree `8d30c79b19ec54c30daa68724031fae3768ef214`:

1. With `max = 1.2345678901234567`, `step = 0.1`, `[0, 1]`, requesting the last slot at `max` became a no-op in every collision mode. The endpoint-preserving snap was followed by `toPrecision(14)` cleanup, which moved it above the bound; a final guard silently discarded the request. The negative minimum was symmetric.
2. With `max = 1.2345678901234123`, cleanup moved the accepted endpoint inward. Re-requesting that same endpoint falsely changed it, and pushing an unrelated slot could also round the untouched endpoint.
3. With `[0, 9.5]`, `max = 9.5`, `step = 3`, minimum step count `1`, requesting the first slot at `9.5` produced `[6.5, 9.5]`. Re-normalizing the proposal produced `[6, 9.5]`, so an owner could not write back the proposed value unchanged.
4. The initial definition omitted off-center Thumb grabbing. Inspected `SliderThumb` records the contact-to-center offset; `SliderControl` subtracts that offset and suppresses track seeking on a Thumb-origin pointerdown.

The original packet and all old green/red evidence remain preserved; none of its green tests establish correctness of these missing cases. A directed author regression first reproduced six failures. The reviewer's independent 19-case suite covers both pointer/keyboard endpoints, same-value no-op, untouched endpoints and owner normalization closure. It is rerun by the author against the repair as supplementary evidence; only a new independent rerun can close the review findings.

### R2 draft priority and precision policy

The reference oracle's accepted domain consists of the finite Number projections of `min + k * step` inside the bounds, plus the exact finite endpoints. Number inputs are interpreted by their canonical shortest round-trip decimal text for the oracle's arithmetic. A grid point is evaluated in bounded decimal integer arithmetic, then projected by standard Number rounding. Endpoints bypass that projection and retain their exact numeric identity; signed zero is normalized to positive zero for JSON-compatible snapshots. This is an explicit proposed Proto oracle policy, not measured official bit-for-bit behavior and not a public cross-host precision guarantee.

Bounds, grid membership and minimum spacing must hold together. Endpoint exemption applies only to grid membership. Minimum spacing is a minimum decimal distance of `step * minStepsBetweenValues`, with no ad hoc tolerance. Where the numeric collision bound is off grid, select a feasible projected grid value inward from it. No extra exception is created at `neighbor +/- gap`. For the counterexample above the bound is `6.5`, but the admissible upper value is `6`, producing `[6, 9.5]`. If no feasible domain member exists, return an explicit diagnostic; do not shrink the gap, manufacture a value, mutate another owner's data or report an ordinary no-op.

Standard Number projection can round a mathematical boundary outward. The oracle corrects direction using the next representable Number and reselects the grid point; it never adds an arbitrary epsilon. A proposal must survive `prepareSliderModel(proposal.values, samePolicy)` unchanged. Normalization must also be idempotent. Exact endpoint requests are no-ops when already accepted, and unaffected endpoints remain untouched. Strict property fixtures combine these requirements with finite values, order, minimum spacing and input immutability rather than checking each in isolation.

The decimal engine is deliberately bounded: input is a finite Number, whose shortest decimal representation has at most 17 significant digits and magnitude exponents from -324 through 308. Intermediate decimal powers are limited to 1024 and signed coefficient text to 2048 characters; exceeding a bound produces `oracle-precision-budget`. Nonfinite output projection produces `unrepresentable-grid-value`. BigInt/DataView computations remain local to the pure test oracle; no BigInt, class or buffer is emitted in a model snapshot. This does not require or claim BigInt/DataView support in any Compiler or native host. A separate generic numeric precision/representation design is an activation prerequisite.

Decimal interpretation has real limits. For example, the shortest-decimal `Number.MAX_VALUE / 2` multiplied by four is slightly greater than the shortest-decimal span from `-Number.MAX_VALUE` to `Number.MAX_VALUE`. The oracle explicitly diagnoses that five-slot spacing as infeasible; it does not quietly relax the gap to preserve an old fixture assumption. The corresponding large finite five-slot fixture uses `[-1e308, -5e307, 0, 5e307, 1e308]`, which satisfies the declared decimal policy. Both the failed intermediate attempt and this documented policy distinction are retained. No claim is made that the oracle supports every conceivable finite configuration or defines the final portable numeric standard.

### Off-center grab requirement and outstanding host evidence

For a center-aligned Thumb-origin session, Root captures its accepted start value. The start sample must not seek to the contact position. Further logical `totalDelta` samples move from the start value's percentage, preserving the initial contact offset. A Track-origin start seeks its logical position. AxisInput already adjusts logical coordinates/deltas for direction and reversal; the component must not reverse values or apply the axis mapping twice. No additional DOM rectangle read or second recognizer is needed in this reference calculation.

`sliderPointerValue` models only that data transformation: an off-center press at 56% on a 50% Thumb returns exactly 50%; a logical +4% total move returns 54%; returning to zero movement returns the original exact value. It neither attaches capture nor proves focus, pointer-origin attribution, geometry lifetime or controlled acknowledgement. Planned real tests must cover both sides of each Thumb's hit area, pointerdown without movement, capture outside the Thumb, repeated/canceled sessions, RTL/vertical signs, controlled rejection, swap and changed geometry. Edge-aligned domains still require the separate generic inset geometry work. The shipped scalar runtime was not changed to claim this behavior.

R2 remains the same seven-file definition/model scope. It does not implement generic State, numeric translation, public array API, multiple mounted Thumbs, Field aggregation, family paint or native/Compiler behavior. The new tree requires fresh independent review before any commit.

## R3 projected-domain bound correction (1fdb remains blocked history)

Fresh independent review of tree `1fdbbd7bfa767ee130993090f83af8f4807352fb` passed the original 19 witnesses and 9,300 additional proposal properties, but found SLV-004 with a new accepted-value containment invariant. For `min = 0.1`, `max = 1`, `step = 0.12345678901234566`, the mathematical first grid point projects to Number `0.22345678901234567`. An accepted duplicate at that value was below its own computed lower bound, because the old `ceilAllowed` divided the projected value by the ideal decimal step and selected the second grid index. A same-value request then moved another slot. A shifted tiny finite grid exposed the same defect. The new independent 27-case suite was 9 passing and 18 failing against R2; that red and the old packet remain intact.

The correction searches the actual monotone Number projection over integer grid indices from zero through `floor((max - min) / step)`, with the exact maximum as an additional endpoint. Ceiling finds the first projected Number greater than or equal to the inclusive decimal boundary; floor finds the last less than or equal to it. Repeated grid-index projections form plateaus and are handled by the same lower/upper-bound search. No zero-gap shortcut, epsilon, neighboring-Number repair or silent diagnostic suppression is used. The previous adjacent-Number/DataView helper is removed. Per-Thumb bounds wording now specifies the nearest legal projected-grid-or-endpoint values inward from spacing boundaries, rather than treating off-grid arithmetic boundaries as accessible values.

The finite index interval is searched by bisection, without enumerating the possibly enormous grid. Each bound search has an explicit 4096-iteration limit and returns `oracle-search-budget` if exceeded. The existing decimal power/coefficient limits remain. The bound follows from the declared finite domain: each finite endpoint has magnitude less than `1.8e308`, so the shortest-decimal span is less than `3.6e308`; a positive finite step has shortest-decimal magnitude at least `5e-324`. Thus the final grid index is less than `7.2e631`, which is less than `2^2100`. Inclusive bisection needs at most 2101 iterations, even with repeated Number projections. The fixed 4096 guard conservatively exceeds that derived ceiling; it is a deterministic operation bound, not an arbitrary wall-clock timeout or a new public precision promise. Grid points and output still have the same bounded model-only domain. Runtime collection State and portable numeric semantics remain unimplemented.

New tests require every accepted value to lie in its own interval and every same-value request to preserve all slots across collision policies and pointer/keyboard intent. An independently enumerated small-grid oracle covers positive and negative shifted grids, both projection directions, zero and positive minimum gaps, and multiple grid indices mapping to a single Number. A maximum finite signed span with the smallest positive step exercises the large search interval. Existing repeated-proposal properties now also check containment and same-value stability after each owner-writeback round trip. These supplement, rather than replace, the original exact-endpoint and closure tests. The next freeze still requires fresh independent review; no runtime acceptance or Slider completion is implied.
