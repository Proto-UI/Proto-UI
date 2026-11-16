# Explicit linking of independently compiled DOM libraries

This document describes the bounded `proto-ui.compiler-library` and `proto-ui.compiler-link` version 1 formats. The corresponding draft contract is `C-COMPILER-ARTIFACT-LINKING-0001`. It does not promote a compiler profile or claim that a runtime Adapter and a compiled component share a transport.

## Why a linker is necessary

A source declaration is nominal. Its name is diagnostic, and two private declarations remain distinct even when their source spelling and configuration match. A separate compilation emits its own declaration object and its own transport modules. Copying an equal filename into two package directories does not preserve JavaScript reference identity.

The project output API solves sharing inside one project generation. A library link contract makes sharing between independently compiled generations explicit:

- A library exports a reached declaration by its canonical source binding ID, such as `contracts.ts#VALUE`, under a public symbol.
- An importing library marks its checked local declaration binding as an external obligation on that library/public symbol. Its local source declaration supplies the expected kind and value/configuration contract; it no longer allocates a distinct identity. This is an explicit compilation/link option, never an inference from a name, source path, or equal bytes.
- A library may re-export an imported declaration under another public symbol. Following re-exports must reach exactly one actual owner. Cycles and missing owners are link errors.
- All unmarked declarations remain private to their library. An output directory, debug name, hash, or package-like string is not a process-global identity key.

Authored source import aliases and re-exports already resolve to a canonical declaration in the source graph. The library contract uses that resolved ID, which the library manifest exposes for inspection. This version does not add a TypeScript package resolver or execute a declaration factory while compiling.

## Public API flow

Each library runs `compileProject` independently. `prepareCompilerLibrary` receives that successful generation and its explicit boundary:

```ts
const provider = prepareCompilerLibrary(providerGeneration, {
  id: '@example/provider',
  sourcePaths: { 'provider.proto.ts': 'Provider.tsx' },
  exports: { Selection: 'contracts.ts#SELECTION' },
});
const consumer = prepareCompilerLibrary(consumerGeneration, {
  id: '@example/consumer',
  sourcePaths: { 'consumer.proto.ts': 'Consumer.tsx' },
  imports: {
    'selection.ts#LOCAL_SELECTION': {
      library: '@example/provider',
      export: 'Selection',
    },
  },
});
```

All these APIs return a checked `CompileResult`. Successful prepared values can be published with `writeCompilerLibrary` and recovered in another build with `readCompilerLibrary`. Reading requires the complete artifact directory, including `compiler-library.json`; it does not need the source project or compiler AST.

`linkCompilerLibraries` returns the final artifact set and entry paths. `writeLinkedCompilerLibraries` publishes that set into a fresh directory. Its optional `directories` map chooses ordinary package directories, such as `provider` and `consumer`; otherwise the linker selects stable private directories from explicit library IDs. A React application imports `CompiledComponent` from `provider/Provider.tsx` or `consumer/Consumer.tsx`. Vue applications import the generated component options, and Web Component applications use the generated `register` export. Public declaration objects are ordinary named exports from each library's `proto-declarations.ts`.

One output is one explicit link realm. Independently created link outputs remain separate unless a later build links the original library artifacts together. This is build-time linking, not a global process registry or a hot-load module federation protocol.

## ABI and target boundary

Version 1 supports the React DOM, Vue 3, Vue 2, and Web Component source profiles and their existing DOM SSR variants. One link uses one target profile. Runtime backed React and non-JavaScript native backends must reject this format explicitly.

Nominal contracts cover Context keys, accessibility object references, Anatomy families, Focus Scope keys, and Focus Roving keys. Context value schemas compare structurally, including optional fields and union alternatives. Static declaration configuration compares exactly after deterministic object-key normalization; array order and signed zero remain significant. Debug names are not identity.

The linker creates one explicitly scoped transport/support realm per output. Known identity-bearing support modules use named, versioned ABI records. Equal ABI names require equal versions and implementation fingerprints. This version deliberately rejects an unreviewed implementation change even when a maintainer expects it to be source compatible. Legacy interaction support and version 2 ownership support cannot silently coexist as two realms in one link.

Version 2 native support uses separate reached ownership modules for ordinary logical ownership, focus, boundary arbitration, overlays, hit claims and tables. The linker shares each reached module under its own ABI. Plan-specific native/module helpers remain library-local and import those shared ownership modules normally. The static dependency closure of a shared module is copied with its relative layout; it may not own private declaration factories.

Reached ControlLabel support adds the explicit `proto-ui.dom-control-label` version 1 host ABI. Its stable helper imports a stable type-only module, so two components with different support plans never make the shared host depend on either component's private factory. App-created ControlLabel refs retain their published same-realm association ABI; they are distinct from the source-declared Context, Anatomy and Focus identities governed by library import/export contracts.

Per-component observation or props-update policy remains in that component's provenance. Different policies may coexist when they use the same compatible support ABI; policy equality is not a prerequisite for declaration identity.

## Output and failure behavior

The preparation API returns a serializable library with all ordinary source artifacts and a content-bound manifest. Exported declarations also have an ordinary `proto-declarations.ts` named-export surface. An unresolved external declaration throws when its unlinked module is evaluated, so accidentally importing an unlinked library cannot silently allocate a replacement identity.

The linker preserves component source and source maps. It replaces only explicit external declarations and known shared-support modules with normal ESM re-exports to their canonical owner. It does not interpret IR at runtime, instantiate a global registry, or require a special component launcher.

Preparation, validation, and linking finish before publication. Publication uses the existing create-only artifact writer, including its conflict detection and cleanup behavior. Library readers validate manifests, paths, file kinds and content hashes before linking; edited or incompatible inputs fail visibly. Linked provenance retains original artifact hashes and separately records the actual linked files and canonical owners, instead of presenting original hashes as hashes of rewritten forwarding modules.

## Existing Vue 2 artifact migration

The separate `migrate-native-support` command retains its explicit trusted input-manifest hashes and create-only publication. Current version 2 outputs record the support plan's version, ID and features in provenance. Migration reconstructs that plan and compares every expected helper path, kind and byte before sharing any registry. Editing the metadata or resealing modified helper bytes cannot establish compatibility.

Recognized historical full version 1 support forwards its original component import paths to the complete version 2 host ABI. The recognized version 1 Text and Image helpers have different constructor options from version 2; their verified host code is retained and only their imported ownership module forwards to the current logical/physical and focus registries. Compatibility does not depend on pretending those factory signatures are interchangeable. Full historical inputs keep the complete host closure because their original component bodies are preserved and are not recompiled under a narrower support plan.

There is one explicit removed-protocol boundary: an old component that calls the historical native `asTransition` factory must be recompiled from its authored source. Migration resolves the called member against the verified old support declaration before making this decision. An ordinary object method with the same name is allowed, as is an unused historical declaration. Rejection happens before any output file is opened; the command preserves the original component, map, support and provenance bytes. Newly emitted support has no Transition business machine.

The fixed published IR6 full factories, with and without ControlLabel, are recognized by their separately captured exact hashes. The Vue2 association boundary is independently verified and retained. Migration can compose these old ControlLabel components with current components using one current host pairing and ownership ABI; the unchanged old component code still imports its original paths through ordinary forwarding modules.

Migration preserves each old component's observation behavior. In particular, published IR6 Vue2 components rely on a child update to refresh a changed association; changing only `instanceAssociations` in a component with no slot children may not trigger that update. The current generator observes this host input independently. Recompile an old component to receive that observation fix: changing a shared helper cannot add a missing framework subscription inside an unchanged component. The historical/current composition test uses the actual slot-based published boundary, and a separate current/current composition checks association-only updates without slots.

Historical Context scope bytes are retained separately from the current implementation and accepted only at their recorded hash. Migration upgrades the transport while leaving each input's nominal key factory private. Intentional cross-library declaration sharing uses the explicit library linker above. Historical IR versions 5 and 6 provenance is accepted for these verified source artifacts; this does not admit old IR objects into the current compiler.

The migration tests retain the original CLI capture. Current CLI outputs are independently produced, linked through the production migration command and loaded by ordinary filesystem imports. Negative controls now duplicate the specific boundary, modal or physical ownership registry while leaving unrelated ownership shared, so they continue to detect the actual failure mechanism after factories have become plan-specific.

`native-support-published-captures.json` adds immutable captures from the fixed `ce562749` and `08d8f9d9` compiler commits. Its source, process result, component, source map, support and manifest are original CLI outputs; content is deduplicated only by SHA256. The corresponding test rejects the real legacy Transition output and executes both old-Label/current-target and current-Label/old-target combinations through an ordinary Vue2 app, including association rebinding, unmount and remount. These remain simulated-DOM observations, not trusted browser-input evidence.

## Required consumer evidence

Use the public prepare/write/read/link APIs, then import the final generated components normally. Do not merge supporting files in a test helper. Cover independent compilation, explicit sharing, private same-name isolation, source-level aliases, cross-library re-exports, mixed component policies, incompatible schemas/ABIs, absent owners, cycles, tampering, repeated mount and terminal cleanup. Simulated DOM execution is useful but remains distinct from native-browser or non-DOM acceptance.
