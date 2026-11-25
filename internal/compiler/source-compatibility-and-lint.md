# Shared sources and compiler lint

This page projects the [source-compatibility criterion](../../spec/contracts/C-COMPILER-FOUNDATION-0001.yaml) and [lint contract](../../spec/contracts/C-COMPILER-LINT-0001.yaml). Their [independent cases](../../spec/tests/T-COMPILER-LINT-0001.yaml) own the expected diagnostic and migration results. This page adds no language restrictions.

## One authored source

Adapter execution and compilation consume the same migrated component source and transitive authored helpers. Record the actual entrypoints, resolution configuration and per-file content digests. Checking only a root `.proto.ts` does not detect a substituted helper. Target-specific implementations of declared atomic host primitives or externs remain explicit target bindings; they cannot execute an entire prototype in place of compiler lowering.

The language is still Proto, authored in valid TS. An Adapter's ability to run JavaScript does not admit arbitrary JavaScript into that language. A necessary migration updates the common source once. Upstream owns official source changes and supplies verified migration tooling for registered consumers; it does not ask consumers to maintain a second compiler-specific implementation.

Both paths execute independently specified behavior traces. Comparing their observations helps locate drift, but matching wrong results fails the independent expectation. Historical Adapter output is not the oracle.

## Analysis result

The compiler, lint CLI and editor integration prepare the same source and project through `createProtoProgram`. The source closure identifies the effective configuration, reached file bytes, module resolutions and existence probes. The analysis additionally identifies the selected target in `analysisConfigurationHash`. The [package guide](../../packages/compiler/README.md#shared-frontend-and-partial-lint) describes project discovery and explicit selection. The three result fields have distinct meanings:

| Situation | `sourceValid` | `analysisComplete` | `compilable` for the selected target |
| --- | --- | --- | --- |
| A language violation is established; source checks completed | `false` | `true` | `false` |
| Legal source fully analyzed; target lowering is missing | `true` | `true` | `false` |
| Analysis cannot finish and validity is undetermined | `null` | `false` | `false` |
| A violation is known but another source path remains unanalyzed | `false` | `false` | `false` |
| Source and target admission are complete, with all reached lowering and bindings | `true` | `true` | `true` |

An informational missing-capability diagnostic still prevents unsupported compilation. A restricted TS prelude helps reject undeclared members, but TS itself still accepts constructs such as a numeric condition. Missing Proto semantic checks must remain visible; an empty diagnostic list from a partial scanner is not a valid-source or backend-support certificate.

The initial stable language-rule identities are `proto/explicit-bool-condition`, `proto/no-implicit-coercion`, `proto/text-api`, `proto/pure-derivation` and `proto/no-capability-assertion`. The lint contract defines their boundaries, positive/negative examples and criterion references. These names describe obligations, not a claim that all five are implemented.

Do not infer new bans from old parser failures. Declarations through legal helpers, defined Context-key lifetimes, admitted equality operations and style expressions require semantic analysis of their actual bindings and contracts. The old parser's rejection or a hard analysis limit does not settle validity.

## Migrations and versions

Publish source preconditions and behavioral scope with each automatic fix. Verify its result and idempotence, and refuse changed inputs rather than overwriting another edit. A coercion or Unicode rewrite can change behavior; when its safe preconditions are not established, report the migration work instead of applying a guessed fix. A capability assertion cannot be repaired by inventing another assertion or declaration.

Upstream still owns completing and verifying every required official and registered-consumer migration. It must establish the safe transformation/preconditions or complete the concrete source migration with explicit semantic decisions, then deliver the verified tooling. Lack of a general autofix is unfinished upstream work, not permission to abandon migration or require the consumer to maintain a second source.

Version the language, rules and compiler separately. A published rule-set change that narrows accepted source is breaking and carries migration notes. Implementing an already legal capability improves coverage without redefining the source language. Correcting detection of an existing violation retains that distinction and records newly surfaced diagnostics.

## Inventory and delivery

Keep the entire official-library and registered-consumer destination visible, including missing and unrun entries. Track source files, component entrypoints, semantic operations and target profiles separately. Newly registered source may increase the denominator and lower a percentage without being a regression in an already delivered capability. Regression gates protect actual delivered source/target capabilities and retain source mappings through migration.

[Shenko's intake](https://github.com/Proto-UI/Proto-UI/pull/1915#issuecomment-7170144913) reports 204 upstream files plus two consumer prototypes at its historical snapshot. That is a requested scope awaiting a verified manifest, not 206 independent compilation successes or a current inventory of every official prototype. Complete final acceptance still requires the full governed scope.

The contract and test entities remain draft. Their full analysis, editor/CLI parity and migration/inventory routes are recorded as missing. Bounded implementation increments must attach their actual subset evidence without converting those complete routes into unsupported passes.
