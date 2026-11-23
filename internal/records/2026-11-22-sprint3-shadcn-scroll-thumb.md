# Sprint 3 Shadcn Scroll Area Thumb thickness — 2026-11-22

This is a bounded repair candidate for the 0.3 public Scroll Area consumer, associated with #1178, #1164's retained #863 acceptance and PR #1713. It changes Shadcn's passive appearance and its evidence. It does not change shared Scroll/Move, the old native failure, historical acceptance, experimental-family conditions or draft lifecycle status.

## Preserved native failure

[CI run 45018250847, job 137199303858](https://github.com/Proto-UI/Proto-UI/actions/runs/45018250847/job/137199303858) ran source `830287f95959a4a1a4fb797df68b0bd6889e0bae`. Browser `4/18` identifies the shard. The job completed 24 passing tests and one failure in six files. The failing public consumer was `apps/www/src/content/docs/zh-cn/demo-shadcn-scroll-area.browser.test.ts`: after WC's vertical Thumb drag, `scrollTop` was still zero and the original greater-than-zero poll failed at 1000 ms.

The loop stopped at that assertion. WC horizontal dragging and the React, Vue and Vue 2 branches did not execute; they are not failures or passes. Earlier focus and track checks passed. The retained focus observation was viewport `{ x: 34, y: 504.5, width: 252, height: 190 }`, document scroll `{ x: 0, y: 1263 }`, unchanged before/after focus. This is Viewport geometry, not Thumb geometry. The old log contains no Thumb width/height, center hit target, pointer/capture trace or browser screenshot proving the cause.

The local candidate started from integration revision `4adb6076a6d9e93ddfd6eb02d07ce06c319eb2d2`. The inspected Shadcn Scroll Area sources, public demo/test, shared Scroll host, Move host and browser harness were unchanged from `830287f95959a4a1a4fb797df68b0bd6889e0bae` before this repair.

## Source diagnosis and responsibility

`P-BASE-SCROLL-AREA-THUMB`, `P-SHADCN-SCROLL-AREA-THUMB`, `HC-SCROLL-SURFACE-0001` and `HC-MOVE-GESTURE-0001` remain draft. Base owns passive anatomy; the Scroll host owns extent, offset, movement mapping and lease cleanup; Shadcn owns ordinary fill and track presentation. The Web Component Adapter profile is active, which does not promote those draft definitions.

The public demo uses empty Thumbs. The vertical track is a flex row; the horizontal track is a flex column. The old Shadcn Thumb emits `relative flex-1 bg-border`, whose real token compiler lowers `flex-1` to `flex: 1 1 0%`. `projectComposedChrome()` owns `flex-grow: 0` and `align-self: flex-start`, sets height for the vertical Thumb and width for the horizontal Thumb, and restores the authored other dimension. This leaves an empty zero-basis flex item in the track's thickness direction. Adding only `h-full w-full` while retaining `flex-1` would still leave that zero basis.

This is a source-derived cause candidate, not a retrospective observation of the failed CI box. [CSS Flexbox's basis and automatic-minimum rules](https://www.w3.org/TR/css-flexbox-1/) explain why an empty item with zero basis and no growth can collapse, while an automatic basis uses the authored width/height. The installed Playwright 1.58.2 Chromium `boundingBox()` implementation computes dimensions from `DOM.getBoxModel` and does not reject a returned zero dimension; the old test only rejected a null box. Thus its successful geometry lookup did not establish a pointer hit area.

The Move host accepts immediate primary-pointer sessions, attempts capture, and also listens on document capture for movement/up/cancel. Failure to acquire capture alone is not sufficient to attribute this result. The old Select-overlay dismissal is not a direct hit check; an unrelated overlay is another possibility the retained log cannot exclude. The new test observes the actual hit target before input rather than guessing which of those paths ran.

| Family source | Cross-axis presentation | Scope disposition |
| --- | --- | --- |
| Base | No family appearance; its public vertical recipe explicitly supplies `w-full` | Remains the passive semantic base; no new paint or geometry policy added. |
| Shadcn | Old `flex-1`, ordinary borderless empty Thumb | This repair replaces the flexible basis with full authored dimensions while leaving the host's scrolling-axis size and offset unchanged. |
| Brutalist | Existing `relative h-full w-full`, no `flex-1` | Already supplies independent thickness; no source change or new native pass claimed. |
| Bootstrap 2.3.2 | `flex-1`, ordinary one-pixel border | The same basis issue is a source-level risk; the border means it is not identical to the ordinary borderless zero-size Shadcn case. Retained for its own experimental-family native acceptance. |
| Liquid Glass | `flex-1`, ordinary one-pixel border | Same explicit pending boundary as Bootstrap; neither changed nor accepted by this 0.3 repair. |

## Candidate and discriminating evidence

The Shadcn Thumb now emits `relative h-full w-full bg-border`. Its full dimensions supply the track's content-box thickness; the existing inline host dimension still determines the scrolling-axis extent. The host's `flex-grow: 0`, top/left positioning, 18px minimum, track inset, drag travel, pointer ownership and cleanup are untouched. There is no page-local CSS or new public prop. Profile corner shapes and active-forced-colors-only contour remain unchanged.

The draft visual criterion records this Proto-specific sizing adaptation from the pinned upstream `flex-1` recipe. Its earlier revisions and the original provenance record remain intact; no upstream reference migration, new copied asset or API-equivalence claim is introduced.

The public browser consumer keeps every earlier focus/track/paint check, both original greater-than-zero assertions, 36px movement with four samples, the default 1000 ms poll and the four-runtime loop. It now:

- measures both Thumb dimensions before input and rejects a zero hit area;
- records actual center `elementFromPoint`/hit-stack and requires the Thumb or a descendant;
- preserves scroll offsets, extents and exposed attribute facts before/after each attempted drag, including failed polls, and also requires a positive movement delta;
- performs one synchronous, intentional `flex-basis: 0%` mutation on each actual Thumb after both unmodified native drag checks, records the collapsed cross-axis counterexample, and restores the exact previous inline value/priority before asynchronous observer delivery. The mutation cannot serve as a remeasurement/recovery prerequisite for the preceding input. Ordinary default-scale thickness is expected to be 7px. This future native comparison is a controlled mutation, not a rerun of old source.

The browser additions have not executed on a native browser yet. They are reviewable diagnostic and acceptance code, not a passing CSS/layout/hit-test result.

## Local validation and remaining acceptance

The updated two family suites first ran against the unchanged product implementation: 17 passed, two failed specifically because `h-full` was absent. After the candidate, those suites plus `web-scroll-host.test.ts` and `web-scroll-corner.test.ts` passed 35/35 in four files. The 19 family cases are included in 35, not an additional count. These tests use the existing Happy DOM/fact fixtures; they establish the style projection and unchanged host behavior only. They do not execute browser layout or trusted pointer input. A later comment-only clarification in Thumb source does not change the tested style expression.

A strict TypeScript single-entry check of the modified browser test and its imports exited zero. No native browser or complete site build was started in this slice. The original global/native failures and unrun targets remain outstanding.

The initial Shadcn preset check was terminated with a shell `Killed` report and no stdout; the first subprocess status was not separately captured before the following GPUI check exited one. A single authorized retry under the two shared locks, with a 768 MiB Node heap bound and 45-second deadline, was also terminated: the subprocess recorded signal 9 at 18.6 seconds, with zero log bytes. The termination cause is unproven. Neither attempt is a preset-check pass, and no further repeated attempt was made. Existing generated Shadcn tokens already include `h-full`, `w-full` and other components' `flex-1`, but that source inspection does not substitute for the interrupted canonical check.

The GPUI check failed with stale style and theme fixtures. The same command then failed on a separate, clean `4adb6076a6d9e93ddfd6eb02d07ce06c319eb2d2` checkout. Both actual canonical generations to separate scratch targets exited zero and produced byte-identical candidate/baseline files; both differ from the unchanged tracked fixtures. The before/after source identities remained identical. This demonstrates pre-existing projection drift, not a Thumb-caused change or a passing native build:

| Output | Tracked baseline | Both actual generated outputs | SHA-256 of both generated outputs |
| --- | --- | --- | --- |
| Style fixture | 373 tokens / 366 compiled / 6 without declarations | 910 / 905 / 4; unsupported selectors stays 1 | `ecaa4e9cca0f2d527edf9c0d5878c0ae5d3f6fc6a9d23a479230f2ea5c3b6528` |
| Theme fixture | Per-mode key counts: Shadcn 45, Brutalist 43, Bootstrap 19, Liquid 18 | Per-mode key counts: 48 / 46 / 28 / 25 | `126f7eecba69462ab39a7e0fd6ed389fc13d541187128c407eee4a0de5bd3155` |

No generated file was copied over the tracked inventory. The original failures, five exact commands, timestamps, signals, logs, generated bytes and diffs are retained in `style-diagnosis-receipt.json` and the raw evidence set; the [JSON companion](2026-11-22-sprint3-shadcn-scroll-thumb.json) binds their hashes. The integration/native inventory owner must reconcile this existing gate with its real source and native mapping scope. The successful scratch generation is not a GPUI runtime or full gate pass.

The integration owner must retain final-source native results for all four Web runtimes, including actual cross-axis dimensions, the zero-basis control, unobstructed hit targets, both drag deltas, original focus/track assertions and the separate corner/forced-color visual acceptance. If native facts contradict the thickness diagnosis, continue from those facts; this patch does not pre-authorize a shared-host change or a timeout increase. Independent review, final CI, merge and original-condition tracking remain separate actions.
