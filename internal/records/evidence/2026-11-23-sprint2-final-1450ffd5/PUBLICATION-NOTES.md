# Public evidence copies: provenance and path parameters

## Scope and authority

This directory archives the reviewed historical 1450 candidate on an evidence-only branch rooted at product commit `1450ffd549bce8da636f2ccd45044aff5121e6ad`, tree `15e67863a668e5e7a09af69731fd9c4c668ff9f1`. It must not be merged into the product PR. These records describe observed executions and review, not new product requirements or platform approval. PR #1716 has since advanced to `9d0f47d4ef67bbc3676e4db24c7906f8721e5b42`; none of the 1450 results automatically certify that later head.

This preparation covers the original 13 collected text files plus `independent/code-review.md`. Later hosted, consumer and visual files require their own actual results and provenance. `sanitization-manifest.json` is the original-to-public byte map for this preparation.

## What changed

The original 13 files received only deterministic literal longest-prefix substitutions for private checkout, evidence-directory, reviewer-task and hosted-checkout paths. All other bytes, including whitespace, assertions, errors, exit codes, counts, timestamps, head/tree bindings, status values and embedded original hashes, are preserved. Three JSON files had no matching paths and remain byte-identical.

The source of `independent/code-review.md` was an already sanitized copy of the actual independent review. Its entire original content is retained beneath a prominent historical-scope preface, followed by separately labeled platform and hosted updates independently checked on 2026-11-23. The manifest records the original review hash, public hash, preface hash and appendices hash. The final hosted update closes the previously pending S2-FINAL-002 type-validation gap; it preserves the earlier failed and pending records.

Private control originals and the initial `assembly.json` were not modified. `assembly.json` is the original collection snapshot: its `sha256`, `bytes` and `modified:false` fields describe pre-sanitization copies. They do not describe transformed public bytes. The assembly owner may reconcile it when finalizing the full evidence branch; meanwhile use `sanitization-manifest.json` to verify public copies.

## Path parameters

These placeholders identify execution roles. They are not private filesystem locations or automatic environment expansion.

| Parameter | Meaning |
| --- | --- |
| `<S2_REPAIR_CHECKOUT>` | Repair checkout used for red, uncommitted repair and final 1450 runs; recorded head/tree/dirty fields distinguish them. |
| `<REVIEW_EVIDENCE_DIR>` | Private execution-record directory; original source locators below are relative to it. |
| `<S2_16BE_CHECKOUT>` | Checkout used for the recorded 16be executions; a historical role, not the current branch of that directory. |
| `<GITHUB_ACTIONS_CHECKOUT>` | Hosted CI checkout prefix; repository-relative diagnostics remain unchanged. |
| `<INDEPENDENT_REVIEW_AGENT>` | Independent reviewer task identifier; not a GitHub approver identity. |

The original review also uses illustrative shell variables `$PROTO_UI_CHECKOUT`, `$REVIEW_EVIDENCE_DIR` and `$NODE24`; readers supply their own checkout, evidence destination and Node.js 24 executable. Those example variables do not claim that a command was rerun after publication.

The repair checkout has records from different stages. Consult each record's head, tree, source hashes and clean/dirty metadata before attributing a result to final 1450. A substituted prefix does not rebind historical results to a new commit.

## Execution records and runnable regressions

`prior/16be-r5.mts` and `independent/1450-r5.mts` are archived copies of scripts that actually ran before sanitization. Their private path literals are now placeholders, so the public copies are execution records rather than directly runnable artifacts. Their eight behavioral cases, expected values and assertions were not changed. Associated JSON outputs and original hashes bind the historical observations.

The canonical committed regressions are in [notification-retirement-lifecycle.test.ts at 1450](https://github.com/Proto-UI/Proto-UI/blob/1450ffd549bce8da636f2ccd45044aff5121e6ad/packages/prototypes/base/test/notification-retirement-lifecycle.test.ts). With Node.js 24 and installed locked dependencies in that checkout, the corresponding 12-case subset can be run using:

```sh
corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/notification-retirement-lifecycle.test.ts --maxWorkers=1 --minWorkers=1 --pool=forks --testNamePattern='reset mixed callback|reset entry checked owner'
```

The independent eight-case probe and the author's twelve-case regression have separate provenance and counts. Do not add them into one execution denominator or treat a probe process exit code alone as a passing result.

## Failures and incomplete work retained

- `prior/16be-r5.json` retains `ok:false` and eight cases. Four retirement cases failed on the old source; the later pass does not rewrite those failures.
- Repair red Vitest retains 4 passing, 8 failing and 146 pending tests (`success:false`). Only the 12 selected cases ran; pending tests are not passes.
- The prior hosted types log retains the two original TS2345 errors. The isolated repair log retains TS2307 for missing generated shadow-style modules and its real failed exit.
- The focused final run has 275 passing tests in six files, with zero failed or pending tests. Vitest's nested suite count is not a different file count.
- The final independent eight-case JSON retains `ok:true` and exact final head/tree/source metadata. These focused results alone do not establish full acceptance.
- The appended actual final hosted result separately records successful package/styles prerequisites, workspace types and the complete 304 inventory. That later execution closes S2-FINAL-002 without changing the old failed records. Hosted originals are assembled separately, outside this 14-file sanitization scope.
- Earlier missing raw evidence, reviewer-fixture mistakes, unfinished historical jobs and remaining acceptance boundaries stay in the review. No old red result becomes a final pass by relabeling.
- The platform appendix retains the actual Ready actor, absence of GitHub reviews, Codex usage-limit failure and Vercel rate-limit failure. Ready state is separate from acceptance. Wider consumers, global types and actual visual outcomes require their own terminal records.

## Hash semantics

Original SHA-256 values identify immutable control-source bytes. Public SHA-256 values identify files here after transformation. A transformed file is not an original-byte copy.

Embedded checksums inside archived receipts still refer to original execution artifacts and were deliberately left unchanged. Verify a downloaded sanitized file against `publicSha256` in the new manifest; do not mistake an expected mismatch with an embedded original checksum for corrupt execution.

The manifest and these notes are newly authored records, without an original execution counterpart. The manifest includes the notes' public hash. Its own hash is reported separately to the assembly owner to avoid a self-referential checksum.

## Original-to-public inventory

| Public file | Original SHA-256 | Public SHA-256 | Changed |
| --- | --- | --- | --- |
| `focused/manifest.json` | `8625744debde13a7b5955677bac791de4690f3c88e3917290294d6e06f2c978a` | `0434d4660c57692a655f54972719ea3a1ee4298cae555c362f1f8b3ea0444d60` | yes |
| `focused/vitest.json` | `c78d7a2110b66a2040bf6d8f7f001e39ef44cf90027a3c98677cf1c4e3d23dec` | `03eabd38357b64cb42d2c06e5e2391921c29426044880b4fcda0afbb015303ab` | yes |
| `focused/vitest.log` | `71835fd332b2dd0a6ab3144351a903e7d51e40cfbc2925b19f1fc9c22137f67f` | `e2da3e4db5f05deb33b4952dcfa22e76b438608d6c716bd2a027e6121c3f6d7a` | yes |
| `prior/16be-workspace-types.log` | `43c44a8f5989d5280d342cb66be41a2c846ceed838b1acf14984f48be6fb6a15` | `03a4600932bd89167ca14051a87bdace99d65e63b39d7dce6cb42976caf7f9f3` | yes |
| `prior/16be-review.md` | `be477e00b452fa4dc9b932b5da28ec0c4be97fcc9f0c6aeb6bb1b97ffcaf0197` | `90032edc91b44b8402a76b11306fa406b067da259d0270e2a1459b6d030f9755` | yes |
| `prior/16be-r5.mts` | `6812599c7dbbfa79963f3039e404ba1c51d99e1f4f105697cf4fcc5978a37222` | `f2fb0938d17f15ec0610ae748b2401a71395b0ad8ca77eaedbb155b38f473415` | yes |
| `prior/16be-r5.json` | `848d1a14274644332390d2dc8726a382ebec3071008ca59a2d1a69d98de99778` | `848d1a14274644332390d2dc8726a382ebec3071008ca59a2d1a69d98de99778` | no |
| `prior/repair-red-receipt.json` | `52d6444a20aff4f334cefb1de5ceba5046fab64cfa2e6e65b248da79383ea84f` | `a2c0f3937c3cc46a42e25ca7a666b94b0ecf0b74545e1e4b11ba19456577e999` | yes |
| `prior/repair-red-vitest.json` | `6aa6ab1dec80c0960c55eb3676249106c476f9550887da4ad829da8fdd4707cd` | `1b44b3e87d368fac59bec6dc059aedc01cd52772b00137cc171f4b43abb2dc4f` | yes |
| `prior/repair-workspace-types.json` | `aae680f3bf21678550626db1a98048fc2f31504b2c4100ac8709adae2f7e073d` | `aae680f3bf21678550626db1a98048fc2f31504b2c4100ac8709adae2f7e073d` | no |
| `prior/repair-workspace-types.log` | `adb427539ae46bb90197eeb8cb437f27777fa8f9cafd0f70c35c14355ba301d0` | `d74b6eb3a2103408be136fda42377afffa70ac1446d812e22228d41f95139f82` | yes |
| `independent/1450-r5.mts` | `fb4842aa23b2b1369b95a658ee3e194a244b8213df9fa1bda4dd89529a9a1925` | `573f7315b8735a14c6d10b24507cc18eeda40d4471393992fab760361463ebfc` | yes |
| `independent/1450-r5.json` | `bdc22803025d8ff38e8c856fa0174d0609fcd9765857168d429c029555c2ebef` | `bdc22803025d8ff38e8c856fa0174d0609fcd9765857168d429c029555c2ebef` | no |
| `independent/code-review.md` | `2bd25ef66c02db663580372f8d600f834030a6c75ff591c2c209b2fb7d748105` | `23e90f5e2e1f0b72ba17513bd045910fee5f6c3657e3aff5d4b92c8bb9f8cc85` | yes |

## Verification boundary

Preparation verified all 14 control-source hashes, read back every public output, compared JSON recursively after allowed string substitutions, checked preserved result/diagnostic/hash tokens and scanned this inventory plus notes and manifest for common credential signatures and private paths/device identifiers. No matches were found in that scope. This bounded disclosure check does not certify arbitrary future additions.

Product source, control originals and the initial assembly snapshot were unchanged. No files were staged or committed, and this preparation performed no GitHub review, Ready transition or publication.
