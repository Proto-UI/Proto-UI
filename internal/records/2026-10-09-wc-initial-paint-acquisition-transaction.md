# WC initial-paint lease and view acquisition

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Observed failure and bounded explanation

The source baseline is `48b6f1bf6def5ffe1d1a7c34be91d670b1e7a077`. Official initial-paint run [37937416524](https://github.com/Proto-UI/Proto-UI/actions/runs/37937416524), artifact 11618384230, captured 13 frames. At 145.7 and 162.4 ms the same owner displayed the admitted seed; the 179.1 ms sample had `background-image: none`, `opaque-fallback`, reason `preparing`, and no seed marker. At 329.1 ms the original PNG returned. The artifact does not establish a continuously sampled 150 ms blank interval, nor a GPU failure.

A local test using the actual WC Adapter, Feedback and Liquid Surface observed four synchronous visual commits within one view acquisition. The first three had empty style tokens and material candidates; the fourth had the exact final family intent used by the official producer. A registered-seed reproduction on the baseline called `retire` four times. Its first recorded stack was `replayStyleForViewEpoch` → `projectFinalStyle` → material sink `repaint` → `ordinary('unresolved-owned-opaque-fallback')`. Thus an intermediate empty projection can withdraw the verified server plane before the final candidate reaches the ordinary matching guard. This source-level reproduction explains the official sampled sequence; candidate native validation is still required.

The synthetic test holds the custom element's connection callback while preparing a genuinely connected seed, then invokes the original callback. This models the browser's unknown connected element before upgrade without happy-dom's element-replacement behavior. Geometry, canvas bytes, image decode and GPU are synthetic. It is not native upgrade, CSS or optical evidence.

## Change and boundaries

During the WC custom visual provider's synchronous view-acquisition transaction, retain the latest complete feedback frame. Once `attachView` succeeds, commit it synchronously through the existing deferred provider. Failed acquisition discards/releases the pending view without allocating a provider. Subsequent frames immediately use the ordinary provider path, including empty styles and revocations.

There is no timer, delayed readiness claim, weaker seed match or retained-invalid-paint exception. The material sink, seed verification, source/preference/style/geometry guards and decode validation are unchanged. Existing provider failure, reentry and one-time retirement ownership remain in force. The change does not modify the other Adapter implementations or enable a public initial-paint feature.

## Verification and retained failures

- Baseline red: real Surface acquisition exposed four provider frames instead of one; the registered-seed test retired the seed four times. Baseline call-stack instrumentation identifies the first unresolved-style retirement.
- Candidate seed/acquisition assertions pass: initial pixels survive delayed decode; live quality is published after decode; later source revocation still withdraws paint.
- Full WC plus seed invocation: 128 files and 1,045 tests passed; two suites failed collection because this new isolated tree initially lacked website dependency links. Those failures are retained, not counted as passes.
- After restoring existing local links, the previewer suite passed 6/6. Final seed plus acquisition plus previewer rerun passed 124/124 before three additional acquisition controls; those three and the original four passed 7/7 in the final dedicated run. Counts overlap and are not added as independent tests.
- Dedicated controls cover failed initial render without provider allocation, Error/undefined/0 final-commit failures and exactly-once cleanup, immediate later empty-style publication, falsy factory failure and synchronous null-provider ordinary style.
- Workspace `tsc -p tsconfig.workspace.json --noEmit` passed with a command/exit-code receipt. The initial attempt found three newly introduced test typing errors and two absent generated Shadow-style modules. The test constructors were corrected; the existing CLI and website style generator regenerated the local inputs. Both failed and successful logs are retained.
- Strict package budget measurement exits 1: React 106,445/+445 B, Vue 106,280/+280 B, WC 132,072/+72 B. Only WC grows, by 42 gzip bytes relative to the baseline. No caps changed. Finf advisory measurement exits 0 with `withinBudgets: false`.
- Independent source review separately reran 114 seed, seven acquisition and six deferred-provider tests, plus additional failure and later-empty-frame controls. Reentry is covered by the existing deferred-provider tests. That is bounded source evidence, not platform approval or native acceptance.

The genuine browser suite `shadow-closeout.browser.test.ts` did not run: its initial collection failure preceded browser launch. No candidate native browser run or screenshot is claimed. The official initial-paint assertion remains unchanged and must pass on the eventual exact published head. Full Finf acceptance remains 0/68; canonical integrated source proof and exact-head CI belong to the subsequent integration boundary.

The evidence packet retains the three source hashes, a complete source patch, original and corrected logs, strict/advisory budget JSON and explicit command/exit receipts. No remote ref is changed by this local repair.

## Recovery after the 14:03 UTC environment replacement

The shared and temporary filesystems were replaced after the original local commit and independent review. The earlier logs, archives and the local `613d94c51d31e8540c3284ce6bf563c966327aa7` commit object are no longer readable. The preceding verification results describe observed earlier executions; they are not claims that their original log files survived.

The three source/test files were reconstructed from the previously displayed tool text against the remotely published 48b baseline. Their SHA256 identities match the reviewed originals exactly:

- WC Adapter: `1a57489181a25f0115f7801c7e3d68f87621ce7f54208d12c76ed02818108283`
- Seed tests: `f79f457827f386b48c450b791ddb9e1ee34e9cc59a91f61efd9dc366024a103a`
- Acquisition tests: `02bf70b3b5313c6dc32209f25f09898f93e1095ae0c608ea41f0505d4a774269`

This recovery uses a new commit and new command receipts. It does not recreate or claim the old commit history, bundle bytes or missing logs. New native execution remains outstanding, and final integrated source proof must be regenerated at the eventual publication boundary.

The recovery reran 127 focused tests (114 seed, seven acquisition and six existing deferred-provider controls), all passing. A complete workspace type check subsequently passed. The first recovery type attempt was incomplete because the minimal restored checkout omitted website test/type inputs and some workspace dependency links; those original 48b inputs and locked local links were restored, then the same type command succeeded. New strict and Finf-advisory measurements retain the same +445/+280/+72 B overages and exit codes 1/0 respectively. These are new executions after recovery; no old execution log is reconstructed.
