# Sprint 4: bounded scene package-budget transaction

## Accepted implementation and authority

The current user requested completion of Sprint 4, including #1143's remaining backing-source leases and #1089's corresponding pure-source consumer composition. The bounded application-owned scene implementation is `9fff88cf23d4e55375979bc5c68c033e3deaed38`. The measurement and browser-evidence successor is `c1f0332eed6ba79734b92bd4407b274f45d5c274`; its subsequent changes affect tests, evidence records and scoped artifact upload, not the product implementation.

This transaction accepts the measured cost of that reviewed **draft** Web subset. It does not activate C/HC/T definitions, certify original private IR10 authorship, or close #1143, #1089 or Sprint 4. Existing owner direction and the current task authorize implementation; the repository's `pui-package-budget` leaf delegates this numerical choice after validation. No new direction was inferred from a red CI run.

The input validation report is factual and chooses no ceiling. Its SHA-256 is `a389fd9384aac9576c0a6a968d674abcd04254981d2230366233e7e7ac236642`. The corresponding validated input candidate digest is `dbd057f45f51dc66472d8a45c44b54f8d2dac867ff44042b551472a4f47a7420`.

## Canonical before/after evidence

- Baseline `31239ef95dfe610ddeb415976721adb7f12d5ba0`: [Actions 45257565727](https://github.com/Proto-UI/Proto-UI/actions/runs/45257565727), strict **9/9**, exit 0.
- Implementation `9fff88cf23d4e55375979bc5c68c033e3deaed38`: [Actions 45262013762](https://github.com/Proto-UI/Proto-UI/actions/runs/45262013762), strict **6/9**, exit 1.
- Current measured candidate `c1f0332eed6ba79734b92bd4407b274f45d5c274`: [Actions 45266820171](https://github.com/Proto-UI/Proto-UI/actions/runs/45266820171), strict **6/9**, exit 1, clean/exact/stable source. All nine result objects and both diagnostic objects, including minified hashes and entire retained-source closures, equal the implementation run. The 47 packages build, 47 manifests resolve, and 28 budget controls pass; only the three recorded numerical limits fail.

All runs use Node v24.22.3, esbuild 0.25.12, Linux x64 and zlib 1.3.2.1-motley-285e94b. Bundling, minification and tree shaking are enabled; format is ESM, platform browser, target es2020, gzip level 9. The identical external-list SHA-256 is `6a8bd56596b933f9a9d941db2a9e325789b44886af2648d6a9795f022787c253`.

| Entry | Baseline gzip bytes | Candidate gzip bytes | Original ceiling | Observed excess | New ceiling | Headroom |
| --- | --: | --: | --: | --: | --: | --: |
| adapter-react root | 172338 | 172749 | 172600 | 149 | 172800 | 51 |
| adapter-vue root | 171098 | 171536 | 171400 | 136 | 171600 | 64 |
| adapter-web-component root | 206862 | 207303 | 207200 | 103 | 207400 | 97 |

The new values are the next 100-byte increments above the actual integrated costs, each 200 bytes above its old value. This is a narrow rounding allowance, not a statistical confidence interval or a reservation for additional features. The other six ceilings remain unchanged. Candidate minified sizes and hashes, all nine entries, old failures, source fingerprints and full measurement options are in the [factual report](./evidence/2026-11-24-sprint4-scene-budget/prebudget-facts.json).

## Investigated cost and alternatives

Independent comparison reconstructed all 7,831 measured source-file hashes and 3,831 unique closure inputs against the current immutable Git commit. It also checked the canonical baseline and implementation originals. The current measurement scope's only change from the previous implementation is the browser test, which enters none of the measured closures.

The three adapter roots and two diagnostic consumers retain zero bytes from `shader-scene-host.ts`. Retained input counts do not grow; no duplicated Runtime copy was found. Runtime retained bytes stay 33046 in React/Vue and 33015 in WC. Relevant minified input changes include Core shader +337 bytes, sink +852, physical host -84/-89, and adapter plumbing +23 to +28. These observations explain the affected ownership/plumbing boundary; they are **not additive gzip attributions**. Full source and closure evidence is retained rather than guessing function-level causes from an esbuild metafile.

Removing the explicit host capability, weakening lease retirement or hiding the whole entry behind diagnostic profiles would not preserve the accepted behavior. No such alternative is applied. This transaction changes exactly three ceiling literals and supporting records; entry points, compression, externals, implementation, measurement policy and strict blocking behavior are unchanged. The Finf advisory exception is not used as a substitute for this strict check.

## Implementation evidence and limits

- [x] **245/245 focused tests in 17 files pass on integrated product `9fff88cf`.**
- [x] **48 independent scene controls and the bounded owned-pixels compatibility review pass on their recorded source versions, with critical product sources equal to the integration.**
- [x] **37/37 sandboxed Chromium journeys pass on `c1f0332e`**, with three fixtures by four compiled profiles and all 106 generated artifacts preserved in a 250-file archive: [Actions 45266835323](https://github.com/Proto-UI/Proto-UI/actions/runs/45266835323). The 16 active-paint/replacement captures were actually inspected. The initial texture and replacement green source remain behind readable child content. WC's paint extent differs from the other hosts, so this is not cross-host layout parity. ANGLE/SwiftShader is not physical GPU performance evidence.
- [ ] **The numerical commit still requires a new exact-head canonical strict run and independent review.** Pre-edit evidence does not pass the changed candidate.
- [ ] **Formal GitHub approval, integration, external Vercel deployment and full original Sprint 4 acceptance remain separate.** The observed Vercel failure is its daily deployment quota.

The first 9fff browser run's post-dispose screenshots and 70 omitted hidden support files remain in their original archive. The c1 successor supplies the missing active paint and generated files without rewriting the first receipt. Original local/remote browser preparation failures and the two strict red budget runs remain history. No result from them has been converted to green.

## Reproducible records and rollback

The [prebudget archive](./evidence/2026-11-24-sprint4-scene-budget/prebudget-originals.tar.gz) contains the six byte-exact canonical files; it is 315621 bytes with SHA-256 `b2fb242e53637823041b5040ec133c868175b06a360ac6cf7cb9fdd05bac4a02`. The [independent continuation receipt](./evidence/2026-11-24-sprint4-scene-budget/independent-prebudget-receipt.json) and its replay reader preserve the current-source check. Earlier baseline and implementation originals and their full independent audit remain in [canonical cost evidence](./evidence/2026-11-24-sprint4-canonical-cost/report.json).

The [transaction input manifest](./evidence/2026-11-24-sprint4-scene-budget/transaction-inputs-manifest.json) preserves the byte-exact authority, authorization, measured candidate, factual validation report, received handoff and independent receipt in a separate small archive. Readable JSON files are formatted projections; their formatting does not replace the original digests in that archive.

To roll back this transaction, revert its three ceiling changes and this supporting record. Do not remove implementation tests, old failures, or alter measurement policy to compensate. Validation must run the existing canonical workflow on the numerical commit itself; its actual outcome will be recorded in a later receipt tied to that exact source, without rewriting this pending state.
