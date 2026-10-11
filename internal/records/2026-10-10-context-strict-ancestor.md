# Explicit optional ancestor Context

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and decision

The owner-directed Finf nested Fieldset work needs a provider to compose an outer value for the same ContextKey. Ordinary Context resolves self first, and privileged `resolveScope` exposes only an opaque identity. An author-side DOM/host traversal or second hidden key would obscure the ownership semantics. This slice adds the explicit optional pair `def.context.trySubscribeAncestor` and `run.context.tryReadAncestor` to the existing Context owner and Runtime bridges.

The ancestor channel starts at the supplied logical parent. Its setup intent is independent of ordinary required/optional subscriptions and does not grant ordinary read or consumer write authority. Existing APIs keep self-inclusive resolution. No ancestor update or renderer read API is introduced.

Reads and notification eligibility re-resolve current ancestry. Provider removal/reparenting alone remains notification-free under C-CONTEXT-0011. Consumers must refresh lifecycle-derived state through their existing lifecycle callbacks. Unsubscribe removes its callback but retains read intent. Terminal owner disposal removes both channels. Each ancestor delivery checks provider generation, subscription record, callback presence and current binding, including inside a deferred Runtime callback dispatcher.

The Context contracts, Module and tests remain draft. This is a usable source slice for Finf, not a completion/lifecycle-promotion claim.

## Evidence

- Node 24.19.0 / Corepack pnpm 10.32.1; no new package downloads.
- 82 tests passed across 21 focused Context Module, Runtime lifecycle/render, and four Web Adapter Context files. This includes 20 new ancestor Module cases, 8 Compiler-profile rejection cases and four actual Runtime/Adapter composition cases, each with two owner generations.
- Nested same-key providers compose 1 -> 11 -> 111 and react to an outer increment as 2 -> 12 -> 112 through actual WC/React/Vue/Vue2 owners. Tests inspect derived DOM text and terminal provider/subscription cleanup. This is Happy DOM execution, not native-browser visual evidence.
- Module cases cover independent intent, missing ancestors, late provider availability, falsy opaque identity, reparent/provider removal, callback unsubscribe, reentrant queued delivery and delayed-dispatch invalidation.
- Workspace TypeScript check passed after generating the required website style projection and attaching existing workspace dependencies.
- Existing Compiler frontend returns PUI1004 `unsupported-input` at the unsupported ancestor call for React runtime/source, Vue, Vue2, WC, GPUI, Qt and Flutter profiles. Equivalent ordinary Context calls parse successfully as controls. No Compiler or native implementation is claimed.

Initial test-authoring failures were an explicit-undefined fixture token being replaced by its default argument and diagnostic expectations not matching the frontend's actual unsupported-member message. Both test harness errors were corrected before the final passing run. Initial workspace types lacked linked app dependencies/generated style projections; no source errors remained after preparing those existing inputs.

The full prototype catalog check fails on the integration baseline's new Finf prototype entries lacking catalog/debt registration. This slice does not edit those unrelated entries or claim that aggregate check passed. The tsx CLI's optional IPC pipe was denied by the execution sandbox; the same spec scripts are checked through Node's tsx import loader without opening an IPC listener. No sandbox permissions or native GUI execution are expanded.

## Remaining boundaries

Compiler/native ancestor lowering and native browser/GUI evidence remain unimplemented/uncollected. Finf Fieldset/Form integration and the baseline prototype catalog debt belong to the coordinating feature batch. Publication, PR comments, merging, Session/Delay work and Adapter runtime source changes are outside this worker's slice.
