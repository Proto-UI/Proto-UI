# Phase 0 run 003: Props resolved-snapshot documentation projection

## Identity

- Run ID: `AM-P0-003`
- Semantic baseline commit: `0303cdf06ee6f47c16264b570d839c899057d286`
- Budget class: `medium`
- Mode: manually triggered, fresh-task, read-only Observer

## Objective

Determine whether the English and Chinese public Props documentation faithfully project the current active guarantees for declared-key resolved snapshots and state-specific fallback. A verified finding is not required; a well-supported no-finding result is valid.

## Scope

Trace and compare only this semantic slice:

- `C-PROPS-0008` and criteria `C-PROPS-0008-A` through `C-PROPS-0008-G`;
- `C-PROPS-0009` and criteria `C-PROPS-0009-A` through `C-PROPS-0009-I`;
- the corresponding surface of active `M-PROPS-0001`;
- `T-PROPS-0005`, `T-PROPS-0006`, and the required implementations they name;
- `packages/modules/props/src/**` and the focused Module or Runtime evidence needed to establish current behavior;
- `apps/www/src/content/docs/en/specifications/props.mdx`;
- `apps/www/src/content/docs/zh-cn/specifications/props.mdx`.

Assess both structured contract-preview data and explanatory prose in the two public pages. Check whether each material public claim preserves state-specific distinctions, lifecycle authority, and English/Chinese semantic equivalence. Do not expand into unrelated Props contracts or general website quality.

## Starting material

Read first:

- `AGENTS.md`;
- generated `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md`;
- `spec/README.md`;
- `spec/contracts/C-PROPS-0008.yaml`;
- `spec/contracts/C-PROPS-0009.yaml`;
- `spec/modules/M-PROPS-0001.yaml`;
- `spec/tests/T-PROPS-0005.yaml`;
- `spec/tests/T-PROPS-0006.yaml`;
- the two scoped public documentation pages.

## Known boundaries

- The selected contract and Module entities are `active`; report their exact lifecycle as observed at task start.
- Run 001's Adapter normalization and verifies-anchor evidence gap is already known and remediated. It is out of scope and must not be re-reported.
- A wording or translation preference is not a finding unless it changes, omits, overstates, or contradicts an applicable active guarantee.
- Passing mapped tests establish implementation evidence; they do not by themselves prove that public prose is complete or accurate.
- Do not edit the documentation even if drift is found.

## Validation floor

At minimum, record the actual results of:

```sh
corepack pnpm@10.32.1 spec:docs:agent
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 exec vitest run \
  packages/modules/props/test/contract/resolved-snapshot-shape.v0.contract.test.ts \
  packages/modules/props/test/contract/fallback-resolution.v0.contract.test.ts \
  packages/modules/props/test/contract/resolved-json-value-boundary.v0.contract.test.ts \
  packages/runtime/test/contract/run-props-wiring.v0.contract.test.ts
```

The Observer may add exact focused evidence when falsifying a suspected documentation mismatch. It must report the commands actually run and distinguish source inspection from executable evidence.

## Stop condition

Stop after reporting at most three documentation-projection findings that survived falsification, or after the selected slice has been traced and no verified finding was discovered. Do not implement fixes, modify tracked files, or create external writes.

## Observer result

- Status: completed
- Actual starting and final HEAD: `d7bf6c9ff4191388c5d35e4b58e2908b6c1817d4`
- Candidate findings: 1
- Finding: [`AM-P0-003-F1`](../findings/AM-P0-003-F1.md)
- Observer confidence: `0.98`
- Verifier classification: confirmed (`0.99` confidence)
- Verifier result: both rendered language pages flatten the active state-specific fallback order; active authority, implementation, and focused evidence preserve the correct distinction.
- Corrected scope: the two public `C-PROPS-0009` previews, plus a separately identified stale PropsKernel comment; no active semantic, runtime, test, or generic preview-component change is indicated.
- Observer-created repository changes: none
- Validation: Agent projection generated from 529 entities, prototype catalog passed, and 4 focused files with 36 tests passed in an isolated temporary checkout.
- Environment limit: the Observer's successful reproduction used Node 20.19.4 rather than the repository's Node 22 CI baseline.
