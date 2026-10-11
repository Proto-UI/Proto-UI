# Carousel and Resizable public type contracts

Date: 2026-10-10 UTC. Follow-up to the Calendar-first public contract repair. Baseline `efd7f3d9`. This slice is declaration-only and does not claim feature, visual, native, compiled or packed acceptance.

- Eight atoms across five families now retain explicit public Props/Exposes domains. Base setup signatures and authored AsHook capture contracts are typed; the four design-language wrappers use explicit `definePrototype<Props, Exposes>` parameters.
- Root and Slide collection APIs remain included, rather than silently dropping inherited public members. Carousel's exposed `slideCount` aliases the authored `count` state; the collection's authored `collectionCount` remains distinct. Carousel navigation's Button states are nested under `getAsHookHandle('as-button')`, not flattened into the parent.
- Resizable declares its actual numeric ratio/size/value facts and the actual handle's disabled/focus-visible exposure. It does not invent an imperative `focusSelf` member absent from the source.
- The forty atom/family consumer checks contain 115 negative controls, numeric/boolean method and state witnesses, and React event payload projection checks. Events use the Adapter event-props surface; they are not ordinary methods in `getExposes()` and are not portable business props.
- Two runtime tests instantiate all eight authored hooks and compare exact public exposed-key sets and captured state-key sets, including nested Button ownership. An initial fixture wrongly counted events as `getExposes()` methods; it was corrected to the actual Adapter event boundary, with independent event-prop type checks added instead.

## Actual verification

- The same final consumer fixture, with imports redirected to the earlier frozen source, produced 125 TypeScript diagnostics, including 51 unused expected-error directives. The current formatted source passes `tsc --noEmit -p packages/prototypes/base/test/tsconfig.carousel-resizable-public.json` with no diagnostics.
- Capture/expose witnesses and existing Group C composition/projection suites passed 36/36 across three files.
- TypeScript ES2022/ESNext transpilation with comments removed produced identical normalized JavaScript for all ten implementation entry files before/after this slice. Existing styles and runtime algorithms are unchanged.
- No shared root index, registry, package manifest, host, Compiler or CSS collector was modified. Existing family/root `export *` entries carry the new local public type exports. Scoped checks are not workspace/package/native acceptance.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
