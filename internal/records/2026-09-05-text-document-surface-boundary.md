# Text Document / Editor Surface boundary for later Agent Harness work

Date: 2026-09-05

Status: non-normative research recommendation for #531. This record does not admit a Contract, Module, Host Capability, Prototype, Adapter relation, editor engine, document model, language service, persistence path, or implementation.

Refs: #389 (Text Control/Input), #513 (Agent Harness tracker), #514 (coverage matrix), #517 (Code Block), #521 (windowing), #529 (Artifact Workspace/static Diff Review), #531 (this research).

## Recommendation

Advance **option C: a narrow single-document plain-text Editor Surface proposal checkpoint**. Keep the document model, text storage, edit application, undo/redo stack, selection objects, tokenization, viewport rendering, decorations, language services, workers, and host accessibility implementation inside an infrastructure-exempt editor engine. Keep file identity, source revision, persistence, permissions, save/revert, conflicts, audit, and diagnostics truth App-owned.

The next checkpoint should consider one semantic Module plus one lease-shaped Host Capability for an opaque document/revision reference, attachment/read-only/status facts, revision-bound transaction summaries, bounded selection summaries, engine-command requests, Focus-domain integration, Module-owned connection identities, and stale-result suppression. It should not admit an editor engine, public Prototype, syntax/diagnostic semantics, multi-document workbench, or Adapter support claim.

Classification: **next proposal checkpoint**. The editor/document engine remains **infrastructure-exempt behind a narrow host surface**.

Option A remains the honest fallback for small unrevisioned plain text (`P-BASE-TEXTAREA`), structural code/log presentation (#517), and immutable diff review (#529). Option B pays editor/model/accessibility cost but adds little beyond those fallbacks. Option C is the first slice with an editor-specific user job: maintain one revisioned editing session with engine-owned selection and undo while the App remains persistence authority.

## Evidence and authority

### Repository authority

The following catalog entities are draft unless stated otherwise:

- `C-TEXT-CONTROL-0001-A/C/F/G/I`, `M-TEXT-CONTROL-0001`, and `HC-TEXT-CONTROL-0001` govern one host-selected single- or multiline plain-text control, normalized value/input/composition behavior, and a bounded host lease. They do not govern a revisioned document, editor transactions, model lifetime, undo, decorations, or language services.
- `D-TEXT-CONTROL-PROJECTION-0001-A/C/D/E` keeps selection, cursor, IME, software keyboard, edit menus, and system editing chrome host-owned and limits current conformance to Web hosts. `D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION` already owns the open question of when selection facts/requests enter the plain Text Control contract.
- `P-BASE-TEXTAREA-PHYSICAL-TARGET`, `P-BASE-TEXTAREA-EVENTS-AND-IME`, and `P-BASE-TEXTAREA-BOUNDARY` define a contentless multiline leaf and explicitly exclude rich text, system selection/edit-menu ownership, auto-resize, and a second editor.
- `P-BASE-INPUT-PHYSICAL-TARGET` and `P-BASE-INPUT-BOUNDARY` make the same negative boundary for single-line text entry. Merged PR #547 generalized the shared Text Control line-mode implementation without adding document semantics.
- `K-HOST-SURFACE-ROLES-0001-D` and `C-HOST-SURFACE-PROJECTION-0001-B/D/E` keep raw targets/controllers in translation and require logical-boundary stability plus replacement cleanup.
- `C-FOCUS-0001`, `C-A11Y-0001`, and `C-SCROLL-0001` retain focus, accessibility semantic projection, and logical scrolling ownership. An Editor Surface may consume these domains but may not copy their state machines.
- Active `D-ADAPTER-PROFILE-0001-B/C/D/E` prohibits inferring reviewed Module support or Host Capability provision from a package or same-Web evidence.

Current source and tests confirm the adjacent boundary:

- `packages/core/src/text-control.ts` exposes line-mode patches, normalized editing/composition events, and only value/composition snapshots.
- `packages/modules/text-control/src/caps.ts` uses a data-only `attach`/`update`/`snapshot`/`dispose` lease.
- `packages/modules/text-control/src/web.ts` keeps concrete Web targets, listeners, selection preservation, scroll offsets, and IME mechanics in the host bridge.
- `packages/modules/text-control/test/impl-spec.test.ts` proves value, IME, and lease behavior through a fake host.
- `T-TEXT-CONTROL-0001`, `T-BASE-TEXTAREA-0001`, and `T-BASE-INPUT-0001` bind the current leaf-control evidence. No `T-TEXT-DOCUMENT-*` or `T-EDITOR-SURFACE-*` evidence exists.
- Targeted searches found no Text Document/Editor Surface, CodeMirror, Monaco `ITextModel`, or comparable editor implementation in `packages/**` or `apps/www/src/**`.

`internal/records/2026-08-02-text-control-host-boundary.zh-CN.md` explains the host-owned plain-text boundary. `internal/records/2026-08-29-code-block-composition-first-slice-design.md` keeps code, highlighting, selection, and Clipboard outside Code Block. Issue #529 keeps immutable diff computation, revisions, patch semantics, and side effects App-owned. These are context or scoped work, not authority to admit an editor.

### External primary sources

Web evidence was inspected from Monaco Editor:

- [README at `d620ca0c03d24a51c05ae4dca8a9d5923a4aeb9c`](https://github.com/microsoft/monaco-editor/blob/d620ca0c03d24a51c05ae4dca8a9d5923a4aeb9c/README.md) separates file-like models, URI identity, text content/edit history, DOM editor views, language-feature providers, workers, and disposal.
- [public `monaco.d.ts` at gh-pages `b86a4f9e56a3228b067578205655e2307ae89d44`](https://github.com/microsoft/monaco-editor/blob/b86a4f9e56a3228b067578205655e2307ae89d44/node_modules/monaco-editor/monaco.d.ts) gives models distinct IDs/URIs and version IDs; exposes range-based change events, selections, composition, paste, focus, layout, scroll, hidden areas, serializable view state, multi-cursor behavior, decorations, accessibility page size, and `tabFocusMode`; and represents listeners as disposables.
- [Accessibility Guide for Integrators](https://github.com/microsoft/monaco-editor/wiki/Accessibility-Guide-for-Integrators) requires host-provided action keybindings, an accessible label, high-contrast decisions, screen-reader support configuration, and accessibility help. It records that wrapping may need host/engine adaptation for screen readers.

Non-Web evidence was inspected from current Microsoft native-editor documentation:

- [WinUI RichEditBox guidance](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/rich-edit-box), source revision `fd2cde64baabeded5e3cf17f33b8787c9e468691`, separates the editor control from surrounding toolbar/file controls and exposes an `ITextDocument` for content, ranges, selection, undo/redo, loading, and saving.
- [RichEditTextDocument](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.text.richedittextdocument), source revision `70ebf766b73dd46f874ded9cfcf5b01d4476048d`, owns selection, undo grouping/history, ranges, streams, text, formatting, and display-update batching.
- [UI Automation TextPattern](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-textpattern-overview), source revision `156931bb4ec1e81b028c76ea983553f2e9778bdd`, exposes document text as ranges with selection/change events and platform navigation. It warns that ranges may become invalid after replacement, accessibility text is broadly readable by clients, and range access has cross-process performance costs.

The Web and native engines differ, but both keep models, selections, rendering, input services, accessibility ranges, and resource lifetime behind engine/platform APIs. That supports a data-only host surface, not a generic portable document model or a multi-host conformance claim.

## User-job and slice comparison

| Option | User job | Benefit | Cost or failure | Disposition |
| --- | --- | --- | --- | --- |
| A. No editor domain | Edit a small plain-text value or read code/log/diff output. | Existing Textarea, Code Block, and static Diff boundaries remain honest and cheap. | No document revision, engine undo, durable selection, viewport restoration, or large-document session. | Keep as fallback. |
| B. Read-only document viewport with selection/copy | Navigate a document through an editor engine without editing. | Can preserve engine-native selection and accessibility ranges. | Pays model/view/a11y/lifecycle cost while overlapping Code Block/static document/diff paths; no first editor-specific editing job. | Do not make the first Proto UI slice. Private infrastructure may provide it. |
| C. Single-document plain-text Editor Surface | Maintain one revisioned editor session, apply engine-local edits/undo, and route explicit App actions. | Smallest end-to-end editor-specific job; fakeable through references and transaction summaries. | Requires revision, shortcut/IME, permission, selection-summary, view-state, and stale-callback rules. | **Recommended proposal checkpoint.** |
| D. Syntax/decorations/diagnostics | Inspect tokens, decorations, diagnostics, quick fixes, and navigation. | Useful developer experience. | Adds language-service truth, decoration identity, issue navigation, and accessibility policy. | Defer. |
| E. Multi-document/large-document workbench | Manage tabs, models, huge files, paging, branches, conflicts, and workspace commands. | Full workbench. | Conflates App workspace, persistence, windowing, editor, language, and conflict owners. | Defer. |

## Responsibility and trust table

| Layer or existing surface | Owns | Receives across the boundary | Must never expose or claim |
| --- | --- | --- | --- |
| App/backend | Opaque document/file identity; authoritative source revision; permissions; loading; persistence; save/revert; conflict and idempotency; language-service and diagnostics truth; audit. | Document/transaction references and explicit data-only action requests. | File handles, storage streams, credentials, VCS objects, language-server handles, authority inferred from rendered text. |
| Editor-engine infrastructure | Mutable text model; edit application; composition; selection/cursors; undo/redo; tokenization; decorations; folding; find; viewport rendering/physics/internal line windowing; view state; native text ranges/caret implementation. | Host-local target plus model/backend services injected outside portable authoring. | Engine/model/view/controller/worker, mutable ranges, DOM/native target, semantic role, logical Focus/Scroll ownership, framework component, host view-state object. |
| Proto UI Text Document semantic owner | One logical surface identity; composite document/model-session/source/content/mutation identity; lease epoch; attachment/read-only/input-enabled facts; commit-stamped transaction authorization context; revision-bound transaction observations; bounded composition/selection availability; engine-command correlation; stale UI rejection. It consumes Focus identity/view epoch and resolved Scroll facts/requests rather than owning them. | Immutable references, status facts, summaries, and requests. | Full document, raw changes/models, focus facts, Scroll support/geometry/physics, tokenizer/diagnostic objects, raw events, persistence authority, engine undo data. |
| Text Document Host Capability | Resolve model by composite `{ documentId, modelSessionId }`, underlying App document service by `documentId`, and current target/view from host configuration; attach engine; bridge IME/keyboard; stamp initiating view/policy context at commit; expose targets/controllers to Focus/Scroll/A11y integration; apply read-only policy; emit bounded view facts; preserve view state; clean up. | Static requirement and mutable patch plus adapter-injected resolvers keyed by opaque IDs. | No target/model/editor/range/selection/file/stream/worker/callback source returned to portable authoring; no semantic focus, role, or logical Scroll support ownership. |
| Adapter profile | Materialize boundary/surface/input/a11y targets; wire capability; translate lifecycle and Focus participation. | Governed Module requirement only after admission. | No semantic reinterpretation and no support/provision relation before profile evidence. |
| Composition/design language | Tabs/breadcrumbs, toolbar, filename/revision/status, dirty/conflict badge, explicit Save/Revert, find controls if later admitted, diagnostics list if later admitted. | App facts and ordinary Proto UI control events. | Document storage/model, edit transactions, undo stack, language/diagnostic truth, direct engine action during render. |
| Base Textarea | Small unrevisioned multiline plain-text value protocol. | Value/property facts and normalized input/IME. | Document identity/revision, transactions, engine model, multi-cursor, workbench. |
| Code Block | Structural presentation of App-authored code/log content. | Authored text/tokens and ordinary child controls. | Editing, selection, Clipboard, document history, language services. |
| Static Diff Review | App-local immutable change presentation and explicit review actions. | App-computed diff/revision labels. | Edit model, patch application, persistence, conflict resolution. |

The engine can remain completely outside Proto UI. Host configuration resolves the model by the composite opaque key `{ documentId, modelSessionId }` and the underlying App document service by `documentId`; neither member is assumed globally unique by itself, and no engine or document object crosses portable authoring.

## Portable facts, requests, and information paths

### Candidate first-slice values

Names below illustrate a proposal; they are not an admitted API:

- App input: immutable stable `surfaceId` plus `document: { documentId, modelSessionId }`; the composite pair is the model key, and the model-session service owns source/saved content. Mutable resolved `editingMode: interactive | read-only | disabled` and status policy crosses per view. Role/name/description remain A11y; help is composition/relation.
- Host facts: discriminated attachment; post-attachment facts/policy revisions; ready model/source/mutation/content; independent composition and bounded-selection availability/facts; input/keyboard-route/A11y/view-state support. Module derives dirty. Focus and resolved Scroll facts remain in their domains.
- Model transaction summary: `{ documentId, modelSessionId, transactionId }`, document/source/mutation/content identity, immutable commit-time origin authorization context, disposition/count, and no observer freshness. The durable dispatcher reaches App once; a per-connection observation envelope adds the observing view's applied policy/facts revision for optional UI delivery.
- Engine requests/results: mutation/policy-bound undo/redo and explicit snapshot/export by the App-owned service. Line navigation remains deferred. Focus/blur remain in Focus. Save/revert remain App actions.

The first slice's selection summary is intentionally bounded to `{ count, primaryCollapsed }` plus the current monotonic mutation revision. No raw range, selected text, mutable selection, pixel rectangle, or ungoverned line/column encoding crosses. A later line/column or range API needs an explicit Unicode position encoding and revision semantics.

This resolves the seam with `D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION` without closing it: plain Text Control selection remains that decision's open question. Revision-bound document selection is a different future contract and must not be retrofitted into `TextControlHandle`. Neither surface gains `selectAll`, `setSelection`, or `replaceSelection` in this first slice.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| Document/model identity | App -> immutable Text Document requirement -> Host Capability resolver | Correct shared/private model and view appear even when different documents reuse a locally scoped session ID. | Resolve model by composite `{ documentId, modelSessionId }`; use `documentId` alone only for the underlying App document service. |
| Source content/revision | App model-session service -> engine/model dispatcher | Engine renders text and all attached views observe one current persisted base. | Composite document/model session owns source revision and changes once for all its views. |
| IME/text/key input | Physical editor -> initiating Host view bridge -> engine/model dispatcher | Before the transaction enters the shared model dispatcher, that exact bridge stamps immutable initiating surface/connection/applied-policy context; durable model delivery reaches App exactly once even if views detach. The Module never guesses origin from a later shared-model callback. | Composition support, composite model key, mutation revision, and commit-time interactive authorization; observer freshness does not govern durability. |
| Edit details | Already-stamped model dispatcher -> App service; views receive optional observation envelopes | App validates origin context and persists `persist` by `{ documentId, modelSessionId, transactionId }`; stale view observation may drop without data loss. | Shared summary retains immutable origin authorization but no observing-view revision; each envelope binds only its current recipient connection/policy/facts revision. |
| Save/Revert | Button -> App/model-session service | Save atomically advances model-session source revision and saved content version for all views sharing the composite model key; Module derives dirty. | App idempotency plus composite model/source/content identity; no per-view stale base. |
| Undo/Redo | App/semantic command -> initiating Host view bridge -> engine | Engine transaction and availability facts. | Expected mutation/policy revision validated before mutation; the bridge stamps initiating authorization before the committed result enters shared dispatch. |
| Selection/caret | Engine | Native accessibility exposes ranges; when supported, Proto receives only count/collapsed summary; unsupported summary is explicit and carries no selection fact. | Monotonic facts and selection revisions within connection/policy; engine selection remains usable independently. |
| Focus/Tab escape | Focus domain / host keyboard arbiter -> editor or Harness | Exactly one focus destination; facts return only through Focus. | Focus identity/view epoch and shortcut policy. |
| Accessible role/naming | A11y semantic object -> HC-A11Y/Adapter -> editor target | One role/name/description projection; App help control uses existing relations. | A11y identity and target replacement; engine supplies native implementation, not role truth. |
| Viewport/scroll | Text Document registers one logical Scroll surface; M-SCROLL/HC-SCROLL-SURFACE map requests/facts to editor controller | Portable logical scroll facts/requests; engine retains physics/rendering/internal line windowing. | Scroll view epoch plus host-local geometry/controller; no raw view state. |
| Diagnostics/decorations | App language service -> later engine/composition slice | Deferred. | No first-slice channel. |

## Fake-engine / fake-host protocol sketch

Callbacks below are Module-to-Host internals, not Prototype props.

```ts
type DocumentRef = Readonly<{
  // Collision-free only as a pair; neither member is globally unique alone.
  documentId: string;
  modelSessionId: string;
}>;

type DocumentSurfaceRequirement = Readonly<{
  // Immutable for one connection; identity changes require reattachment.
  surfaceId: string;
  document: DocumentRef;
}>;

type DocumentAttachmentFailure =
  | 'engine-unavailable'
  | 'document-unavailable'
  | 'service-unavailable'
  | 'read-only-unenforced';
type DocumentCommandRejectReason = 'stale-policy' | 'stale-mutation' | 'policy-denied';
type DocumentCommandUnavailableReason =
  | 'engine-unavailable'
  | 'document-unavailable'
  | 'service-unavailable';

type DocumentSelectionSummary = Readonly<{
  selectionRevision: number;
  mutationRevision: number;
  count: number;
  primaryCollapsed: boolean;
}>;

type DocumentInputSupport =
  | Readonly<{ availability: 'available' | 'read-only'; reason: null }>
  | Readonly<{ availability: 'unavailable'; reason: 'input-unavailable' }>;

type DocumentCompositionSupport =
  | Readonly<{
      reporting: 'available';
      composing: boolean;
      arbitration: 'ime-first';
      reason: null;
    }>
  | Readonly<{
      reporting: 'unavailable';
      composing: null;
      arbitration: 'conservative-ime-first';
      reason: 'composition-unavailable';
    }>;

type DocumentSelectionSupport =
  | Readonly<{ availability: 'available'; summary: DocumentSelectionSummary; reason: null }>
  | Readonly<{
      availability: 'unavailable';
      summary: null;
      reason: 'selection-unavailable';
    }>;

type DocumentTransactionOriginSupport =
  | Readonly<{ availability: 'commit-stamped'; reason: null }>
  | Readonly<{
      availability: 'unavailable';
      reason: 'transaction-origin-unavailable';
    }>;

type DocumentKeyboardRouteSupport =
  | Readonly<{ availability: 'available'; reason: null }>
  | Readonly<{
      availability: 'unavailable';
      reason: 'keyboard-route-unavailable';
    }>;

type DocumentAccessibilitySupport =
  | Readonly<{ availability: 'host-text-provider' | 'bounded-range'; reason: null }>
  | Readonly<{
      availability: 'unavailable';
      reason: 'accessibility-unavailable';
    }>;

type DocumentViewStateSupport =
  | Readonly<{ availability: 'available'; reason: null }>
  | Readonly<{ availability: 'unavailable'; reason: 'view-state-unavailable' }>;

type DocumentSurfaceSupport = Readonly<{
  input: DocumentInputSupport;
  composition: DocumentCompositionSupport;
  selection: DocumentSelectionSupport;
  transactionOrigin: DocumentTransactionOriginSupport;
  keyboardRoute: DocumentKeyboardRouteSupport;
  accessibility: DocumentAccessibilitySupport;
  viewState: DocumentViewStateSupport;
}>;

type DocumentSurfacePatch = Readonly<{
  editingMode: 'interactive' | 'read-only' | 'disabled';
  // Every accepted update is strictly greater than the previous revision.
  policyRevision: number;
  conflicted: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  shortcutPolicyId: string;
}>;

type DocumentSurfaceFacts =
  | Readonly<{
      attachment: 'detached' | 'attaching';
      appliedPolicyRevision: null;
      support: DocumentSurfaceSupport;
    }>
  | Readonly<{
      attachment: 'unavailable' | 'error';
      appliedPolicyRevision: number;
      factsRevision: number;
      support: DocumentSurfaceSupport;
      reason: DocumentAttachmentFailure;
    }>
  | Readonly<{
      attachment: 'ready';
      appliedPolicyRevision: number;
      factsRevision: number;
      support: DocumentSurfaceSupport;
      sourceRevision: string;
      savedContentVersion: string;
      mutationRevision: number;
      contentVersion: string;
      canUndo: boolean;
      canRedo: boolean;
    }>;

type DocumentTransactionBase = DocumentRef &
  Readonly<{
    transactionId: string;
    sourceRevision: string;
    beforeMutationRevision: number;
    afterMutationRevision: number;
    contentVersion: string;
    changeCount: number;
  }>;

type DocumentViewTransactionOrigin = Readonly<{
  kind: 'user' | 'undo' | 'redo';
  surfaceId: string;
  connectionId: string;
  committedPolicyRevision: number;
  editingMode: 'interactive';
}>;

type DocumentTransactionSummary =
  | (DocumentTransactionBase &
      Readonly<{
        origin: DocumentViewTransactionOrigin;
        disposition: 'persist';
      }>)
  | (DocumentTransactionBase &
      Readonly<{
        origin: Readonly<{ kind: 'app' }>;
        disposition: 'observe-only';
      }>);

type DocumentTransactionObservation = Readonly<{
  observerAppliedPolicyRevision: number;
  observerFactsRevision: number;
  summary: DocumentTransactionSummary;
}>;

type DocumentCommandResult =
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'applied';
      appliedPolicyRevision: number;
      mutationRevision: number;
      contentVersion: string;
      reason: null;
    }>
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'rejected';
      appliedPolicyRevision: number;
      mutationRevision: number;
      contentVersion: string;
      reason: DocumentCommandRejectReason;
    }>
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'unavailable';
      appliedPolicyRevision: number;
      reason: DocumentCommandUnavailableReason;
    }>;

type DocumentSurfaceConnection = Readonly<{
  // Issued and retired by the Module; callback closures reject retired identities.
  connectionId: string;
  requirement: DocumentSurfaceRequirement;
  patch: DocumentSurfacePatch;
  onFacts(connectionId: string, facts: DocumentSurfaceFacts): void;
  // The initiating Host bridge supplies an already commit-stamped summary.
  onTransactionObserved(connectionId: string, observation: DocumentTransactionObservation): void;
  onCommandResult(connectionId: string, result: DocumentCommandResult): void;
}>;

type DocumentSurfaceLease = Readonly<{
  update(patch: DocumentSurfacePatch): void;
  requestCommand(
    request: Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      expectedPolicyRevision: number;
      expectedMutationRevision: number;
    }>
  ): void;
  snapshot(): DocumentSurfaceFacts;
  dispose(options: Readonly<{ viewState: 'retain-for-surface' | 'evict-surface' }>): void;
}>;

type DocumentSurfaceHost = Readonly<{
  attach(connection: DocumentSurfaceConnection): DocumentSurfaceLease;
}>;
```

1. attach two surfaces to `{ documentId: doc-7, modelSessionId: default }`; resolve the same model, while `{ doc-8, default }` and `{ doc-7, model-4 }` resolve independent models and view-state keys;
2. receive attaching/null policy, then ready with exact discriminated input/transaction-origin/keyboard/A11y/view support; each unavailable availability branch contains only its matching reason, with no free-form reason array; resolve Scroll support separately through `M-SCROLL-0001`;
3. commit `tx-1` from the interactive surface; before shared dispatch, that initiating Host bridge stamps the durable `{ doc-7, default, tx-1 }` summary with its immutable surface/connection/policy context; App validates the context and persists once, while each observation envelope has only its recipient policy/facts revision;
4. deliver the same model transaction to a read-only sibling view; its observation cannot replace the interactive origin context or authorize a second persistence; Module attempts to infer an origin from the sibling are prohibited;
5. detach one view before observation; stale UI drops but durable delivery remains once;
6. recover unavailable -> ready; older failure loses by facts revision;
7. keep committed input interactive while composition reporting is unavailable: Host-local IME arbitration conservatively sends candidate Enter/Tab/Escape to the engine before Harness and reports no `composing` fact. If that ordering cannot be guaranteed, resolve read-only/unavailable. Separately make selection summary unavailable while engine-local selection remains usable; each support union has exact reason/null fact;
8. move supported selection twice without edit; facts/selection revisions order callbacks;
9. exercise interactive/read-only/disabled: only interactive edits; undo/redo under non-interactive mode returns `policy-denied` before engine mutation; unavailable origin stamping resolves read-only/unavailable rather than emitting a persistable edit;
10. during reported active composition, IME-consumed Enter/Tab/Escape reaches engine before Harness shortcuts; after known composition end, registered shortcut precedence resumes;
11. make Tab/F6 exit route unavailable; exact keyboard support reason is `keyboard-route-unavailable`, and composition acceptance rejects independently of Button;
12. request undo while selection summary, keyboard route, A11y, and view-state are unavailable; command still executes if engine/document/service and policy/mutation checks pass. Only a `DocumentCommandUnavailableReason` may produce command `unavailable`;
13. save model content/source centrally for all views sharing the composite model key; dirty/source remain coherent;
14. enforce strict policy updates and per-view observation envelopes; durable summary retains commit-time Host-stamped authorization but no observer freshness;
15. App-origin transaction is observe-only; no persistence echo;
16. unavailable/error carries facts/policy revision but no engine fields; unavailable command omits mutation/content and uses only engine/document/service reason;
17. switch `surface-2` between composite model keys; release old leases with `retain-for-surface`, restore each `{ surfaceId, documentId, modelSessionId }` state without collision, then permanently remove the logical surface with `evict-surface` and prove all of its cached keys are purged;
18. map role/name only A11y and focus only Focus; consume logical viewport/support only from Scroll and prove Text Document reports no second Scroll truth;
19. complete stale UI callbacks without suppressing durable transactions;
20. prove no raw engine/model/range/target/scroll controller/file/document/system-duplicate/view-state value crosses and no view-state cache survives final surface eviction.

This proves composite model-session identity, initiating-Host commit authorization, exact support/reason coupling, command-specific unavailability, conservative IME arbitration without composition facts, bounded view-state lifetime, resolved editing mode, keyboard-route support, model-scoped restoration, monotonic UI revisions, recipient-only observation envelopes, durable delivery, and system-domain ownership. It does not prove real host behavior.

## Revision, input, shortcut, and permission policy

- **Revision, transaction, and authorization ownership:** the composite `{ documentId, modelSessionId }` service owns current `sourceRevision`; monotonic mutation prevents ABA; content version identifies equality. The initiating Host bridge—not the Module or an observing sibling—captures immutable `surfaceId`, `connectionId`, applied policy revision, and `editingMode: interactive` before the transaction enters the shared dispatcher. Durable `{ documentId, modelSessionId, transactionId }` summaries then emit once. The App/backend validates that context against its permission decision before persistence. Recipient observation envelopes carry separate current policy/facts revisions and may stale-drop; they never rewrite origin authorization. User/undo/redo persist; App origin observes only. If the bridge cannot correlate and stamp the initiating view synchronously, `transaction-origin-unavailable` prevents interactive persistable delivery.
- **Save/conflict/dirty:** Save/Revert invokes the App's composite model-session service. Success atomically advances source revision and saved content version for every attached view sharing that key; the next facts publication carries both, with no per-view patch or stale base. Dirty compares content versions. Lifecycle never saves.
- **IME and shortcut precedence:** candidate/composition UI stays engine-owned. With available reporting, active composition sends IME-consumed keys (including Enter/Tab/Escape) to the engine first; Harness shortcut precedence resumes only after a known composition end. With reporting unavailable but interactive input retained, `conservative-ime-first` requires the Host's local IME arbiter to consume candidate/composition keys before Harness without publishing `composing`; it must never infer “not composing” from null. If the Host cannot guarantee that order, policy resolves read-only/unavailable.
- **Text versus command keys:** engine owns editing/cursor/undo/indent. App commands use host arbiter; no native key object crosses.
- **Tab and escape:** Web host reports Tab/F6 route through exact `DocumentKeyboardRouteSupport`; composition owns leave Button/Focus topology. Either unavailable route or absent control fails acceptance.
- **Clipboard/paste:** system/editor owns; only a resulting persistable transaction already stamped by the initiating Host bridge enters the durable model dispatcher.
- **Editing mode and policy:** one resolved mode replaces conflicting booleans. Only `interactive` with `transactionOrigin.availability: commit-stamped` may emit persistable edits or execute undo/redo. `read-only` preserves focus/engine-local selection; `disabled` blocks entry. Commands in non-interactive modes return `policy-denied` before engine mutation. Every update is strictly newer; committed transactions remain durable.
- **Mobile:** host IME/touch chrome; input, composition-reporting/arbitration, selection-summary, and exit support report through exact discriminated branches. Unavailable composition reporting may retain interactive input only with conservative Host-local IME-first arbitration; unavailable selection may degrade without claiming a summary; unavailable exit blocks composed acceptance.

## Accessibility boundary

- App supplies editor role/name/description through A11y semantic-object facts. Help is App composition through existing relations; no help fact. Adapter projects A11y IR; engine/Host Capability supplies native editable control, text ranges, caret behavior, wrapping, and screen-reader editing mechanics without second role ownership.
- `DocumentSelectionSummary` supports low-cost status only; native accessibility exposes ranges. Later line/column API needs encoding/replacement rules.
- Streaming edit/caret does not feed live region. Announcements are bounded to read-only/save/conflict/rejection. Diagnostics is option D.
- Web evidence covers A11y role/name/description/help relation, screen-reader mode, Tab-focus, composition, selection, read-only, Scroll integration, zoom/wrap/high contrast, focus entry/exit, and no duplicates.
- Native evidence may use UIA TextPattern or equivalent; sensitive content projection is App/Host privacy. Degradation explicit.
- Large-document accessibility and range-query performance are option E. Same-Web WC/React/Vue results cannot establish native-host conformance.

## Performance, viewport, windowing, and lifecycle

- Full document/model/token/decorations/internal viewport lines do not enter generic Proto State.
- Durable model transactions are view-independent but retain immutable initiating-Host commit authorization; App validates and dedupes `{ documentId, modelSessionId, transactionId }` and ignores observe-only. Recipient view envelopes may stale-drop and cannot change origin.
- Text Document registers a logical Scroll surface. `M-SCROLL-0001` exclusively owns portable Scroll identity/facts/requests/support and view epoch; `HC-SCROLL-SURFACE-0001` maps the engine controller behind a lease. Text Document consumes that resolved state and never republishes a Scroll support field. Engine owns physics/rendering/internal line windowing; #521 applies to external authored Collections, not engine lines.
- Raw geometry/view state remains host-private; restoration keys `{ surfaceId, documentId, modelSessionId }` so independent sessions never share cursor/selection/folding/scroll state.
- One surface holds immutable surface plus composite document/model requirement and view connection. Identity replacement reattaches; model source updates centrally; mutable update is strictly increasing policy only. Loading is represented only by the `status` discriminant; no duplicate boolean exists.
- Every post-attachment facts branch has facts revision. Each support dimension is an exact discriminated union: success has null reason; unavailable has only its matching bounded reason. Composition-reporting/selection unavailable branches contain null facts. UI callbacks stale-suppress; durable transactions never use observer freshness.
- `dispose({ viewState: 'retain-for-surface' })` releases input, Focus bridge, separately owned Scroll lease/controller, observations, A11y, and target refs while keeping only the keyed host-private view state for later attachment during the same logical `surfaceId` lifetime. `dispose({ viewState: 'evict-surface' })` performs the same cleanup and purges every cached `{ surfaceId, documentId, modelSessionId }` entry when that logical surface is permanently removed. The App/runtime must issue final eviction; retention is not global or indefinite.
- View lease disposal never disposes App-owned model/file/language/storage sessions.
- Attachment failure uses only `DocumentAttachmentFailure`; command unavailable uses only `DocumentCommandUnavailableReason`; surface capabilities fail or degrade only through their own exact branch. Scroll availability remains solely in the Scroll domain.

## Proposed entity and evidence graph

If a maintainer later accepts semantic admission, the smallest coherent graph is:

```text
C-TEXT-DOCUMENT-SURFACE-0001 (draft contract)
  <- satisfied by M-TEXT-DOCUMENT-SURFACE-0001
       -> requires HC-TEXT-DOCUMENT-SURFACE-0001
  <- verified by T-TEXT-DOCUMENT-SURFACE-0001

K-HOST-SURFACE-ROLES-0001
C-HOST-SURFACE-PROJECTION-0001
C-FOCUS-0001 / C-A11Y-0001
C-SCROLL-0001 / M-SCROLL-0001 / HC-SCROLL-SURFACE-0001
D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION (related seam, not replaced)

A-REACT-18-19-0001
  -> may later support/provide the new Module/Host Capability only after
     reviewed Web evidence
```

No new Adapter identity is justified: existing profiles receive reviewed relations only after evidence. No public Prototype is justified by this research alone. Prototype identity/anatomy and editor chrome require a later admitted authoring slice. Text Control remains unchanged; the document selection contract is related but separate.

### Bounded red-first plan

1. **Portable negatives:** reject raw engine/model/target/range/worker/stream/file/framework/native event/geometry/document/token/view-state/scroll-controller/service values; reject identity in mutable updates.
2. **Fake lease:** composite document/model-session resolution, immutable attach, strict policy, editing modes, keyboard-route support, source update across views, model-scoped view-state retain/restore/final eviction, replacement, cleanup, stale UI suppression without edit loss.
3. **Revisions/transactions:** composite model key and triple idempotency key; UI revisions/content equality; initiating-Host commit authorization before shared dispatch; recipient-only observation freshness; exactly-once persistence; App observe-only; shared save; undo dirty/conflict.
4. **Input/permissions/commands:** exact per-capability support/reason unions; conservative IME-first arbitration when composition reporting is unavailable; editing-mode and transaction-origin gates; command-specific unavailable reasons plus policy-denied/stale branches; composition Button/Focus; regressing policy rejection.
5. **Selection/availability/view identity:** facts revision on post-attachment/ready branches; ready-only engine fields; null policy only attaching; `{surface,document,model}` view key; retain-for-reattach versus final surface eviction; loading status single-valued; line navigation deferred.
6. **A11y/Focus/Scroll fakes:** role/name only A11y; help composition; focus only Focus; logical viewport/support consumed exclusively through Scroll; keyboard-route support explicit; no duplicate Scroll fact.
7. **Real Web:** editing modes, initiating-bridge authorization stamping, composition reporting/arbitration/degradation, Tab/F6 support, bounded selection availability/undo, shared composite-key model save, model-scoped view restore/final eviction, replacement, A11y, Scroll, cleanup.
8. **Performance:** rapid edits/caret movement and a bounded first-slice document prove no full-content/token/viewport copies through Proto UI and no retained listeners/models.
9. **Cross-adapter Web only if claimed:** WC/React/Vue from one authoring source remains Web evidence.
10. **Non-Web:** independent native profile with native input, selection, revision, accessibility, view replacement, and cleanup evidence before multi-host language.

## #513/#514 matrix consumption

PR #563 carries `internal/agent-harness/dogfood-coverage-matrix.md`, but it is not on `main`, is conflicting, and has an active `CHANGES_REQUESTED` review. This record must not copy that matrix or create a second source of truth.

After the matrix carrier lands, a follow-up #531 carrier must update exactly:

- `harness.future.editor-chrome`: replace pending ownership with the option-C recommendation; keep `research` until semantic admission, link this record, name the proposed `C-*` / `M-*` / `HC-*` / `T-*` checkpoint, distinguish Textarea/Code Block/static Diff fallbacks, and trigger re-review on admission outcome, selection position encoding, syntax/diagnostics, multi-document/large-document scope, or non-Web claims.
- `harness.future.editor-engine`: retain `infrastructure-exempt`; settle the exemption for model/content/edit/undo/selection/rendering/tokenization/view-state internals; state that engine selection, persistence/service binding, raw-model leakage, or capability expansion triggers re-review.
- Recompute totals only if a state changes. This recommendation keeps both current state counts unchanged.

#513 should receive the landed record/matrix-carrier link. #514 remains owner of the single matrix. Until that projection lands, #531 is advanced rather than closed.

## Acceptance mapping

- Textarea, Code Block, static Diff, App/backend, editor engine, Proto UI semantic owner, Host Capability/Adapter, and composition responsibilities are distinct.
- Options A-E are compared; C is the smallest proposed editor-specific slice and D/E are explicit deferrals.
- Document/source/engine revisions, transactions, input/shortcuts/IME/Tab, selection, accessibility, permission change, viewport/windowing, lifecycle, and cleanup are bounded.
- No raw editor, model, document/range/selection, host target, worker, stream, language service, or file object enters portable authoring.
- No third-party editor is treated as Proto UI-owned UI; its model/view/a11y implementation remains infrastructure.
- The conclusion is one `next proposal checkpoint`; no materially different viable owner remains unresolved in this packet.
- The exact #513/#514 rows and re-review triggers are identified; their authoritative projection remains the next carrier after PR #563.

## Residual risks and smallest human decision

Residual risks: transaction IDs require a robust App-owned service contract; revision and replacement races can lose or duplicate edits; Unicode position encoding is intentionally deferred; screen-reader editor behavior varies; permission revocation during composition can discard a candidate; view-state/model ownership differs across engines; sensitive document content may be exposed through platform accessibility; selected engines may not support the required separation.

Smallest later human decision: accept or reject admission of the proposed `C-TEXT-DOCUMENT-SURFACE-0001` / `M-TEXT-DOCUMENT-SURFACE-0001` / `HC-TEXT-DOCUMENT-SURFACE-0001` / `T-TEXT-DOCUMENT-SURFACE-0001` graph for option C with the exclusions above. Acceptance authorizes a separate spec proposal, not an engine choice, Prototype, or implementation. Rejection leaves option A plus private editor infrastructure and ordinary Proto UI chrome.
