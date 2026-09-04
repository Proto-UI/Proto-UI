# Sandboxed Preview / Browser Surface boundary for later Agent Harness work

Date: 2026-09-05

Status: non-normative research recommendation for #532. This record does not admit a Contract, Module, Host Capability, Prototype, Adapter relation, iframe/webview, sandbox engine, remote browser, message bridge, executable Template value, or implementation.

Refs: #374 (Image View), #513 (Agent Harness tracker), #514 (coverage matrix), #529 (Artifact Workspace/static Diff Review), #532 (this research).

## Recommendation

Retain the issue checkpoint's **option B: a trusted, App-controlled static HTML Preview Surface with no bidirectional bridge** as the smallest safe proposal. The App may resolve an opaque artifact reference to static HTML through host configuration, while the host must enforce a reviewed no-execution/no-network/no-navigation/no-message profile. The source may be delivered from an App-controlled same-site service, but the Web host omits both `allow-scripts` and `allow-same-origin`; the embedded document therefore receives a sandboxed unique origin rather than parent-origin authority.

Advance one proposal checkpoint for a generation-bound semantic Module plus a lease-shaped Host Capability covering source/policy references, fail-closed support negotiation, preparation/status facts, reload, bounded navigation-attempt results, Focus/A11y integration, replacement, and cleanup. Keep document execution, origin/network/storage/permission enforcement, browsing context, renderer process, object URLs, and accessibility of inner content in host/sandbox infrastructure.

Classification: **next proposal checkpoint** for option B, with the preview engine **infrastructure-exempt behind a narrow host surface**. Options C/D/E remain deferred. No third-party embedded-app runtime or content rendered inside the preview acquires Proto UI ownership or App authority.

## Evidence and authority

### Repository authority

The following entities are draft unless stated otherwise:

- `K-HOST-SURFACE-ROLES-0001-D` and `C-HOST-SURFACE-PROJECTION-0001-B/D/E` keep raw host targets/controllers in translation, separate logical/visual/domain targets, and require exact replacement cleanup.
- `C-IMAGE-VIEW-0001-A/C/E/H`, `M-IMAGE-VIEW-0001`, `HC-IMAGE-VIEW-0001`, `P-BASE-IMAGE`, and `T-IMAGE-VIEW-0001` are a narrower precedent for opaque URI projection, explicit accessibility input, generation-bound leases, stale-completion suppression, and cleanup. They do not authorize HTML, execution, navigation, storage, or messages.
- `C-FOCUS-0001`, `C-A11Y-0001`, and `C-SCROLL-0001` remain the owners of logical focus, accessibility semantic objects, and admitted logical scrolling. Preview-specific facts must not duplicate Focus or claim ownership of inner-document scroll.
- `C-BOUNDARY-0001-A/C/F` classifies pointer samples across interaction regions and cleans up; it does not define origin, sandbox, navigation, trust, embedded documents, or IPC.
- `HC-PORTAL-0001` only names detached portal mounting. A Portal is not an iframe/webview, isolation policy, browser process, or capability grant.
- Active `D-ADAPTER-PROFILE-0001-B/C/D/E` means existing Adapters cannot claim Preview Module support or Host Capability provision before concrete reviewed evidence.

Current source/tests confirm the adjacent boundary:

- `packages/modules/image-view/src/caps.ts` uses data-only generation/update/completion and an updateable/snapshot/dispose lease.
- `packages/modules/image-view/test/impl-spec.test.ts` proves source generation, synchronous completion, A→B→A stale suppression, visual clearing, capability/mount replacement, and cleanup for a static image only.
- `packages/adapters/base/src/host/surface-projection.ts` supports adapter-private surface replacement without creating a security domain.
- Targeted searches found no Preview Surface, iframe/webview runtime, `postMessage`/`MessagePort` bridge, `srcdoc`, or Browser implementation in `packages/**` or Website application surfaces. The package iframe usage is a Text Control cross-realm test; the Web Component adapter lists iframe only as a host focusable selector.
- PR #554 merged the host-neutral Image View slice. PR #581's Web Image Checkpoint C is open, conflicting, and changes-requested; it is not current-main Web evidence.
- No `T-PREVIEW-SURFACE-*` evidence exists.

`apps/www/src/content/docs/en/build/host-caps.md` accurately projects Module -> Host Capability -> Adapter ownership and lease cleanup. Issue #529 keeps Artifact Workspace/static Diff presentation, artifact truth, and side effects App-owned; it is not a sandbox.

### External source evidence

The canonical [WHATWG iframe sandbox section](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox) and current `whatwg/html` revision `e5071a20c8569d8a3ec02ed27dd01b948773f850` were identified, but both direct reader and browser retrieval failed with a closed connection in this run. This record does not attribute a fresh textual claim solely to the unavailable page.

Current Web documentation source was inspected at `mdn/content` commit `c26d4cc8e9b10c504587531c49fa82b7b646be18`:

- [`iframe`](https://github.com/mdn/content/blob/c26d4cc8e9b10c504587531c49fa82b7b646be18/files/en-us/web/html/reference/elements/iframe/index.md) describes each frame as a separate browsing context; sandbox tokens lift specific restrictions; Permissions Policy further restricts camera/microphone and other features; `allow-scripts` plus `allow-same-origin` is unsafe for same-origin embedded content; sandboxed top navigation/popups/downloads require explicit tokens; parent access is origin-bound; iframe `error` is suppressed and `load` always fires, so those events cannot prove readiness; and a concise frame title is required for assistive navigation.
- [`Window.postMessage`](https://github.com/mdn/content/blob/c26d4cc8e9b10c504587531c49fa82b7b646be18/files/en-us/web/api/window/postmessage/index.md) states that receivers must validate `origin`, usually `source`, and message syntax; senders must use an exact `targetOrigin`; and applications that do not need messages should install no `message` listener. Option B follows the last rule.

Accessibility source was inspected at W3C revisions `w3c/wcag@7e4034b262bc0d25332e330d8a582aaf34113829` and `w3c/aria-practices@2cde22ec6cfa8d5a6ec00d2ffae91509a24295db`:

- [WCAG Technique H64](https://github.com/w3c/wcag/blob/7e4034b262bc0d25332e330d8a582aaf34113829/techniques/html/H64.html) says iframe `title` labels the frame for entry/navigation, not the inner document; both frame and document need their own names.
- [Modal Dialog Pattern](https://github.com/w3c/aria-practices/blob/2cde22ec6cfa8d5a6ec00d2ffae91509a24295db/content/patterns/dialog-modal/dialog-modal-pattern.html) requires contained Tab order, Escape close, visible close control, and focus restoration only when a containing surface is genuinely modal. An ordinary Preview Surface is not implicitly a Dialog.

A native desktop embedded-content class was inspected at `electron/electron` commit `5856ddccab81f13f9cec16c98f816c264b39bbf2`:

- [Electron Security](https://github.com/electron/electron/blob/5856ddccab81f13f9cec16c98f816c264b39bbf2/docs/tutorial/security.md) warns that arbitrary untrusted content is severe risk and a browser may be safer. It requires Node integration disabled, context isolation, process sandboxing, explicit permission handling, restrictive CSP, navigation/new-window limits, validated external-open URLs, validated IPC senders, safer custom protocols instead of `file://`, and no Electron API exposure.

These sources support a fail-closed host policy and explicit degradation. They do not prove that Web and Electron share one implementation or that option B is safe without host-specific enforcement evidence.

## Use-case and trust classes

| Class | Trust/execution | Honest existing or proposed owner | First-slice disposition |
| --- | --- | --- | --- |
| Static image artifact | Non-executable pixels/resource. | Draft Image View/Base Image; App owns source/auth/actions. Web realization remains pending PR #581. | Use Image path, not Preview. |
| Static authored document/code/diff | Non-executable semantic content rendered by the App. | Native/static authored content, #517 Code Block, #529 static Diff. | Use existing/fallback path, not Preview. |
| Trusted same-site static HTML | App-controlled immutable artifact, but no authority inferred from trust label. Host enforces unique sandbox origin, no script/network/navigation/message. | Proposed option-B Preview Surface. | **Recommended first proposal.** |
| Trusted interactive generated HTML/app | Script execution and application state. | App/backend plus sandbox engine; potential later host surface. | Defer to option C with a new threat review. |
| Untrusted interactive generated app | Adversarial code/content. | Dedicated isolation/security infrastructure, possibly an external browser. | Defer; option B rejects it. |
| Remote web page/browser-like preview | Arbitrary navigation, origins, credentials, storage, downloads, permissions. | Real browser or separately governed browsing product. | Defer option E; not a Proto UI Browser. |
| Interactive embedded tool/application | Bidirectional commands/messages and embedded UI runtime. | App/tool protocol plus sandbox/IPC security layer. | Defer option D; no MCP/A2UI/third-party UI ownership. |
| Native non-Web webview | Native renderer/process/permission/focus/accessibility APIs. | Concrete Adapter/host profile plus sandbox infrastructure. | No conformance claim until independent evidence. |

Trust classification is App input, not a capability. `trusted-static` authorizes only evaluation against the fixed static profile; it cannot enable script, same-origin access, IPC, network, storage, or sensitive APIs. Unsupported or mismatched content fails to `unavailable`; it never falls back to a weaker profile.

## Responsibility and threat table

| Layer | Owns | Receives across boundary | Must never expose or infer |
| --- | --- | --- | --- |
| App/backend | Artifact ID/revision/hash; authorization; immutable-content store; trust classification; policy choice; content validation/sanitization; route/audit; external-open allowlist; App status. | Bounded status/navigation results and explicit action requests. | No authority from rendered content; no content-controlled URL or message executes an App action. |
| Sandbox/preview engine infrastructure | Browsing context/renderer process; HTML parse/layout/paint; unique origin; CSP/network isolation; storage/cookie/cache; script/media/form/download/navigation/permission enforcement; crash handling; inner-document accessibility; object URL/custom protocol. | Host-local content and policy from injected resolvers. | Raw HTML/code is never Proto UI Template/State; engine objects never become portable. |
| Proto UI Preview semantic owner | Stable logical surface; source/policy generation; attachment/preparing/ready/error/unavailable facts; reload request/result; bounded blocked-navigation facts; current connection/generation; stale callback suppression. | Opaque IDs, bounded enums/codes, immutable requests/results. | No origin decision, raw URL, HTML/code, execution, message, permission grant, renderer state, Focus fact, or inner scroll state. |
| Preview Host Capability | Resolve physical target and artifact/policy services; prove required restrictions before load; attach/replace; report status; block/classify navigation; expose target to Focus/A11y integration; revoke resource/listeners/objects exactly. | Static data-only patch and Module-issued connection/generation; host-configured policy/resolvers. | No iframe/Window/webview/WebContents/MessagePort/native view/object URL/controller returned through Props/State/Event/Context/Expose. |
| Adapter profile | Materialize boundary/surface/focus/a11y targets and wire capability/lifecycle. | Governed requirement after admission. | No semantic reinterpretation or support/provision claim before profile evidence. |
| Composition/design language | Preview label, toolbar, reload/close, status/error/fallback, Tabs, visible leave-preview control. | App facts and ordinary Proto UI control events. | No direct frame/webview access, policy weakening, content-driven action, or embedded runtime ownership. |
| Embedded content | Rendered static document only. | Host-resolved bytes under the fixed profile. | No App/Proto authority, capability grant, message listener, navigation, executable code, interactive form/control, or trusted command. |

## First-slice security and capability profile

The illustrative profile ID is `trusted-static-no-execution-v1`; the ID is data, while its concrete enforcement is host configuration reviewed per profile.

Required Web behavior:

- use a sandboxed browsing context with **no sandbox relaxation tokens**: no scripts, same-origin authority, forms, modals, popups, top navigation, downloads, pointer lock, presentation, orientation lock, or storage-access request;
- omit `allow-scripts` and `allow-same-origin` even when the artifact service is same-site; the source delivery origin does not become the effective sandbox origin;
- deny camera, microphone, geolocation, Clipboard, fullscreen, payment, notifications, sensors, serial/HID/USB/Bluetooth, and other sensitive permissions through Permissions Policy and host permission handlers;
- enforce `network: none` with host policy (for example, controlled protocol/resource resolution plus restrictive CSP). Iframe sandbox flags alone do not block subresource network access;
- reject active/interactive content under this profile. Static text, document structure, CSS, and approved packaged image/font resources may render; scripts, forms, interactive media/widgets, custom protocols, automatic navigation, and animation that ignores the App's reduced-motion policy fail validation or are removed by the App-owned static artifact pipeline;
- permit only the initial host-resolved content commit. All later same-document, descendant, top-level, popup, external, custom-protocol, and download navigation attempts are denied;
- install no `message` listener, expose no preload/bridge API, and create no `MessagePort` or IPC handler;
- never call external-open APIs with a content-controlled URL. An App-authored Open action may use a separately validated App-owned artifact URL outside the preview;
- fail closed before attaching content if any required restriction cannot be verified. No partial/unsupported profile silently loads.

Equivalent non-Web hosts must prove their own no-execution, origin/process, network, permission, navigation, new-window, external-open, IPC, and cleanup enforcement. Mapping to Electron security controls is evidence for a future profile, not current conformance.

## Portable facts, requests, and information paths

Names below illustrate a proposal; they are not admitted API.

- Immutable requirement: stable opaque `surfaceId`, `source: { artifactId, revision }`, `trust: trusted-static`, and exact policy profile ID. Source/profile change retires the connection; none is mutable patch data.
- Mutable Host policy: policy revision only. A policy change uses a Module-allocated generation and fail-closed replacement. App loading/error status remains Module/composition state and never rides an asynchronous Host policy request.
- Host facts: discriminated preparing/ready/runtime-error/unavailable state; applied policy; Module generation; verified origin/storage/execution/network/navigation/permission/message/focus/A11y support; bounded reasons. Focus/naming/App status remain their owners.
- Content title and URL remain host/content-local. Chrome uses an App-owned artifact label. Content-controlled strings do not become portable status or accessible name.
- No application-message request/result exists in option B.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| Artifact/policy reference | App -> Preview Module -> Host Capability resolver | Static document appears only after policy verification and host content commit. | Stable surface ID, Module connection, generation, policy revision. |
| Raw HTML/resources | App artifact service -> sandbox engine directly | Inner document renders under fixed restrictions. | Host-only pipeline; zero raw content in Proto UI values. |
| Readiness/failure | Artifact resolver + host policy/commit -> Host Capability -> Module | `preparing -> ready/error/unavailable` with bounded reason. | Current connection/generation/policy; iframe `load` alone is insufficient. |
| Physical target replacement | Adapter/runtime surface-projection lifecycle -> Host `onViewInvalidated` -> Module | Pending request cancelled, old lease retired, fresh connection/generation prepares same immutable source/policy; no target value crosses. | Signal fires synchronously before old target invalidation/new target exposure, even when capability object is unchanged. |
| Reload | App Button -> Module request -> Host Capability -> result callback | Accepted result names old/new generation before preparation; stale policy/generation returns bounded rejection. | Request ID plus expected generation/policy; no ambiguous void outcome. |
| Navigation attempt | Embedded context -> host blocker -> Module summary | Attempt remains blocked; optional bounded kind/outcome supports status/audit. | Current connection/generation/policy; raw destination never crosses. |
| Focus entry/exit | Focus domain + composition-owned controls + browser-native frame order | Parent-owned Enter/Leave controls bracket one static, non-tabbable inner document; native Tab/Shift+Tab exit without an inner handler. | Focus/view epoch and real-browser proof; Preview facts do not duplicate focus. |
| Accessible naming | A11y semantic object -> HC-A11Y/Adapter -> frame target | Frame has one App-owned concise label/description. | A11y identity and target epoch; inner document names itself. |
| Close/open action | Proto UI Button -> App service | App removes surface or opens only its validated artifact URL. | App authorization/idempotency; content cannot trigger it. |
| Messages | No route. | No listener, port, callback, request, or result. | Option B invariant. |

## Fake-host protocol and state machine sketch

```ts
type PreviewSourceRef = Readonly<{ artifactId: string; revision: string }>;

type PreviewRequirement = Readonly<{
  // Immutable for one connection; source/profile changes require reattachment.
  surfaceId: string;
  source: PreviewSourceRef;
  trust: 'trusted-static';
  policyProfileId: 'trusted-static-no-execution-v1';
}>;

type PreviewUnavailableReason =
  | 'source-unavailable'
  | 'source-revision-mismatch'
  | 'policy-unavailable'
  | 'policy-revision-mismatch'
  | 'preparation-crashed'
  | 'static-validation-failed'
  | 'origin-not-isolated'
  | 'storage-not-isolated'
  | 'sandbox-unverified'
  | 'execution-not-denied'
  | 'network-not-denied'
  | 'navigation-not-denied'
  | 'permissions-not-denied'
  | 'message-channel-present'
  | 'focus-path-unverified'
  | 'accessibility-unavailable'
  | 'content-load-failed'
  | 'host-crashed';

type PreviewPrePolicyFailure = 'policy-unavailable' | 'preparation-crashed';
type PreviewRuntimeError = 'content-load-failed' | 'host-crashed';
type PreviewAppliedUnavailable = Exclude<
  PreviewUnavailableReason,
  PreviewPrePolicyFailure | PreviewRuntimeError
>;
type PreviewPolicyRecoverableUnavailable = Exclude<
  PreviewPrePolicyFailure | PreviewAppliedUnavailable,
  'source-unavailable' | 'source-revision-mismatch' | 'static-validation-failed'
>;

type PreviewSupport = Readonly<{
  origin: 'unique-isolated' | 'unverified';
  storage: 'isolated' | 'unverified';
  sandbox: 'no-relaxations-verified' | 'unverified';
  execution: 'denied' | 'unverified';
  network: 'denied' | 'unverified';
  navigation: 'denied' | 'unverified';
  permissions: 'denied' | 'unverified';
  messages: 'absent' | 'present';
  focusPath: 'native-static-tab-order' | 'unverified';
  accessibility: 'embedded-document' | 'unverified' | 'unavailable';
  reasons: readonly PreviewUnavailableReason[];
}>;

type PreviewReadySupport = Readonly<{
  origin: 'unique-isolated';
  storage: 'isolated';
  sandbox: 'no-relaxations-verified';
  execution: 'denied';
  network: 'denied';
  navigation: 'denied';
  permissions: 'denied';
  messages: 'absent';
  focusPath: 'native-static-tab-order';
  accessibility: 'embedded-document';
  reasons: readonly [];
}>;

type PreviewPolicyPatch = Readonly<{
  policyRevision: number;
}>;

type PreviewFacts =
  | Readonly<{
      attachment: 'detached' | 'preparing';
      appliedPolicyRevision: null;
      generation: number;
      support: PreviewSupport;
    }>
  | Readonly<{
      attachment: 'unavailable';
      appliedPolicyRevision: null;
      generation: number;
      support: PreviewSupport;
      reason: PreviewPrePolicyFailure;
    }>
  | Readonly<{
      attachment: 'unavailable';
      appliedPolicyRevision: number;
      generation: number;
      support: PreviewSupport;
      reason: PreviewAppliedUnavailable;
    }>
  | Readonly<{
      attachment: 'error';
      appliedPolicyRevision: number;
      generation: number;
      support: PreviewSupport;
      reason: PreviewRuntimeError;
    }>
  | Readonly<{
      attachment: 'ready';
      // Must equal the current desired/requested policy revision for this generation.
      appliedPolicyRevision: number;
      generation: number;
      support: PreviewReadySupport;
      // Must equal connection.requirement.source.revision before ready is accepted.
      committedArtifactRevision: string;
    }>;

type PreviewNavigationResult = Readonly<{
  attemptId: string;
  kind: 'descendant' | 'top' | 'popup' | 'external' | 'download';
  outcome: 'blocked';
  appliedPolicyRevision: number;
  generation: number;
}>;

type PreviewReloadResult =
  | Readonly<{
      requestId: string;
      outcome: 'accepted';
      previousGeneration: number;
      nextGeneration: number;
      previousAppliedPolicyRevision: number | null;
      retriedPolicyRevision: number;
    }>
  | Readonly<{
      requestId: string;
      outcome: 'rejected';
      currentGeneration: number;
      currentAppliedPolicyRevision: number | null;
      reason:
        | 'stale-generation'
        | 'stale-policy'
        | 'transition-pending'
        | 'not-retryable'
        | 'support-lost'
        | 'host-crashed';
    }>
  | Readonly<{
      requestId: string;
      outcome: 'cancelled';
      currentGeneration: number;
      currentAppliedPolicyRevision: number | null;
      reason: 'disposed' | 'replaced';
    }>;

type PreviewPolicyResult =
  | Readonly<{
      requestId: string;
      outcome: 'accepted';
      previousGeneration: number;
      nextGeneration: number;
      requestedPolicyRevision: number;
    }>
  | Readonly<{
      requestId: string;
      outcome: 'rejected';
      currentGeneration: number;
      currentPolicyRevision: number | null;
      reason:
        | 'stale-generation'
        | 'regressing-policy'
        | 'transition-pending'
        | 'unavailable'
        | 'not-recoverable'
        | 'support-lost'
        | 'host-crashed';
    }>
  | Readonly<{
      requestId: string;
      outcome: 'cancelled';
      currentGeneration: number;
      currentPolicyRevision: number | null;
      reason: 'disposed' | 'replaced';
    }>;

type PreviewConnection = Readonly<{
  // Connection and every next generation are allocated by the Module.
  connectionId: string;
  generation: number;
  requirement: PreviewRequirement;
  policy: PreviewPolicyPatch;
  onFacts(connectionId: string, facts: PreviewFacts): void;
  // Fired synchronously by Adapter/host-surface replacement before target swap.
  onViewInvalidated(connectionId: string, reason: 'target-replaced'): void;
  onNavigation(connectionId: string, result: PreviewNavigationResult): void;
  onReloadResult(connectionId: string, result: PreviewReloadResult): void;
  onPolicyResult(connectionId: string, result: PreviewPolicyResult): void;
}>;

type PreviewLease = Readonly<{
  requestPolicyChange(
    request: Readonly<{
      requestId: string;
      expectedGeneration: number;
      nextGeneration: number;
      policy: PreviewPolicyPatch;
    }>
  ): void;
  requestReload(
    request: Readonly<{
      requestId: string;
      expectedGeneration: number;
      nextGeneration: number;
      expectedAppliedPolicyRevision: number | null;
      // Equality check only: reload cannot select or regress policy.
      expectedPolicyRevision: number;
    }>
  ): void;
  snapshot(): PreviewFacts;
  dispose(): void;
}>;

type PreviewHost = Readonly<{
  attach(connection: PreviewConnection): PreviewLease;
}>;
```

The immutable requirement, Host policy, facts, requests, and results contain no raw content/URL, App status, execution value, host target, or message channel. A fake host receives private artifact/policy resolvers; the Module separately owns App status and one pending-transition reservation.

### Transition table

| Current | Input | Required transition/result |
| --- | --- | --- |
| detached | attach valid immutable source/profile requirement | Module issues connection/generation; host reports `preparing` with null policy before work. |
| preparing | exact `PreviewReadySupport` verified, `reasons` empty, resolved artifact revision equals `connection.requirement.source.revision`, and applied policy revision equals the generation's current desired/requested policy revision; controlled content committed | `ready` carries both exact revisions; `sandbox: no-relaxations-verified` and every other positive proof are mandatory; iframe `load` alone is insufficient. |
| preparing | resolver/cache returns another artifact revision | Numeric-policy `unavailable` with `source-revision-mismatch`; mismatched content is never committed or ready. |
| preparing | Host reports applied policy unequal to current desired/requested revision | Numeric-policy `unavailable` with `policy-revision-mismatch`; stale-policy content is never committed or ready. |
| preparing | policy lookup/preparation fails before application | Null-policy `unavailable` with pre-policy reason; same-policy reload may retry with expected applied revision `null`. |
| preparing | source not static | Numeric-policy `unavailable` with `static-validation-failed`. |
| preparing | another support proof unverified | Numeric-policy `unavailable` with matching support reason; `ready` is not type-representable with generic/unverified support. |
| preparing/ready | content resolver/renderer fails after policy application | Numeric-policy `error` with `content-load-failed`/`host-crashed`; never `unavailable`; reload may retry. |
| ready | any required positive support proof is lost | Settle any pending policy/reload as rejected `support-lost` and release its reservation; then synchronously revoke committed content and affected resources before publishing numeric-policy `unavailable` with the matching support reason. No ready content survives unverified enforcement. |
| ready | observable navigation attempt | Block/report, stay ready; raw URL audit-local. |
| any | App status-only change | Update Module/composition only; no Host request, generation, policy, or content change. |
| ready, runtime `error`, or retryable pre-policy/source `unavailable` | first reload request for generation/current applied revision/current desired policy revision | Module verifies `expectedPolicyRevision` exactly equals the connection's current desired policy (and therefore cannot regress), atomically reserves generation, allocates a unique next generation, then calls Host; null applied revision is valid. |
| ready or `PreviewPolicyRecoverableUnavailable` | first non-regressing policy-change request for generation | Module atomically reserves generation, requires proposed revision greater than current desired (even when applied revision is null), allocates unique next generation, then calls Host. Source unavailable/revision mismatch/static validation are not policy-recoverable. |
| requestable state | competing policy/reload while reservation pending | Module rejects `transition-pending` without calling Host. |
| ready or `PreviewPolicyRecoverableUnavailable` | accepted policy change | Revoke any surviving content, report result, enter preparing in fresh Module generation, and verify exact new policy plus every support/static/artifact check before ready. |
| ready, runtime `error`, or retryable pre-policy/source `unavailable` | accepted reload | Echo Module old/new generation, previous nullable applied revision, and exactly retried current policy; revoke any surviving content/resources, enter preparing, and rerun all policy/support/static/revision checks before ready. |
| any requestable state | stale/regressing/non-recoverable request | Correlated rejection (`stale-policy` for reload policy unequal to current desired; `not-recoverable` for policy change from source/revision/static-invalid unavailable); no state/resource change or Host call. |
| any | source/trust/profile replacement | Emit correlated `cancelled: replaced` for any reserved request, release reservation, then retire connection/lease and attach new immutable requirement. |
| any | physical target/view-epoch replacement | Adapter/runtime synchronously invokes `onViewInvalidated(connectionId, 'target-replaced')` before invalidating/exposing targets, even when Host Capability identity is unchanged. Module emits correlated `cancelled: replaced` for reserved request, releases reservation, retires old connection/lease, then allocates fresh connection/generation for same immutable requirement/policy; no ready facts carry over and every policy/support/revision check repeats. If the signal cannot be guaranteed, replacement must use capability/mount disposal and reattachment instead of silent target swap. |
| any | host crash | Before publishing unavailable/error, Module settles an in-flight policy/reload as rejected `host-crashed` and releases its reservation; null revision before policy, numeric runtime error after policy; no privilege change. |
| any | detach/dispose | Emit correlated `cancelled: disposed` for any reserved request before revoking delivery; release reservation, revoke target/hooks/resources/Focus/A11y mapping, then ignore old callbacks. |

### Fake-host exercise

1. attach immutable surface/artifact at Module generation 1 and policy 2; preparing/null policy precedes work;
2. fail pre-policy lookup with `policy-unavailable`; request strictly newer policy 3 from that recoverable unavailable state, reserve/allocate new generation, enter preparing, and recover only after full policy/support/static/artifact verification;
3. try same/equal or regressing policy from unavailable and reject `regressing-policy`; try policy change from source-unavailable/revision-mismatch/static-invalid and reject `not-recoverable` without Host call; use reload or reattachment as specified;
4. have resolver/cache return right artifact ID but wrong revision; emit source-revision-mismatch, commit no content, then ready only on exact source revision;
5. after policy change 3 -> 5, have Host claim applied 3; emit policy-revision-mismatch/no content, then ready only when applied equals desired 5;
6. reject navigation-producing content as applied unavailable, never runtime error;
7. fail each positive support proof, including no-relaxations sandbox, as exact applied unavailable; only exact ready support/empty reasons becomes ready;
8. from ready with transition pending, lose each proof; correlate support-lost/release, remove content/resources before unavailable, no stale ready content;
9. force content load failure/host crash; both error; reload fresh generation through complete verification;
10. reserve policy change, crash before result; correlated host-crashed/release then recovery reload accepted;
11. block navigation; no raw destination crosses; prove no message/IPC/content action path;
12. change App status during ready/pending policy; only Module/composition changes;
13. reserve generation then compete reload/policy; both transition-pending; accepted result releases;
14. desired/applied 5 reload expecting 4 rejects stale-policy; exact 5 reload succeeds with correlated generations/revision;
15. while request reserved, replace source/profile; cancelled replaced precedes retirement, then fresh connection/generation/verification;
16. while request reserved and capability object remains same, Adapter surface lifecycle calls `onViewInvalidated` before physical target swap; assert cancellation/release/retirement precede new target exposure, then fresh generation prepares with no inherited ready facts. Omit signal and require mount/capability dispose+reattach; silent swap is forbidden;
17. A11y + composition Enter/Leave; no Preview focus/name;
18. dispose pending request; cancelled disposed precedes callback revocation; old callbacks zero effects;
19. prove no raw content/policy mechanics/target/epoch/host object/message/executable value crosses.

This fake evidence proves policy recovery from explicit recoverable-unavailable states, non-recoverable source classification, lifecycle-visible target invalidation, exact artifact/policy binding, fail-closed support loss, cancellation, failure discrimination, positive sandbox readiness, runtime recovery, serialization, Host-free App status, Module generations, immutable identity, and no raw target channel. It does not prove real host behavior.

## Focus, accessibility, layout, and lifecycle

- Focus facts/requests remain in Focus. Option B's composition supplies parent-owned Enter Preview and Leave Preview controls before/after the frame; the Host Capability exposes only its frame focus target. Preview facts do not report `focused`.
- The static artifact pipeline rejects tabbable descendants. The Web profile relies on browser-native sequential navigation: Tab may enter the labelled static document, and the next Tab reaches the parent-owned Leave control; Shift+Tab returns to Enter. No unreachable inner F6 handler or message bridge is assumed.
- Composition owns both controls and Focus topology; the host reports only `native-static-tab-order` support. Real-browser keyboard and screen-reader evidence must prove entry/exit. If the browser/host cannot guarantee it, `focus-path-unverified` makes the surface unavailable.
- App-provided frame name/description flows through A11y IR and the Adapter to the frame target. The static artifact pipeline owns the inner document's title, language, headings, links-as-text policy, and content semantics. Frame name does not name the inner document.
- Status/error/unavailable is exposed through ordinary composition and bounded App announcements. Inner document mutations do not drive a Proto UI live region.
- Parent-controlled viewport dimensions and responsive containment are host presentation. Inner scroll remains embedded-document/browser behavior and is not projected as `C-SCROLL-0001` facts. No child size or raw geometry enters portable state.
- Zoom/reflow, high contrast, reduced motion, color scheme, and accessible static markup are artifact/engine responsibilities. The fixed profile rejects active animation that the trusted artifact pipeline cannot bound. Proto UI owns only accessible/reflowing chrome and explicit degradation.
- One stable surface may receive multiple Module generations/connections. Module reserves at most one policy/reload transition per generation; policy change may recover only `PreviewPolicyRecoverableUnavailable` with a strictly newer desired revision; source/profile replacement or target invalidation delivers cancellation before retirement; accepted transition revokes surviving content before preparation; App status stays outside Host policy.
- Physical target replacement is terminal for old lease even when source/profile/capability are unchanged. Governed Adapter/host-surface lifecycle synchronously calls `onViewInvalidated(connectionId, 'target-replaced')` before old target invalidation/new exposure. Module cancels pending request, allocates fresh connection/generation, clears ready facts, and re-verifies policy/support/artifact revisions. If signal is unavailable, Adapter must dispose/re-attach mount/capability; silent target swap is forbidden. Callback exposes no target or epoch value.
- Required support is continuously fail-closed: proof loss rejects pending request/releases reservation, then Host revokes content/resources before unavailable. Host crash rejects pending before failure. Disposal sends cancelled-disposed before removing listeners/hooks/Focus/A11y/resource/object URL/renderer/target refs. Lease disposal does not delete artifact or global App authorization.

## Why no bidirectional bridge

Option B has no message schema because adding even one message changes the trust boundary:

- Web would require exact target origin where possible, current `origin` and `source` validation, versioned schema/size/rate limits, request/result correlation, navigation/source epoch binding, and capability-specific authorization.
- Opaque sandbox origins complicate exact targeting. Using `*` would require a separately reviewed proof and never relax receiver/source/schema validation.
- Electron/native hosts require sender-frame validation and a least-authority preload/IPC API; content messages cannot call shell, filesystem, Clipboard, network, or App services directly.
- A bridge would make the content an interactive tool/application class (option D), not trusted static HTML.

Any future bridge requires a separate threat model, security review, Contract/Host Capability revision, bounded schemas, executable adversarial tests, and matrix re-review. No MCP/A2UI or third-party embedded-app runtime is implied.

## Proposed entity and evidence graph

If a maintainer later accepts semantic admission, the smallest coherent graph is:

```text
C-PREVIEW-SURFACE-0001 (draft contract; trusted-static profile only)
  <- satisfied by M-PREVIEW-SURFACE-0001
       -> requires HC-PREVIEW-SURFACE-0001
  <- verified by T-PREVIEW-SURFACE-0001

K-HOST-SURFACE-ROLES-0001
C-HOST-SURFACE-PROJECTION-0001
C-FOCUS-0001 / C-A11Y-0001
  <- referenced/depended on as applicable

A-REACT-18-19-0001
  -> may later support/provide the new Module/Host Capability only after
     reviewed Web security and behavioral evidence
```

No new Adapter identity is justified: existing profiles receive relations only after evidence. No public Browser or Preview Prototype is justified by research alone. Prototype identity/anatomy and chrome require a later admitted authoring slice. Image View, Portal, Boundary, Scroll, and Dialog remain separate; none is revised into a sandbox owner.

### Bounded red-first plan

1. **Portable negatives:** reject raw content/URI/CSP/sandbox tokens/callback/iframe/webview/message/DOM/object URL/permission/controller/navigation/label/App status and immutable identity in Host policy.
2. **Policy/failure negotiation:** exact requested artifact and current desired policy revisions; exact positive isolation/support shape including no-relaxations sandbox proof and empty reasons; pre-policy null unavailable, applied unsupported/mismatched-revision unavailable, runtime content/crash error; no branch ambiguity or weak fallback.
3. **Static validation/state:** reject active/navigation content; preparing precedes work; controlled commit at exact requested artifact/policy revisions causes ready; source/profile reattaches; ready support loss revokes content before unavailable; stale callbacks reject.
4. **Generation/recovery serialization:** Module allocates/reserves one pending policy/reload per generation; reload retries exact current policy; strictly newer policy change recovers only cataloged recoverable-unavailable states; source/revision/static failures reject as non-recoverable; competing request rejects; runtime reload uses fresh generation; all result/crash/replacement/disposal paths settle/release before teardown; accepted transition fully prepares.
5. **Target replacement:** same-capability physical target change synchronously signals `onViewInvalidated` through governed Adapter surface lifecycle before swap; cancellation/retirement/fresh generation/no inherited ready/full re-verification; absent signal forces mount/capability dispose+reattach; no raw target/epoch.
6. **Status ownership:** App status updates only Module/composition, including while policy pending; Host request/result cannot roll it back.
7. **Observable navigation/actions:** host-observable attempts block; raw URL stays security-local; content cannot invoke App actions.
8. **No bridge:** no message listener/port/preload/IPC/content-to-App path.
9. **Focus/A11y:** A11y naming; composition Enter/Leave; no tabbable descendants; browser proves native Tab; no focus/name facts.
10. **Real Web security:** a controlled adversarial fixture attempts script, parent DOM access, subresource network, form, navigation, popup, download, permissions, storage, and messaging; every denied capability and zero sandbox relaxation tokens are positively observed at the host boundary without unsafe real side effects.
11. **Real Web accessibility/layout:** frame label and static document semantics, keyboard entry/exit, fallback/error/reload announcement, 320px/390px/desktop, zoom/reflow, high contrast, reduced motion, target replacement with full re-verification, and cleanup.
12. **Non-Web:** independent Electron/native profile proves process/origin isolation, Node/API denial, permissions, navigation/new-window/external-open, no IPC, accessibility, focus, crash, and cleanup before multi-host language.

## #513/#514 matrix consumption

PR #563 carries `internal/agent-harness/dogfood-coverage-matrix.md`, but it is not on `main`, is conflicting, and has an active `CHANGES_REQUESTED` review. This record must not copy that matrix or create a second source of truth.

After the matrix carrier lands, a follow-up #532 carrier must update exactly:

- `harness.future.preview-chrome`: replace pending ownership with option B; keep `research` until semantic admission, link this record, name the proposed `C-*` / `M-*` / `HC-*` / `T-*` checkpoint, distinguish Image/Code/static content fallbacks, and trigger re-review on trust/profile expansion, script/network/navigation/external-open/message capability, interactive content, remote browsing, or non-Web claims.
- `harness.future.preview-engine`: retain `infrastructure-exempt`; settle the exemption for browsing context/renderer, origin/sandbox/CSP/network/storage/permission enforcement, content, object URLs, and inner-document accessibility; re-review on engine/profile selection, policy weakening, content-to-App bridge, raw-host leakage, or capability expansion.
- Recompute totals only if a state changes. This recommendation keeps both current state counts unchanged.

#513 should receive the landed record/matrix-carrier link. #514 remains owner of the single matrix. Until that projection lands, #532 is advanced rather than closed.

## Acceptance mapping

- Static image/document, trusted static HTML, trusted interactive, untrusted interactive, remote browser, embedded tool, and native webview classes are separated.
- App/backend, sandbox engine, Proto UI owner, Host Capability/Adapter, composition, and embedded-content responsibilities and threats are explicit.
- Option B is the smallest safe proposal; C/D/E and untrusted/remote execution are explicit deferrals.
- Capability denial, navigation/external-open, no-message security, Focus/A11y, layout, state/generation, crash/reload/replacement, late callbacks, and cleanup are documented.
- No executable code, raw content/URI, host object, controller, iframe/webview, Window, MessagePort, framework/native view, or third-party embedded runtime enters portable authoring.
- No authority is inferred from rendered content or trust classification.
- The conclusion is one `next proposal checkpoint`; no materially different viable first-slice owner remains unresolved.
- Exact #513/#514 rows and re-review triggers are identified; their authoritative projection remains the next carrier after PR #563.

## Residual risks and smallest human decision

Residual risks: iframe sandbox does not itself deny network; static-content validation and CSP/custom-protocol enforcement are host-specific; browser load events cannot prove success; unique/opaque origins complicate future messaging; inner-document accessibility and focus vary; content may leak data through resources if network denial fails; object URL/custom protocol cleanup can race replacement; native webviews have different process/permission defaults; an apparent “static” format can gain active features over time.

Smallest later human decision: accept or reject admission of `C-PREVIEW-SURFACE-0001` / `M-PREVIEW-SURFACE-0001` / `HC-PREVIEW-SURFACE-0001` / `T-PREVIEW-SURFACE-0001` for `trusted-static-no-execution-v1` with the exclusions above. Acceptance authorizes a separate spec proposal, not an iframe/webview implementation, engine/profile choice, public Prototype, or executable content. Rejection leaves Image/Code/static authored content plus ordinary Proto UI chrome and an infrastructure-only private preview.
