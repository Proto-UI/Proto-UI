# Markup source reference after the first compiler analysis increment

The source commit is `4583e080e9cc3d46cf023da8a208f9ce01c7bace`. The private compiler package now declares its real TypeScript dependency for its shared analysis API, CLI, editor integration and source intake. The lockfile adds only that importer dependency on the existing TypeScript 5.9.3 resolution; it does not restore QuickJS, the browser compiler or an old generated runtime.

## Reviewed source delta

All 32 direct owners from the [preceding integration](2026-11-25-compiler-retirement-markup-integration.md) remain registered. The other 31 source hashes match exactly.

## Source receipts

The reviewed `pnpm-lock.yaml` identity changes from `50cb2a3862c7875afd270b10567e9202baa2223e00016a13242041381eb8e56b` to `833a3ddcceceb8321ff8afb78003a0f6ef5a61da5e759e7356cae158e92820b6`.

The previous reference is preserved byte-for-byte in [website-markup-provenance-8635852.json](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-8635852.json), with SHA-256 `25a94091426c8241753748ce49684a44ee499e45edcb9af3f68e8e600715be8a`. The [current reference](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-current.json) binds the source commit above, before this reference-only commit.

## Evidence boundary

The source-binding preflight verifies all 32 source identities against that commit. This update changes no browser-study assertion, timeout, source-binding implementation, sampled route or runtime sequence. The 17 browser scenarios retain their own execution obligations.

`sourceAdmission` remains `unverified`. A matching source reference is not a browser pass, served-source proof, full dependency-closure claim or lifecycle promotion. The frontend's own source-manifest tool likewise reports input identity separately from language admission and generated-consumer behavior.
