# Phase 0 run 002: Event and Default Action vertical slice

## Identity

- Run ID: `AM-P0-002`
- Baseline commit: `109083311d32c1a43ba3d66e55e7cd0b7c08f1dc`
- Budget class: `large`
- Mode: manually triggered, read-only Observer
- Starting overlay: accepted `AM-P0-001-F1` remediation is present but not committed; Event-related paths were unchanged at Observer start.

## Objective

Determine whether the current Event input and Default Action vertical slice contains a reproducible, currently unknown maintenance problem. Finding a problem is not required; a well-supported no-finding result is valid.

## Scope

Trace and compare:

- `M-EVENT-0001`;
- `HC-EVENT-BINDING-0001` and `HC-DEFAULT-ACTION-0001`;
- `C-EVENT-0001` through `C-EVENT-0007` and the Event token/type contracts;
- `A-REACT-18-19-0001-E/F`, `A-VUE-3-0001-E/F`, and `A-WEB-COMPONENT-0001-E/F`;
- `T-EVENT-0001`, `T-EVENT-0002`, `T-EVENT-0003`, and every required implementation they name;
- Event Module, Runtime, Adapter Base router, and official Adapter paths referenced by those entities;
- applicable public documentation and package surfaces.

Pay particular attention to:

- author facade versus privileged binding/dispatch ports;
- root versus global registration and conditional host binding;
- logical-owner routing across host roots, trigger surfaces, portals, and compound instances;
- callback-safe delivery, default-action request scope, and cancelability;
- target replacement, view detach/remount, terminal disposal, and listener lease cleanup;
- whether React, Vue, and Web Component evidence proves equivalent semantics without assuming identical commit timing;
- whether implementation or tests still rely on Web `EventTarget` details beyond what the draft portable host capability claims.

## Starting material

Read first:

- `AGENTS.md`;
- generated `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md`;
- `spec/README.md`;
- `internal/records/2026-08-13-module-host-cap-adapter-catalog-route.zh-CN.md`;
- `internal/records/2026-08-14-event-module-host-cap-adapter-audit.zh-CN.md`;
- `internal/records/2026-07-06-default-action-control.zh-CN.md`.

## Known boundaries

- `M-EVENT-0001`, both Event host capabilities, and `T-EVENT-0003` are draft; do not present their cataloged direction as a stable public guarantee.
- Explicit open questions and the recorded `EventTarget`/listener-options portability debt are known gaps, not new findings.
- The 2026-08-14 record predates the current passing Adapter Base default-action projection entry in `T-EVENT-0003`; verify current evidence rather than repeating the record's former planned-test gap.
- Expose Event is out of scope except for proving that its outward channel does not leak into the Event input facade.
- The separate cross-catalog verifies-anchor completeness audit is not part of this semantic run.

## Validation floor

At minimum:

```sh
corepack pnpm@10.32.1 spec:docs:agent
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 exec vitest run \
  packages/modules/event/test \
  packages/runtime/test/contract/event-no-registrations.v0.contract.test.ts \
  packages/adapters/base/test/contract/event-target-requirements.v0.contract.test.ts \
  packages/adapters/base/test/contract/event-default-action.v0.contract.test.ts \
  packages/adapters/react/test/event-routing.test.ts \
  packages/adapters/react/test/event.test.ts \
  packages/adapters/vue/test/event-routing.test.ts \
  packages/adapters/vue/test/event.test.ts \
  packages/adapters/web-component/test/contract/event.router.mapping.v0.contract.test.ts
```

The Observer may add focused router, ownership, portal, lifecycle, or browser checks when needed. It must report the actual commands and results.

## Stop condition

Stop after reporting at most three findings that survived falsification, or after the selected vertical slice has been traced and no verified finding was discovered. Do not implement fixes.

## Observer result

- Status: completed
- Candidate findings: 1
- Finding: [`AM-P0-002-F1`](../findings/AM-P0-002-F1.md)
- Verifier classification: partially confirmed (`0.96` confidence)
- Human disposition: accepted with corrected failure-path scope
- Observer-created implementation changes: none
- Accepted remediation: narrowed to target preflight plus explicit retry after an independent `incomplete` review; automatic capability recovery and attachment/cleanup failure guarantees were removed.
- Semantic decision: accepted. Round-two review is adequate (`0.96`), Node 22.23.2 validation passed, and the implementation remediation completed automatically on 2026-08-19.
- Integration decision: Event remediation committed separately as `58d734ac8fded9adb4873b8d524476897173f19c`; merge and release were not authorized.
- Remediation review: [`AM-P0-002-F1`](../reviews/AM-P0-002-F1.md)
