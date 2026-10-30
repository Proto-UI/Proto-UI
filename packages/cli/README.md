# @proto.ui/cli

Proto UI command line tooling for initialization, component facade generation, and style presets.

## Purpose

Provides command line tooling for initializing Proto UI workspaces and generating framework integration assets.

## Package Role

CLI package used by applications and maintainers to scaffold Proto UI configuration and generated files.

## Install

```bash
npm install @proto.ui/cli@0.3.0-alpha.1
```

## Authored hook state selectors

Nested child handles remain under their explicit result or projected paths rather than being flattened. Literal `getState` lookups and detached lookup aliases preserve the same provenance.

A call that may write to a source-backed handle container withdraws its cached member provenance, including through aliases, so subsequent reads remain unresolved instead of certifying stale states. A proven `Object.assign` copy retains each copied member's producer identity; an uncertain or mixed-producer source, or any binding named `Object`, prevents that builtin-copy proof. Authored `defineAsHook` calls evaluate their arguments but do not pass them to setup, so argument evaluation still updates provenance without treating those calls as container escapes.

Container mutations belong to their authored setup owner, not to the cached producer declaration. Distinct setups keep independent member versions, including referenced setup functions and canonical factories reached through Core re-exports; ordinary lexical helpers inherit their setup's versions.

Receiver method calls conservatively withdraw affected container members unless every possible evaluated callee is a proven projected accessor or `getState` lookup. The callee is captured before argument effects; a known return value alone does not prove that a call left its receiver unchanged.

Child registrations are counted in declaration order for direct hook-call initializers in identifier-named variable declarations. Complex containing statements retain whole-statement collision checks rather than inferring execution order from syntax traversal. Independent setup functions do not inherit registrations from an enclosing switch selector.

Package resolution for an imported hook follows the manifest's own conditional-export key order among conditions active for the importer: configured `customConditions` plus `default`, `node` and the importer's ESM/CJS format under Node16/NodeNext, or the module setting otherwise. TypeScript's resolver receives that same Node16/NodeNext importer mode, so JavaScript-only packages select the runtime's `import` or `require` implementation. Declaration-only `types` entries are never runtime answers, and an explicit `null` target rejects that path. Resolution reads inherited compiler options without enumerating the project's input files; this does not change normal compilation or type-check inputs.

For packages without `exports`, Node16/NodeNext legacy entry resolution follows `main`, not the bundler-only `module` field.

Subpath export patterns follow Node's selection rules: the longest prefix before `*` wins, with total key length breaking equal-prefix ties. Only single-asterisk patterns with non-overlapping prefix and suffix matches qualify. A selected `null` target or an inactive condition rejects the subpath; a less specific pattern cannot reopen it. These checks keep certified hook provenance aligned with the implementation selected by native package resolution.

Type-only `satisfies` wrappers and stable shorthand configuration names preserve producer identity. Setup literals follow their lexical bindings, including successive synchronous helper calls with different arguments. Object destructuring in `projectHandle` and numeric tuple reads retain declaration provenance; numeric record keys alone do not prove iterable destructuring.

This is a bounded static analysis, not a JavaScript interpreter. Unproved setup captures remain open, so the coverage scanner reports unresolved reads instead of discarding optional Rules as unreachable. Bodyless declarations do not prove executable setup or helper captures. Async/generator factories cannot prove a returned holder, and mutations or escapes invalidate provider-member proofs. Finite literal loops preserve captured token values and row pairing; consumed style handles follow sequential assignments while retaining conditional alternatives.

Loop-assigned literal bindings, parameter initialization with unproved effects, and possible computed configuration overwrites remain unresolved. Unproved hook names are not indexed as named child captures.

Stable aliases of the setup State facade retain declaration provenance. Extracted constructor functions, unanalysed runtime uses of a State facade or its owning Def, and constructor-member replacement leave capture open; handles proven before that boundary remain known. Stable Def aliases and definition arguments followed into proven synchronous helpers preserve their identity. Conflicting reachable constructors for the same state name remain unresolved rather than selecting the last source branch or proving the member absent. Binding declarations, static property names, and type-only syntax do not count as runtime facade uses.

Logical and compound member writes preserve the evaluated receiver across right-hand-side effects and rebinding. Logical assignments use state-handle object truthiness only when every reachable member is proven, including local receiver branches with no recognized member; a legacy coverage label alone is not member-existence proof. Other compound results remain unproved. Destructured conditional members keep separate selectors, while opaque writes retain exposure uncertainty through aliases instead of certifying stale handles or silently treating exposed state as internal.

Source-backed member writes follow the actual receiver object, including nested projected paths: aliases of the same object observe the write, a right-hand side that replaces the receiver keeps its evaluated identity, and conditional receivers keep their alternatives. A write the analysis cannot order (deferred, conditional, dynamic key or unproven right side) marks the affected members unresolved rather than keeping a stale selector.

Object-projection versions from the same container are coalesced only when their proof-relevant content matches; nested object identities remain distinct. Conditional writes retain the unwritten alternative. Member writes and call withdrawals reach every current version of the container, and a call's receiver is read before the arguments are evaluated, so an argument that rebinds a name cannot change what the callee denoted. A member of a producer call is resolved across every current version: any unproven alternative prevents certification from an older local member map. The admitted `getState` accessor is an immutable capture of the projected state handles, so writing to the container does not change the accessor's identity. Replacing that accessor changes what later calls resolve; the analysis does not recover the projection's original accessor from a stale result.

Projector returns are admitted as proof only when the return expression is effect-free: reads of the projection's own `getState`, `getMethod`, `getAsHook` and `getAsHookHandle` accessors count as reads, but calls the analysis cannot classify as these accessors, or writes visible in a reachable branch, keep the projection unresolved.

Within those admitted projector bodies, `var` remains function-scoped across nested blocks and into a conditional's sole continuing branch; an initializer-free redeclaration preserves its existing binding. Block-scoped lexical and function declarations shadow from block entry and are restored when their block exits, so reads before declaration cannot inherit an outer proof. A join with both branches continuing remains unresolved rather than retaining an arbitrary pre-branch binding.

Default-imported names are resolved through their source module rather than the built-in hook-name table. A matching local spelling cannot certify an unrelated default export; a source-proven default producer still retains its declared state selectors. Rejected authored projections cannot regain state proof from a built-in hook's spelling. Returned object literals containing getters, setters or method declarations do not prove a complete public projection, including through local aliases and spreads. Ordinary alias or parameter rebinding invalidates the previous holder without losing the source declaration itself.

## Opt-in Shadow style companion

The source CLI generates the companion consumed by the Web Component Adapter's explicit experimental `shadow: { mode: 'open', presentation: 'split', styleArtifact }` profile. Pass the imported value as `styleArtifact`; generating it alone does not select that profile. Existing boolean `shadow` options remain unchanged. See the [Adapter guide](../adapters/web-component/README.md) for admitted prototypes, recipes and customization limits. Installing an already-published CLI version does not imply that it includes this source change.

```bash
proto-ui shadcn --styles-dir ./src/styles \
  --shadow-out ./src/styles/proto-ui-shadow-style.generated.js

# The same option is available for proto-ui brutalist and source scanning:
proto-ui tokens --input ./proto-ui/prototypes \
  --out ./src/styles/proto-ui-tokens.generated.css \
  --shadow-out ./src/styles/proto-ui-shadow-style.generated.js
```

The command generates document CSS and a same-closure ESM `.js`/`.d.ts` pair. The companion has one named export:

```js
import { protoShadowStyleArtifact } from './styles/proto-ui-shadow-style.generated.js';
```

Treat that companion as generated, trusted same-source output. Its internal receipts detect stale or accidental edits but do not authenticate adversarial or independently authored CSS. Do not hand-edit declarations or recompute receipts; regenerate document CSS and the companion together. The consuming Adapter performs additional fail-closed checks only for the bounded recipes that cross the split boundary.

It is a frozen, synchronous version-1 value with `kind`, `version`, `environment`, and `cssText`; no DOM or runtime renderer is required to import it. The declaration preserves literal ABI types and readonly fields. Use it as ESM (for direct Node imports, place it in a package with `"type": "module"`). No Promise, lazy loader, JSON import, or package-root builder API is introduced.

`--shadow-out` requires an explicit `.js` path relative to the working directory, not to `--styles-dir`; its declaration replaces that suffix with `.d.ts`. Presets still generate their theme and entry CSS. Without the option, no companion is written; `init` and `add` do not generate one or select a split Adapter.

Source scanning separates directly proven Template-only style occurrences from Root recipes. Those tokens receive ordinary Shadow-local CSS; shared Root uses, opaque helpers and unclassified handles remain subject to conservative Root preflight. Preset and flat token inputs remain conservative because they carry no target provenance. Template CSS membership never grants runtime Root admission, and generating that CSS does not enable automatic WC Template-handle projection.

All target paths and generated content are checked before replacing any file. Targets must be distinct regular files or new paths, not file symlinks or directories; path collisions are conservatively case-folded across platforms. The complete set is staged first. Caught replacement failures attempt to restore old files and remove new outputs; if recovery fails, the error lists retained backup directories. Empty output parent directories may remain after failure. This is not an atomic multi-file transaction for crashes or concurrent writers.

Rerun the same command after changing tokens; keep CSS, JavaScript and declarations together. There is no runtime generation-digest check. Generating a preset closure does not establish that every prototype or Root token in it is split-compatible. Theme custom properties remain document/host-owned and inherit into Shadow roots.

Family projections use a finite physical vocabulary, not arbitrary Tailwind or CSS admission. The source collector follows each family's actual Base dependencies; regenerate the presets after changing a recipe. Unsupported tokens remain explicit diagnostics rather than silently disappearing. The vocabulary includes source-bound table layout, fractional spacing, directional corners, complete Bootstrap gradient/shadow recipes and separate text wrapping, foreground and font-size intents. The scoped border-box baseline has zero selector specificity so an authored `box-content` token can override it without resetting unrelated host elements.

Successful token generation establishes CSS translation only. It does not establish native layout, input, material effects, accessibility or split-Root compatibility; those require the corresponding real consumer evidence.

## Internal Structure

- `src/commands/`
- `src/config/`
- `src/generated/`
- `src/index.ts`
- `src/legacy/`
- `src/registry/`
- `src/services/`
- `src/utils/`

## Related Internal Packages

- None

## License

MIT
