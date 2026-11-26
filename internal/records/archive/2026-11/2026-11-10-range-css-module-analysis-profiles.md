# Bounded Range and CSS Modules analysis profiles

Date: 2026-11-10. Issue: [#854](https://github.com/Proto-UI/Proto-UI/issues/854). Source base: `0607c6c5c386b8a932ab850e92a8873b2121dc45`. This is an authored source-analysis candidate and execution plan, with no new executed product result, production-consumer admission or lifecycle promotion.

The original parent keys are [563/discussion_r4193812704](https://github.com/Proto-UI/Proto-UI/pull/563#discussion_r4193812704) and [563/discussion_r4193812719](https://github.com/Proto-UI/Proto-UI/pull/563#discussion_r4193812719), both pinned originally to `f5a0a226cd4407229332d7d7c3bb20b6109197c7`. Their scope replies [r4193976722](https://github.com/Proto-UI/Proto-UI/pull/563#discussion_r4193976722) and [r4193978248](https://github.com/Proto-UI/Proto-UI/pull/563#discussion_r4193978248) explicitly recorded unmodeled work, rather than implemented or resolved fixes. The October 6 absence search remains a dated observation; it is not an exemption. The separate HTML/Astro quoted-comment repairs and their historical evidence are unchanged.

Live Issue intake found the Issue open, both original compound checkboxes unchecked, and exactly two comments. The [first November 6 comment](https://github.com/Proto-UI/Proto-UI/issues/854#issuecomment-6684432599) deferred the work to 0.4; the [individual determination](https://github.com/Proto-UI/Proto-UI/issues/854#issuecomment-6684477055) described it as static-analysis tooling outside the then-current 0.3 scope. Both facts are retained. The current user separately directed this bounded candidate. That direction does not rewrite either old comment or supply independent acceptance.

## Source ownership and authority

The source profile is analysis tooling, with no claimed active or draft Proto UI runtime/Compiler guarantee. The completed exact search in `spec/contracts`, `spec/decisions` and `internal/contracts` for coverage-matrix, consumer-wall, Website/Harness and self-hosting ownership found no applicable entity. A subsequent whole-spec search timed out after 30 seconds, so catalog completeness remains unknown. No catalog identity or lifecycle is modified. The governing bounded task is Issue854 plus the current request; `AGENTS.md`, `spec/README.md` and contributor rules retain their lifecycle, provenance and acceptance boundaries. The existing matrix checker and dated October 6 records describe its implementation history, not an independent admission of this candidate.

The Issue owner authors `scripts/coverage-matrices/bounded-analysis-profiles.mjs`, `scripts/coverage-matrices/test/bounded-analysis-profile-consumers.mjs` and this record. Main approved these exclusive paths and owns the shared checker, central test registration and README integration. Exact original bytes and separate unapplied shared patches are retained in `/tmp/release03-issue854-owner-20261110/`; those temporary paths are preparation artifacts, not published evidence. No Compiler/IR, prototype, public coverage/catalog, runtime browser inventory or workflow production code is changed by the owner.

## Range decision

Admitted native provenance consists of unshadowed `document.createRange()` and `new Range()`, including their `window`, `self` and `globalThis` receivers and bounded lexical document/constructor/Range aliases. The projection uses the existing complete lexical binding inventory, including assignments and destructuring, with a 64-binding bound. The profile identifies source provenance only. Every recognized fragment call remains an unverified HTML sink even for benign literal markup or an uninserted fragment.

Explicit unknown receivers, Range-typed parameters, arbitrary factory results, shadowed factory returns and constructor instances remain unverified. Extracted methods, `call`, `apply`, bound invocations, `Reflect.apply` and dynamic members on known ranges are retained as unsupported provenance. Definite business objects/aliases, inert acquisition/binding, inert shadowed acquisition, comments and strings are controls. A lexical shadow is not evidence of a browser global, nor does it certify an unknown returned value. Property mutation, arbitrary aggregate/interprocedural/reflective aliases and complete data-flow closure are outside this profile and require separate source review.

No authored JavaScript payload or returned fragment is executed or parsed. The profile does not infer insertion, activation, document bases, local/remote resource closure, custom elements or HTML/SVG/MathML contextual namespaces. A normal source check cannot promote this use into accepted production behavior. The original inserted-handler example is represented as source text, alongside a benign uninserted control that remains unverified.

## CSS Modules/ICSS decision

Only standalone exact lowercase `.module.css` sources are admitted. Supported forms are a single-local-class declaration `composes: name [name ...]`, with no `from`, `from global`, or `from "target.module.css"`, and a top-level `:import("target.module.css") { ... }`. Quoted targets use CSS escape decoding; comments and strings are tokenized before structural inspection. Local/global composition introduces no dependency. These rules discover dependency edges; they do not prove selector/export-value validity or render a stylesheet.

Relative `./`/`../` targets and exact `@proto.ui/*` subpaths must retain an explicit `.module.css` suffix. The existing resolver, workspace/package-layer classification and promotion source-byte walk consume those edges. Keeping the suffix on both ends preserves module context in the path-based walk. Vite/PostCSS may also interpret regular `.css` dependencies as modules; that broader language is deliberately unverified rather than resolved with the wrong context. Missing relative targets stay unverified, and the existing root, symlink, manifest/config, source/context and traversal-budget rules still apply. No directory/package allowance is introduced.

Opaque/interpolated targets, URL-function targets, ordinary `.css` dependencies, third-party/bare resolver contexts, `@value`, `compose-with`, compound/malformed ICSS, composition on a non-single-class selector, preprocessor modules, uppercase filename variants and Vue `<style module>` stay unverified. Ordinary non-module CSS retains its current import profile and its inert `composes`/`:import` controls. No candidate PostCSS plugin, Vite config or package code is loaded or evaluated.

## Original-condition ledger

Every row below remains **authored/unrun** until Main supplies source-bound execution and independent acceptance. The original two compound checkboxes remain open.

| Stable child | Original requirement | Authored candidate and remaining acceptance |
| --- | --- | --- |
| 854-R1 | Decide and document admitted native receiver/alias forms | Decision above; Main must reconcile actual checker output and independent review. |
| 854-R2 | Retain unverified results for unsupported provenance | Explicit receiver/type/factory/shadow/method controls; actual results unrun. |
| 854-R3 | Website/Harness native acquisition controls | Both real checker consumers receive the source-text fixtures. |
| 854-R4 | Business/shadow controls | Definite business and inert shadow negatives, unknown shadow-return positives. |
| 854-R5 | No payload execution | Parser-only source inputs; Main must inspect execution/dependency boundaries. |
| 854-R6 | Insertion/resource/namespace limits and promotion reconciliation | Limits above; no production consumer or promotion evidence is admitted by this preparation. |
| 854-C1 | Decide supported composes/from and :import syntax | Finite grammar above; no general CSS closure claim. |
| 854-C2 | Relevant resolver context | Explicit .module.css endpoints, existing resolver/config/manifest gates, unsupported Vue/preprocessor/plain-CSS contexts. |
| 854-C3 | Unsupported syntax stays unverified | Dedicated CSS Modules diagnostic reaches Website/Harness and installed-package inspection. |
| 854-C4 | Governed-package consumer boundaries | Direct and installed-package composition/ICSS controls in both consumers. |
| 854-C5 | Local dependency bytes changed after capture | Separate unchanged baseline followed by changed, missing and symlink mutations for both syntaxes. |
| 854-C6 | Comments/strings | Inert examples and quoted structural delimiters retain independent controls. |
| 854-C7 | Escapes | Escaped grammar and governed-package identity enter the consumer wall. |
| 854-C8 | Ordinary non-module CSS controls | Both ordinary composition and ICSS, plus ordinary Vue style, retain their non-module context. |
| 854-C9 | No directory/package blanket allowance | Targets go through existing exact layer/resolver/byte gates. |
| 854-P1 | Reconcile declared scope, implementation, negative controls and independent acceptance before production/promotion use | Exact shared patches prepared; Main must execute before/after, full source gate and fresh independent review before any admission or closure. |
| 854-P2 | HTML/Astro quoted-comment defects remain with original #563 scope | Historical record/source/evidence untouched; no closure claim made here. |
| 854-E1 | Finite future design/validation task, not completed support or security-bypass proof | All new product executions, native results and acceptance remain unrun. |
| 854-E2 | Source-bound executable evidence | Exact preimages, after-SHAs, patches and serial commands are in the owner handoff. |
| 854-E3 | No unrelated screenshot substitute | Internal evidence is the executed checker/byte transition; no UI screenshot or native CSS/DOM claim is proposed. |

## Serial Main acceptance

The new registrar defines 30 Range cases and 24 CSS cases per Website/Harness consumer, four installed-package boundary cases and six promotion cases: **118 selected cases** in the existing checker test file after its prepared registration patch is applied. This is a source inventory count, not collection or execution. Main must reconcile the runner's actual selected count and retain every setup error, failed assertion, skip and result. The six promotion tests each assert an unchanged source-bound baseline before their mutation.

Use the retained shared-file preimage hashes before applying the test-only patch. Run `node --test --test-name-pattern='^issue854 ' scripts/coverage-matrices/test/check-coverage-matrices.test.mjs` on the original checker plus those new consumers, retaining expected failing assertions as baseline evidence; an import/setup error is not a failed-before result. Then apply the separate checker/README patch and run the identical command. All 118 selected cases must pass with zero selected skips. Main formats the actual integrated files once and runs `corepack pnpm@10.32.1 check:coverage-matrices` serially with installed Node24 and the declared dependencies. Exact argv, environment, output paths and SHA bindings are carried in `main-validation-plan-ready.json` in the owner packet.

The actual consumers are the existing Website and Harness source scans and Website promotion source-byte closure. The meaningful action is an authored source input or dependency mutation; its outcome is unverified sink, governed-layer rejection, unchanged source admission, or stale/missing/symlink dependency rejection. Inspect the source-bound transition from native receiver to sink classification and from composition/ICSS edge to dependency digest comparison. There is no browser navigation or visual rendering acceptance for this internal task. Screenshots cannot replace these results. No production page is newly admitted or promoted.

Remaining original work belongs to Main plus this continuing owner: apply/reconcile shared patches, genuine before/after and complete consumer execution, required formatting/source checks, fresh independent acceptance, lawful exact-head PR integration and actual earned Issue tracking readback. No PR, review, merge, native observation or closure has been created by this preparation.
