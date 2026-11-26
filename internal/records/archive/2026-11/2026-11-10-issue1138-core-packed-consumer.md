# Issue 1138: isolated core package consumer evidence

Date: 2026-11-10. Inspected source: `0607c6c5c386b8a932ab850e92a8873b2121dc45`, assigned branch `fix/release03-thirty-issue-1138-sol-20261110`.

This is an authored, unexecuted consumer producer and a conditional source repair proposal. It contains no reproduced product failure, passing consumer result, applied production repair, CI/DCO verdict, independent acceptance or Issue closure. Main owns execution and production-patch admission.

## Original conditions and retained source keys

| Original child key | Original parent key / source | Complete condition | State and remaining acceptance |
| --- | --- | --- | --- |
| `issue.1138.001` | `issue.1088.009`; PR887 `Current native failure ownership` | Repair governed source failures and native consumer evidence（修复受治源失败与原生消费者证据） | Open. Attribute genuine current failures, repair their governed owner, collect applicable original native/consumer evidence, preserve historical head/source identity, then obtain actual CI/DCO, independent review and lawful integration. This producer addresses one package boundary only. |
| `issue.1138.002` | `issue.1088.010`; PR887 `Current native repair finalization` | Validate current package graph and packed consumers（验证当前包图与打包消费者） | Open. Run the current graph/export build and actual packed consumers. A core-only result cannot stand for the whole package graph, all adapters or historical native surfaces. |

The source keys are retained in `internal/governance/release-0.3-source-ledger.json`. PR887 body lines 128–134 preserve both source headings and original English conditions. No additional historical session identifier has been recovered or invented here. The dated Issue1138 deferral and parent1088 historical-evidence warning remain intact; current train governance classifies release prerequisites per criterion. Neither a historical deferral nor a current prerequisite repair disposes of the other original conditions.

The live Issue read returned OPEN, zero assignees and one comment. A separate paginated comments read delivered that one comment, dated 2026-11-06, in full. No claim/comment/checkbox or other GitHub mutation was made.

## Authority and concrete hypothesis

`internal/governance/package-surface-map.md` requires public native ESM and declaration artifacts and identifies core as an author-facing API package and types as shared public protocol types. `C-CONTEXT-0003` is **draft**, since 0.1.0, and depends on draft `C-CONTEXT-0001`. Its criteria A/B/C describe reference-identity keys, diagnostic-only debug names and the existing core factory. This work proposes no semantic or lifecycle change.

[INFERENCE] A Prototype Author installing only core's declared production closure may be unable to compile its public declarations. `packages/core/package.json` lists `@proto.ui/types` only in `devDependencies` and `protoUi.buildDependencies`. Core's public `createContextKey<T>()` signature imports `ContextKey` and `JsonObject` from that package. The canonical builder uses `protoUi.buildDependencies` to order builds; it does not promote that metadata into npm dependencies. `createPublishManifest()` copies the source manifest, deletes `devDependencies`, and rewrites only already-declared production, peer and optional workspace edges. Genuine emitted declarations and actual installed closure still require Main's before run.

The existing React consumer starts at CLI, adapter and prototype roots. Other declared edges can install types in that aggregate closure, so its success would not establish that a core-only author receives everything core's own declarations need. The dated `2026-10-09-finf-main-ca28-package-integration.md` results remain bound to their historical source; they are not evidence for this candidate.

Main has reserved `packages/core/package.json` and only the `packages/core` lock importer as **unapplied** candidate paths. Production edits require genuine before attribution. If confirmed, the proposed patch promotes the unchanged `workspace:*` edge into dependencies, removes the now-redundant explicit build-dependency metadata, and changes only that importer role from dev to production. The existing `link:../types`, versions, resolution bytes and all other importers stay unchanged. Main holds the prepared patch outside tracked source. Existing Focus/Compiler/IR owners retain their implementation paths.

## Consumer producer and observable outcomes

Run `scripts/release/consumer-smoke-core.mjs` against actual canonical packed output. It begins with core, follows only staged declared dependencies, and installs just that closure from local tarballs with npm offline and lifecycle scripts disabled. The fixture itself imports only `@proto.ui/core`. No undeclared types package is supplied to make the before case pass. All installation artifacts and logs are retained outside the repository.

The producer binds actual source/head hashes, pack-manifest and tarball hashes, staged/installed dist byte inventories, installed lock and manifest hashes, tool identity, individual exit statuses/signals, emitted `context.d.ts`, and resolved declaration paths. Resolved declarations must belong to the installed consumer or the actual TypeScript standard library. A missing dependency in the staged manifest cannot fall back to the registry or workspace sources. Command failure, timeout and setup errors stay failed; later controls remain unrun.

| Observation | Planned consumer assertion |
| --- | --- |
| Native ESM | Two public keys with the same debug name have different reference identities; output records both distinct keys. No TypeScript loader is used. |
| Valid NodeNext and Bundler | The JSON-shaped context factory compiles with strict mode, `skipLibCheck: false`, explicit files and no ambient type packages or workspace aliases. |
| Invalid NodeNext and Bundler | After both valid cases pass, a function-valued context shape must be rejected with TS2344 and no missing-module TS2307. |
| Injected missing-types NodeNext and Bundler | If the genuine closure includes types, a separate copy of the actual installed core bytes deliberately omits types. Both modes must fail with TS2307 naming `@proto.ui/types`. The real positive installation remains untouched. This is an injected control, not an independently observed product bug. |

A successful full repaired run therefore supplies seven consumer observations: one native ESM, two valid types, two invalid-type rejections and two injected missing-dependency rejections. A before failure should retain both actual valid-mode diagnostics; negative controls are not credited if the positive producer cannot run. If valid before declarations resolve without a declared types package, the runner permits that result and marks the injected missing-types control not applicable. Main must then withdraw the unnecessary dependency patch rather than manufacture a failure.

## Exact serial Main commands

The target initially contains metadata YAML links only. Main must first supply the existing package build/dependency links for this exact source; the child did not install anything. Existing TypeScript 5.9.3 CLI metadata was located under `/workspace/repo/node_modules/typescript`. That executable is a tooling input; product declarations must still resolve entirely from the isolated installation. Use a fresh short output name for every invocation: the consumer refuses to reuse its work directory. Preserve any failed build/consumer attempt before correcting prerequisites.

From the assigned worktree, with the single portfolio execution slot:

```sh
export PATH=/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin:/usr/local/bin:/usr/bin:/bin
node scripts/release/publish.mjs --pack --only @proto.ui/core,@proto.ui/types --out-dir /tmp/i1138-before-r1
node scripts/release/consumer-smoke-core.mjs --release-dir /tmp/i1138-before-r1 --work-dir /tmp/i1138-before-c1 --typescript /workspace/repo/node_modules/typescript/bin/tsc
```

Do not proceed from a failed packing command to a consumer of absent or stale output. First read the actual `receipt.json`, emitted declaration, installed lock/manifest and each valid-mode log. Only a matching product failure admits the separately prepared production patch. Bind the applied candidate to its real source head and hashes, then execute the identical producer against fresh outputs:

```sh
node scripts/release/publish.mjs --pack --only @proto.ui/core,@proto.ui/types --out-dir /tmp/i1138-after-r1
node scripts/release/consumer-smoke-core.mjs --release-dir /tmp/i1138-after-r1 --work-dir /tmp/i1138-after-c1 --typescript /workspace/repo/node_modules/typescript/bin/tsc
```

After source admission, the proportional existing checks are serial. The targeted native Node tests exercise canonical manifest construction, explicit export roots and strict relative-declaration consumers. Main owns formatting the authored files before final exact-source validation; this child did not run a formatter, syntax/import check, test or build.

```sh
corepack pnpm@10.32.1 check:package-manifests
node --test scripts/release/test/publish-manifest.test.mjs scripts/release/test/public-package-export-roots.test.mjs scripts/release/test/public-package-relative-specifiers.test.mjs
```

For original criterion `issue.1138.002`, retain current whole-graph results separately rather than treating the narrow core pack as their substitute:

```sh
corepack pnpm@10.32.1 build:packages
corepack pnpm@10.32.1 release:scan -- --json
corepack pnpm@10.32.1 release:smoke:react -- --keep --work-dir /tmp/i1138-react-c1
corepack pnpm@10.32.1 release:smoke:cli
```

Those existing aggregate consumers include their own installs/builds/host fixtures and must be scheduled with their actual prerequisites and source bindings. The CLI producer chooses its own temporary directory, emits bound delivery/native JSON records to stdout, preserves failed artifacts and removes its work directory after success; it has no keep/work-dir options. Main must retain its actual stdout records and account for that artifact-retention limit independently. These are planned commands, not executed results. Any failure remains attributed to its original owner and condition, including source frozen historical/native evidence that the narrow core case does not cover.

## Visual and integration boundary

This package dependency candidate has no rendered UI change. Its appropriate technical walkthrough is the actual staged production edge → installed package closure → emitted public type reference → strict consumer diagnostic/result. Planned before/after transitions are `{}` → `{ "@proto.ui/types": "<exact release version>" }`, core-only → declared core/types closure, and missing-module diagnostic → valid public context compilation. Main must fill that walkthrough from actual producer receipts; no screenshot of logs or invented browser journey is requested or counted. Original native/browser/paint conditions remain separately open where applicable.

Suggested evidence-only PR title: **Add isolated core package consumer evidence**. If Main genuinely confirms and admits the repair, revise to **Fix core declaration dependency closure**. Suggested body: “A core-only author may miss the shared types required by core's emitted declarations. Add an offline consumer of the canonical declared tarball closure, with strict NodeNext/Bundler and independent negative controls. Refs #1138; actual before/after receipts, CI/DCO and review determine repair acceptance. Both original Issue conditions and historical native evidence remain open until individually earned.”
