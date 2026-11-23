# A2 CI: standalone catalog study and workspace type boundary

## Observed failure

The [type-check job 137393388150](https://github.com/Proto-UI/Proto-UI/actions/runs/45082437149/job/137393388150) ran on candidate `b0397ecb21ca0a49287129a16058f64f42176906` (A2), with Node `v24.22.3` and pnpm `10.32.1`. The website style prelude completed. The workspace TypeScript check then reported **38 diagnostics**, all in [`scripts/analysis/declarative-agent-ui/app.tsx`](../../scripts/analysis/declarative-agent-ui/app.tsx), and exited with code 2. The subsequent website type check in the `&&` chain did not run.

| Diagnostic | Count | Actual source locations and meaning |
| --- | --: | --- |
| TS2307 | 3 | Lines 1–3: the root installation cannot resolve React, React DOM or Radix Tabs for this independent project. |
| TS7016 | 1 | Line 6: the experiment's `mapping.mjs` has no declaration consumed by this root TypeScript invocation. |
| TS2532 | 1 | Line 20: the imported JSON's inferred shape permits an undefined value at the selected nested access. |
| TS2875 | 1 | Line 25: the React JSX runtime/types are unavailable in this dependency scope. |
| TS7006 | 5 | Callback parameters have no usable contextual type. |
| TS7026 | 25 | JSX intrinsic element types are unavailable. |
| TS2322 | 2 | Line 74: without React JSX typing, `key` is checked as an ordinary component prop. |

The original downloaded log is 25,732 bytes with SHA-256 `0db27c476ed7e0926ae2db4e3bdb331ba428cb1f048ca7cd8023c5ba628bca91`. This is a failed A2 CI observation, not a type-check success. Installing runtime dependencies alone would not address every reported type boundary.

## Source attribution

The app's Git blob is `02392130b484e2b7f4ab413ff9a5c575ba386214` at all three revisions:

- Original experiment commit `af70fbd99f57017aeee6b541c4ccbb04c348d68b`.
- Imported dependency branch `ad39435aeb3589d3bc52de3cbd1f4cdd375cec68`.
- A2 `b0397ecb21ca0a49287129a16058f64f42176906`.

Main `2479acecddf8f9801cdbee0c538ca08d7e79c9d4` had no `scripts/analysis/declarative-agent-ui/` directory. A1 `b5922d4dfda98d6fb5bb7ed66f04e0215f9ae56b` joined that main and `ad39435…`, bringing the existing study into this integration. The workspace configuration itself has the same blob, `6f8450c27676b7bfbe4a83a4aa7f188986ed17d3`, at main, the dependency branch and A2.

This proves an inherited standalone experiment entered the current workspace scan. It does **not** establish that main 247's CI already failed, or supply a historical type-check receipt for the dependency branch. The current integration must account for the failure.

## Owning project and repair

The study already has a private [`package.json`](../../scripts/analysis/declarative-agent-ui/package.json), its own npm lockfile and a [documented independent installation/build/browser sequence](../../scripts/analysis/declarative-agent-ui/README.md). It is not included by [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml), so root `pnpm install --frozen-lockfile` does not install its local React/Radix dependency set. Its [producer](../../scripts/analysis/declarative-agent-ui/build.mjs) uses esbuild and resolves those packages from the study's own directory. That producer is neither Vite nor a TypeScript strict check.

The bounded repair adds only the exact `scripts/analysis/declarative-agent-ui` directory to [`tsconfig.workspace.json`](../../tsconfig.workspace.json), beside the existing independently materialized consumer projects. Root `strict`, compiler options, package source, tests and the rest of `scripts/analysis/` remain in their existing scopes. [`scripts/README.md`](../../scripts/README.md#type-checking-and-independent-consumer-projects) documents the project owners and the actual evidence boundaries.

The experiment's app, package manifest, npm lock, producer, protocols, historical README, [original record](2026-11-22-sprint-7-declarative-agent-ui.md), and retained receipts are not changed. Their observed schema/build/browser results remain what they were. No standalone TypeScript strict result is claimed, and no new result is substituted for the original 38 workspace diagnostics. This is a project-boundary correction, not a type repair to the frozen experiment.

## Separate package-job result

The [public-package job 137393481584](https://github.com/Proto-UI/Proto-UI/actions/runs/45082437149/job/137393481584) completed **47/47 public package builds**, checked all 47 public manifests, and passed the 15 existing budget-policy tests. It subsequently exited 1 at the strict whole-entry package-budget command. The exact downloaded job log is 111,761 bytes with SHA-256 `91bad469fc08e39c97084d48c958db2ee9211c4e9cbfdbe010fef464b5c96729`.

That failed size gate is a separate finding; this type-project change neither resolves it nor raises any ceiling. Its actual uploaded measurement report must determine the affected entries and cost attribution.

## Validation and next owner

The authorized scope is this exact configuration entry, its maintained tooling explanation, and this diagnosis. No new test scenario, source rewrite, dependency install, standalone type-check claim or budget-policy change is included.

At preparation, the integration owner still owes a fresh complete `check:types` run after the coordinated CI repairs, including the website phase that A2 did not reach, plus the applicable documentation checks. Those commands are not represented as passed here. The original failing job and experiment source/evidence bindings remain available for review.
