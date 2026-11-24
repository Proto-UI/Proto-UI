# Independent local source review: GPUI dependency migration preparation

## Conclusion

**No unresolved blocking findings remain in the reviewed candidate.** This review found two defects, reproduced both independently, and verified the author's repairs. The final independent run of the Cargo graph, CLI and native-producer manifest tests passed **55/55**, with **0 failed and 0 skipped**, under an inherited `CARGO_TARGET_DIR` equivalent to the workflow environment.

This is a prepublication local source review of the bounded preparation. It is **not** a GitHub `APPROVED` review, a validated canonical review packet, a native compatibility certification, or integration authorization. There is no PR review-input snapshot at this stage. Exact reviewed file hashes and the tracked diff digest are recorded in [independent-review-manifest.json](independent-review-manifest.json); the tracked patch is retained as [independent-reviewed.patch.gz](independent-reviewed.patch.gz). The gzip archive decompresses to the original reviewed patch bytes; the raw scratch copy is preserved.

## Review binding and scope

- Repository: `/workspace/scratch/1b24643d38b1/proto-ui`.
- Base and checkout HEAD during review: `b939afe35d30a1a436766d80beea7093a46e4fb2`. The candidate is an uncommitted worktree diff, not a newly published head.
- Invocation: `human-assisted` / `current-user`, inherited from the bounded current task, with local review class `review-governed-implementation-slice`.
- Requested outcome: prepare a later source migration, centralize the unchanged default, inspect exact Git/registry/sparse identities and separate platform identities, document migration prerequisites, and preserve the old default. The incidental duplicate `external_scroll` producer registration is included in the reviewed repair.
- I read `AGENTS.md`, `.agents/skills/pui-dev/SKILL.md`, the resolved `.agents/skills/pui-review/SKILL.md`, the supplied envelope/authority/dependency reports, the thin-compiler completion standard, documentation policy, relevant native-composition records, and the two draft test entities cited by the authority map. I did not treat historical native execution or draft lifecycle as current standalone-source acceptance.
- Reviewed all 11 tracked changed files and all 4 new source/documentation files listed by `git status`: the workflow, Compiler README, four dependency/profile/capability source modules including the new declaration, three fixture producers, graph CLI/library, both graph test files, the migration guide, and the final dated preparation record. Final documentation additions explaining caller-relative paths and Cargo's working directory were also inspected.
- I made no repository edits, commits, pushes, GitHub comments or review submissions. All review reproductions and receipts live outside the repository.

## Findings and disposition

### R1 — P1, high confidence — registry fixture failed in the actual CI target-directory environment — resolved

**Original location:** `scripts/gpui/test/cargo-source-migration.test.mjs`, original lines 428 and 457–460; workflow context `.github/workflows/compiler-gpui-source-consumers.yml:88–90,112–116`.

The new real-registry fixture inherited `process.env.CARGO_TARGET_DIR` but read its packaged `.crate` from each crate's hard-coded `target/package` path. The native workflow configures a shared `CARGO_TARGET_DIR` before running these tests. Cargo therefore wrote the archive under the shared target, while the test read a nonexistent crate-local path. This would fail the graph step on both configured native runners before native consumer compilation.

I reproduced the mismatch with the pinned Cargo installation and a distinct inherited target directory. The focused registry test failed **0 passed / 1 failed**, reporting `ENOENT` at the expected `package-gpui/target/package/gpui-0.0.0-migration-fixture.crate` path. The archive was actually present in the externally configured target. The unchanged red log is [independent-ci-target-red.log](independent-ci-target-red.log).

**Repair reviewed:** the fixture now explicitly assigns its own `CARGO_TARGET_DIR` inside its temporary root, reads archives from that target, and checks Cargo metadata's `target_directory` against the fixture target. The relevant final code is at `cargo-source-migration.test.mjs:429–436,466–469` and the receipt assertions immediately following the `admission` helper.

**Independent closure:** the full final run passed 55/55 with a new inherited target path. That external path did not even get created. The fixture no longer depends on or populates the workflow's consumer cache. See [independent-final-graph-tests.log](independent-final-graph-tests.log) and the `externalTarget` observation in the review manifest. Cargo's documented target-directory behavior also agrees with the observed failure: [cargo package](https://doc.rust-lang.org/cargo/commands/cargo-package.html).

### R2 — P2, high confidence — documented foreign-manifest invocation missed the consumer registry configuration — resolved

**Original location:** `scripts/gpui/check-cargo-graph.mjs`, original `runCargo` spawn at lines 98–103, together with the migration guide's instruction to run from the Proto-UI repository root.

The CLI supplied `--manifest-path` but left Cargo's working directory at the caller. A consumer's named registry and local source-replacement settings in its own `.cargo/config.toml` were therefore unavailable when invoking the documented command from Proto-UI's root. The new fixture originally spawned the checker from the consumer directory, so it did not exercise this invocation.

I created an independent real `.crate` archive, local registry index, consumer/shared-SDK workspace and lockfile. With the same manifest, lockfile, source/version expectation and checker, invocation from the consumer directory passed. Invocation from the documented Proto-UI root failed at Cargo metadata with exit 101 and `registry index was not found in any configuration: fixture`. Both initial results remain in [independent-registry-cwd-QcaP8S/result.json](independent-registry-cwd-QcaP8S/result.json), with the corresponding receipt and stderr files in that directory.

**Repair reviewed:** the CLI resolves manifest and output paths against the original caller before spawning Cargo from the manifest's directory, and records `cwd` in the receipt. This also lets a child manifest discover ancestor workspace configuration. See final `check-cargo-graph.mjs:82–107` and the receipt field near line 153. The real-registry tests now include a foreign repository-root invocation with relative paths and a child `sdk/Cargo.toml` invocation. The Compiler README and migration guide describe these semantics.

**Independent closure:** I reran the original independent fixture from the Proto-UI root with both a relative manifest path and relative output path. It now exits 0, leaves the receipt at the caller-relative output location, and records the expected consumer working directory. The successful result is [documented-repo-cwd-fixed.json](independent-registry-cwd-QcaP8S/documented-repo-cwd-fixed.json). Both new repository regression cases also pass in the 55/55 final run.

## Source, graph and fixture assessment

The source selector preserves the caller's exact Cargo source spelling. Git candidates bind the URL, full requested revision and resolved commit; registry candidates bind both source ID and complete package version. The code refuses mixed source kinds, partial selectors, floating versions and undeclared future profiles. Literal source comparison prevents same-version or same-commit packages from a different URL from being silently accepted.

The graph walk still starts from every workspace member, follows resolved package IDs rather than dependency aliases, and traverses all retained dependency edges. The CLI still requests full `cargo metadata --locked --all-features`, without `--no-deps` or a platform filter. Duplicate reachable GPUI and SDK identities remain failures. The platform addition rejects duplicates, validates any present Git platform against the selected source by default, requires an explicit independent platform identity for registry GPUI when a platform is present, and makes an explicitly selected platform mandatory. An explicitly optional platform in the library API still cannot ignore a source/version mismatch. I found no new bypass in these branches.

The registry integration fixture is not merely a fabricated metadata object. It calls real `cargo package`, hashes actual `.crate` archives into a local index, intentionally generates a lockfile, and then invokes the actual CLI against Cargo's locked offline metadata. Wrong registry/version, mixed Git plus registry packages under a build alias, absent required platform, and missing-lock failures have executable negative coverage. The synthetic metadata cases remain useful unit controls but are not the only evidence.

A supplementary read-only adversarial review independently exercised a **real Cargo sparse source** using a new workspace and actual registry archives. Exact `sparse+https://registry.example.invalid/index/` passed; the same URL with the `registry+` prefix failed explicitly; both attempts left lockfile bytes unchanged. I inspected its retained results in [adversarial-sparse-Bm0tb6/result.json](adversarial-sparse-Bm0tb6/result.json), [exact-sparse.json](adversarial-sparse-Bm0tb6/exact-sparse.json), and [registry-prefix-mismatch.json](adversarial-sparse-Bm0tb6/registry-prefix-mismatch.json). That additional review found no issue beyond R1 and R2.

Cargo failures retain `ok: false`, stage, exit details and null metadata digest when metadata was never produced. Selector errors are intentionally rejected before Cargo and before a receipt is written; tests cover that distinction. The CLI does not substitute a lockfile text scan, truncated metadata or a successful skip for a failed graph resolution.

## Default preservation and producer repair

I independently loaded the changed Compiler code and compared the old literal Cargo pin, workspace declaration, complete target profile, focus diagnostic, both SDK identities and all 15 SDK file hashes in each mode against the retained pre-change baseline. All matched. The default remains `https://github.com/zed-industries/zed` at `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`, and the SDK version remains `0.2.0`. Result: [independent-default-preservation.json](independent-default-preservation.json). The baseline artifact was supplied by the implementation work; I also inspected the base diff's original literals. This comparison is not an independent native recompilation.

The first comparison harness incorrectly compared two different inventory path/order shapes; it was corrected to align the existing emitted prefix and ordering, without changing any hash. That harness mismatch is disclosed in the result and was not treated as a product defect.

The ordinary producer retains the `compileFile`-based `external_scroll` unit and removes the second registration. Its new guard fails on any repeated module name. The real producer regression, included in the final 55/55 run, parses the emitted Cargo manifest with Cargo and checks the retained modules, dependency aliases, lockfile bytes and Rust test-target inventory. Its `--no-deps` use is correctly limited to manifest/target validation; the separate full graph gate remains mandatory. No emitted Rust was hand-edited by this preparation.

## Documentation and upstream observations

The new guide and README consistently distinguish dependency graph admission, native API compatibility, native compilation and physical OS input. They preserve future activation and rollback obligations, call out independent platform versioning, and do not claim that a repository rename or a registry version establishes a compatible GPUI implementation. Verdant and Shenko remain consumer-specific future verification obligations, not executed results of this patch.

I independently opened the public [standalone GPUI repository](https://github.com/zed-industries/gpui), which showed one commit and only `README.md`, and [GPUI 0.2.2 on docs.rs](https://docs.rs/crate/gpui/0.2.2), which showed the 2025-10-22 version and a Zed-monorepo source link. Those observations support retaining the current default. The fixed-commit tree/API endpoint was unavailable through my web retrieval route; the implementation's exact fixed-tree, release/tag and consumer-revision observations remain separately sourced in the migration guide rather than independently authenticated by this local review.

## Executed evidence and limits

| Observation | Result and scope |
| --- | --- |
| Independent original CI target reproduction | Failed as expected; R1 red log retained. |
| Independent original consumer/config comparison | Consumer cwd passed; documented repository cwd failed; R2 red/green controls retained. |
| Independent final graph/CLI/producer suite | **55 passed, 0 failed, 0 skipped**, Node 24.22.3, Cargo 1.98.1, Linux x86_64; inherited shared target isolated. |
| Independent replay of the original R2 fixture | Passed with caller-relative manifest/output paths. |
| Independent default/SDK inventory comparison | Both dependency modes and all file hashes preserved. |
| Supplementary real sparse source positive/negative | Exact sparse passed, registry-prefix mismatch failed, lock bytes unchanged. |
| Final `git diff --check` | Passed. |
| Implementer's focused Compiler tests reviewed | 41/41 in `compiler-tests.json`; not rerun by this reviewer. |
| Implementer's scoped Compiler typecheck and docs result reviewed | Scoped source typecheck exited 0 according to the supplied execution record; `public-docs.log` passed. |
| Whole-workspace typecheck | **Not green.** `typecheck-6144.log` contains 14 missing-export/implicit-any errors in unchanged CLI tests and 2 missing generated-style module errors. I did not independently rerun a whole-base comparison and do not report a workspace-wide pass. |

The registry and sparse archives are empty resolver fixtures, not GPUI implementations. No standalone native API test, real old-source native rebuild, Windows/macOS run, physical input, assistive-technology delivery, application consumer migration, remote CI run, DCO check or live platform review was executed by this reviewer.

A source-replacement configuration preserves Cargo's logical registry identity. Consequently, graph source/version agreement does not independently authenticate that the bytes were published by the corresponding official registry. Cargo documents source replacement as assuming equivalent source contents: [Source Replacement](https://doc.rust-lang.org/cargo/reference/source-replacement.html). The future activation must retain trusted publication evidence and expected checksums/provenance in addition to graph receipts. This is a scope boundary, not an additional defect in the stated logical-identity checker.

**Remaining findings: none in the bounded reviewed source.** Ordinary exact-head platform review, applicable CI/provenance and any future dependency activation remain separate work.
