# Repository documentation governance audit — 2026-11-22

## Scope and source

Baseline: `dc3b184ba10b0de53e40359c52d012b204b2cd01` on `main`.

The user requested overall documentation governance after finding the old root `RELEASE_CHECKLIST.md`. The baseline Git tree contains **2,054 Markdown/MDX files**: 1,166 under `internal/`, 688 under `apps/`, 75 under `packages/`, 41 Agent skills, 23 under `docs/`, 19 under `spec/`, 13 under `scripts/`, eight under `benchmarks/`, seven under `experiments/`, seven under `.github/`, six root documents, and one under `native/`. The inventory uses NUL-delimited Git output so non-ASCII filenames are counted without Git's display quoting.

This is a repository-wide file inventory with targeted semantic review of entry points, release guidance, directory roles, public status pages, and their owners. It is not a claim to have re-proved every historical observation or every behavioral statement in all 2,054 files.

## Findings and disposition

| Observation at the baseline | Reconciliation |
| --- | --- |
| The root v0 checklist names `internal/contracts` as the contract entry, prescribes an earlier website information architecture, and includes an author's machine-local absolute paths. | Keep `RELEASE_CHECKLIST.md` as current release navigation. Preserve the complete old source in the [historical archive](2026-11-22-v0-public-launch-checklist.md); trace its requirements below. |
| Root README direction still describes post-0.2 stabilization and a later release, while the repository has a concrete 0.3 delivery plan and private Compiler implementation. | Align both README locales with the actual plan, package roles, and implementation boundaries. Keep stable 0.2.0 distinct from draft workspace preparation. |
| The website roadmap/status pages lag that plan, and compatibility prose calls the current workspace `0.3.0-alpha.0`. | Link the maintained plan and `VERSION`/version entities in both locales. Preserve the historical Vue 2 profile boundary at alpha.0 and avoid implying unpublished package availability. |
| `docs/`, `experiments/`, `benchmarks/`, `native/`, `scripts/`, `shared/`, and `types/` lack directory-level responsibility guides. | Add scoped READMEs grounded in actual consumers, generators, and workspace boundaries, with one [documentation ownership guide](../governance/documentation-policy.md). Add thin `apps/`, `packages/`, and `internal/` navigation. |
| `internal/records/README.md` points new projections to nonexistent `specs` and `engineering` website directories. | Use the existing `specifications` and `build` trees. |
| The interaction benchmark guide still names Node 22; its workflow uses Node 24. The discovery guide names nonexistent `discovery.study.json`. | Correct the toolchain baseline and link the actual `study.json` input. |
| Repository prose uses root pnpm scripts inside package READMEs; one component guide abbreviates two commands as `pnpm dev/build`. | Encode the existing intended workspace root explicitly with `-w`, and replace the shorthand with two real website package commands. The original root-scoped instructions were valid when followed from that directory. |
| The existing documentation gate checks public routes, release claims, package projections, and placeholders, but not the maintained repository's general links or script references. | Compose an offline repository checker into the existing gate, with an explicit role inventory and tests for actual broken targets, scripts, and classification boundaries. |

The original checklist payload is **3,832 bytes**, SHA-256 `5428652a05cbc126512e490cc7f7e8a4cacfe8bf62cf5227b87b43fc75fb856f`. Its archived payload is byte-identical to the baseline Git blob. The archive wrapper identifies the source and historical role; it does not edit original checkboxes or claim the v0 launch criteria were completed.

## Old checklist requirement owners

These are current ownership routes, not acceptance receipts. Retiring the old checklist does not close any live Issue or unfinished condition.

| Original section | Current owner or interpretation |
| --- | --- |
| 0. Positioning and messaging | [Root README](../../README.md), [中文 README](../../README.zh-CN.md), [spec lifecycle](../../spec/README.md), and [versioning policy](../governance/versioning-policy.md). The old v1 zero-runtime aspiration is not a published guarantee. |
| 1. v0 baseline capabilities | [Adapter profiles](../../spec/adapters/), [prototype entities](../../spec/prototypes/), and the [0.3 plan](../governance/release-0.3-plan.md) with its [acceptance list](../governance/release-0.3-list.md). Existing host/consumer obligations remain accountable. |
| 2. Public usage | [CLI guide](../../packages/cli/README.md), [public Quick Start](../../apps/www/src/content/docs/en/start-here/quick-start.mdx), and [release workflow](../governance/release-workflow.md). Follow current supported delivery paths; the old wording does not create unconditional v0/v1 compatibility. |
| 3. Website and demos | [Website guide](../../apps/www/README.md), [actual navigation configuration](../../apps/www/astro.config.mjs), and the plan's website criteria. The original CTA/layout choice remains historical design context. |
| 4. Prototype families and strategy | [Family packages](../../packages/prototypes/), their attribution/notice files, [upstream conformance procedure](../agent-operations/prototype-upstream-conformance.md), and the plan's committed versus WIP family scope. |
| 5. Contracts and tests | [Spec source-of-truth migration](../../spec/README.md#source-of-truth-migration) and [AGENTS authority rules](../../AGENTS.md#authority-and-conflicts). Internal contracts remain explanation or an uncataloged fallback. |
| 6. Contribution | [CONTRIBUTING](../../CONTRIBUTING.md), [Issue templates](../../.github/ISSUE_TEMPLATE/), and [contribution provenance](../governance/contribution-provenance.md). Existing dependency and rights requirements remain in force. |
| 7. Documentation information architecture | [Astro configuration](../../apps/www/astro.config.mjs), [website guide](../../apps/www/README.md), and [documentation ownership](../governance/documentation-policy.md). The original four-level layout is no longer a parallel instruction. |
| 8. Minimum documentation | Current localized [getting-started content](../../apps/www/src/content/docs/en/start-here/), [whitepaper](../../apps/www/src/content/docs/en/whitepaper/), and [build guides](../../apps/www/src/content/docs/en/build/), plus [public documentation checks](../../scripts/docs/README.md). Page existence does not prove tutorial completeness. |
| 9. Language and localization | Linked root README locales, actual website locale configuration, and [public-doc policy](../../scripts/docs/public-doc-policy.mjs). |
| 10. License and attribution | [LICENSE](../../LICENSE), [DCO](../../DCO.md), contribution policy, and the applicable package notices. |
| Machine-local file locations | Repository-relative links in maintained entry points; original absolute paths survive only in the historical payload. |

## Preservation and limits

- Retain `docs/superpowers/` and `docs/evidence/` at their current paths: catalog entities and evidence consumers still cite them. An old “Approved” design label does not override an applicable entity's current lifecycle.
- Preserve all prior release and experiment results. Active release evidence is historical; draft or uncataloged preparation remains subject to current structural checks. A directory without a V entity does not establish publication.
- Preserve spec semantics, entity statuses, package versions, release scope, and unresolved acceptance. No source directory moves or runtime changes are part of this governance change.
- The repository checker resolves actual Markdown links/images/references and a documented static subset of package-script commands. It reports excluded roles and command contexts. It does not execute examples, crawl external URLs, validate heading anchors, or establish prose truth.
- Website routes and their build retain their own gate. Real browser/native/AT and application-consumer evidence remains with the relevant implementation owner; a documentation check supplies none of it.

## Verification record

Observed on Node `24.22.3` and pnpm `10.32.1`, before publication of the candidate:

| Check | Observed result and boundary |
| --- | --- |
| `check:repository-docs` / `check:public-docs` | Passed. Candidate inventory: 2,070 Markdown/MDX files, including 435 maintained documents, 671 website documents, 932 historical records, 16 historical release documents, 12 fixtures, and four evidence documents. All 631 relative targets and 219 static script references passed. The literal documentation example `pnpm run <script>` is reported as an intentionally unresolvable placeholder; external URLs, root-relative routes, fragments, and arbitrary shell are not certified. |
| Public-doc test inventory with serial file execution | **469 passed, zero failed/skipped/cancelled**, using the same file inventory as `test:public-docs` with `node --test --test-concurrency=1`. This includes the eight new repository-checker cases and the 17 existing public-checker cases; these are subsets, not additional tests. |
| Six changed website page bodies | Rendered successfully with the site's actual Astro Markdown processor and the configured `remarkDirective`, `remarkConceptDirective`, `rehypeEnhancedImage`, and `rehypeScrollableTables` plugins. Frontmatter, headings, current-source links, and the obsolete current-alpha wording were checked. This is body rendering, not a website bundle or browser screenshot. |
| Agent configuration and skill registry | `check-agent-operations.mjs` and `check-contributor-skills.mjs` passed: 41 skills, 39 lazy leaves. |
| Agent project-understanding check | The same generator passed through `node --import tsx scripts/spec/generate-agent-project-understanding.mjs --check`. The pnpm/tsx CLI entry itself failed to open its IPC socket with `EPERM`; that original command is not reported as passing. |
| Full Agent-operations test command | No terminal suite result. Two attempts reported 528 top-level passing test lines but did not terminate; both were interrupted with exit 130. The second attempt also supplied Node's per-test timeout. Registry success and partial test output do not establish a completed full suite. |
| Full `docs:build` | Not completed. The first attempt failed inside the CLI TypeScript build; a separate CLI build and actual CLI example extraction then passed. Two subsequent full-build attempts, one with a 1,400 MiB Node heap limit, terminated with exit 137 during website prototype-token generation, before Astro built the changed pages. The termination cause is not established by that exit code alone. |
| Independent local code/document review | Closed the discovered command-classification defect and inventory-count issue; no remaining substantive findings in the reviewed documentation/checker scope. This was not a GitHub approval or release acceptance. |

The first new repository check reported two not-yet-created audit links and command-context mismatches; those were preparation failures, not passing receipts. The command clarifications preserve their existing meaning instead of weakening the checker with an unrestricted root-script fallback. Independent review reproduced false rejection of pnpm native/npm-delegated commands. The repair follows the actual pinned CLI dispatch and preserves explicit `run` checking; focused negative controls cover the distinction.

The initial public-doc test attempt lacked the exact HIG source objects `25c3d0731e39003d87f541afc5e1a294a9d95568` and `0607c6c5c386b8a932ab850e92a8873b2121dc45`. Fetching those real objects restored the existing tests without editing assertions. A later parallel attempt failed in CLI build; the final serial run retained the complete 469-test inventory and passed. These recoveries do not erase the separate full-site or Agent-suite limits above.

The reviewed checker SHA-256 is `7d5a52f0db1f600380b802b563d263e5f06b7590d8001e14bc85d6b2892374f0`. Reviewers can rerun the full public-doc inventory in the same serial configuration:

```sh
node --test --test-concurrency=1 scripts/docs/test/*.test.mjs \
  apps/www/scripts/contrast-provenance.test.mjs \
  apps/www/scripts/contrast-report-journal.test.mjs \
  apps/www/scripts/contrast-probe-serialization.test.mjs \
  apps/www/scripts/contrast-audit-plan.test.mjs \
  apps/www/scripts/contrast-anatomy.test.mjs \
  apps/www/scripts/runtime-retry-urls.test.mjs \
  apps/www/scripts/generate-cli-init-docs.test.mjs
```

Future review triggers are an affected definition or lifecycle change, package/public-route change, command or path rename, new release identity, generated-source change, or a newly reproduced documentation mismatch. Update the owning projection and its tests when applicable, rather than starting another independent release checklist.
