# Native contents-wheel observation at dca8f4f8

## Observed result

The focused run failed. The two authored native cancellation controls passed.
The original selected public Popover matrix failed at Brutalist / WC / click
with `AssertionError: expected +0 not to be +0`, at
`apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts:1260:35`.
This is the original `vi.waitFor` assertion with a 1000 ms deadline. The failing
combination did not reach the subsequent two-animation-frame final-offset
assertions. The selected case took 60272 ms; the complete selected-file invocation
took 150.67 seconds. This was not the 180-second case timeout.

- Source: `dca8f4f8f17ff1eba7198ad5aef8a018b3ac9434`.
- Run: https://github.com/Proto-UI/Proto-UI/actions/runs/45408980428
- Job: https://github.com/Proto-UI/Proto-UI/actions/runs/45408980428/job/138497341264
- Workflow: `373828512`, `.github/workflows/browser-suite-repair-evidence.yml`.
- Event: `workflow_dispatch`; attempt 1.
- Created: 2026-11-24T13:58:31Z; terminal failure at 2026-11-24T14:02:06Z.

## Actual public coverage

There are 13 distinct public wheel receipts from the planned 36 combinations:

| Observed combinations | Result |
| --- | --- |
| Shadcn: WC, React, Vue, Vue2, each with click, Enter, Space | 12 receipts with no recorded error, final offset 0 to 500, matching trusted uncancelled wheel, retained current owner/readiness, and unchanged document offset |
| Brutalist / WC / click | Original assertion failed; final offset remained 0 |
| Remaining combinations | 23 unexecuted; no pass inferred |

The 12 successful wheel observations retain movement in the commanded direction
in their final archived receipt. The exact tested source includes the new final
nonzero/direction assertions after two requestAnimationFrame boundaries. The
remaining nine homepage test cases were intentionally filtered out; this is not
full homepage or full CI acceptance. Twelve normal-close observations and four
Shadcn keyboard-focus receipts are also retained in the original artifact.

The failing Brutalist receipt records trusted scroll callbacks on the same
connected Content/Surface at top 500 and then top 0, with no dropped scroll
observations. Callback observation times are 4411.2 and 4504.8 ms (about 93.6 ms
apart); corresponding event timestamps are 4407.5 and 4450.9 ms (about 43.4 ms
apart). These are different timing facts and do not identify the operation that
reset the offset. Before/after used client heights are 768/772 and projected
available heights are 772/776. Document offset remained unchanged.

## Source and generated-input integrity

Both `beforeTest.json` and `afterTest.json` bind to the exact source above and
report `dirty: false`. Each contains exactly the workflow's 17 source paths.
All 34 recorded hashes and byte counts were checked against the corresponding
committed Git object bytes.

All five actual afterTest generated outputs were rehashed from their archived
bytes and are byte-identical to the actual 92d33316 native-run inputs:

- `shadcn-theme.css`
- `proto-ui-style.css`
- `proto-ui-tokens.generated.css`
- `proto-ui-shadow-style.generated.js`
- `proto-ui-shadow-style.generated.d.ts`

Four generated files were absent at the beforeTest checkpoint, before the native
harness generated them. Those recorded absences are preserved and are not
described as successful pre-test byte checks. The existing wrapper CSS was
present and matched. Environment and browser details are retained in the source
records and `result-summary.json`.

## Retained original evidence

GitHub artifact `14927725291` was downloaded as the original ZIP, 736611 bytes,
SHA256 `7bae7313a582a73a04a36626b13e54300c2284aac24a54e11e3afa4930a5d5dd`.
The digest matches GitHub's artifact metadata. All 65 members were safely
extracted; every extracted file has a SHA256 in `artifact-manifest.json`.

The complete decoded job log is retained as `job-138497341264.log` and losslessly
compressed as `job-138497341264.log.gz`. Its UTF-8 byte count is 65099 and SHA256
is `8a6030d68a5ec6ae41696974b895e70c73e349b3294ef7fc0e699a83a889e9a1`.
This is the GitHub connector's decoded complete log, not a claim about raw HTTP
response bytes.

The compact durable bundle contains the original artifact ZIP, complete job-log
gzip, terminal API metadata, input checks, observations and this report. The
extracted PNG tree is not duplicated in that bundle. The extracted artifact is
available alongside it for independent inspection.

No new run, rerun, cancellation, source edit or platform mutation was performed
by this read-only watcher. This observation does not establish the remaining
root cause or complete the user-facing repair.
