# Sprint 7: geometry-free follow pause and compiler consumption

Shenko's actual Inspect/IM consumers need to pause automatic end-follow when selecting text or restoring a saved reading position, without moving that position or focus. The shared draft criterion `C-SCROLL-END-FOLLOW-0001-PAUSE` and the existing dispatched/queued/rejected vocabulary now express this operation. Application message, session and saved-anchor policy stays in Shenko; no domain vocabulary or raw geometry enters the public operation.

The Runtime/Core/Module/Base implementation and real consumer are recorded in [the Harness record](2026-11-22-sprint-7-harness.md). This record covers the compiler projection and independent review. It does not promote native profiles or close broader #732/#733 parity conditions.

## Compiler behavior

`scroll.pauseFollowing()` is admitted as a zero-argument callback-phase operation with a typed `ScrollSurfaceRequestOutcome`. It lowers through ordinary Web targets and the existing direct GPUI/Flutter/Qt emitters. The public result and ownership checks remain explicit: undeclared, detached, disabled-axis, unavailable and retired owners cannot claim a delivered pause.

The Web support closure cancels pending end work and publishes paused without a position or focus write. A synchronous attachment queue preserves FIFO order even when a publication callback issues another command. A newer pause/resume command wins over an older state publication. Reveal advances command ownership only after geometry admission, so an invalid nested reveal cannot retire a valid in-flight command.

An explicit pause survives stationary input, editing, other-axis movement and layout-only changes. Pausing retires previously armed reader intent while preserving contact ownership. A fresh arrival must have actual movement on the followed axis, stable layout dimensions and an end position. Native events and the host's synchronous composed wheel/track/thumb commands provide separate private arrival evidence; ordinary public position requests do not impersonate reader input. Explicit `to-end` remains the other resume path. Disposal releases the event/contact state and retires old work.

Qt's control model receives private physical offset/viewport/extent observations, rather than treating a generic `scrolling` flag or normalized-position change as arrival. Flutter checks owner/epoch again after publishing follow facts and guards deferred layout callbacks. GPUI emits the corresponding retained-state operation. The native emitter tests establish source lowering/model behavior only: no native SDK build or device run is claimed here.

## Executed verification and independent review

| Verification | Terminal result | Scope |
| --- | --- | --- |
| [Final compiler suites](evidence/2026-11-22-s7-scroll-pause/compiler-final-85.log) | **85/85 passed**, four files, one worker, no skipped tests | 45 current-view/scroll/reveal support cases, 20 parser/outcome checks, 16 ordinary generated framework-consumer cases and four native lowering/Qt-model cases. |
| [Preceding compiler revision](evidence/2026-11-22-s7-scroll-pause/compiler-final.log) | **84/84 passed** | Retained unchanged; the final reveal-at-end regression was added afterward. |
| [Independent review probes](evidence/2026-11-22-s7-scroll-pause/review-final.log) | **4/4 passed** | Unrelated key/stationary scroll; reentrant FIFO attachment commands; pause during end publication; actual composed-wheel arrival. |
| [Independent native-model review](evidence/2026-11-22-s7-scroll-pause/review-native-model.log) | **4/4 passed** | Exact direct emitters and Qt private geometry path; no platform-runtime inference. |
| [Runtime disabled-axis counterexample](evidence/2026-11-22-s7-scroll-pause/runtime-disabled-red.log) | Old implementation: **94 passed, 2 failed** | Both Module and Web-host pause incorrectly accepted a disabled followed axis. |
| [Runtime correction](evidence/2026-11-22-s7-scroll-pause/runtime-disabled-green.log) | **108/108 passed** | Existing module delivery, reader-contact lifetime and Web follow suites after guards. |

The independent reviewer authored no compiler implementation. Review bound the tracked compiler diff SHA-256 `7c0a64247860946f9599f30b2cef567b4c6c2f74c8349c24cfdad8a8a6bc9f0f` and the new target-test file SHA-256 `30959bfd680231ca0d90d425e532063e13a016dcc479ba423023c501534b2403`, then executed its own probes. This is an agent review record, not a GitHub APPROVED review or maintainer certification.

The last Runtime/compiler alignment added one further reveal guard: a valid reveal at the current end must retain an explicit pause, including the absence of a transient `following` publication. The new assertion fails on the preceding source ([negative receipt](evidence/2026-11-22-s7-scroll-pause/reveal-paused-negative.log)). The independent reviewer read the one-line guard and new assertion, then reran its [four probes](evidence/2026-11-22-s7-scroll-pause/review-after-reveal.log) and the [new targeted case](evidence/2026-11-22-s7-scroll-pause/review-reveal-final.log). The targeted receipt filters 44 other cases; the separate final 85-case run executes every case.

The first 85-case attempt suffered a worker exit after 40 completed checks ([raw process failure](evidence/2026-11-22-s7-scroll-pause/compiler-worker-exit.log)). An invocation through the environment's fallback `pnpm` was then rejected for selecting pnpm 11 rather than the declared pnpm 10 range ([engine rejection](evidence/2026-11-22-s7-scroll-pause/compiler-engine-rejection.log)). The terminal successful command used Node 24.22.3 and `corepack pnpm` 10.32.1 with `--maxWorkers=1 --minWorkers=1`; neither failed attempt is a passing receipt.

The framework-consumer tests mount real generated owners through their ordinary frameworks in the declared test environment. They are separate from Shenko's real Chromium journey and from any physical/AT evidence. The full workspace TypeScript process was terminated by the local environment with `SIGKILL` and no compiler diagnostic; the source-bound support type check and consumer tests passed. The workspace process termination is retained and must not be reported as a successful global type check.

## Failures preserved during review

- [Initial independent probes](evidence/2026-11-22-s7-scroll-pause/review-initial-red.log) exposed three actual contract failures: unrelated input resumed pause, attachment publications could overtake the queue, and an older end notification could overwrite a new pause. Their assertions remain in the final suite.
- [Qt negative control](evidence/2026-11-22-s7-scroll-pause/qt-negative.log) showed a stationary `scrolling=true` notification incorrectly resumed. The same model now keeps pause through stationary/other-axis/layout changes and resumes on actual arrival.
- [Late-input/layout negative control](evidence/2026-11-22-s7-scroll-pause/late-reader-negative.log) retained two actual failures from the early Web implementation. Targeted filtering in this negative probe is recorded; it is not the final full-suite result.
- [Composed-wheel independent failure](evidence/2026-11-22-s7-scroll-pause/composed-negative.log) showed synchronous wheel delivery consumed the physical delta before its later scroll event. The correction attributes movement at the host command and does not grant that permission to public position requests.
- [An unsuccessful reveal-order candidate](evidence/2026-11-22-s7-scroll-pause/reveal-admission-failed.log) advanced command ownership before checking geometry and broke existing invalid-reveal controls. The final implementation advances only after admission. Those original checks were retained.

The evidence manifest binds raw logs. Current passing results do not rewrite these earlier failures or imply missing historical acceptance. Real consumer acceptance remains linked to its exact public-package pin and the companion Shenko PR.
