# Finf production material isolation and WC helper ownership

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Root cause and bounded repair

The previous `2026-10-08-finf-color-scheme-bundle-owner.md` preserved the complete 45-diagnostic production failure rather than declaring its single exact-module correction sufficient. This follow-on separates two actual causes:

1. `demo-renderer.ts` already loads `preview-material-scene.ts` with dynamic `import()` only for Liquid Glass consumers. The scene imports the opt-in `@proto.ui/adapter-base/web-material` entry. However, `websiteManualChunk` grouped every Base/WC module into `site-shadcn-controls`, placing the material program/source/shader in the eager Website control chunk and defeating that authored boundary. Excluding only `packages/adapters/base/src/material/` from this forced grouping lets Rollup retain the existing lazy scene. No new loader, renderer lifecycle or runtime API is introduced.
2. The exact reviewed WC helper set lagged the existing public Adapter implementation. Add precisely the Base portal-direction helper plus WC focus-scope-targets, keyed-meta-sources, portal-conceal, portal-mount and ten Shadow profile/effects/resource/style helpers listed in the guard. Source-AST traversal from the actual public WC index verifies every newly accepted module has a static owning path. No material/shader module is added to the allowlist; no directory admission, foreign-caller permission or assertion relaxation is made.

The retry-URL virtual module's existing source-owner admission binds the complete Astro configuration digest. The three-line grouping repair initially causes four expected fail-closed consumer-wall errors. Rebind only `PROMOTION_FINF_RETRY_AUDIT_CONFIG_SHA256` from `a7947553aeba5d5efb4b5806326b833e8c31dd924d3555411099feb0b8c898e8` to the final configuration hash below; retain the same four source owners, both plugin digests, arbitrary-plugin rejection and dynamic-CSS checks. This does not reclassify a virtual module or expand plugin authority.

The material directory exclusion is a refusal to force eager grouping, not permission to execute a directory. The unchanged production guard still rejects any of those modules in an ordinary shell's static closure, regardless of how the dependency was chunked.

## Discriminating verification

All final checks use worktree-local workspace links and fixed Node 24.19.0 / pnpm 10.32.1 dependencies. The prior 45 production diagnostics were reproduced on a real build with the original guard and matched canonical CI exactly.

- New WC helper ownership controls: original limited guard 427 pass / 450 fail; exact helper admission restores all 877. Foreign static/dynamic importers through owner, bridge and renderer placements remain rejected.
- Final production suite: 969/969 pass, including all material source files, adjacent/sibling/child helper rejection, and a source-function mutation removing the material exclusion that reproduces eager grouping. The preexisting framework-only instance-associations exclusion is retained.
- Existing dynamic CSS / opaque style / stylesheet negative selection: 18/18 pass. This patch does not change their scanner or waive dynamic CSS.
- Retry virtual/config/plugin and dynamic CSS negative selection: 35/35 pass; complete consumer-wall validation passes both matrices after the exact config digest rebind.
- Workspace TypeScript passes without errors.
- Actual Website build completes 345 pages and the original production guard passes. The material implementation is in a single `isDynamicEntry: true` preview-material-scene chunk, dynamically reached by the renderer. No ordinary Website entry statically reaches that chunk.

On the real generated graph, in-memory mutations remain rejected: a static import of the material chunk (35 diagnostics); a foreign dynamic material importer (5); a foreign dynamic Shadow stylesheet-owner importer (5); and an adjacent unreviewed Shadow helper (45). These mutate only the test copy of the graph, never the built asset or accepted guard. The unchanged candidate graph has zero issues.

Graph SHA-256 from the verified candidate: `ae38e2febd04663cbcaef5663e9a329b4b232d683efdf0ce84e805a8344c39ae`. Astro config SHA-256: `428f9cbe0c5fe19f4d24a74afeebddcfcad0f00c929144df205a94c45e87f8ac`. Production guard SHA-256: `cad75df20c4811a519a2cca54edbd3fcb18250f90264c2494b705c01707aafa3`.

## Integration boundary

The earlier d0 run remains failed. This local production result is not a native screenshot, optical-material result or final integrated CI pass. The Glass candidate adds its own material/contact modules; it must rebuild and pass the same guard after these commits are combined. Source grouping and the exact helper list are independently reviewable, and no permissions, secrets, required CI policy, package ceilings or repository protections are changed.
