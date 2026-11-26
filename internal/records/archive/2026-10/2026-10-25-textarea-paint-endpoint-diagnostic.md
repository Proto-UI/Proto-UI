# Textarea invalid-clear paint endpoint: retained failure and bounded diagnostics

Recorded 2026-10-25 UTC. Existing owner/scope: #954, merged carrier #955.
This is a non-normative diagnostic continuation, not a production repair or acceptance waiver.

## Evidence and decision

The final source `80f6909e901d84d18e0c452b77ade217d246444d` failed the
[native job](https://github.com/Proto-UI/Proto-UI/actions/runs/40225011567/job/121264419282).
Artifact `12611071355` has SHA256
`7e4d4762811ef262a472e6b2e87bf391ea1b5a52ab5ab0455120d23723cb24ae`.
Static inspection of its JSON and CSS, without executing its bundle, found:

- Observation 517 already passes the same React/dark/Rhea/readonly focused valid target.
- Observation 485 passes the normal-mode invalid-clear route.
- Observation 548 fails the readonly invalid-clear route after destructive/40 paint:
  expected Oklab a `0.0000253916`, observed `0.0000253917`; other recorded state,
  border, ring color-property, alpha and 3px geometry match.
- The final source and preparation baseline main
  `17e49ca7e03fd8e763179c453f63d3ba35a390dc` have identical evidence script,
  strict shadow helper and production Textarea visual source.

The existing independent box-shadow probe is retained. It was already introduced
by b01cd; replacing color-property matching with that probe again is not a repair.
The previous collector overwrote each poll and recorded no transition phase. The
artifact cannot distinguish an in-flight/interrupted transition, late state
projection or settled serialization precision. Earlier passing identical targets
argue against an always-wrong static recipe, not against every production defect.

[CSS Transitions sections 4–5](https://www.w3.org/TR/css-transitions/#application)
distinguish interpolated current values and completion.
[CSS Color 4 section 16.4](https://www.w3.org/TR/css-color-4/#serializing-lab-lch)
does not fix exact internal Oklab precision. Neither fact justifies a numeric
tolerance, skipped assertion or a claim of harmless rendering here.

## Additive diagnostic implementation

The existing capture script now retains browser-monotonic sample times, host
elapsed times, computed paint/state and relevant CSS transition metadata/events.
Listeners are attached before the original state sequence. No animation is
finished, paused, cancelled or awaited. The original nominal 240ms polling window
and cadence, strict predicates, colors, geometry and state sequence remain unchanged.
An already-started sample can return and satisfy the original predicate after the
deadline; this is not a hard completion cutoff. Diagnostic reads consume time
without resetting the deadline or adding retries.

Retention is finite: first 31 plus latest sample per attempt (32 total); latest 64
relevant events per editor with cumulative sequence/count; at most 8 relevant
animation snapshots per sample with omission counts. Events exclude descendants
and pseudo-elements. Scope is box-shadow and border-color CSS transitions, not
arbitrary keyframe animations. API absence/read failure is explicit, never proof
of completion. Original actual/expected paint fields are captured before a guarded
diagnostic lookup/read. Missing or throwing tracers produce explicit `missing` or
`read-failed` status (and error for a failed read), without reinstalling a tracer or
fabricating an empty successful history. This preserves paint evidence even if
the reacquired editor has been replaced. Sampling reads are not atomic frames;
instrumentation can affect scheduling, so a changed outcome alone proves no fix.
The source receipt records probe hashes, browser version and these limitations.

Focused tests in the existing collected probe suite cover retention, filtering,
metadata, non-mutation, API failure and continued strict rejection of the original
one-digit mismatch. Missing tracer, throwing snapshot and throwing tracer-lookup
negatives invoke the same self-contained browser sampling callback and require
the original actual/expected paint plus failed strict comparison to survive.
These tests are authored but not executed on the preparation
seat. No repository resolver, generator, dependency installation, build or browser
execution is claimed. Standalone syntax checks, if reported by the preparation
handoff, are not runtime verification or independent acceptance.

## Existing validation route and next decision

`.github/workflows/shadcn-textarea-style.yml` checks out the exact PR head, runs
the four existing focused suites, then runs
`node --import tsx scripts/prototypes/shadcn-textarea-evidence.mjs` and uploads
the complete artifact even on failure. Its path filter now explicitly includes
the shared shadow/diagnostic helper. Existing failure JSON, screenshot/hash and
original acceptance outcome remain preserved.

Read every original scenario and retained trace on that exact head. A still-running
or restarted transition calls for timing/state-owner investigation; a completed
transition with persistent mismatch calls for a bounded independent upstream CSS
reference reproduction. Do not derive expected color/geometry from actual output.
Any eventual comparison repair requires wrong-color/alpha/width/state negatives
and independent review. Continue diagnostics and the actual repair in the same
follow-up PR under #954; do not claim this increment closes the Issue or finishes
native acceptance. Production, renderer, Compiler/IR, #887 and other owner paths
are unchanged. No new Issue or separate quantity-only diagnostic PR is needed.

## Exact-head native result and post-verdict continuation, 2026-10-26 UTC

The first diagnostic increment was published on the same #954 follow-up PR #1010
at `4f4d98ab968801983cdbfbe61b03dcf0e2f461a9` (tree
`b6a67bac89399f3f89a23dd1f1b1dfa79c84424b`). Its
[native job](https://github.com/Proto-UI/Proto-UI/actions/runs/40245950237/job/121327422116)
passed 34 focused tests across four files, then failed native paint acceptance.
Artifact `12618538242` SHA256 is
`08915dcf1713e841847cb1b12548620a668768cfd8c273cc85e24bb3980246f8`.
Source/app/index/CSS bindings were inspected; browser version is `155.0.8059.39`.
These results belong to that exact published head, not the continuation below.

This failure is React **light**/Rhea readonly invalid-clear, distinct from the
original dark failure. All 11 polling samples are retained without omissions.
At the last sample, host elapsed is 230ms and browser snapshot time is 13582.5ms;
the box-shadow transition remains running at 199.992ms of 200ms with progress
0.9999999991666418. Its startTime remains 13372.428. Event216's transitionend at
13306.1 belongs to the previous transition; events217/218 are the current
run/start at 13372.8. No current completion or restart is observed.

The host first-to-last delta is 222ms and browser delta is 221.8ms, not proof of
an exact shared clock. The final retry sleeps up to the remaining nominal window
and checks the deadline before sampling again. It can miss a completion in that
unsampled tail, but this trace does not prove one happened. The possible next
frame inferred from the roughly 16.666ms animation steps is an extrapolation,
not measured completion. Settled precision drift is also unestablished.

### Smallest additional observation, preserving the failure

The catch handler first attempts an atomic primary `failure.json` write before
optional page work. Supplemental writes use a same-directory pending file and
rename so a failed write does not truncate an already persisted primary receipt.
A write failure is reported, not represented as successful persistence.
If primary writing or renaming fails, both new phase reads are explicitly skipped.
The pre-existing readiness and screenshot attempts still run independently, and
a later receipt write may retain their result plus the failed-primary/skip status;
that does not retrospectively authorize the skipped reads.

Two direct `page.evaluate` reads then capture the failed-attempt fixture editor:
one before existing readiness/screenshot work and one immediately after the
existing screenshot attempt. There is no locator auto-wait, sleep, retry,
animation mutation, new oracle node or new expected color. Each optional read,
readiness capture and screenshot attempt has an independent error boundary.
Missing editor/tracer and failed reads remain explicit. Primary observations and
error remain unchanged; later data is stored separately in
`postFailureDiagnostics` and never reconsidered as acceptance. The original
error is rethrown even if optional capture or supplemental persistence fails.
Both browser and server cleanup are attempted independently. Secondary cleanup
errors are recorded in `cleanup-errors.json`; recording failures are logged. A
failing run rethrows its original value (including null/undefined) after cleanup;
on an otherwise successful run a cleanup error remains a failure, not success.

Each phase records host wall-clock start/end and browser monotonic read boundaries;
these clocks are not precisely aligned. The reacquired editor is not claimed to
have proven identity with the failed sample. Existing bounded tracer history can
retain a subsequently delivered transitionend, but missing/failed history cannot
prove completion. No extra wait is added to obtain it.

Screenshot options remain `path` and `fullPage` only. Playwright's documented
default `animations: "allow"` does not fast-forward transitions; `"disabled"`
would, and is not used. Its existing default caret hiding is unchanged. A later
phase can reflect elapsed screenshot processing and is not proof of completion
inside the original nominal polling window. See the
[official screenshot options](https://playwright.dev/docs/api/class-page#page-screenshot).

Focused negative controls cover first/both phase failures, readiness failure,
screenshot failure, later matching paint, missing editors and throwing tracers.
They require the original verdict/attempt reference, both phase attempts and
absence of probe-node creation. These new cases are authored but unexecuted on
the source-preparation seat; only standalone JavaScript syntax/static inspection
is permitted here. Fresh exact-head CI, screenshot evidence and independent
review remain required on the same PR. The observed light failure and original
dark failure remain open; neither sampling-tail nor settled-precision root cause
is asserted, and no timeout, tolerance or production behavior is changed.

### Unpublished candidate rejection and correction

Independent review rejected the first local post-verdict delta, SHA256
`fa77ed4568e40c133722dd6f2a451dcba03d04d28005cee963057d1ac3166d52`.
It accidentally inserted two helper identifiers as extra arguments at the native
sampler's `locator.evaluate` call, continued new phase reads after failed primary
persistence, and retained cleanup that could overwrite the primary exception.
That candidate was not published or executed; its local copy and diff are retained
for review history. Its syntax-only success did not establish correct wiring.

The corrected call is exactly the original `sampleTextareaPaint` callback plus
the `{ kind, border: expectedBorder, ring: expectedRing }` argument. A focused test
reads the actual collector source to guard that complete invocation, primary-error
capture, persistence-status wiring and cleanup handoff. Persistence controls cover
both write and rename failure branches, explicitly skipped new reads and preserved
old screenshot attempts. Cleanup controls cover original Error/string/null/undefined
identity, both close attempts, secondary-record failure and failure after an
otherwise successful run. No assertion, polling sequence or acceptance interval
has been weakened. These additional tests remain unexecuted locally.

### One bounded clock/identity receipt, 2026-10-26 UTC

The post-verdict increment `92d2930` collected 47 passing tests and one introduced
source-path test failure (`ERR_INVALID_URL_SCHEME`), skipping native capture.
The minimal path correction `198adbbc3dc794f461195aca77dd90360c4929d8` then passed
48 tests across four files (21 probe tests), but retained the native strict failure.
Run40250006349/job121339634259 artifact12619633224 has digest
`f5c529e2f6077c78189da8023501475baec68a61181a16fa664421b3e7a58258`.
All 592 diagnostic reads succeeded and the primary receipt was persisted.
React light/Rhea readonly invalid-clear's last original sample was host231ms /
browser12919.9ms, still running at199.992/200ms. Current transitionend225 was
recorded at12921.5ms; separate catch12963.4ms and after-screenshot12987.2ms reads
matched the expected shadow with no relevant animations. No restart was observed.
This supports near-end interpolation followed by completion in this light run,
not persistent post-completion disagreement in those later reads. The old dark
failure remains unresolved, and the original verdict was not reconsidered.

The next diagnostic-only increment records host wall-clock dispatch/return bounds
around each existing sample, along with the unchanged attempt start/deadline;
adds callback-finish browser time; and adds a guarded random installation ID plus
a closure-bound requested-editor equality check to the existing tracer snapshot.
Both original and post-verdict callbacks pass the actual requested editor.
Missing/unavailable ID, changed installation ID, failed reads or false equality
leave identity continuity unknown; equality alone is insufficient. No tracer is
reinstalled to repair missing evidence. Random ID generation failure does not
prevent paint or transition collection.

Paired host/browser brackets can bound clock offset only under stable wall-clock
and monotonic-clock-rate assumptions. They are not exact synchronization; clock
jumps/drift, interval overlap with the deadline or unavailable identity leave the
classification unresolved. Event-listener time is event delivery, not the exact
paint/completion instant. Post-verdict reads cannot grant acceptance.

There are no new evaluations, polls, listeners, probes, sleeps or UI changes.
Predicates, state order, deadline construction, original elapsed-time measurement,
retry cadence and late-return acceptance behavior are unchanged. Diagnostic reads
consume time and can perturb scheduling. Source checks/independent static review
are not runtime evidence; no local project execution is authorized or claimed.
Use the existing exact-head native workflow once after review, then classify the
clock/identity question as established or unresolved from that single receipt.
Do not repeatedly instrument or rerun to obtain green. Any acceptance-contract
change is a separate semantic decision, not part of this diagnostic increment.

### Separate observer scheduling decision and implementation, 2026-10-26 UTC

The final diagnostic head `47708705f94fae9b8f52ab46012520317d1fd980` passed49
focused tests (22 probe tests) but retained native failure in WC/dark/Rhea/normal
keyboard-return focus, distinct from the earlier React readonly failures.
Run40250797889/job121342036600 artifact12620641167 SHA256 is
`1031a9e88b6d756a352999e0ab3468a582884d16ddd3e7b97e36c1657b4f1d3e`;
failure JSON SHA256 is
`4fc41b4b9dcd756fb309934bc0f068fc268b18a4ba54d4623f348117c053f08b`.
All10 original samples and both post-verdict reads retained the same installation
ID and true bound-editor checks. Independent constant-offset interval review
conditionally places current transition-event delivery at222.2–226.1ms after
attempt start. This is not exact paint timing or an original completed-endpoint
observation; the native failure stays failed. The bounded diagnostic phase ended
there, without another diagnostic rerun or post-hoc acceptance.

The existing owner then explicitly selected a separately reviewed observer
contract, rather than treating diagnostics as authority to change acceptance.
The design packet SHA256 was
`f23a5bac3f8ad408e350502ca8e7b5747114cfba8455ed9a7253b1b83e6349e3`;
its deterministic boundary-table SHA256 was
`465ed702bc35639b3b6f7c0cbf0205d3f3e05294006597f92b44ed9a14ee55f7`.
This is a bounded engineering policy choice by dot for cyjin-yl under #954, with
independent design review, not external approval or normative component timing.
P-SHADCN-TEXTAREA's200ms transition and paint/state obligations do not prescribe
a240ms polling policy. The relative240/16 observer was introduced in our
`3a915ca38ea4f2a957fa73bdea18d5a47541419f` harness work. Its accumulated read-plus-
sleep delay is a source-proven coverage limitation, independent of any one trace.

Implementation preserves the host start location and D=S+240ms, but replaces
relative sleeps with absolute16ms opportunities S+16k, k=0..14 (0..224ms).
After each eligible mismatch it chooses the earliest unused nominal slot at or
after current host time, skipping missed unscheduled slots and strictly advancing
ordinals. There is no catch-up batch. Early timer wakes rewait the remaining time;
one already-scheduled late wake may dispatch once only before D. At most15 reads
are dispatched, one in flight. Every returned observation is retained, but any
return at/after D immediately fails, including exact paint. The existing exact
independent paint/state predicate is extracted unchanged and shared by the actual
collector and deterministic scheduler controls. Editor lookup/state flow is not
replaced; existing continuity evidence remains diagnostic.

**Semantic changes are explicit:** absolute scheduling may increase sample density
relative to an old execution; polling is not claimed unchanged. The return cutoff
closes the old matching-late-return acceptance hole. No budget increase, empirical
transport margin, tolerance, production change, unconditional final read or
post-verdict pass is introduced. The224ms slot derives from the existing16ms
policy, not an assumed browser frame. Complete-window/last16ms observation is not
guaranteed; correctness reached after the last eligible read may still fail.
Stable/nondecreasing host-clock behavior remains an assumption. Transport and
cleanup need not complete by D, but late returned paint cannot pass.

The existing collected suite now exercises the real scheduler/predicate path
against immediate/zero-cost/drift/skipped-slot/early-wake/late-wake and deadline
boundaries, strict paint/state negatives, evaluation rejection and unobserved
late correctness. Existing post-verdict failure controls remain. Source wiring
guards are adapted to the real scheduler call, not deleted. These tests are
prepared, not locally executed; syntax checks and independent static review are
not runtime proof. Obtain separate exact-patch review, then one exact-head native
repair receipt using the existing workflow. Preserve all historical failures and
report actual new results; neither the decision nor implementation closes #954
or establishes latest-main/full-native acceptance.
