# Bound browser font setup before the job deadline

Date: 2026-10-05. This CI-only follow-up is separate from the Focus logical-intent repair. It changes no product source, package ceiling, browser assertion, or public contract.

## Observed failure

On exact main `c9691a6b4f026e4b7e43f2cf4059bfe778afb837`, [run 37364827693, browser shard 5](https://github.com/Proto-UI/Proto-UI/actions/runs/37364827693/job/111987027346) downloaded the real 61.2 MB `fonts-noto-cjk` package successfully, but the download took 14 minutes 21 seconds. Font setup ran from 22:40:13 to 22:54:44 UTC. The browser producer then ran from 22:54:48 to 23:00:12 before cancellation, about 324 seconds rather than its own 900-second limit. The job began at 22:39:57 and has a 20-minute deadline.

The timing strongly supports job-budget exhaustion after slow setup; the cancellation issuer is not directly established. This was not a failed font download or a proven product regression. Native-links completed 10 tests; the other five selected suite files have no successful completion. The aggregate correctly rejected the cancelled producer. Other green shards cannot fill that gap.

## Bounded change

The font-install step receives `timeout-minutes: 3`, an existing repository setup pattern. The same apt commands and real font remain mandatory. A slow setup fails earlier; it cannot be treated as success. The browser job remains 20 minutes, the actual suite remains 900 seconds, and no `continue-on-error`, skipped typography evidence, fake font fallback, or aggregate relaxation is added.

This bounds only this setup step. It neither makes the mirror reliable nor guarantees the suite a full 900-second window, because other setup also consumes time. Broader setup limits and other workflows are outside this patch. Source-bound native CI must run again; no historical cancelled run is converted to a pass.

## Evidence

The added exact workflow contract fails on the uncapped baseline and passes on the candidate. Nineteen isolated mutations are rejected, including missing or changed font/setup deadlines, missing real font installation, swallowed apt failure, conditional skip, soft-failure flags, changed job/suite limits, and invalid step order. Existing typography and fail-closed workflow contracts are preserved. This is socket-free configuration evidence, not an Actions timeout simulation or native browser execution.

The independently reviewed product parent passed 4,347 general tests and its package/type checks. This CI-only child preserves its production and browser-test bytes; its own workflow contracts are separately rerun. The real final-head CI remains the acceptance evidence for the combined commit history.

Final worktree verification: both complete runtime/workflow and typography contract files pass all 120 tests. Formatting and diff checks pass; all nine product-source hashes match the reviewed parent. The isolated 19-mutation evidence is supplemental and is not counted in that 120-test aggregate.
