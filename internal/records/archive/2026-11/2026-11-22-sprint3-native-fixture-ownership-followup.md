# Sprint 3 native fixture and source-server ownership follow-up — 2026-11-22

This is a bounded source follow-up to Draft PR #1713, prepared on 3acf2e094dbb63d59a84c561ece7c50f177d2b6b. It combines eight source files and this record. The original 14-file native inventory remains 364 cases; the separate Drawer browser file remains seven cases. No test-name filter, per-case deadline extension, screenshot substitution, product behavior change, or integration approval is introduced here.

## Observed failures and bounded repairs

The complete original native consumer run on 4cfe2e8cdd476ceaf463a52b134dd1091c045cc1 naturally finished with 358 passed, six failed and zero pending. The original ledger SHA-256 is ec76ee369f2382b5d8ea308c88ea672d2d3b07e2b0400bbb19edc0f5f3d2d2d6. Its original documentation build passed in 343.629 seconds. Those results remain attached to that revision.

Two component-consumer cases exceeded the existing five-second test limit. An opt-in phase diagnostic showed that first renderer allocation took 4,612.78 ms, and the timed-out React fixture continued after the subsequent Web Component case started. The installed test runner timeout races the body and does not cancel it. The candidate creates the first actual blank page in the existing 60-second suite setup, then transfers that page to exactly one real fixture before an await. It adds no dummy page or readiness wait; subsequent fixtures still allocate independent pages. All case bodies and their five-second deadlines remain unchanged. This bounds initial renderer allocation; it does not claim general cancellation of arbitrary future timed-out bodies.

The Spinner observer could spend its entire 120 ms observation window in its first synchronous style read and return one sample without an awaited animation frame. It now starts from a real RAF timestamp and requires at least two increasing native frame timestamps across the original nominal 120 ms interval. All motion, reduced-motion and focus assertions following the sampler are unchanged.

The Scroll Corner case deliberately hid content, waited for both thumbs to become display:none, and then required positive thumb geometry. The helper now explicitly requires display:none and zero width/height for that one hidden-content phase. The live Brutalist thumb geometry and nontransparent-fill checks remain in every visible phase. Restoring content waits for both axes before applying those original checks. Both style families receive the hidden-state checks.

The Dropdown journey expected 24 prototype roots while the authored demo contained 25, including its destructive command. The expectation is now exactly 25. This source count is not substituted for actual DOM confirmation; the original runtime journey still has to pass.

The controlled Button owner canary dynamically imports source modules. The original bounded producer pointed it at a static production preview, which returned 404 for those module URLs. Public Light/Dark journeys continue to use the original production documentation page. Only the supplemental controlled source canary gets a separate context and explicitly owned source origin. Existing public and canary assertions and case limits are retained.

## Separate source-server ownership

The producer starts one isolated Astro source child only for the controls row, after the original fresh documentation build. Its own loopback port comes from the real child API response; caller-supplied production and source origins are cleared. Startup and the bounded stop grace consume the existing controls-row and global budgets. The original 600-second build budget, suite budgets and 45-minute runner limit remain unchanged.

The source producer records the actual installed Astro version, API entry and package hashes, ready process identity, document/module probes, request log and terminal cleanup. The exact tracked source gate remains in force. Explicit startup/end digests also bind generated paint inputs found in the real import graph. The generated Shadow style companion is recorded as a generator companion, not presented as an exercised Button Shadow path. Missing, aliased or changed inputs fail the producer. Six sealed source receipts and a clean terminal process-group cleanup are required during finalization. This supplemental source evidence does not replace production bundle or native interaction evidence.

Two real Node counterexamples failed against the first producer candidate: a descendant survived loss of the owner after readiness, and changing a generated style input did not invalidate the producer. The final helper retires its own group when the owner disappears and checks the generated inputs before and after use. The historical failing packet and logs remain unchanged.

## Drawer observation boundary

[The full CI run on 4cfe](https://github.com/Proto-UI/Proto-UI/actions/runs/45069218364) recorded six of seven Drawer cases passing. The Shadow reversal comparison failed with a 26.62994384765625 px displacement between samples 5.9 ms apart. The separate native run on that same revision had passed all seven cases. Neither result overrides the other.

The original test sampled, changed target, and sampled again through three browser RPCs. Reconstructing the original motion curve from both content translation and mask opacity is consistent with one additional approximately 16.5 ms leave frame between the observations. The original trace lacks a RAF acknowledgement and target-boundary timestamp, so that reconstruction is an inference, not proof of the actual event order.

The candidate retains the early leaving sample and diagnostics. It samples the immediate boundary, invokes the original target(true), and samples again within one synchronous browser task. Both Content and Mask must change from leaving to entering, both samples must remain attached, and the original strict displacement threshold remains less than 15 px. The old-to-fresh sample gap is recorded separately. The subsequent 600 ms entered check, reduced-motion close, all seven cases and all time budgets are unchanged.

## Executed evidence before this combined candidate

| Scope | Actual result and limit |
| --- | --- |
| Original six-file pure batch on 4cfe | 713 passed, zero skipped or pending; historical base evidence |
| Original 14-file native consumer batch on 4cfe | 358 passed, six failed, zero pending; all original files collected |
| Complete component-consumer file with the first-page candidate over clean 3acf | 84 passed, zero failed or skipped, naturally finished 22:32:55 UTC; only that candidate file changed during this execution |
| Final source-producer unit file | 24 passed, zero failed or skipped; original 13 bodies unchanged; real Node child/IPC/HTTP with a synthetic Astro package, not actual Astro or Chromium |
| Drawer boundary fault controls | 11 expected outcomes matched: two accepted and nine rejected, including both original-sized jumps, exactly 15 px, missing reversal, missing Mask reversal, detach and an erased target-call source mutation; synthetic observations against the extracted actual callback/guards, not browser evidence |
| Standalone actual installed Astro startup before documentation build | Failed naturally on the helper's 120-second startup deadline at 22:49:17 UTC; no ready/module-probe result; group and cache retired, source and lock unchanged. This was a pre-build diagnostic, whereas the formal producer runs after the fresh build. No actual Astro success is claimed. |

The complete 84-case Vitest JSON SHA-256 is 713037b8d36829a953d80601b444b6101a5efa0674b13660a6c0f3ad4952d3ce; its log SHA-256 is 513ad202f5c6dd4428c6a370aefdc6f12f6a4e74e0c380a63636a687fc8a858e. The final 24-case Node log SHA-256 is ea50b2ab071389823b457cd231b8ad81ccb67e71fef41f452d8a6d90d1b4aace. The pre-build Astro probe log SHA-256 is a380b75b798130a7c6744b1c6873dcb8b04db2c101ae54f945c98a56b918a1a1.

The owned remote checkout used a real pnpm 10.32.1 frozen install with scripts disabled, Node 24.22.3, and Chrome for Testing 145.0.7632.6. No other checkout's complete node_modules was linked. The lock SHA-256 remained e374ba03f76079fd191d63c2da1f62861b7e90bbeba64a0b310027fc2c15b7f8. Original sandbox choices, CJK fonts and input routes remain in force.

## Remaining acceptance

Run the complete original 14-file/364-case producer, including its fresh documentation build and actual source child, on the clean combined candidate commit. Run all seven Drawer native cases on that candidate. Preserve terminal logs, source/lock identity, production/source origin receipts and complete case counts for failures as well as successes.

The prior v6 paint witness calibration passed its 152-case Node file and 56-case native file. The original five-shard production contrast run 45077350176 subsequently reported success for all five jobs on exact head 3acf2e094dbb63d59a84c561ece7c50f177d2b6b at 22:44:44 UTC; this status was read back at 22:55 UTC. Review of the actual eight wheel-frame artifacts is still pending, and that parent-revision workflow result is not reassigned as a complete combined-candidate CI result. The earlier full workspace type command exhausted its resource budget during style generation before reaching TypeScript. Complete production contrast, workspace types, required full CI, normal independent review and platform gates remain open. Source review and these bounded executions do not constitute formal GitHub approval, OS assistive-technology certification, or Sprint completion. PR #1713 remains a Draft pending those requirements.
