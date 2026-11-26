# Anatomy comparison-path cache: unchanged strict package budgets

Date: 2026-11-24 UTC. This record is non-normative and changes no ceiling.

## Exact measured candidate

The official strict measurement was executed locally on the clean candidate `a6f77761a1130dd1170af028d1c9f5ec191d59f8`, tree `5e85d689cf5824ccdc4410808d2f884329c712c8`. The source fingerprint was `0153b17f08a6e1815abd01f2e9ac190d90f6d9d69987bd93e2306a5c763bffe1` over 7,998 inventoried source files, stable before and after measurement. The report records `requireClean`, `workingTreeClean`, `measuredSourceMatchesHead` and `stableDuringMeasurement` as true, with the exact expected candidate SHA.

The implementation and its newly executed semantic controls are described in `2026-11-24-anatomy-comparison-path-reconstruction.md`. The unavailable earlier local source object and raw semantic archive are not prerequisites asserted by this new measurement.

## Executed official workflow stages

The commands follow `.github/workflows/package-budget-evidence.yml`:

1. Fresh `pnpm@10.32.1 install --frozen-lockfile`, additionally using `--offline` and the existing pnpm store: exit 0. The checkout's earlier dependency symlinks were removed only within this owned checkout; a real local workspace graph was installed to avoid resolving another checkout's generated packages.
2. Complete `build:packages`: 47/47 public packages, exit 0, including each package's JavaScript-only import smoke. No selected-package shortcut.
3. `check:package-manifests`: exit 0.
4. `test:package-budget-policy`: 28/28 passed, zero failures or skips.
5. The unchanged `scripts/analysis/package-budgets.mjs --json --require-clean --expected-sha a6f77761a1130dd1170af028d1c9f5ec191d59f8`: exit 0; all nine strict entries passed.

The entire chain ran serially with `NODE_OPTIONS=--max-old-space-size=1536`. Every stage retained empty tracked/untracked source status before and after. There was no outer timeout. The strict stage completed at `2026-11-24T12:14:15.035015+00:00`.

This is the repository's official strict path executed locally, not a hosted GitHub Actions receipt. It retains the frozen install, complete package build, manifest controls and actual original strict report rather than presenting an isolated bundle-size sample as the complete gate.

## Observed budgets

| Gzip entry                 | Measured bytes | Unchanged ceiling | Remaining bytes |
| -------------------------- | -------------: | ----------------: | --------------: |
| Lucide X icon              |          1,797 |             3,000 |           1,203 |
| Lucide root                |        635,846 |           700,000 |          64,154 |
| Core root                  |         12,967 |            13,100 |             133 |
| Runtime root               |        107,023 |           107,400 |             377 |
| React Adapter root         |        180,715 |           180,900 |             185 |
| Vue Adapter root           |        179,616 |           179,700 |              84 |
| Web Component Adapter root |        217,155 |           217,400 |             245 |
| Base Button                |          4,311 |             6,000 |           1,689 |
| Shadcn Button              |          6,739 |             7,900 |           1,161 |

The retained exact `fde59e8517b52f4c0a3fd19453a5d586e9fe7f3f` report used the same complete measurement settings and environment: Node 24.22.3, esbuild 0.25.12, zlib `1.3.2.1-motley-285e94b`, Linux x64. Comparing actual source hashes from every measured dependency closure finds only `packages/modules/anatomy/src/impl.ts` changed in the four affected entries. The other five entry closures are unchanged. Observed gzip differences are Runtime +156 B, React +155 B, Vue +160 B and WC +170 B. This comparison does not sum minified attribution groups or infer gzip contributions from them.

## Evidence and scope

The [strict evidence archive](evidence/2026-11-24-anatomy-strict-package-budget.tar.gz) retains the original report, terminal verification, complete stage commands and logs, environment, old source-bound report and input-hash comparison. Its manifest hashes every member. The old report remains bound to `fde`; it is not relabeled as a new baseline execution.

The existing Vue margin accommodates this measured source with 84 B remaining. The final integrated candidate still needs its own exact source binding and strict receipt. Package-byte success does not prove the original native Matrix 60-second startup condition, full repository types, hosted CI, or release acceptance. No budget policy, assertion, source-admission status or lifecycle was changed, and this child performed no external write.
