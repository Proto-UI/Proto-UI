# Native compiler increment: bounded website source reference

The source commit is `745e2851`, tree `0b40cc71`. This record binds source bytes before a separate metadata-only commit. It does not assert full compiler acceptance or browser execution.

## Reviewed change and preservation

The [current markup reference](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-current.json) retains the same 32 direct owners. The other 31 hashes are unchanged. Only `pnpm-lock.yaml` changes from `833a3ddccece` to `212e98529f0e`.

The reviewed delta pins the compiler's TypeScript specifier to the already resolved 5.9.3 and declares its React consumer, type, esbuild and Playwright development dependencies using versions already present in the lock. It adds no new resolved package version. This is dependency/source identity, not a browser result.

The preceding current profile, revision `3ed63ef5`, is preserved byte-for-byte in [website-markup-provenance-3ed63ef.json](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-3ed63ef.json), SHA-256 `97e6a78810d8`. The earlier retired compiler-panel owners remain absent. Existing archives and their recorded failures are retained.

## Evidence boundary

`sourceAdmission` remains `unverified`. No browser assertion, timeout, deadline or case is changed by this metadata patch. The original browser cases and their failed or unrun history remain; no old CI, Vercel, production build or generated-consumer result is reassigned to this source revision.

Complete served/transitive closure, source admission, browser execution, compiler conformance and independent review remain separate obligations.

The preparation checks compare all 32 source digests and the archive bytes. Applying this prepared patch still requires the normal focused source-binding/control and documentation checks at the final checkout. If product source changes before application, regenerate against the new real source commit and re-review any additional owner drift.

Do not substitute a tree ID, uncommitted worktree hash or anticipated future commit.

## Receipts

The short identifiers above retain these complete source and artifact identities.

| Short form     | Complete identifier                                                |
| -------------- | ------------------------------------------------------------------ |
| `745e2851`     | `745e28513e4b247e81b596516ba542e43b869725`                         |
| `0b40cc71`     | `0b40cc71c68f84d2680b9930c8bf0a977f61cb5f`                         |
| `833a3ddccece` | `833a3ddcceceb8321ff8afb78003a0f6ef5a61da5e759e7356cae158e92820b6` |
| `212e98529f0e` | `212e98529f0e2e76831ae8fee37b281f069e61bb737f8462f7b5cfbcc14ce53a` |
| `3ed63ef5`     | `3ed63ef546891e518e3ba237c5e9f53acc63b77b`                         |
| `97e6a78810d8` | `97e6a78810d8e42cfba869cab4866e69a1b4d22f482b772e0ee366e0acb551f5` |
