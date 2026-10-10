# Fifth quality source: additional real type/build failures

This is a post-freeze verification record, not a source repair or an acceptance admission. The tested local proof is `60e94b0ebbf0ef94a1fa41d6f954a6c7f0bfd062`, whose source remains `c2cbb8d6fce71e949f84f0358189184783505989` / tree `21deede869afddec39131b65af63e593460193a4`. The three demo helpers and the positioning factory are unchanged from published `5d96eb345ecc6e5e4b4831189d384f03a56d24c9`.

## Official aggregate type command

`corepack pnpm@10.32.1 -s check:types` performs style generation, workspace TypeScript, and Astro documentation checking. The existing workspace pass excludes `apps/www` and did not establish this aggregate result.

A local first invocation stopped at Astro telemetry configuration because `/home/agent/.config/astro` did not exist. Repeating the same command with Astro's supported `ASTRO_TELEMETRY_DISABLED=1` reached diagnostics without changing source or sandbox permissions. Its workspace phase passed and Astro failed with five real source diagnostics:

- `form-primitives-demo.shared.ts:10:24`: TS2339, `DemoNode['children']` includes a text variant without that property.
- `numeric-input-demo.shared.ts:9:24`: the same TS2339.
- `numeric-input-demo.shared.ts:69:11`: TS2322, spreading the broadly typed union does not prove that `ref` belongs to a non-text node.
- `range-readout-demo.shared.ts:3:50`: the same TS2339.
- `range-readout-demo.shared.ts:33:11`: the same TS2322 for the broadly typed union.

The run examined 793 files and emitted seven errors plus ten hints. The other two errors are local checkout omissions of `shared/links.json`, referenced by `SocialIcons.astro` and `site-native-links.browser.test.ts`. The file is tracked with skip-worktree status, is absent locally, and exists at the tested Git revision as blob `a2238e88af84628b2e0f4d5ea54e52c667c30529`. Those two observations do not imply missing repository source; the original log is retained. The five union errors are genuine and are not attributed to checkout setup.

## Public declaration builder

`node scripts/build/public-packages.mjs --package @proto.ui/module-positioning` also fails on this source. With this worktree's own built dependency outputs, the sole remaining diagnostic is:

`packages/modules/positioning/src/web/input-origin-anchor.ts(13,17): TS4058: Return type of exported function has or is using name 'inputOriginAnchorBrand' from external module core/dist/context-menu-input but cannot be named.`

The dependency packages `types`, `core`, `module-base`, `module-expose`, and `module-anatomy` built before that failure. Initial local attempts had stale primary-worktree dependency symlinks and additional missing-export diagnostics. Their logs remain preserved; the final coherent dependency setup reproduces the official declaration failure precisely. No full public-package success is claimed.

## Disposition

The frozen implementation remains unchanged. Independently scoped follow-up fixes will express the demo helper's actual discriminated Proto node type and the host factory's public return type, retaining the opaque anchor brand and runtime semantics. Compiler/IR, Focus, and Runtime ownership are not part of these repairs.

The packet retains all eight Form/CheckboxGroup selector failures and Calendar selector collection gaps as well. These additional type/build failures prevent a claim of full build, full type-check, style acceptance, or readiness to merge. All five historical closeouts and the 5 done / 63 in-progress ledger remain unchanged.

Local logs and their byte lengths/SHA-256 digests are listed in the current publication packet. No local log is represented as an uploaded GitHub artifact.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
