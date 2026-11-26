# PR #1743: preserve presentation ownership during Portal preparation

This bounded repair follows the original seven-case Drawer native failure on `48ebbaa7139e5caf7730659ae827049a93e97ea3`. It preserves the Portal first-render acquisition guarantee and the existing Presence owner, style, geometry and finite-settlement rules. It is an implementation/evidence record, not a lifecycle promotion or new public API.

## Original failure and owning repair

The [original browser suite](https://github.com/Proto-UI/Proto-UI/actions/runs/45222928664) retained **4 passed / 3 failed / 7 total** Drawer cases. Artifact `14841482886` has SHA-256 `5df30618eb793e2e4345f5d979d01d7d5f9d6ad95a9a72c36b494941016ed532`.

The two public cold-entry traces show a valid reference height, followed by the existing private `data-pui-portal-preparing` display suppression. The same live attempt then reads unavailable geometry and settles `unresolved-units` before the Portal releases its first-render barrier. The original document case records one early `entered` frame; that limited trace alone does not prove the entire same causal chain for that case.

The Web host now includes its private preparation state in one environment snapshot and does not measure the suppressed box. It still observes current preference, visibility and projection ownership. The Presence projector applies those original immediate fallback conditions before deferring animation geometry and frame acknowledgement until preparation ends. The existing ancestor observer includes the private marker and crosses ShadowRoot ownership through the existing host traversal.

The Portal display rule, first-paint acquisition/reentry, semantic styles, binding acceptance, cancellation, generation checks, CSP, complete `settle()` function and independent deadline remain unchanged. No dimensions are guessed or borrowed from old layouts. Preparation that never finishes cannot become a successful `finished` result. The original seven native cases, 750 ms observation window and native assertions are unchanged.

## Discriminating evidence and independent source review

The immutable integrated six-file patch is `drawer-preparation-candidate-v3-final.patch`, SHA-256 `f3532a4192ef8a23e11858b21ac77ca658f8f86a6f9181d8ecb8e367f0fc26d7`, prepared against exact48. Integration checked every resulting file against its complete source snapshot.

| Actual execution | Result |
| --- | --- |
| Original48 with the first nine new controls | 4 failed / 5 passed; premature unresolved geometry |
| v2 with the final live preference fixture | 6 failed / 9 passed; preparation incorrectly delays immediate fallback |
| v3 with the same final fixture | 15 passed / 0 failed |
| v3 related Presence, Portal and adoption suites | 12 files; 142 passed / 1 existing TODO |
| Changed TypeScript files and their real imported graph | Focused tsc exit 0 |
| Prettier and diff check | Exit 0 |

The existing TODO is repeated native adoption back to the original Document during cancellation. It is not a new skip. The 512 MiB whole-workspace type attempt ended in V8 OOM with exit 134; it is preserved as a resource failure, not a type pass. Earlier fixture mistakes and failed candidates remain in the raw archive.

Independent narrow review found a P2 in v2: a preparation check before `environment()` also blocked reduced/unknown preference, hidden and lost-channel fallback. The final same-fixture red/green pair confirms v3 closes that finding. The reviewer applied the immutable patch in memory, checked all six file hashes and verified the complete `settle()` body remains byte-identical. There is no remaining blocking source finding within that narrow review. It does not establish final-head platform approval or native acceptance.

Only `APPLICATION` and `OWNER` executable evidence mappings are added to the existing draft [T-FEEDBACK-PRESENCE-PRESENTATION-0001](../../spec/tests/T-FEEDBACK-PRESENCE-PRESENTATION-0001.yaml). Normative criteria and lifecycle remain unchanged.

## Preserved evidence and remaining verification

The [complete raw archive](evidence/2026-11-23-pr1743-portal-presence-preparation/raw.tar.gz) is **351,373 bytes**, SHA-256 `838619108e996fe7dfc083e56bd151331c1b4557bbde49b0114262eeb7f00965`. Its 100 members retain the original native ZIP/frames, all red and green logs, failed resource attempts, source snapshots, routing receipts and the independent review packet. The embedded review packet is 19,548 bytes, SHA-256 `9a69626489040aebaaf25d2bec2908960ceb0061a9d35f4eb40b063353bd88b0`.

The original seven native cases, affected Portal/Image consumers, full current-source type/catalog checks and strict canonical budgets remain required on the final integrated candidate. Earlier exact48 passes and these focused source tests are not relabeled as that final acceptance.
