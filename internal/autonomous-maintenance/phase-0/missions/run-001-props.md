# Phase 0 run 001: Props vertical slice

## Identity

- Run ID: `AM-P0-001`
- Baseline commit: `109083311d32c1a43ba3d66e55e7cd0b7c08f1dc`
- Budget class: `large`
- Mode: manually triggered, read-only Observer

## Objective

Determine whether the current Props vertical slice contains a reproducible, currently unknown maintenance problem. Finding a problem is not required; a well-supported no-finding result is valid.

## Scope

Trace and compare:

- `M-PROPS-0001`;
- `HC-PROPS-SOURCE-0001`;
- Props contracts satisfied by the Module;
- `A-REACT-18-19-0001`, `A-VUE-3-0001`, and `A-WEB-COMPONENT-0001` Props support and capability provision;
- `T-PROPS-0001` through `T-PROPS-0012` and every required implementation they name;
- Props Module, Runtime, and official Adapter implementation paths referenced by those entities;
- applicable public documentation and package surfaces.

Pay particular attention to:

- facade versus privileged port separation;
- raw snapshot normalization and invalidation semantics;
- direct `applyRaw` versus host-source synchronization;
- watcher coalescing and callback-safe dispatch;
- source replacement, unsubscription, pending tasks, and terminal disposal;
- whether all three Adapter profiles supply equivalent semantic evidence without requiring identical host implementation details.

## Starting material

Read first:

- `AGENTS.md`;
- generated `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md`;
- `spec/README.md`;
- `internal/records/2026-08-13-module-host-cap-adapter-catalog-route.zh-CN.md`;
- `internal/records/2026-08-14-props-official-adapter-profile-audit.zh-CN.md`.

## Validation floor

At minimum:

```sh
corepack pnpm@10.32.1 spec:docs:agent
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 exec vitest run \
  packages/modules/props/test \
  packages/runtime/test/contract/props-integration.v0.contract.test.ts \
  packages/adapters/react/test/contract/props-host-source.v0.contract.test.ts \
  packages/adapters/react/test/contract/resolved-snapshot-shape.v0.contract.test.ts \
  packages/adapters/vue/test/contract/props-host-source.v0.contract.test.ts \
  packages/adapters/vue/test/contract/resolved-snapshot-shape.v0.contract.test.ts \
  packages/adapters/web-component/test/contract/props-host-source.v0.contract.test.ts \
  packages/adapters/web-component/test/contract/resolved-snapshot-shape.v0.contract.test.ts \
  packages/adapters/web-component/test/props-reprovide.test.ts
```

The Observer may replace the broad runtime command with exact focused Vitest paths when that provides clearer evidence. It must report the actual commands, not merely this suggested floor.

## Stop condition

Stop after reporting at most three findings that survived falsification, or after the selected vertical slice has been traced and no verified finding was discovered. Do not implement fixes.

## Observer result

- Status: completed
- Candidate findings: 1
- Finding: [`AM-P0-001-F1`](../findings/AM-P0-001-F1.md)
- Verifier classification: confirmed (`0.98` confidence)
- Human disposition: accepted for remediation
- Observer-created implementation changes: none
- Accepted remediation: completed; see the finding record for changes and validation evidence.
- Integration decision: Props remediation committed separately as `541d55673231da9af343e34cb02c8eab0a4aed47`; merge and release were not authorized.
