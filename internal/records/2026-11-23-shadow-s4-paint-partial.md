# S4 native paint diagnostic 07 — 2026-11-23

The original run remains **failed**. It executed all 24 paths with the original 380 ms close interval, 150,000 ms case budget and minimum five actual paint frames. The `split/switch/0` path produced four frames, so the full case did not pass. Seven preparation/cleanup controls passed before launch. No threshold, predicate or product source was changed to count this failure as success.

The recorded product base is `9e0c46c3799da2f3f9c3ecddd114baa81ea0aa31`. Its producer records `dirty: true`; that fact and the complete public-dist input hashes are preserved in the raw report. This historical frozen diagnostic does not include the subsequent owner-marker fix, nine-expression candidate or selector-cache candidate and is not current integration evidence. Chrome 145.0.7632.6 used executable SHA-256 `481fea1516a1f2b76454664272f12cd9dd1f20117b21e1f1498e08bc7f872c00` with `--no-sandbox --disable-dev-shm-usage`.

Actual execution began at 12:30:43.306109 UTC and ended at 12:31:58.490160 UTC, exit 1. All three cards ended closed, their eight content/mask view mount and unmount pairs completed, and the page-error list is empty. The original assertion error is retained unchanged.

## Recorded compositor frames

The failure path retained 170 raw PNGs without adding disk I/O to the measured close window. An offline pass verified every image against the captured index, then used the original Sharp resize-to-550 and marker predicate (r > 200, g < 80, b > 200; visibility at least four pixels). All 24 recorded traces contain marker disappearance and no later recorded reappearance. This is an observation of the captured samples, not evidence about unrecorded frames and not a substitute for the minimum-frame gate.

| Path             | Actual frames | Original minimum met | Recorded reappearance frames |
| ---------------- | ------------: | -------------------- | ---------------------------: |
| light/default/0  |             8 | yes                  |                            0 |
| light/default/1  |             5 | yes                  |                            0 |
| light/switch/0   |             7 | yes                  |                            0 |
| light/switch/1   |             5 | yes                  |                            0 |
| light/checkbox/0 |             8 | yes                  |                            0 |
| light/checkbox/1 |             6 | yes                  |                            0 |
| light/both/0     |             6 | yes                  |                            0 |
| light/both/1     |             7 | yes                  |                            0 |
| split/default/0  |             9 | yes                  |                            0 |
| split/default/1  |             5 | yes                  |                            0 |
| split/switch/0   |             4 | **no**               |                            0 |
| split/switch/1   |             7 | yes                  |                            0 |
| split/checkbox/0 |             7 | yes                  |                            0 |
| split/checkbox/1 |            10 | yes                  |                            0 |
| split/both/0     |             6 | yes                  |                            0 |
| split/both/1     |             8 | yes                  |                            0 |
| mixed/default/0  |             9 | yes                  |                            0 |
| mixed/default/1  |             7 | yes                  |                            0 |
| mixed/switch/0   |             8 | yes                  |                            0 |
| mixed/switch/1   |             7 | yes                  |                            0 |
| mixed/checkbox/0 |             5 | yes                  |                            0 |
| mixed/checkbox/1 |             9 | yes                  |                            0 |
| mixed/both/0     |             8 | yes                  |                            0 |
| mixed/both/1     |             9 | yes                  |                            0 |

For the failing path the four captured frame timestamps relative to the pre-click path start were 560.541, 629.932, 643.632 and 666.316 ms. The view-detach event was at 651 ms. These offsets include the browser input/actionability interval; they are not a measured violation of the subsequent 380 ms close interval and do not establish hardware load as the cause. The first frame has 49 marker pixels; the remaining three have zero.

## Recovery

The ten small source reports, logs, capture index and offline-analysis source/result were copied byte-for-byte into `internal/records/evidence/2026-11-23-shadow-s4-partial/` as gzip files. `manifest.json` records both decoded and gzip hashes. The 170 original PNGs remain intact at:

`/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono/shadow-replays-4deb-02/s4-diagnostic-attempt-07/raw-paint-failure/`

The captured index SHA-256 is `7188156a535c2c8b23f1069aed2d9bc9a0af46f371e9bfac0ffec002871a984a`. The complete native case must still run successfully on the intended current source under the original gates. No Apple, 120 Hz, assistive-technology or other Sprint evidence is inferred from this diagnostic.
