# Release convergence: hosted receipts and followup types

This is an observation record, not release acceptance. The original audit named main `88fc0883bec70abbc0d7505d88370657c279639e`. Subsequent repairs moved the source; observations below keep their actual source identities.

## Published repair and formal CI

[PR #1795](https://github.com/Proto-UI/Proto-UI/pull/1795) was merged by a parallel operator on 2026-11-24 at 11:50:10Z, merge `d8d9efa5401df5aa350db92e6ef49586cb537811`. This integrator did not perform or supply independent platform approval for that merge. The followup starts from main `4aaac6ac60348dc99896c34cd1186abcda98ff0d`, preserving the other owners' Header, compiler and website changes.

[Complete CI run 45385473253](https://github.com/Proto-UI/Proto-UI/actions/runs/45385473253) executes `fde59e8517b52f4c0a3fd19453a5d586e9fe7f3f`. Individual successes include the strict nine-entry budget job, live governance reconciliation, package publish dry-run, React packed consumer, generated GPUI consumers on Linux and macOS, Flutter consumer, Rust interop and ordinary generated WC browser consumer. The run has actual failures and was still in progress at this observation. The package dry-run is not the separate original fifteen-gate release rehearsal.

## Exact-source strict budgets

[Official artifact 14915883799](https://github.com/Proto-UI/Proto-UI/actions/runs/45385473253/artifacts/14915883799) is retained byte-for-byte in the evidence archive. The downloaded ZIP is 306,213 bytes, SHA-256 `a3bd602fb71b0f95a6488a9b55b6b8aca05434756e559e2db3e59adc85b761b9`.

The report binds clean fde source/tree `3d45a7122f2024507da8a01cea7b0bb95bafd2a7`, 7,996 measured files and source fingerprint `8d8184d87fe4a68bf263d87a2e9b75b241059a2da746f457487a80433c7e6f50`. Source matched HEAD and remained stable. The environment was Node 24.22.3, esbuild 0.25.12, zlib 1.3.2.1-motley-285e94b, Linux x64. Policy was strict, `withinBudgets` true and exit code zero.

| Entry              | gzip bytes | Current ceiling bytes |
| ------------------ | ---------: | --------------------: |
| Lucide icon x      |      1,797 |                 3,000 |
| Lucide root        |    635,846 |               700,000 |
| Core root          |     12,967 |                13,100 |
| Runtime root       |    106,867 |               107,400 |
| React Adapter root |    180,560 |               180,900 |
| Vue Adapter root   |    179,456 |               179,700 |
| WC Adapter root    |    216,985 |               217,400 |
| Base Button        |      4,311 |                 6,000 |
| Shadcn Button      |      6,739 |                 7,900 |

These are the separately integrated current ceilings, not the historical audit ceilings. This followup changes no numeric budget. In particular, Vue's 244-byte remaining margin must be remeasured after any subsequent shared Anatomy change; this earlier green does not accept a new source revision.

## Two concrete Docs type failures and bounded correction

[Type job 138415142448](https://github.com/Proto-UI/Proto-UI/actions/runs/45385473253/job/138415142448) passed its Workspace TypeScript stage, then Astro checked 1,344 files with two errors, zero warnings and 48 hints. They were:

1. `runtime-preview-surface.ts`: `SurfaceRootProps` did not satisfy the renderer's `Record<string, unknown>` property-bag contract.
2. The Homepage wheel observer callback passed `Node | null` to `Element | null`.

The Surface correction materializes the existing fresh canvas props with an object spread. It retains all current properties and their public family ownership; it adds no cast, suppression or generic API widening. The two complete existing Surface/composition files passed 100 tests, with zero failures or pending cases. That source file's SHA-256 is `60e953a2d1d3826c8c7c3d357fea269f25934c680c216bdd5bdd624561742b5d`.

Both current wheel callbacks narrow the sole returned node with `instanceof Element`, passing null otherwise. The separate [wheel diagnostic record](2026-11-24-homepage-original-verdict-diagnostic.md) retains the old failure, the source differences in the current native oracle, 23 passing host-model controls and the before/after actual Playwright-type fixture. Those controls do not establish native default scrolling.

The complete original local `check:types` command on `b57e7af30b97a087ae0c3ec9fa75e10c7ca268d8` ran from 12:07:18Z to 12:10:09Z. Website style generation completed; the Workspace checker then exhausted its explicit 2,048 MiB V8 heap and exited 134. The log explicitly says heap out of memory. This is an interrupted type result, not a remaining type diagnostic or a full-chain success. Generated coverage records were being refreshed, but production and type source files did not change during that attempt. A final complete type check remains required with sufficient resources.

## Retention and open acceptance

The [raw hosted and local receipts](evidence/2026-11-24-release-followup/hosted-and-type-receipts.tar.gz) are 378,345 bytes, SHA-256 `e3faea01d8e2818b751fa53f4af891d95ec9c07ed180440a14348e539d595a72`. The [manifest](evidence/2026-11-24-release-followup/manifest.json) records each member's bytes and digest. The retained budget report is the original hosted artifact; an unavailable earlier local report was not synthesized.

Native Homepage wheel/preference, the original Demo Matrix startup assertions, complete current CI, the complete release rehearsal and two evidenced complete green regression cycles remain open. Unsupported or unimplemented native profiles remain separate from named 0.3 generated Web consumers. No draft entity or blocked consumer row is promoted by this record.
