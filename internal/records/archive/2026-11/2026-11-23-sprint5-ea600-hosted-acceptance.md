# Sprint 5: hosted acceptance at ea600, browser failure retained

## Executed source and overall outcome

The manually requested [compiler acceptance run 45271472592](https://github.com/Proto-UI/Proto-UI/actions/runs/45271472592) executed commit `ea60064882924eb455e1dfc3ff7de55a32de4558`, tree `0897b961018877cfcbd41fae6f0c341f755839e2`. Its overall conclusion is **failure**. The first unresolved failure is in the canonical production browser journey. Successful jobs below remain successful observations of this exact source; they do not convert the failed run into acceptance.

The dispatch used the existing workflow with `browser_acceptance=true`, `adapter_acceptance=false`, `package_budget_evidence=false` and `website_shader_evidence=false`. It was issued once after the non-force push was independently reconciled to the published head. The immediate stale PR response after the successful push and the separate read-only reconciliation remain in the publication receipts. There was no second push or duplicate dispatch.

The source retains the normal public f6bd and 12af merges, the independently added physical and immutable ControlLabel controls, and the explicit source and native input-direction selections. The preceding [public integration record](2026-11-24-sprint5-final-public-union.md) and [native concurrency record](2026-11-24-sprint5-post-closeout-native-integration.md) retain their original scope and pending-at-the-time statements.

## Terminal hosted results

| Job or selected check | Actual result |
| --- | --- |
| [Linux generated-native consumers, job 138032094115](https://github.com/Proto-UI/Proto-UI/actions/runs/45271472592/job/138032094115) | Success; nine complete native targets, 155 passed, zero failed, ignored or filtered |
| [macOS generated-native consumers, job 138032093727](https://github.com/Proto-UI/Proto-UI/actions/runs/45271472592/job/138032093727) | Success; nine complete native targets, 155 passed, zero failed, ignored or filtered |
| [Flutter, job 138032093465](https://github.com/Proto-UI/Proto-UI/actions/runs/45271472592/job/138032093465) | Success; wrapper 1/1 and actual native Widget consumer 14/14 |
| [Source regressions and types, job 138032094166](https://github.com/Proto-UI/Proto-UI/actions/runs/45271472592/job/138032094166) | Success; selected 41 files, 716 passed, zero failed, pending or todo |
| Complete workspace and documentation type analysis | Both workspace and docs commands succeeded; the Astro docs result counted 1,330 files, zero errors, zero warnings and 47 hints |
| Official specification authoring | Three inputs passed against exact main `0fbb52ef832cc27c78e24c28c59a55a16f51d7fe` |
| [Production build and bundle gate, job 138032094220](https://github.com/Proto-UI/Proto-UI/actions/runs/45271472592/job/138032094220) | Success; 684 pages and 2,150/2,150 gate controls, zero skipped or todo |
| Generated SSR adoption and retirement in Chromium | 4/4 passed within the browser job |
| Original native `dir=auto` input and textarea cases | Exactly 2/2 passed; 190 other Shadow cases filtered/skipped and not counted as passed |
| [Canonical production browser, job 138032094383](https://github.com/Proto-UI/Proto-UI/actions/runs/45271472592/job/138032094383) | Failed; 17/20 |
| Independent production rebuild and receipt verification | Skipped after the canonical failure |
| Adapter, package-budget and website-shader opt-ins | Skipped because not requested; no new-head execution is claimed |

The independent standard PR run [45271309189](https://github.com/Proto-UI/Proto-UI/actions/runs/45271309189) completed its four executed jobs successfully; the other planned lanes were skipped. DCO was successful in the retained readback. These checks do not replace the failed browser acceptance.

### Native target counts

Both platforms have the following separate results. The two operating systems are not combined into a single acceptance count.

| Original native target          | Linux | macOS |
| ------------------------------- | ----: | ----: |
| Ordinary values                 |    46 |    46 |
| Ordinary ControlLabel           |    14 |    14 |
| Official Input and ControlLabel |     9 |     9 |
| Style mapping                   |     1 |     1 |
| Accessibility activation        |     4 |     4 |
| Numeric projection              |     9 |     9 |
| Scroll pause                    |     5 |     5 |
| Scroll reader                   |     5 |     5 |
| Emitted native SDK              |    62 |    62 |
| Total per platform              |   155 |   155 |

The reader selection includes the new real-wheel later-sibling case. The SDK retains the independently added drained-buffer, inactive bridge, physical ownership and role assertions. The official Input consumer's earlier refused-pair diagnostic failure is not relabelled: both operating systems' earlier 2df logs remain 8/9, while this ea600 run actually completed 9/9 on each.

The Flutter acceptance receipt's native Widget result was checked directly, including its successful exit and final `+14: All tests passed!` output. The wrapper's single passing test is reported separately. The receipt still records `publicFlutterProfileActivated: false`; this execution does not activate a public profile.

## Browser failure and its limits

The production browser was Chrome `157.0.8103.78`. Its canonical receipt retains three failures:

1. `edit-reject-recover-same-revision-source-and-preview` failed after 7,963 ms with the original **250 ms preview cleanup acknowledgement deadline** and a `failed !== ready` assertion.
2. `cancel-running-edit-and-reopen-fresh-owner` then failed after 30,165 ms at its original 30-second wait.
3. `production-worker-chunks-and-cleanup` failed the actual initial, cancellation, reopen and bilingual Worker coverage control. Two actual Workers were observed and both were closed; the required minimum was four.

The first failure and subsequent failures are retained independently. This result does not establish which scheduling or application path caused the missed acknowledgement. No timeout, source input, browser sandbox, expected Worker count or canonical assertion was changed to obtain a result.

The source and asset stability check passed for 10,686 source files, and no browser console error was reported. Those facts do not establish successful cleanup or complete the skipped independent rebuild. The failure screenshots, including the revision-15 state, remain in the unmodified original browser artifact.

The generated SSR tests and the two selected Shadow tests are distinct from the canonical journey. The two selected titles are the original trusted native `dir=auto` input and textarea cases. The remaining 190 Shadow cases were filtered/skipped. This record therefore does not call the canonical result 19/22, and does not claim that the complete Shadow suite passed.

Earlier observed 250 ms cleanup failures, including preserved hosted and diagnostic runs, remain historical failures. The earlier successful 2df production run does not establish why those timing failures did not recur there. This new ea600 failure is preserved as its own actual production observation.

An isolated exact-ea600 production diagnostic was prepared for causal investigation. Its original runner builds the production service itself. Any Profiler, Tracing or observer result from that investigation is diagnostic evidence and cannot replace the canonical production run without added diagnostic observer instrumentation.

## Production graph and source verification

The original production graph is 5,056,274 bytes, SHA-256 `502f4716e268b740d34b8ff91de30c89722ee4ccb679676331e7e5fd169a2748`. Its independent replay used the exact-head gate against the original graph, returned exit zero with no issues, and covered 2,606 chunks and 5,898 modules. The graph was not edited and the build was not repeated for that replay.

The production lock and Astro input identities match the executed Git head. The source job's 41 actual result files were compared with the workflow selection. Its 716/716 count is taken from the actual Vitest JSON, not predicted from static test declarations. The source job separately retained the 9 browser-input controls, 45 configuration controls, 59 CI controls, scheduler, authoring and complete type-analysis output. The original type command sequentially ran style generation, the workspace check and the documentation check; all succeeded. Its final 1,330-file count belongs to Astro's documentation analysis and is not a TypeScript workspace source-file total.

The prior Adapter success remains source-bound to its earlier 2df execution. The existing exact input-equivalence record remains available; the skipped Adapter job in this run is not a new Adapter pass.

## Original artifacts and cross-device custody

The original six hosted ZIPs, complete job logs, independent readbacks and production replay material are retained in this packet. ZIP size and SHA-256 were checked against GitHub's artifact metadata, ZIP CRC checks succeeded, and source identity files bound the contents to ea600. Native counts were mechanically parsed from the complete target logs; Flutter's native result and internal receipt hashes were checked separately.

The source and browser artifacts were first inspected on the primary filesystem. Their later copies on doesvm are **cross-device custody copies**, not another validation run. The two ZIP hashes, exact original job-log hashes, all 50 extracted files and the 34,634-byte peer readback matched. Initial decoded transfer copies had an extra trailing newline; only the separately named `*-job-original.log` files are used as exact original logs here. No temporary signed download URL is included.

| Artifact | ID | Original ZIP bytes | SHA-256 |
| --- | --: | --: | --- |
| Linux native | 14864702274 | 3,574,675 | `2628d370297cb1fac053f57d972cae23c06a599e3d4a69f8f2f6943cb22ae664` |
| macOS native | 14866176346 | 3,575,040 | `6ef201a56dd18ce12a0eabd5b6bfa86592ec92cbdf4ab33400563b88f4ecdfb6` |
| Flutter | 14865427266 | 15,200,337 | `d8de6c994285019604a660186c56345f7dbc1d046aefb3d9d806c0e78df901bd` |
| Source regressions | 14865037350 | 97,620 | `61a8b51b17c015923e6e97777394e073b71a903cc899af6b128a4f6163918bd7` |
| Browser acceptance | 14865836984 | 2,126,283 | `9b56c4470458c16fb6e61f98b05d156409f676d601d3605f802a5e985fedda57` |
| Production build | 14864599701 | 425,043 | `acee4d22c294ee1f4d5aee28601be58a659334edf24576f9b0912c6ca35d92ad` |

The shared [repair evidence manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint5-native-part-input-retirement/manifest.json) records 208 originals, 65,025,208 original bytes and 29,489,830 archived bytes, including complete artifact containers rather than a second copy of every generated file. Every archived byte stream is compared with its original. These originals describe ea600. Any repair accompanying this archive has its own source-bound receipt and does not re-execute or relabel ea600's tests as a different head.

## Readiness

At this snapshot PR #1738 remains **Draft** because the canonical production browser has a real unresolved failure. The successful native, source/type, production, SSR and selected input-direction checks remain available for the next bounded repair. No umbrella Issue, release criterion, specification maturity, physical OS/assistive-technology acceptance or GitHub approval is asserted by this record.
