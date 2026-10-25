# Homepage Header observation repair (#984)

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This is a bounded diagnostic and integration record, not a new normative contract.
Parent: `1dcd9545d6dadeb0e04491653d51124aaff1a467`, downstream of #982.

## Observed failure and responsibility

The [exact-head family job](https://github.com/Proto-UI/Proto-UI/actions/runs/40161123886/job/121072720386)
reports 7 passed / 9 failed: eight Shadcn cases stop at background alpha 0 versus
255; Brutalist/React/dark stops at the immediate focus ring token assertion.
The 39,628,539-byte artifact was not downloaded because it exceeds the available
32 MiB transfer limit. These findings use the official log and source comparison,
not a claim that all artifact screenshots were inspected.

The current probe reads paint from Select Content, which owns lifecycle. The
accepted family composition places paint on its Surface. The owner's
[source-bound QA](https://github.com/Proto-UI/Proto-UI/pull/921#issuecomment-6284852882)
documents that division and historical 16/16 evidence for
`6a4e2b3db65878da7b5150cdad49eb9d8a1cc9d0`. Historical evidence is not acceptance
of this downstream combination.

## Bounded correction and provenance

Integrate HyacinthHaru's existing `readHeaderPopupPaint` implementation from
that exact commit. Shadcn paint must come from exactly one Surface whose closest
listbox is the target Content, with matching nonempty owner and generation.
Missing, duplicate or stale Surfaces throw instead of falling back or selecting
whichever descendant passes. Content still supplies transition state and
animations. Non-Shadcn Content continues to supply its own paint.

Integrate only the corresponding popup shadow/token observation and real native
focus readiness hunks from `header-select-elevation.browser.test.ts`. The latter
polls actual focus and the complete ring-2 token within the existing matcher
budget, then retains the original final assertions. It adds no arbitrary sleep,
input replay or deadline extension. Background/text alpha 255, opacity 1,
contrast at least 4.5 and all existing geometry/shadow/focus assertions remain.

The accepted source also removes a narrow Shadcn +1px pressed pose expectation.
That is a separate oracle change, so this patch deliberately retains current
`pressedY` unchanged. After the earlier popup failure is removed, later press
or focus cases may expose independent failures; do not preemptively waive them.
No production component, Adapter, Compiler, IR or original owner branch changes.

## Added regression controls and actual validation

Eight additive unit cases cover matching Surface paint distinct from transparent
Content (including nested-listbox isolation), missing/duplicate/wrong-owner/
wrong-generation Surface, missing Content owner/generation, and non-Shadcn
self-paint. The unit canvas fixture is not real-browser pixel evidence. Existing
settling, contrast and self-contained serialized-callback tests are preserved.

Guarded TypeScript checking of the three changed TS files reports zero targeted
and zero transitive diagnostics. Actual focused Vitest invocation stops before
collection with Rollup `ERR_DLOPEN_DISABLED`; no unit pass is claimed and native
addon permission was not enabled. No local browser acceptance was performed.
New exact-commit official family tests and source-bound screenshots are required.

Separate #984 outcomes remain visible: density 28/28 demonstrates 44px narrow /
36px wide Header sizing; Hero composition remains 9 passed / 2 failed for the
second React/Vue Home/Enter closure; general CI stops at 79 public-docs drifts
before units. This observer patch does not fix or accept those separate failures.
Keep the PR stacked and Draft pending remaining evidence and review.

## Follow-up after exact a1ee native evidence

The observer-only commit `a1ee35046ff35e9f57b6490d997e0dbd0b0241d2` completed
[family job 121086115113](https://github.com/Proto-UI/Proto-UI/actions/runs/40165677631/job/121086115113)
with 8 passed / 8 failed. All Brutalist cases passed. Six Shadcn WC/React/Vue
cases reached the later narrow press assertion: y=282 versus expected283 at
line300. Vue2/light and Vue2/dark instead passed Escape/popup-hidden then timed
out waiting for trigger focus at line345. The family artifact is48,764,272bytes
and was not downloaded under the32MiB transfer limit; these are log findings,
not a claim that every frame or failure JSON was inspected.

### Separate pressed-position oracle correction

The first patch deliberately retained this failing expectation to keep the
observer change separate. It is now reconciled against the existing public
`P-SHADCN-SELECT-TRIGGER-STATE-DRIVEN-STYLES` criterion and its open-question
clarification, which explicitly withdraw the old `translate-y-px` pressed
delta. The entity is draft, not a claim of a stable guarantee. Fixed upstream
SelectTrigger is the Select recipe, not Button pressed styling; Base Select
Trigger must not inherit Button semantics. The accepted owner source
`6a4e2b3db65878da7b5150cdad49eb9d8a1cc9d0` already implements this exact
`pressedY = hovered.y` observation.

Fixed sources checked independently:
- [Current draft SelectTrigger criteria](https://github.com/Proto-UI/Proto-UI/blob/a1ee35046ff35e9f57b6490d997e0dbd0b0241d2/spec/prototypes/P-SHADCN-SELECT-TRIGGER.yaml#L61-L68),
  blob3291fbd1cdd6c459306ef6efec34258aa6f96e28; the explicit withdrawal is at99–101.
- [New York SelectTrigger](https://github.com/shadcn-ui/ui/blob/f31ed81983653919dd4fe77aee4b4859f610f1dc/apps/v4/registry/new-york-v4/ui/select.tsx#L27-L49),
  blobc0dc7120b4f78008ae5efc6d1c8b7ec8205c35d5, has no pressed translation.
- [Rhea Select recipe](https://github.com/shadcn-ui/ui/blob/3d98900e9b73c45f035f8109e9d41ba6a51685e7/apps/v4/registry/styles/style-rhea.css#L162-L176),
  blob94bbca2a7f78845e7cfbcff68fb8f535e3848a98, also has no pressed translation.
- [Separately pinned Button recipe](https://github.com/shadcn-ui/ui/blob/25af02b1b467fcd53b63e0c6d6d324c57c16ef18/apps/v4/registry/styles/style-rhea.css#L70-L73)
  scopes translation to `.cn-button` and `active:not-aria-[haspopup]`; that is not
  a SelectTrigger rule. Base SelectTrigger's draft inheritance criterion rejects
  Base Button behavior; shared family styling does not override that boundary.

This changes the expected value from an unsupported extra1px to zero movement,
not the tolerance: both `toBeCloseTo(...,1)` checks, the real mouse-down,
data-pressed requirement and original poll budget remain. It is not inferred
solely from the current result282; the independent definition and fixed recipe
supply the expectation. Brutalist press expectations and all other assertions
are unchanged. No production transform or layout is altered.

### Vue2 focus-return diagnosis, not a purported fix

Keep the original Escape, popup-hidden wait,30000ms focus-return wait and
original error. Only on failure, append public-page activeElement, target
popup and matching trigger attributes (owner, generation, transition,
aria-controls, expanded state and connection) to the existing measurements
JSON and diagnostic log. The read performs no focus change, extra input,
account access or retry. Diagnostic failure does not replace the original
error. No timeout is extended.
The diagnostic marker is set only after Escape and popup-hidden succeed, directly
before the original focus wait. Thus input or popup-visibility failures are not
mislabelled as focus-return failures. The added read and existing failure capture
do not establish a hard total duration bound if a browser becomes unresponsive.

The accepted source also has a preparing-phase Base Select focus-return fix,
but this sequence has already observed an entered popup before Escape. Without
an actual event/owner trace, that different phase fix is not evidence of the
same cause and is not imported. Vue2 remains an unresolved acceptance failure.
New exact-head native evidence is required after this follow-up; previous
results and screenshots are not relabelled as new-head validation.

Candidate validation: the guarded TypeScript run reports0 targeted/0 transitive
diagnostics across the browser probe and its two popup-evidence files. No new
native browser run has occurred locally; the prior focused Vitest startup denial
is unchanged, and no new unit pass is claimed. Static comparison must retain the
original inputs, focus timeout and all non-position assertions before publication.

## Paired input-shard coverage maintenance on the same parent

This is an independent CI coverage correction, not a Header rendering or focus repair. On exact parent `a1ee35046ff35e9f57b6490d997e0dbd0b0241d2`, the normal evidence manifest includes `input`, but the `passive-and-editors` workflow shard omits it. Integrate only the two accepted one-line additions from HyacinthHaru's `1038d0fa52406b9dcb1d1cadf1d7df91946c18e2`: append `,input` to that shard and to its exact toolbar-contract expected matrix. The resulting workflow blob is `3021a5c7e56d3e34a3065ad9cc108fd4e92d348d`, and the toolbar test blob is `6b5597e3b5db6826262571dabcfa576f3b4d2dc9`, byte-identical to the accepted source. No other workflow settings, permissions, concurrency, timeouts, capture implementation, or production files change. This does not import another PR's tree or accumulated coverage document.

Validation reran the original two filtered Node tests against the six-file closure freshly read from this exact parent, using the existing installed Node/dependencies and unchanged permission/network guard. The original state fails the manifest coverage assertion (1 pass, 1 fail); workflow-only is a negative control that fails the exact matrix assertion (1 pass, 1 fail); the paired state passes both selected cases (2 pass, 0 fail). The selected tests are `normal PR evidence shards cover every current manifest family exactly once` and `toolbar setup preserves all current manifest families, bounded jobs and exact-head evidence`, run with `--test --test-isolation=none` and an exact name filter. Other tests were not executed. These checks establish shard wiring only, not a successful browser capture or overall CI acceptance. The Header native failures above remain historical evidence, and Vue2 focus repair is still unproven pending the new exact-head failure diagnostics.

Original-source attribution remains with HyacinthHaru; this integration, narrow record, and validation are the current contributor's work. No original author's DCO certification is copied or asserted on their behalf.

## Exact-head focus failure and the missing accepted close-order hunk

Official Header family job [121092374943](https://github.com/Proto-UI/Proto-UI/actions/runs/40167825092/job/121092374943) on `2bf355668c81639a1f1b86fd61689926ca477f93` completed with 14 passed and 2 failed. The six WC/React/Vue Shadcn cases no longer fail the withdrawn press-displacement oracle; all eight Brutalist cases pass. The two Shadcn Vue2 theme cases still fail the original focus-return predicate after Escape and popup-hidden succeed. Both failure snapshots at width 1440 show activeElement=body and the runtime Trigger still connected, closed, with owner `homepage-home-preferences`, generation `2`, and the expected `aria-controls`. The connected hidden popup retains `data-transition-state=entered`; Vue2 retains a hidden DOM shell after logical view retirement, so that projected attribute does not prove the internal close-time state.

The current official [family artifact](https://github.com/Proto-UI/Proto-UI/actions/runs/40167825092/artifacts/12589952287) was retrieved and verified: 51,422,202 bytes, SHA256 `c7fa0a5f92322ead4487bb28b7a72d297751ec5a91c5bedc62436ae689101195`, matching the official digest, and all ZIP CRC checks pass. Subject/probe and both Vue2 JSON source/expected/probe SHA equal the exact head above. Probe-file SHA256 is `64b00085131e6e9dae65629da9180e679fe5fc16a9fb429fc84d74f9030f0263`. The two failure images and a passing React narrow-screen press image were inspected, not every image in the bundle. Historical a1ee evidence was subsequently retrieved too; its earlier download limitation is not a claim that it remains inaccessible.

### Source-preserving candidate and responsibility

Restore only HyacinthHaru's accepted close-order hunk from [26d424545857e3bd26c2f461c4a554b4bb88b519](https://github.com/Proto-UI/Proto-UI/commit/26d424545857e3bd26c2f461c4a554b4bb88b519), plus its original additive Vue2 regression. The current Shadcn Content blob `d4bdd77a330c4ef2dd59529288501cbd45151248` notifies an `open.watch` handler that immediately leaves and completes. Base Content sets its open handle before applying presentation and returning focus; synchronous Vue2 retirement can therefore clear the live context before Base reaches its guarded focus step. The accepted hunk instead subscribes to `SELECT_CONTEXT` after Base's own subscriber, completing only an already-leaving transition, with disposed, next-open and latest-open guards intact. This is a source-supported causal candidate, not a claim that the current failure snapshot captured the entire event sequence.

Owner coordination: [original repair report](https://github.com/Proto-UI/Proto-UI/pull/921#issuecomment-6252708219), [QA](https://github.com/Proto-UI/Proto-UI/pull/921#issuecomment-6252292734), and [historical evidence audit](https://github.com/Proto-UI/Proto-UI/pull/921#issuecomment-6252777045). #978 explicitly preserves the coordinated Content lifecycle hunk while owning newer Rhea/profile presentation. #974 already contains the original repaired source/test; this change does not edit that branch or claim there is no same-file overlap. Only the missing hunk is restored into this stack. All current Rhea/profile, Surface and composition logic remains byte-for-byte outside it. No Base Content preparing patch, Adapter change, or new dependency/API is imported.

The original Vue2 test adds the Shadcn import and `returns Shadcn Trigger focus when Escape synchronously retires the Content view`, retaining synchronous unmount, closed/value, connected/detached DOM and final Trigger-focus assertions. It is legacy popper/synthetic DOM coverage, not the current Header's full anatomy or native paint acceptance. Source credits remain HyacinthHaru's; the current contributor signs only their own integration and record.

### Proportional verification and remaining limits

Actual guarded targeted TypeScript checks on the existing installed source closure report zero diagnostics in the two candidate files for both baseline and candidate. Each also reports the same 75 transitive diagnostics; their complete diagnostic output is byte-identical. This is not a whole-workspace typecheck pass. The unchanged Node permission and network guard remain in effect.

A separate direct-source callback harness executes the exact old/new close callback with an explicitly modelled Base ordering: the old callback retires before the modelled focus step; the restored subscriber follows it. Seven checks pass, including disposed, reopened, next-open and not-leaving negative controls. This isolates the scheduling change but is not execution of the original Vue2 regression, a DOM test, or independent browser acceptance. The existing Vitest addon startup denial remains; no bypass or fabricated test pass is claimed. The original Vue2 regression and exact-new-head Header native family evidence must still run successfully before claiming this repair accepted. No timeout, focus predicate, native input or production fallback focus call is weakened or added.
