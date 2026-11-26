# A2 package budgets: measured growth and bounded reduction

**Four strict whole-entry budgets remain blocking.** This record preserves the original A2 failure, an independently checked main baseline, and two measured reduction attempts. It changes no budget, policy mode, test expectation or acceptance flag.

## Original CI and measurement boundary

The [public-package job 137393481584](https://github.com/Proto-UI/Proto-UI/actions/runs/45082437149/job/137393481584) ran on A2 `b0397ecb21ca0a49287129a16058f64f42176906`. All **47 public package builds**, their manifest checks, and the **15 existing budget-policy tests** passed. The subsequent original strict budget command exited **1**:

```sh
node scripts/analysis/package-budgets.mjs --json --require-clean --expected-sha "$GITHUB_SHA"
```

The uploaded report is artifact `14777842509`, named `package-budgets-b0397ecb21ca0a49287129a16058f64f42176906-45082437149-attempt-1`, in that run. Its JSON SHA-256 is `2c28bf9ba9ae27bd75d60a865b44aff94bc430c28704d46fec846864a6a44cf9`. The report records a clean, stable source matching A2, with source fingerprint `1d1f013998c930681346830bd7cfee6f0ca71d0b4ad383c0993384fa63f3e138`.

CI used Node `24.22.3`, esbuild `0.25.12`, and zlib `1.3.2.1-motley-285e94b` on Linux x64. The local measurements below used Node `24.22.1` with the same esbuild, zlib, platform and architecture. The local pre-reduction run reproduced all nine CI entry results and both diagnostic consumer outputs byte-for-byte, including minified SHA-256 and gzip size. This observed equality does not promote a local dirty-tree receipt into canonical CI evidence.

Every run used the unchanged ESM/browser/es2020, minified, tree-shaken bundle and level-9 gzip algorithm. The unchanged external-boundary SHA-256 is `6a8bd56596b933f9a9d941db2a9e325789b44886af2648d6a9795f022787c253`; no new package was externalized to reduce a measurement.

## Main baseline and actual sizes

Main `2479acecddf8f9801cdbee0c538ca08d7e79c9d4` was measured in a separate clean sparse checkout, with the same original command, `--require-clean`, and that exact `--expected-sha`. It exited **0**. Only the external esbuild installation was reused; no `@proto.ui` package symlink or workspace dependency linked back to A2.

An additional audit checked all **3,824 unique reached workspace inputs**, including zero-retained inputs, against their `247:path` Git blobs and the report's source byte counts/SHA-256 values. Every physical source resolved inside the baseline checkout and matched the recorded commit. The baseline source fingerprint is `54ccc8508b524ef7cca070949b5234b21cb1fc3d6ed4a5e5e5f543ddada2a302`; the source-audit JSON SHA-256 is `7622164fa501f82261169673471f46f713704f62d0141433d6bb0f0817661052`.

All values below are gzip bytes. “Retained reduction” is the stable dirty-tree measurement at `2026-11-23T00:07:00Z`, after canonical formatting and withdrawal of the unsuccessful second attempt. It is not a new clean commit or a final CI result.

| Entry | Main 247 | A2 CI | Retained reduction | Unchanged budget | Remaining excess |
| --- | --: | --: | --: | --: | --: |
| Lucide `icons/x` | 2,879 | 2,879 | 2,879 | 3,000 | 0 |
| Lucide root | 637,306 | 637,306 | 637,306 | 700,000 | 0 |
| Core root | 11,378 | 11,378 | 11,378 | 11,500 | 0 |
| Runtime root | 101,437 | 101,563 | 101,563 | 101,500 | **63** |
| React Adapter root | 165,288 | 165,768 | 165,747 | 165,500 | **247** |
| Vue Adapter root | 164,063 | 164,603 | 164,581 | 164,300 | **281** |
| Web Component Adapter root | 198,760 | 199,264 | 199,232 | 199,000 | **232** |
| Base Button | 5,274 | 5,274 | 5,274 | 6,000 | 0 |
| Shadcn Button | 7,812 | 7,812 | 7,812 | 7,900 | 0 |

The diagnostic Light/Shadow Button consumers changed from `204886/204889` at main to `205402/205407` at A2 and `205372/205376` after the retained reduction. These are separate consumer measurements, not alternative whole-entry acceptance thresholds.

## Attribution and attempts

The changed retained inputs point to actual Scroll pause-following and reader-movement behavior, nullable numeric accessibility projection, and the shared owned-decoration stage extraction. No compiler source or duplicate workspace/runtime source input was introduced into the failed entry closures. Scroll's A2 source already exists on imported dependency commit `ad39435aeb3589d3bc52de3cbd1f4cdd375cec68`; this establishes source lineage, not an inherited passing budget receipt.

For example, the shared Scroll implementation gained 715 retained minified bytes in each failed closure. The reader-contact addition contributed 239 minified bytes to each Adapter closure. React/Vue's decoration stage extraction added a net 85 minified bytes; that stage was parsed but retained zero bytes by the Web Component entry. These are pre-gzip attribution values and cannot be summed into gzip deltas.

The retained change in [`create-web-scroll-host.ts`](../../packages/modules/scroll/src/web/create-web-scroll-host.ts) extracts three identical reader-movement resets and two identical offset/viewport/extent comparisons. Reset order, short-circuit evaluation, contact ownership and lifecycle guards remain in their original locations. It reduced React/Vue/Web Component gzip by `21/22/32` bytes. Runtime does not retain this host implementation, so its gzip did not change.

A second attempt extracted only the two lease-command replay branches and the three fresh reader-contact snapshots. It preserved the lease receiver, guards, request identity, snapshot allocation and iteration order. Its measured Runtime/React/Vue/Web Component values were `101569/165767/164582/199234`: all four were larger than the retained first attempt. That exact patch was therefore withdrawn, and both files were checked byte-for-byte against their original A2 content. The attempted patch SHA-256 is `66949b019f45c3e395f745aa4035757363cbb9335f87b1d0d3db6d04ee38b420`; its failing measurement remains recorded.

Canonical formatting and the official host-source generator/check completed successfully. The latter's closed source inventory does not include these Scroll files, so its generated bytes did not change. No generated snapshot was hand edited.

## Receipt identities and remaining gate

The original reports and attempt patch remain in the task evidence set; none was rewritten as a pass. Report filenames and SHA-256 identities are:

| Report | SHA-256 |
| --- | --- |
| `package-budget-main247.json` | `324420f067ce24121bd2fc184ef70839504d6fbf558e6936b69d6e2005b3aa36` |
| `package-budget-local-diagnostic.json` | `2d786d8ef2781d8c979fc1846c87a9eb304cbff67de398d80607d106afab3cfa` |
| `package-budget-web-scroll-dedup-1.json` | `638c3c8e3a735953386ae4a03ffe63e01e6dbff8c6cb24f3339e6bd9360e7226` |
| `package-budget-scroll-dedup-2.json` | `379bbd2ca08b14fc3b4b74cf1583ff354a61445e285440d1e72d0ba06533b71b` |
| `package-budget-scroll-kept-1.json` | `7ebeb72c66986ea22bc1051b170164e912fac278a76c0c5e9910a5f684456d43` |

The last report's source fingerprint is `f0670a3370d48766153c162e27c39fbccdb3517cc4762b3c27ddae45d27ce478`. It records A2 as the checkout base, `workingTreeClean: false`, `measuredSourceMatchesHead: false`, `stableDuringMeasurement: true`, `withinBudgets: false`, and `exitCode: 1`. Other coordinated CI repairs were present in this diagnostic tree; its declared fingerprint, rather than the base commit alone, identifies the actual measurement.

This bounded reduction attempt stops here. The four remaining overruns require an independently reviewed numeric decision under the [existing budget policy](../governance/finf-package-budgets.md), or a separately justified implementation improvement, followed by canonical exact-head strict CI. No numeric decision, advisory exemption, behavioral acceptance or final `check:package-budgets` pass is claimed by this record. The retained Scroll refactor still requires its existing behavior regressions in the integration queue; this report does not substitute size measurements for those tests.
