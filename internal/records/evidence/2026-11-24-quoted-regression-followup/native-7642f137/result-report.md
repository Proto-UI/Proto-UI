# Diagnostic contents-wheel observation at 7642f137

## Result and scope

The focused diagnostic run failed. Both authored native cancellation controls
passed. The selected public Popover matrix failed at Brutalist / WC / click with
`AssertionError: expected +0 not to be +0`, at
`apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts:1327:35`.
This is the original 1000 ms `vi.waitFor` assertion, before the subsequent two
requestAnimationFrame final-offset checks. The selected case took 71920 ms and
the complete selected-file invocation took 166.40 seconds. It was not the
180-second case timeout.

- Exact source: `7642f1376b08ee3d4930f596da6a77ca74db9dda`.
- Run: https://github.com/Proto-UI/Proto-UI/actions/runs/45413327043
- Job: https://github.com/Proto-UI/Proto-UI/actions/runs/45413327043/job/138512737583
- Workflow: `373828512`; `workflow_dispatch`; attempt 1.
- Created: 2026-11-24T14:22:18Z; terminal failure: 2026-11-24T14:26:18Z.

This source enables temporary, bounded positioning diagnostics. Instrumentation
adds execution overhead. A passing observation in this run is not final
uninstrumented product acceptance.

## Actual coverage and native observations

There are 13 distinct public wheel receipts from 36 planned combinations:

- Shadcn / WC, React, Vue and Vue2, each with click, Enter and Space: 12 receipts
  with no recorded error and final offset 0 to 500. Each retains the current
  owner/readiness, a matching trusted uncancelled wheel, the commanded movement
  direction, and an unchanged document offset.
- Brutalist / WC / click: one failed receipt; before/final offset both 0.
- Remaining 23 combinations: unexecuted. The other nine homepage cases were
  intentionally filtered out. No full homepage or full CI pass is claimed.

The Brutalist failure records trusted scroll callbacks on the same connected
Content/Surface at top 500 (`at=4937.3`, `eventTimeStamp=4933.5`) and then top 0
(`at=5009.4`, `eventTimeStamp=5005.2`). No scroll observations were dropped.
Before/after client heights are 768/772 and projected available heights are
772/776. Document offset is unchanged. Twelve normal-close observations and
four Shadcn keyboard-focus receipts are retained as supplementary evidence.

## Bounded positioning trace

Every public wheel receipt contains `positioningDecisions` with a limit of 256
entries. The 13 receipts retain 873 entries in total and report zero collector
drops. The failing Brutalist receipt retains 158 entries:

| Phase | Entries |
| --- | ---: |
| position | 25 |
| intrinsic-begin | 25 |
| retire-projected-size | 11 |
| intrinsic-mutation | 72 |
| position-stale | 5 |
| intrinsic-commit | 20 |

One concrete alignment point is sequence 94, generation 27, lease 1, at 4952.1:
`retire-projected-size`, reason `fresh:autoUpdate`, currentOwner true, with
available height `774.7831935882568px`. It lies between the two recorded scroll
callbacks above. Its preceding begin decision, rejected checks, basis changes
and retirement stack remain in the original JSON. Startup retirements also
exist; this report does not label every retirement a defect.

The collector filters to the current Docs Content lease. Zero dropped entries
means no truncation was reported by this collector, not that every browser
operation was instrumented. The raw trace was delivered to the repair owner and
independent reviewer before this summary was prepared. This watcher does not
infer a complete root cause or repair from temporal correlation alone.

## Input and artifact integrity

Both beforeTest and afterTest records bind to the exact source and report
`dirty:false`. Each lists exactly 17 source paths. All 34 hashes and byte counts
match the committed Git object bytes.

All five actual afterTest generated CSS/shadow outputs were rehashed and match
their archived metadata. Their bytes are identical to the actual 92d33316
native-run inputs. Four files were absent before the harness generated them;
those recorded beforeTest absences remain explicit rather than being counted
as successful byte checks.

GitHub artifact `14930556981` is retained as its original ZIP, 843418 bytes,
SHA256 `2f860e89671c5aaa6eebbf622249beaa13eb68a4a1128bf7f49b0c80aeb42a69`.
That digest matches GitHub metadata. All 65 extracted members have recorded
byte counts and SHA256 values in `artifact-manifest.json`.

The complete connector-decoded job log is retained as
`job-138512737583.log` and losslessly compressed as `job-138512737583.log.gz`.
The decoded UTF-8 log is 65372 bytes with SHA256
`f75dfdd325b2f5fb77dc01a58f0a73f10793927bd9707bceb5ec2723da2a4a92`.
This is not a claim about raw HTTP response bytes.

The compact durable bundle includes the original ZIP, complete job-log gzip,
terminal API snapshots, source/receipt checks, the trace index and this report.
It does not duplicate the extracted PNG tree. No rerun, dispatch, cancellation,
source edit or platform mutation was performed by this read-only watcher.
