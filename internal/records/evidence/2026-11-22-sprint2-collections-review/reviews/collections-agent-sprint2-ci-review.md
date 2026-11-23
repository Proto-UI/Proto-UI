# Independent local review: Sprint 2 sequential browser acceptance queue

Reviewer: `/root/collections`, independent of the queue implementation author. Human-assisted / current-user. No implementation files were changed by this reviewer and no native-browser matrix was executed in this review.

## Source binding and scope

Reviewed working-tree additions `scripts/analysis/run-sprint2-consumers.mjs`, `scripts/analysis/test/sprint2-consumer-queue.test.mjs`, and the `projection-family-evidence.yml` workflow change. Original source bytes and SHA-256 records are retained in `collections-agent-sprint2-ci-review-source.json` and its three `reviewed-original-*` snapshots. Corrected source hashes are in `collections-agent-sprint2-ci-review-source-r2.json`.

The initial review covered eight suites. The subsequently reviewed nine-suite delta adds 20 generated-consumer cases and includes the existing Date Picker journey in the geometry suite, bringing the browser inventory to **280** cases. Its source hashes are retained in `collections-agent-sprint2-ci-review-source-r3.json`. The next reviewed delta adds the 12 original ordinary linked-library consumers: **ten suites / 292 cases**, consisting of 280 browser cases and 12 Node/HappyDOM cases. That delta is bound by `collections-agent-sprint2-ci-review-source-r4.json`. Later additions need their own count/name delta check.

## Reconciled findings

### CI-REVIEW-001 — P2 / high confidence — timeout process-group retirement

**Expected:** A timed-out suite's process group must stop doing work before the sequential queue begins the next heavy suite.

**Original observation:** The timeout sent SIGTERM to the group, but the leader's `close` event cancelled the pending SIGKILL and resolved immediately. A descendant ignoring SIGTERM survived while the queue was free to start the next suite.

**Independent negative control:** A real Node group leader spawns a real descendant that ignores SIGTERM and writes a heartbeat every 100 ms. The leader exits gracefully on SIGTERM. Against the original source snapshot, `runProcess` returns `{code:0, timeout:true}` while the descendant continues to update its heartbeat, including after the five-second hard-kill grace. The reviewer kills the owned probe descendant in `finally`. Evidence: `sprint2-queue-timeout-review-probe.mjs` and `sprint2-queue-timeout-review-red.json`.

**Correction and independent result:** The deadline remains alive after the leader closes. The timeout path sends the final group SIGKILL and only then permits completion. The identical probe against the correction observes no heartbeat change after the queue resumes; the descendant disappears. Evidence: `sprint2-queue-timeout-review-green.json`. A transient reparented zombie is not an active workload and must not be confused with the original continuously working descendant.

### CI-REVIEW-002 — P2 / high confidence — exact native matrix inventory

**Expected:** Acceptance requires every admitted family × host × kind × scenario exactly once. An equal total with missing combinations cannot satisfy that inventory.

**Original observation:** The summarizer only checked total count, allowed individual family/host/kind values and uniqueness. A receipt containing 72 distinct fake scenarios for Base/WC/OTP passed as 72/72, despite containing none of the admitted scenario IDs or other family/host combinations.

**Independent negative control:** `sprint2-queue-inventory-review-red.json` records that false acceptance from the original implementation.

**Correction and independent result:** The implementation constructs the exact Cartesian set, including separate controlled/uncontrolled OTP cases and controlled/uncontrolled/lifecycle/directions Slider cases. It compares the sorted exact ID sets before accepting counts. My identical 72-fake-case receipt now rejects, the actual full 72-ID inventory accepts, and changing one selected case to skipped leaves it incomplete. Evidence: `sprint2-queue-inventory-review-green.json`.

The added generated-consumer Vitest path initially retained the same count-only weakness: 20 distinct fabricated React/Base names were accepted as the full four-target matrix. I reproduced that exact false acceptance in `sprint2-compiled-inventory-review-red.json`. The owner then froze the 12 target/family Button names and eight target/owner TextControl names as `expectedIds`. My original fake receipt now rejects, the independently constructed actual 20-name set accepts, and one selected pending case remains incomplete. This readback is retained in `sprint2-compiled-inventory-review-green.json`.

### Workflow timeout-budget correction

The original job timeout was 60 minutes while ten sequential stages could each use 15 minutes. Several slow/failed stages could therefore let the external job timeout cut off the queue before it assigned later suites a terminal disposition. The intermediate 180-minute budget covered ten stages. With nine suites and two prerequisites, eleven stages can consume 165 minutes plus up to 55 seconds of grace. Installation is explicitly capped at ten minutes and artifact upload at three; retaining only 180 minutes would leave about 65 seconds for all checkout/setup overhead. Following the review, that delta increased the budget to 190 minutes. The current ten-suite version allows **210 minutes** for twelve stages: 180 minutes plus up to 60 seconds of process-group retirement, installation/upload caps and about sixteen minutes of setup margin. No case timeout or acceptance criterion was weakened. Platform cancellation can still interrupt a run; an inaccessible or interrupted receipt is never a pass.

## Inventory and filtering review

| Suite | Admitted cases | Source basis |
| --- | --: | --- |
| Shared input | 72 | Three families × four hosts × two OTP and four Slider scenarios |
| Collection recipes | 36 | Three families × four hosts × Tree, Data Table and Virtual List |
| Resizable / Carousel / Date Picker | 36 | Three families × four hosts × three original capability journeys |
| Form / Select recipes | 24 | Three families × four hosts × two public recipes |
| Ordinary linked-library consumers | 12 | Existing Node/HappyDOM import/linking/nominal-identity tests; not native browser evidence |
| Generated ordinary framework consumers | 20 | Twelve family Button cases plus eight synchronous/queued TextControl cases |
| Website B/C/D and historical Hook evidence | 42 | Eight live Tabs, sixteen desktop navigation, eight mobile navigation, eight Hero and two Hook cases |
| Preferences | 4 | One real source consumer in each host |
| Collapsible | 23 | Base five cases; Shadcn and Brutalist nine each |
| Accordion | 23 | Twelve family/host journeys, three narrow locale cases, eight Shadcn Rhea homepage cases |

The two existing disclosure test files retain their broader original families. The new queue selects the explicit three-family release cases through anchored test names and records the excluded cases separately; nonselected experimental cases are not counted as passes. Any selected skipped/pending test remains incomplete and prevents queue acceptance. The existing workflow default and reusable path retain the original broader evidence lane; only explicit manual `scope=sprint2` enables the new queue.

The queue clears ambient diagnostic selectors, assigns fixed family/host/kind values, and checks each resulting receipt. A failed suite retains its own failure while later independent suites still run. Only failed common build/style prerequisites stop dependent suites. Spawn failures, timeout flags, nonzero exits, missing/malformed receipts, duplicate/partial inventories and incomplete cases cannot become successful queue results. Each step is persisted before and after execution, and the aggregate exit remains failure if any required step fails or is not run.

For the later ordinary linked-consumer delta, I independently extracted the eight literal test titles and four profile-expanded titles from the existing source and compared all twelve complete names with the new `expectedIds`. The actual names accept and twelve fabricated names reject (`sprint2-ordinary-inventory-review.json`). Its `evidenceKind` explicitly says Node/HappyDOM, and that distinction is retained in `report.suites`; these twelve results cannot be counted as Chromium cases. The optional evidence-directory environment key is assigned only when defined. A Vitest worker exit still fails through process status and/or incomplete inventory; the independent queue continues. The author's two earlier unexplained worker exits remain historical failures. A later instrumented local 12/12 run does not explain or erase them, and the hosted uninstrumented run is still required.

Source binding records the starting Git HEAD/tree, tracked patch digest and actual lock digest; the correction additionally hashes untracked source files using NUL-delimited Git paths. Native runners retain their own source/bundle/style and browser evidence. These hashes disclose a dirty local candidate; they do not turn it into a clean final commit automatically.

## Independent executions

- Original two queue control tests: **2/2 passed**, with no skipped/cancelled tests.
- Corrected queue controls, including the real process group and false full-count matrix: **4/4 passed**, with no skipped/cancelled tests on Linux.
- Nine-suite delta controls, including the false generated-consumer inventory: **5/5 passed** in an independent reviewer execution, with no skipped/cancelled tests on Linux (`sprint2-queue-nine-suite-review.log`).
- Separate exact original/repaired process-group heartbeat probe.
- Separate false-matrix red/rejection green, full-inventory positive and selected-skip control.
- Static review of the original eight inventories and the later nine-suite/280-case delta, selector names, source-binding fields and workflow gating. The queue fixes `CANDIDATE_SHA` to its recorded source HEAD for the generated-consumer assembly.

These are small Node control-flow checks. They do not constitute any native product acceptance or revive unavailable remote results.

## Proposed Git-object transport

The owner described a temporary transport branch carrying a Git bundle, with a read-only validation job and a separate narrowly scoped publisher job. This can preserve original commit objects/authors/sign-offs, provided the publisher verifies the fixed transport commit, bundle SHA-256, intended target commit/tree and expected old PR head; checks that the old head is an ancestor; imports only the intended ref; and uses an explicit target ref with an expected-head lease. The temporary transport commits must stay outside the PR ancestry. A remote ref readback must confirm the exact published SHA.

This is a **conceptual review**, not acceptance of an unseen publisher workflow or proof that the platform permits the operation. No candidate code should run in the write-credential step; checkout credentials should not persist, and secrets must not enter logs or artifacts. An actual permissions rejection must remain a rejection rather than prompting a weakening of repository protections or a credential substitution.

Current GitHub documentation was checked for the relevant platform constraints:

- [GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token): token-created pushes do not start push workflows; some PR events can create approval-required runs. A transport run is therefore not product CI.
- [Manually running a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow): the existing default-branch manual workflow can select a branch/ref through the real authorized UI.
- [Repository contents permissions](https://docs.github.com/en/rest/repos/contents): changing workflow files has a distinct workflow-authorization boundary. `contents: write` must not be assumed to grant every workflow update.

### Concrete transport-r1 source review and local verification

The owner subsequently supplied `workflow/transport-r1/{publish-candidate.mjs,manifest.json,preference-source-evidence.yml,projection-family-evidence.yml,candidate.bundle}`. I read the complete publisher and both workflow roles, then ran the real script's **verify mode only** in a disposable local Git carrier fixture with no authentication variables. This is not a GitHub run or a publication receipt.

`transport-r1-local-verify.json` binds all five supplied file hashes and records successful verification of the 18 original commit objects, exact tree and parent chain, original author sign-off lines, changed-path digest, and the 154,040-byte bundle with SHA-256 `b755d61b542d48351f9233e1cec71dc17dd5429e4eb14c97272a91a045367b18`. The fixed move is from `f0aa85b99ebb27f68bef2bb729dcd6f530965e7f` to `c13d4d9e079f1da0488c4f1d7ada45d7dc44f758`. The workflow copy intended for the carrier is byte-identical to the candidate's workflow at the same path.

No source defect blocking that exact transport was found. The actual code imports only the bundle's HEAD into a local candidate ref; it never checks out or executes candidate code. The publisher independently re-verifies all objects, reads current repository identity/permission and the exact remote branch head, permits only the fixed non-default feature branch, and uses one explicit expected-head lease. A failed or unknown acknowledgement receives one readback and retains the truthful observed status; it never retries the write or rewrites authorship.

The external carrier still needs an exact uploaded-source readback before dispatch, followed by the real platform permission result and final feature-head readback. An actual permission rejection remains a rejection. No credentials were accessed or GitHub write performed by this reviewer.

### Installation-token permission-model delta

The actual original GitHub transport run `45021743737` completed its read-only verification, but the publisher stopped **before writing**: all 18 objects were verified, `writeAttempts` was zero, and the existing feature head remained unchanged. The retained publisher receipt identifies a self-written guard that incorrectly required a human `viewerPermission` role. This was not a platform rejection of an attempted push.

GitHub's [Repository GraphQL documentation](https://docs.github.com/en/enterprise-cloud@latest/graphql/reference/repos) states that `viewerPermission` is null for App authentication. The reviewed correction therefore identifies the expected repository database ID, the `github-actions[bot]` App viewer with a null user role, the exact publisher job, original and triggering actor, workflow SHA/ref and existing authorized feature destination. It records the installation-token permission model rather than inventing a human WRITE role. The workflow's existing contents:write grant, original bundle, target tree, expected-head lease, one-write limit and independent server enforcement remain unchanged.

The exact revised script snapshot and SHA-256 are in `reviewed-transport-r1-fixed-publish.mjs` and `transport-r1-installation-token-review.json`. I read the prior real receipt and the revised source; I did not execute an authenticated publication or perform a GitHub write. No blocking source defect was found in this bounded correction. Actual platform acceptance and remote head reconciliation remain the publisher's separately recorded result, and a real platform denial must stay a denial.

## Final public-choice inventory delta

The final reviewed source commit `2430aeaf1c74dc1f4563a543e0021574e7d5c441` includes the public choices recipe in the existing Form/Select suite: 36 rather than 24 cases. The full plan is now **ten suites / 304 cases: 292 browser and 12 ordinary Node/HappyDOM**. It adds no sequential stage, so the 210-minute bound above still applies. I independently executed only `--plan`, asserted those totals, and recorded exact source bytes in `collections-agent-sprint2-ci-review-source-r5.json`; no browser work ran in that check.

The owner's `sprint2-integration-controls-r2.log` contains 26/26 combined Node controls, including the five queue tests; the other 21 are scheduling policy controls. These counts must not be added to their own subset. That same retained log reports Rhea 103/103, catalog helper 7/7, and the 305 bilingual primary-route inventory check. The readback is source/control evidence and not a native matrix acceptance.

## Required workspace-type stage

Commit `dbcdecb077283d4e3fe11fe1077b74708f24fa4b` adds `workspace-types` as an ordinary serialized command stage using the existing `check:types:workspace` script (`tsc -p tsconfig.workspace.json --noEmit`). It depends only on public packages and styles, as do all subsequent ten suites; a type-check failure keeps its own process/log terminal, fails the final aggregate, and does not suppress independent browser/ordinary suites. The existing runQueue negative control already distinguishes failed prerequisites from unrelated later work. This review only reads the delta and command definition; it does not rerun a broad suite or claim a new type-check result.

There are now thirteen sequential stages: at most 195 minutes plus up to 65 seconds of retirement grace. Installation remains capped at ten minutes and upload at three; the new 225-minute job retains roughly sixteen minutes of setup margin. The admitted inventory remains ten suites/304 cases (292 native browser +12 ordinary). Exact source snapshots and hashes are in `collections-agent-sprint2-ci-review-source-r6.json`. The same commit corrects the new Popover test relation to start at 0.3.0-alpha.2; this is not a lifecycle promotion or a test result.
