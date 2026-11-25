# Website markup study: reviewed 0.3 source renewal

## Retained failure and reference

[CI run 45513860306, browser job 138868331876](https://github.com/Proto-UI/Proto-UI/actions/runs/45513860306/job/138868331876) used source `47ae41c671c64091ae87d717f3fa61d02c13f355`. The markup study reported all 17 cases skipped after its suite hook failed. The original log is byte-retained in `evidence/2026-11-25-browser-gate-source-renewal/original-browser3.log.gz`. The later passive-atom suite reached the whole-run deadline; source-reference renewal does not resolve or certify that separate failure.

The preceding fixed reference, revision `0b436b388882d73b916ede97c73a1bf304dcf6f6`, is copied byte-for-byte to `scripts/coverage-matrices/test/fixtures/website-markup-provenance-0b436b3.json`. All 33 saved hashes match that exact Git revision. The older archived references remain unchanged.

## Reviewed changes

The renewed reference binds the same 33 paths to their exact Git blobs at `5f0844907895a4ae0db506fe6a5d0bf162318329`. Two members differ. The review compared the complete prior/current blobs, not only their digests.

| Source | Reviewed change and boundary |
| --- | --- |
| `apps/www/astro.config.mjs` | Keeps canonical English component/sidebar names in the Chinese navigation and adds the current Bootstrap/Liquid draft sidebar entries. It does not change the sampled code producer, HTML sink, Copy owner, or dev-server source profile. |
| `apps/www/src/content/docs/zh-cn/ui-libraries/shadcn/dialog.mdx` | Renews workspace-version text, composition/API explanations, and five additional public examples. The sampled `demo-shadcn-dialog` remains the first highlighted demo with the same four runtimes. The unchanged study resolves its own response-bound previewer and compares against the unchanged `shadcnDialogCode` producer. Additional demo implementation closure is outside this bounded inventory. |

The exact preceding/current digests and original CI identity are retained in `evidence/2026-11-25-browser-gate-source-renewal/source-ledger.json`. All 33 renewed hashes match the worktree product inputs as well as the recorded Git blobs. No product source was edited to make the reference match.

## Validation and limits

The unchanged `sourceBindingIssues` reports exactly the two changed sources against the archived reference and no discrepancies against the renewed reference. The existing `website-markup-provenance.test.mjs` discriminator suite passes **67/67**, with no skips. Changed, missing, duplicated, unknown and opaque inputs remain rejected. The browser `beforeAll`, source checker, runtime/response/Copy assertions and all native-input expectations are unchanged; fixed expected hashes are not computed dynamically at test time.

`sourceAdmission` remains `unverified`. This source-reference renewal establishes a reviewed prerequisite update; it does not establish served-build proof, transitive source closure, source promotion, or completion of #834.

The subsequent native browser run `markup-current` passed **17/17** original cases with no filtered cases. It used the isolated `5f0844907895a4ae0db506fe6a5d0bf162318329` candidate worktree with the same 33 inventoried product blobs and separate browser/consumer repairs. Its raw report identity, full case outcomes and the explicit dirty-candidate boundary are retained in `evidence/2026-11-25-release-gate-browser-repairs/verified-runs.json`. That execution is separate evidence from this source-only review; it does not relax the browser guard or replace final integrated CI.
