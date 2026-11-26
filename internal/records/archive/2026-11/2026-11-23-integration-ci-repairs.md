# Seven-Sprint integration: compiler types and generated projections

The full CI run [45146424504](https://github.com/Proto-UI/Proto-UI/actions/runs/45146424504) measures the preserved integration source `d0392fb31513b12f55b9e99b1fcf26a6338569c9`. It exposed real integration failures before the affected downstream checks could complete. Their original job logs are retained with [source hashes and focused validation](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-integration-ci-repairs/validation.json).

## Small owning changes

- The compiler parser imported `unwrapSourceExpression` twice, once from its canonical source and once through a re-export. The redundant re-export import is removed. The canonical helper and all call sites remain unchanged.
- The unused-shader negative control passed a StyleHandle without its required `kind`. It now supplies `kind: 'tw'`; both the physically idle undeclared owner and the actual guarded physical-acquisition control retain their original assertions.
- The repository's `sync:package-manifests` producer restores the canonical Base public files order. The contents and package dependency graph are unchanged. This stale manifest blocked both package-budget measurement and material source/host artifact checks; those failures were not budget overruns.
- The complete `styles:preset:generate` command refreshes Shadcn, Brutalist and draft-family token manifests from their actual integrated prototypes. It restores changed direction padding and the integrated Slider/Field tokens. No token is manually inserted and no generated check is disabled. The motion palette producer runs unchanged.

## Validation boundary

The existing parser and unused-shader tests pass **21/21**, with zero skipped. The first local invocation incorrectly selected a nonexistent Vitest `unit` project and collected no tests; the corrected command uses the repository's actual default configuration. It does not turn that first observer failure into a pass.

The formal manifest check accepts all **47** public packages. Every preset generator's ordinary `--check` succeeds and the existing motion-palette suite passes **13/13**. These are generated-output checks and bounded behavioral controls; they do not replace strict workspace typing or browser consumer verification.

An independent agent reviewed the exact six-file source patch and found no blocking issue. Its digest is bound in the receipt. This is a local source review, not a GitHub approving review. The separate declarative consumer typing failure, CLI Portal smoke oracle and native macOS lint failures are handled by their own changes. Final combined-head CI, trusted DCO and repository-required independent approval remain outstanding. No acceptance threshold, package budget, original criterion or lifecycle is changed by this repair.
