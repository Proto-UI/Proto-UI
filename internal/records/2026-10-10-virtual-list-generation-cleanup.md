# Virtual List revoked-generation Web cleanup

Date: 2026-10-10 UTC. Baseline: exact sixth source `8f937f087f68335b17f7243aaa45549e23945526`. This independent successor follows the separately committed Tree/DataTable input repair `766613b7dbfa9c739803bb31eb6b6d35d32c9798` without changing the frozen sixth snapshot.

## Scope and governing boundary

The current owner request authorizes repairing stale physical resources in the existing explicit `@proto.ui/prototypes-base/virtual-list/web` materializer. The public model has generation/revision-bound requests, committed materialized keys and explicit invalidation. Public Virtual List docs describe the separate Web node/spacer/measurement owner and retain WIP cross-host acceptance. No cataloged Virtual List contract was found; this local repair does not promote that uncataloged capability into a stable or cross-Adapter guarantee. The earlier functional source and manifest records remain historical context, not normative authority.

The independent sixth-source review reproduced two mutation cases: replacing twenty old keys with ten new keys while the viewport exceeded maxMaterializedItems, and shrinking that policy below the current visible count. Both cleared the model commitment but retained old physical rows, old aria-setsize and spacer extent. The baseline was verified before the repair. Resize-only unavailability with a still-valid committed model window is a different case and remains preserved.

## Implementation

Only the existing Web materializer changes. When the model revokes its commitment, its old physical views are removed and unobserved, the view map is emptied and both owned spacers reset to zero. A failed proposal no longer leaves revoked-generation resources mounted. Successful recovery materializes only current keys with current position/set-size facts. Ordinary refresh still preserves keyed node identity.

Installation checks request generation, revision, current status and disposal at renderer, accessibility-attribute, insertion, observation and measurement boundaries. Synchronous invalidation schedules one coalesced refresh for the latest collection; superseded staged work cannot publish or commit. Failed rendering still throws the original error while clearing a now-rejected projection. Disposal cancels ownership so queued refresh and late observer callbacks cannot revive rows. No DOM operation is introduced into the portable model or prototype, and no Compiler/Runtime/shared protocol is changed.

## Reproducible evidence

The new nine-case fixture on exact baseline Web source has **7 failed / 2 passed**. On the repaired source, **9/9 pass**. The focused combined run passes **68/68 across eight files**: generation cleanup (9), existing Virtual List (4), key-list props (16), Tree (3), collection compositions (6), public hook contracts (1), family projections (28), and Message Scroller (1). Both scoped TypeScript checks pass.

The tests observe actual Happy DOM nodes, attributes, connectivity, retained identity, spacer values and model state. Viewport height is explicitly injected. A deterministic ResizeObserver probe records observe/unobserve/disconnect and injects late callback delivery. Custom elements exercise synchronous attribute/connection reentry. The asynchronous wait targets the scheduled microtask boundary, not a grace-period sleep. These facts do not establish native ResizeObserver timing, browser layout/paint, keyboard/a11y journeys, Compiler/native/packed conformance or full Finf acceptance.

```sh
./node_modules/.bin/vitest run packages/prototypes/base/test/virtual-list-generation.test.ts packages/prototypes/base/test/virtual-list.test.ts packages/prototypes/base/test/collection-key-list-props.test.ts packages/prototypes/base/test/tree.test.ts packages/prototypes/base/test/finf-collection-compositions.test.ts packages/prototypes/base/test/finf-collection-hook-contracts.test.ts packages/prototypes/base/test/finf-collection-projections.test.ts packages/prototypes/base/test/message-scroller.test.ts --maxWorkers=1 --minWorkers=1
./node_modules/.bin/tsc --noEmit -p packages/prototypes/base/test/tsconfig.virtual-list-generation.json
./node_modules/.bin/tsc --noEmit -p packages/prototypes/base/test/tsconfig.collection-key-list-props.json
```

Environment: Node 24.19.0, fixed offline pnpm 10.32.1 and Vitest 2.1.9, existing workspace dependencies, one worker. Normal formatting and diff checks pass. This source-only slice is not published; no new screenshots or uploaded visual evidence exist. Exact-revision real-browser cleanup observation remains a separate acceptance action, together with broader packaging/native/independent acceptance. No TODO, lifecycle, shared entry or global generated artifact changes accompany it.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
