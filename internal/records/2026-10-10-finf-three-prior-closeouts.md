# Three carried PR closeouts at Finf 5dab3a9e

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Bounded review verdict

Independent read-only technical review approves **prior-pr.857, prior-pr.867 and prior-pr.871** for closeout at integration revision `5dab3a9ea0e5a6eccd2ae24d60050c2fa14c2654`, root tree `ea7bb49b73daefd59e3b7c3f22736352c020455e`. Their original bounded tasks are implemented, integrated and supported by applicable passing evidence. This does not approve PR #872 for merge, certify its entire CI, promote any draft entity, or close a core prototype-family goal. No code was executed or changed during this review.

The reviewer compared live GitHub PR metadata, Git tree/blob identities, original requirements, current source and actual official logs. Merged state alone was not used as acceptance. Four-family prototype completeness and GPUI execution are not requirements for these parser/governance/benchmark tooling repairs.

## prior-pr.871: bound Chromium startup separately from interaction assertions

Original requirement: [PR #871](https://github.com/Proto-UI/Proto-UI/pull/871) and `internal/records/2026-10-06-benchmark-browser-bootstrap-bound.md`. Use the existing 30-second browser launch policy, retaining action 1,200 ms, screenshot 5,000 ms and process 90,000 ms, all positive/negative controls and failures. No retries or passing fallback.

Source head `0ed119b52cd2c498d90121e681d2c47953c4f345` is an ancestor of the reviewed revision. All four changed files remain byte-identical at 5dab: README blob `c1c24070673c36e14cc8d8c352c01bf326734c14`, record `fce6b9551be3fd041ee2d636c6040adab532755e`, browser-calibration.mjs `5d00b48565a2af4244f85a276e7b3da5604e1b9c`, browser-calibration.test.mjs `8a65ae390397a361d1467c42ddf66f83ffd3059b`.

[Current official calibration](https://github.com/Proto-UI/Proto-UI/actions/runs/38029962495/job/114148633123) completed successfully: 80 portable controls pass (24 native cases intentionally skipped in that first phase); the separate real Chromium phase passes 29/29 with 0 skips. Repeated packet arms and archive verification succeed; artifact 11662101740 is retained. Run head is 5dab; actual checkout is synthetic merge `e92deb9fbac3e7cddd9d21d1b26acb79123483b1`. GitHub Git API confirms parents main `ea19727838d85c05af5e4bca8d5fc235cb44e288` and 5dab, and its complete tree equals 5dab's `ea7bb49…`. This is same-tree evidence, not a claim that checkout SHA equals PR head.

Historical [native run 37500928412](https://github.com/Proto-UI/Proto-UI/actions/runs/37500928412) and [aggregate 37500928601](https://github.com/Proto-UI/Proto-UI/actions/runs/37500928601) both also succeeded on 0ed119b. No remaining defect or validation gap in this bounded startup repair was found.

## prior-pr.857: preserve parser repair and module-owned runtime boundaries

Original requirement: [PR #857](https://github.com/Proto-UI/Proto-UI/pull/857), including the parser masking, importer-edge and WC bridge-origin review repairs, portable coverage and a separate real decoder integration. Range and CSS Modules/ICSS future profiles are explicitly excluded from this repair.

Source head `83327215fc617e23e012c083ace8765d35e9aa20` is an ancestor of 5dab. The original dated parser/importer/WC-origin records and decoder/script-span tests remain present. Later strengthened coverage logic is retained, not silently replaced with an old green file.

[Official 4b85 general evidence](https://github.com/Proto-UI/Proto-UI/actions/runs/38026839816/job/114140208245) retained the complete coverage phase: 3,730 pass, 0 fail, 1 explicit optional-decoder-not-run notice. A separate actual FFmpeg integration phase passes 15/15, 0 skips. Specific passing controls include quoted fake script markers for HTML/Astro with Unicode offsets; original active suffix preservation; renderer/runtime/helper same-target direct/dynamic importer rejection; legitimate exact WC bridge-owner positives and foreign-origin negatives. Full script/test sources under `scripts/coverage-matrices`, Astro config, package manifests and lockfile have no diff from 4b85 to 5dab. Only evidence-data identity leaves changed in the matrix; scoped code-result reuse does not claim that every new proof-data test was rerun here.

Actual 4b85 checkout is `4953f33727e8baa3ade1fd4a4970083befb1d4ef`, whose Git API tree `1ca31ffb3de3efe46e6a4c6116bce5e37fc83fc6` exactly equals 4b85. The source-preserving reuse boundary is explicit. Current 5dab's retained P2 integration record separately documents the actual 349-page build and production bundle/source-owner gate. No unresolved applicable parser/importer defect was found; pending unrelated native UI failures do not reopen this tooling task.

## prior-pr.867: persist the owner-authorized dot exemption

Original requirement: [PR #867](https://github.com/Proto-UI/Proto-UI/pull/867) and Issue866: explicit dot-only role disclosure, no fabricated measurement, consistent guides/public projections, reject malformed competing declarations and retain authorization/DCO/live drift/idempotency boundaries.

Source head `8cf74b43ae19c2f5f14c18cc587a8eafaed5f24a` is an ancestor of 5dab. The exemption implementation blob `97506e9322abf4c1601fa05742cf8f111fe7a7a5` and its 62-case test blob `48c9af7184407152de989ea97e064b0b00234415` are identical to the accepted source; both public-language Agent/Skill guides and contributor/provenance instructions retain the exception. Publisher changes since the original source concern measured-record historical reconciliation, preserve current freshness immediately before writes, and are covered by the later official tests.

The same [4b85 official general job](https://github.com/Proto-UI/Proto-UI/actions/runs/38026839816/job/114140208245) completes the Agent suite 1,632/1,632, 0 skips. Actual lines include malformed/hidden/nested/image-alt/heading rejection; non-dot measured default; exact dot hook; real temporary Git commit with own DCO; actor/head drift rejection; no retry on uncertain write; and readback/idempotency. Scripts, tests, package/lockfile, relevant guides and public contributor docs are unchanged between 4b85 and 5dab. No remaining applicable exemption defect was found. A local technical verdict is not a submitted GitHub review and does not waive repository protections.

## Count and remaining work

Accepting these three prior-work rows changes the user-weighted view from 0 done / 40 in-progress / 28 not-started to **3 done / 37 in-progress / 28 not-started**, or **21.5 / 68 = 31.617647%**. Each transition adds 0.5 point, for 1.5 points total. Core checked items remain 0/55; this review does not change the other 65 rows.

Notably prior-pr.863 remains open in the carry ledger for a concrete current failure: CI job 114148661647 on the same 5dab tree fails the Shadcn minimum-thumb end placement at scroll-area-corner.browser.test.ts:530, absolute error 158 px versus allowed 0.5 px. The old source/native success is not substituted for that conflicting current result. Other prior-work rows are not failed merely because a global CI job is red; their precise scope/evidence gaps remain separately recorded.

Publication of this review and the corresponding ledger changes is pending at the time of preparation. Integrator should first retain this record at an immutable commit, then use that real record URL in each closeout.independentReview.source; do not invent an existing URL or weaken the closeout schema.
