# Shared compiler frontend: source identity after current main integration

The frontend source merge is `3ed63ef5`, tree `d7006598`, with parents `8e16d709` and foundation `06dc33e1`. It preserves the shared analysis implementation and all main `c8e700ff` RC repairs. The five legacy compiler paths resolved as retired in the foundation remain absent.

## Source reference

The [current markup reference](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-current.json) binds the real frontend source merge. All 32 owners match its committed Git blobs and the worktree.

Relative to the foundation's reviewed source reference, only `pnpm-lock.yaml` renews its digest, retaining the frontend importer for the already locked TypeScript 5.9.3. The foundation's three Previewer scheduling/removal updates remain included.

Both parent references are preserved byte-for-byte:

- [Foundation source reference](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-524365a.json), revision `524365a3`.
- [Earlier frontend reference](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-4583e08.json), revision `4583e080`, SHA-256 `3277cd32a171`.

The [foundation integration record](2026-11-25-compiler-retirement-main-c8-source-bindings.md) retains its canonical matrix refresh, independent controls and the ordinary matrix scanner's 240-second timeout. No source scanner completion is inferred from this reference update.

## Evidence boundary

This metadata step changes no product source, browser assertion, deadline or source-admission status. The reference remains `sourceAdmission: unverified`. Earlier production build and Vercel results remain attached to their exact earlier heads; this update does not transfer those results to the new source.

Generated-consumer traces, complete compiler conformance, current full CI and independent review remain separate obligations.

## Receipts

The short identifiers above retain these complete source and artifact identities.

| Short form     | Complete identifier                                                |
| -------------- | ------------------------------------------------------------------ |
| `3ed63ef5`     | `3ed63ef546891e518e3ba237c5e9f53acc63b77b`                         |
| `d7006598`     | `d700659807eed4f83a145597c4e1451d5cb92fc1`                         |
| `8e16d709`     | `8e16d709e350f826e2d5ac5dba916844ed959479`                         |
| `06dc33e1`     | `06dc33e1069a46406f22b5200a9bb41a5758e72e`                         |
| `c8e700ff`     | `c8e700ff06ef7a96e7ec8b406859268918d158c6`                         |
| `524365a3`     | `524365a3b1f97dbf9dd6a3408ce231fbb4ee4af3`                         |
| `4583e080`     | `4583e080e9cc3d46cf023da8a208f9ce01c7bace`                         |
| `3277cd32a171` | `3277cd32a171bf9ceadb052075a698b962a54291e68658885226da4af61047ac` |
