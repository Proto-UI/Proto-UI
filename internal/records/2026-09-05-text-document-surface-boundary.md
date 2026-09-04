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
- Model transaction summary: `{ documentId, modelSessionId, transactionId }`, document/source/mutation/content identity, immutable commit-time origin authorization context, disposition/count, and no observer freshness. One serial durable dispatcher per composite model key preserves the mutation chain and reaches App once in commit order. Accepted acknowledgement advances; rejected acknowledgement pauses every view, discards the dependent queued chain, and completes authoritative private model reconciliation before editing resumes. A per-connection observation envelope adds recipient UI freshness only.
- Engine requests/results: mutation/policy-bound undo/redo with explicit applied, no-op, rejected, and unavailable outcomes; explicit snapshot/export by App service. Commands before applied policy return nullable-policy `policy-not-applied` without engine access. Line navigation is deferred. Focus/blur remain Focus. Save/Revert are App actions serialized as model-key barriers.

The first slice's selection summary is intentionally bounded to `{ count, primaryCollapsed }` plus the current monotonic mutation revision. No raw range, selected text, mutable selection, pixel rectangle, or ungoverned line/column encoding crosses. A later line/column or range API needs an explicit Unicode position encoding and revision semantics.

This resolves the seam with `D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION` without closing it: plain Text Control selection remains that decision's open question. Revision-bound document selection is a different future contract and must not be retrofitted into `TextControlHandle`. Neither surface gains `selectAll`, `setSelection`, or `replaceSelection` in this first slice.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| Document/model identity | App -> immutable Text Document requirement -> Host Capability resolver | Correct shared/private model and view appear even when different documents reuse a locally scoped session ID. | Resolve model by composite `{ documentId, modelSessionId }`; use `documentId` alone only for the underlying App document service. |
| Source content/revision | App model-session service -> engine/model dispatcher | Engine renders text and all attached views observe one current persisted base. | Composite document/model session owns source revision and changes once for all its views. |
| IME/text/key input | Physical editor -> initiating Host view bridge -> composite-key serial model dispatcher | Bridge stamps origin before shared dispatch. One unacknowledged App delivery per model; views detach without reorder/loss. Negative acknowledgement pauses all views, drops dependent queued summaries, and reconciles engine privately to authoritative App content before any new edit. | Composition, composite key, contiguous mutation chain, commit authorization, reconciliation epoch; observer freshness never governs durability. |
| Edit details | Serial dispatcher -> App service -> accepted/rejected acknowledgement; views get optional envelopes | Accepted tx N permits N+1. Rejected tx atomically stops queue, prevents persistence of later dependent transactions, resets/rebases model through App service with monotonic new mutation/content identity, and publishes conflict/error; stale view observations drop. | Before must equal prior accepted after; rejection reconciliation revision exceeds all discarded committed revisions so stale callbacks cannot revive. |
| Save/Revert | Button -> composite-key model action barrier -> serial dispatcher/App service | Barrier resolves earlier acknowledgements and blocks later edits. Save persists exact drained version. Revert applies authoritative saved content App-origin observe-only, then atomically rebases dispatcher's accepted mutation/content/source head to replacement facts before resume; next user transaction chains from replacement. | One barrier/model; rejection reconciles first and supersedes action for retry; no old-source transaction crosses; Revert baseline reset is barrier result, not transaction acknowledgement. |
| Undo/Redo | App/semantic command -> initiating Host view bridge -> engine | Applied mutation, no-op empty, policy/stale rejection, or unavailable. | Before applied policy both expected policy and mutation are null; Host returns policy-not-applied before any numeric check/engine. After attach both must be numeric/current and history rechecked; no-op changes nothing. |
| Selection/caret | Engine | Native accessibility exposes ranges; when supported, Proto receives only count/collapsed summary; unsupported summary is explicit and carries no selection fact. | Monotonic facts and selection revisions within connection/policy; engine selection remains usable independently. |
| Focus/Tab escape | Host arbiter: active/conservative IME -> required Focus exit route -> ordinary Harness shortcut -> editor | Exactly one focus destination; at least one policy-verified exit key/chord cannot be captured by Harness/editor; facts return only through Focus. | `DocumentKeyboardRouteSupport.shortcutPolicyId` equals applied patch policy; route recomputed on every shortcut-policy update, plus Focus identity/view epoch. |
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
type DocumentCommandRuntimeUnavailableReason =
  | 'engine-unavailable'
  | 'document-unavailable'
  | 'service-unavailable';
type DocumentCommandUnavailableReason =
  | 'policy-not-applied'
  | DocumentCommandRuntimeUnavailableReason;

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
  | Readonly<{
      availability: 'available';
      shortcutPolicyId: string;
      reservedExit: 'Tab' | 'F6' | 'Shift+F6';
      reason: null;
    }>
  | Readonly<{
      availability: 'unavailable';
      shortcutPolicyId: string;
      reservedExit: null;
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
    }>
  | Readonly<{
      attachment: 'unavailable';
      appliedPolicyRevision: null;
      reason: 'engine-unavailable' | 'document-unavailable' | 'service-unavailable';
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

// App-service acknowledgement consumed by the composite-key serial dispatcher;
// neither acknowledgement nor reconciliation content is a portable authoring value.
type DocumentTransactionAck =
  | Readonly<{
      transactionId: string;
      status: 'accepted';
      acceptedMutationRevision: number;
      acceptedContentVersion: string;
      reason: null;
    }>
  | Readonly<{
      transactionId: string;
      status: 'rejected';
      reason: 'authorization-revoked' | 'source-conflict';
      reconciliationId: string;
      authoritativeSourceRevision: string;
      authoritativeSavedContentVersion: string;
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
      status: 'no-op';
      appliedPolicyRevision: number;
      mutationRevision: number;
      contentVersion: string;
      reason: 'history-empty';
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
      appliedPolicyRevision: null;
      reason: 'policy-not-applied';
    }>
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'unavailable';
      appliedPolicyRevision: number;
      reason: DocumentCommandRuntimeUnavailableReason;
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
      expectedPolicyRevision: number | null;
      expectedMutationRevision: number | null;
    }>
  ): void;
  snapshot(): DocumentSurfaceFacts;
  dispose(options: Readonly<{ viewState: 'retain-for-surface' | 'evict-surface' }>): void;
}>;

type DocumentSurfaceHost = Readonly<{
  attach(connection: DocumentSurfaceConnection): DocumentSurfaceLease;
}>;
```

1. attach two surfaces to composite doc/model keys; distinct key pairs resolve independent models/view state;
2. snapshot detached/attaching null policy/no support; call undo with both expected policy and mutation `null`, receive unavailable `policy-not-applied`/applied null before revision comparison or engine access; mixed null/numeric request rejects as invalid internal request. Then ready with support and Scroll separately;
3. commit tx-1 then tx-2. Delay tx-1 ack; serial dispatcher withholds tx-2. Accept tx-1 then deliver tx-2 with contiguous revision; duplicate tx-1 does not advance;
4. repeat but App rejects tx-1 for authorization-revoked and source-conflict. Before negative ack handling, engine has tx-1/tx-2 locally. Assert all views become non-interactive, tx-2 is never persisted, queue resets, App service privately replaces model with authoritative content, undo/history/view facts reconcile at a mutation revision greater than every discarded revision, old callbacks cannot revive, then editing resumes only under fresh source/policy;
5. sibling observations cannot replace origin, authorize persistence, or reorder; Module origin inference prohibited;
6. detach view before ack; UI drops but durable/reconciliation queue remains correct;
7. recover unavailable -> ready; old failure loses by facts revision;
8. degrade composition reporting with conservative IME; degrade selection independently;
9. move supported selection twice; order revisions;
10. exercise editing modes/origin stamping; only eligible interactive persists;
11. during composition IME precedes. After end, reserved policy-verified exit precedes Harness, then editor;
12. shortcut policy collision makes exact route unavailable; non-colliding reserved exit works;
13. call undo/redo with current policy/mutation while corresponding history is empty, including race after previously true canUndo/canRedo; receive no-op history-empty with unchanged mutation/content and no transaction. Unrelated support degradation cannot make command unavailable;
14. commit tx-3/tx-4, delay tx-3 ack, invoke Save. Barrier blocks edits/commands, waits both accepted, saves exact drained version, advances source/saved, resumes; no old-source delivery;
15. repeat Save/Revert with rejected pending transaction; reconcile first and return superseded/retry. Retry Revert on reconciled baseline: apply authoritative saved content App-origin observe-only, atomically set dispatcher accepted head to replacement mutation/content/source, then resume. Commit tx-after-revert with `beforeMutationRevision` equal replacement revision and prove it persists normally without acknowledgement for App-origin replacement;
16. enforce strict policy/per-view envelopes; App-origin observe-only no echo;
17. unavailable/error shapes exact; command unavailable policy may be null only for policy-not-applied and otherwise uses engine/document/service;
18. switch surface between model keys; retain/restore then final evict cache;
19. map A11y/Focus/Scroll owners; Text Document removes bridge only, M-SCROLL disposes lease once;
20. stale UI callbacks cannot suppress/reorder/revive rejected durable chain;
21. prove no raw engine/model/content/range/target/Scroll-controller/file/document/view-state/reconciliation payload crosses portable authoring.

This proves pending command completion, undo/redo no-op race, ordered positive and reconciled negative transaction acknowledgement, Save/Revert barriers, pending attachment, composite identity, Host authorization, support coupling, IME/exit/Harness arbitration, bounded view state, policy-bound route, system ownership, and no raw reconciliation content. It does not prove real host behavior.

## Revision, input, shortcut, and permission policy

- **Revision, transaction, authorization, order, and rejection:** composite service owns source revision; mutation revisions prevent ABA; content version identifies equality. Initiating Host stamps authorization before shared dispatch. One dispatcher per composite key allows one unacknowledged App delivery and contiguous chain. Accepted ack advances. Rejected `authorization-revoked | source-conflict` ack atomically marks all views non-interactive, discards every dependent queued summary, privately reloads/rebases engine from App authoritative content, clears/reseeds undo as engine requires, and publishes a reconciliation mutation revision greater than every rejected/discarded revision. New edits wait for fresh facts/policy. App validates/dedupes triple key; recipient freshness never changes origin/order.
- **Save/Revert barrier:** barrier makes views non-interactive, blocks edits/commands, drains earlier acknowledgements. Save persists exact drained version then advances source/saved facts. Revert applies App authoritative saved content App-origin observe-only and, as one atomic barrier completion, resets serial dispatcher's accepted mutation/content/source baseline to the replacement facts; the first subsequent user transaction must chain from that revision. No acknowledgement is expected for App-origin replacement. Earlier rejection reconciles first and returns superseded/retry. Input resumes only after result/new facts/policy.
- **IME/exit/shortcut precedence:** Host-local IME, required Focus exit, Harness, editor. Null composition not inactive; route support matches policy; collision blocks.
- **Command outcomes:** Before applied policy, request must carry both expected policy/mutation null; Host returns unavailable policy-not-applied/applied null before revision comparison/engine. A mixed null/numeric pair rejects as invalid internal request. After attach both are numeric/current; false history returns no-op history-empty unchanged; non-interactive policy-denied; only engine/document/service unavailable.
- **Text versus command keys:** engine owns editing/cursor/undo/indent. App commands use host arbiter; no native key object crosses.
- **Tab and escape:** composition owns enabled leave Button and Focus topology plus policy-verified host route. Either failure blocks acceptance.
- **Clipboard/paste:** system/editor owns; only Host-stamped persistable transaction enters serial durable dispatcher.
- **Editing mode/mobile:** only interactive with commit-stamped origin may persist/command. Read-only preserves selection; disabled blocks entry. Host IME/touch and support branches degrade explicitly.

## Accessibility boundary

- App supplies editor role/name/description through A11y semantic-object facts. Help is App composition through existing relations; no help fact. Adapter projects A11y IR; engine/Host Capability supplies native editable control, text ranges, caret behavior, wrapping, and screen-reader editing mechanics without second role ownership.
- `DocumentSelectionSummary` supports low-cost status only; native accessibility exposes ranges. Later line/column API needs encoding/replacement rules.
- Streaming edit/caret does not feed live region. Announcements are bounded to read-only/save/conflict/rejection. Diagnostics is option D.
- Web evidence covers A11y role/name/description/help relation, screen-reader mode, Tab-focus, composition, selection, read-only, Scroll integration, zoom/wrap/high contrast, focus entry/exit, and no duplicates.
- Native evidence may use UIA TextPattern or equivalent; sensitive content projection is App/Host privacy. Degradation explicit.
- Large-document accessibility and range-query performance are option E. Same-Web WC/React/Vue results cannot establish native-host conformance.

## Performance, viewport, windowing, and lifecycle

- Full document/model/token/decorations/internal viewport lines do not enter generic Proto State.
- Durable transactions retain Host authorization. Serial dispatcher per model preserves contiguous order with one unacknowledged App delivery. Rejected ack pauses views, discards dependent queue, performs App-private authoritative reconciliation with monotonic fresh revision/content identity, then resumes only after fresh policy/facts. No rejected or discarded transaction later persists.
- Save/Revert use same barrier: block edits, drain/reconcile prior queue, operate exact baseline, publish facts, resume. Revert barrier atomically rebases dispatcher accepted head to App-origin replacement revision/content/source; next user edit chains normally despite no replacement transaction acknowledgement. View envelopes may stale-drop without changing order/barrier.
- Text Document registers logical Scroll; M-SCROLL exclusively owns identity/facts/requests/support/epoch and HC lease disposal. Text Document cleans only editor controller bridge, never Scroll lease/support.
- Raw geometry/view state host-private; restoration keys composite with surface.
- One surface holds immutable composite requirement; identity replacement reattaches; mutable update policy only. Loading only status discriminant.
- Detached/attaching/pre-attach unavailable have null policy/no support. Post-attach facts revision. Support exact branches. UI stale suppression never governs durability/reconciliation.
- Dispose retain releases input/Focus/editor Scroll bridge/observations/A11y/target and keeps keyed state; M-SCROLL disposes own lease. Evict purges all keys. App models survive view lease.
- Attachment failure uses attachment union; command unavailable uses policy-not-applied/engine/document/service only; Scroll remains Scroll-owned.

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
2. **Fake lease:** pending attach; both expected revisions null for pre-policy command, mixed pair invalid; composite resolution; strict policy/modes/route; source views; state retain/evict; replacement/cleanup/stale UI.
3. **Transactions/actions:** composite/triple keys; Host auth; serial accepted/rejected chains; reconciliation; Save/Revert barriers; Revert atomically rebases accepted dispatcher head to App-origin replacement then next user edit persists from it; no late persistence; recipient freshness; shared dirty/conflict.
4. **Commands/input:** applied/no-op/rejected/unavailable; null policy+mutation policy-not-applied; empty-history race; exact support; IME -> Focus exit -> Harness -> editor; policy collision; editing/origin gates.
5. **Selection/availability/view identity:** post-attach revisions; ready-only fields; null policy/no support before attach; composite view key; retain/evict; loading single; line navigation deferred.
6. **A11y/Focus/Scroll fakes:** system owners; Text Document drops bridge, M-SCROLL disposes once; no duplicate.
7. **Real Web:** modes/auth; accepted/rejected transaction chains/reconciliation; Save/Revert queue barriers plus post-Revert dispatcher rebase/edit; null-revision/no-op commands; arbitration/route; selection/undo; shared save; restore/evict; replacement/A11y/Scroll cleanup.
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
