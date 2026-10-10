# Finf collection public contracts: source-only repair

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and observed loss

The authorized repair starts from `802da90ef79aeb9fd0ee9f3f74ff9a11f0cace8e` and changes only Tree, Message Scroller, Virtual List and Data Table public source contracts plus their four styled projections. It does not change runtime algorithms, styles, package exports, shared Core/Adapter contracts, catalog lifecycle or Finf acceptance status.

All four components previously declared their Base setup Exposes as `any`. Every styled wrapper used unconstrained `definePrototype`, yielding broad Props and `Record<string, unknown>` Exposes. Base equality alone therefore could not establish a usable typed public contract. Most authored hooks also defaulted to an empty state contract, while Tree Item's contract covered only five of its fifteen captured states.

## Repair

- Separate, exported subpath `types.ts` contracts cover every part's actual Props, Exposes and authored AsHook state frame. Base setup definitions and hooks bind those contracts, and all 68 styled part declarations carry explicit Props/Exposes generics.
- Tree and Data Table preserve Collection provider/item public exposes. Data Table Root preserves `getStructure`; cells/headers preserve Table's already-implemented `headers`, `rowSpan` and `columnSpan` props. Commands preserve Button's disabled prop, focus methods, state and outward click signal.
- Message Scroller and Virtual List viewports preserve Scroll Area's actual instance exposes. Message Scroller additionally declares finite end-follow/request-status domains and the zero-argument `jumpToEnd(): void` command. Virtual List methods return the existing `WindowedCollection` and `WindowSnapshot` contracts.
- An authored child's state is not flattened into its parent. Button and Scroll Area child handles are named under `asHooks`, accessed through `getAsHookHandle`. This repair does not invent parent `focusVisible`, `disabled` or `following` handles.
- Captured state names follow Runtime's `__stateName`, not expose aliases: Collection's `count` expose corresponds to `collectionCount`; Message Scroller's captured Scroll states retain `@scroll/verticalAtEnd`, `@scroll/endFollowState` and `@scroll/endFollowRequestStatus`.
- The internal `__collectionItem` registration is filtered by the Adapter and is deliberately absent from public Exposes. A first exact-key runtime assertion caught this potential over-declaration before the final contract was accepted.

## Verification

Pinned toolchain: Node `24.19.0`, pnpm `10.32.1`, existing linked dependencies; no new dependencies or external source execution.

- `packages/prototypes/base/test/finf-collections-public.types.ts`: independent positive consumer calls, incorrect Props, incorrect method arguments, missing instance keys, hidden metadata, state domains, nested-hook boundaries and signal payload tests for all 17 parts across Base plus shadcn/brutalist/bootstrap-2-3-2/liquid-glass. It checks `any` explicitly rather than only equality with Base.
- Baseline control: the same consumer compiled with its 20 implementation entry files supplied from `git show 802da90e:<path>` through a temporary TypeScript CompilerHost failed with 298 diagnostics, including 108 unused negative directives and 156 unknown-value diagnostics. No worktree source was reverted for this control.
- `packages/prototypes/base/test/finf-collection-hook-contracts.test.ts`: real Web Component setup consumers enumerate exact public instance keys and all declared captured state keys, then check runtime value domains. The declared-state counts are Tree `4/15/0/0`, Message Scroller `0/4/2`, Virtual List `2/0/0`, Data Table `2/9/1/1/0/0/0`. Nested Button and Scroll Area focus handles are verified separately.
- All 20 changed implementation entry files emit identical canonically formatted JavaScript to the baseline; the changes are erased types and formatting only.
- Workspace `tsc -p tsconfig.workspace.json --noEmit` passes after generating the repository's existing ignored website style companion. Generated style/build outputs are not part of this change. The initial missing-generated-module diagnostics are not treated as a source-contract failure.
- Existing collection composition/projection tests passed all 34 cases; the new exact hook/instance contract test also passes. The final focused run, including Tree/Message Scroller/Virtual List regressions, passes all 43 tests in 6 files.

- `check:agent-doc` does not pass in this checkout: its tsx CLI first hits the sandbox IPC `EPERM`; direct `node --import tsx ... --check` reaches the real validator and reports three baseline GPUI test paths omitted by this sparse checkout (`available_space.rs`, `composition.rs`, `tabs_t0.rs`). The paths exist in the baseline Git tree and have the skip-worktree flag. No spec or native files were changed to conceal that checkout-limited aggregate blocker.

## Remaining boundaries

This is a source typing correction, not complete component acceptance. It does not verify new visual/native/assistive-technology behavior or promote uncataloged prototypes. Existing styled `Record<string, State<boolean>>` assertions and their absent-state checks are preserved verbatim; correcting style behavior is separate work. Core's generic AsHook method artifact lookup remains `unknown`; Adapter instance methods now have concrete public signatures. The parent integration must rerun validation on the combined head and perform the separate independent/publication gates before claiming integration or external delivery.
