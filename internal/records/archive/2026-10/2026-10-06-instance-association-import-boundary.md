# Keep the framework association adapter helper outside the sitewide WC bridge

Agent: dot. ModelTrace: not measured (owner-authorized exemption).

## Actual failure

The 309-page production build based on Finf `689c5614` completed, then its import-graph gate rejected old Header/Homepage/Search/Copy/Typography consumers. The actual graph placed `adapter-base/src/host/instance-associations.ts` in the site-shadcn-controls chunk (222 rendered bytes). This leaf has no imports, but its runtime root-barrel re-export and the site's broad Base manual chunking made it part of the shared WC startup closure. Only React, Vue and Vue 2 call it to sanitize custom getProps results; WC already excludes the reserved key through its own props path. Small byte size does not waive importer ownership.

## Real boundary repair

- Keep the helper implementation and behavior; expose its exact internal subpath instead of re-exporting it from the Base runtime root.
- The three framework Adapters import that internal leaf directly.
- That exact leaf is excluded from the sitewide Base manual chunk assignment. No Adapter allowlist entry is added or widened.
- Public package builds compile every declared non-wildcard JavaScript export source root, including a leaf deliberately absent from its barrel. Merely adding package exports without producing real dist files would be invalid. Missing source and traversal fail before build; wildcard behavior is unchanged.
- A separate exact entry declaration recognizes the existing #808 Bootstrap state-controls four-runtime demo. Source inspection confirms that it uses the reviewed demo-renderer and lazy framework routes. Copied paths and eager framework imports are still rejected. No filename-prefix exemption is added.

## Executed evidence

- Actual repaired production build: 309 pages in 29.11 seconds.
- Actual resulting production graph: PASS. The helper is now in its own instance-associations lazy chunk; its only three importer modules are React/Vue/Vue2 adapt.ts, and the Base index has no edge to it.
- Graph gate: 392 tests pass, including keeping this helper forbidden in the sitewide bridge and exact Bootstrap/copy/eager-framework controls.
- Public export-root/build planning: 6 tests pass; the new fixture really invokes tsc and JavaScript import smoke for an unbarrelled dist leaf.
- Real public build: all 39 dependency packages for the three framework Adapters pass output validation and JavaScript import smoke. Direct compiled helper behavior and all three compiled Adapter factory imports also pass.
- Real Label Adapter source fixtures: React 4, Vue 3, Vue2 3 tests pass.
- Workspace types pass; git diff --check passes.

The original red graph and the repaired graph are preserved in the candidate handoff with SHA-256 digests. An initial local package build lacked links for new workspace packages and failed; the corrected temporary workspace links then passed all 39 builds. The initial local Astro attempt tried its default telemetry config outside the workspace; the build was rerun with telemetry disabled and an empty temporary HOME. No private credentials or new toolchain were used. An initial ad-hoc dist assertion guessed factory names incorrectly; correct public createReactAdapter/createVueAdapter/createVue2Adapter exports were subsequently checked against source and passed.

This is import/build ownership evidence, not UI pixel or native material acceptance. Finf's final integrated head must rebuild and check its own graph.
