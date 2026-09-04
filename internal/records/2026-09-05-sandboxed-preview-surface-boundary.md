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

- App patch: stable opaque `surfaceId`, `source: { artifactId, revision }`, `trust: trusted-static`, exact policy profile ID/revision, and App loading/error status. It contains no URI, HTML, code, CSP string, sandbox token list, framework value, or object URL.
- Host facts: a discriminated attachment/preparing/ready/error/unavailable state; applied policy revision; generation; verified support; and bounded reason codes. Focused state is reported only through Focus. Accessible name/description remain A11y IR.
- Requests/results: reload with expected generation/policy revision and bounded outcome; blocked navigation attempt classification with no raw URL; close remains an App action; focus/blur remain Focus-domain requests.
- Content title and URL remain host/content-local. Chrome uses an App-owned artifact label. Content-controlled strings do not become portable status or accessible name.
- No application-message request/result exists in option B.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| Artifact/policy reference | App -> Preview Module -> Host Capability resolver | Static document appears only after policy verification and host content commit. | Stable surface ID, Module connection, generation, policy revision. |
| Raw HTML/resources | App artifact service -> sandbox engine directly | Inner document renders under fixed restrictions. | Host-only pipeline; zero raw content in Proto UI values. |
| Readiness/failure | Artifact resolver + host policy/commit -> Host Capability -> Module | `preparing -> ready/error/unavailable` with bounded reason. | Current connection/generation/policy; iframe `load` alone is insufficient. |
| Reload | App Button -> Module request -> Host Capability | New generation revalidates policy/source and replaces target/content. | Expected current generation and policy revision; stale request rejects. |
| Navigation attempt | Embedded context -> host blocker -> Module summary | Attempt remains blocked; optional bounded kind/outcome supports status/audit. | Current connection/generation/policy; raw destination never crosses. |
| Focus entry/exit | Focus domain -> Host Capability focus bridge | Focus enters frame/document or returns to Harness exactly once. | Focus/view epoch; Preview facts do not duplicate focus. |
| Accessible naming | A11y semantic object -> HC-A11Y/Adapter -> frame target | Frame has one App-owned concise label/description. | A11y identity and target epoch; inner document names itself. |
| Close/open action | Proto UI Button -> App service | App removes surface or opens only its validated artifact URL. | App authorization/idempotency; content cannot trigger it. |
| Messages | No route. | No listener, port, callback, request, or result. | Option B invariant. |

## Fake-host protocol and state machine sketch

```ts
type PreviewSourceRef = Readonly<{ artifactId: string; revision: string }>;

type PreviewUnavailableReason =
  | 'source-unavailable'
  | 'policy-unavailable'
  | 'sandbox-unverified'
  | 'execution-not-denied'
  | 'network-not-denied'
  | 'navigation-not-denied'
  | 'permissions-not-denied'
  | 'accessibility-unavailable'
  | 'host-crashed';

type PreviewSupport = Readonly<{
  execution: 'denied' | 'unverified';
  network: 'denied' | 'unverified';
  navigation: 'denied' | 'unverified';
  messages: 'absent' | 'present';
  accessibility: 'embedded-document' | 'unavailable';
  reasons: readonly PreviewUnavailableReason[];
}>;

type PreviewPatch = Readonly<{
  surfaceId: string;
  source: PreviewSourceRef;
  trust: 'trusted-static';
  policyProfileId: 'trusted-static-no-execution-v1';
  policyRevision: number;
  appStatus: 'idle' | 'loading' | 'ready' | 'error';
}>;

type PreviewBaseFacts = Readonly<{
  appliedPolicyRevision: number | null;
  generation: number;
  support: PreviewSupport;
}>;

type PreviewFacts =
  | (PreviewBaseFacts & Readonly<{ attachment: 'detached' | 'preparing' }>)
  | (PreviewBaseFacts &
      Readonly<{
        attachment: 'error' | 'unavailable';
        reason: PreviewUnavailableReason;
      }>)
  | (PreviewBaseFacts &
      Readonly<{
        attachment: 'ready';
        committedArtifactRevision: string;
      }>);

type PreviewNavigationResult = Readonly<{
  attemptId: string;
  kind: 'same-document' | 'descendant' | 'top' | 'popup' | 'external' | 'download';
  outcome: 'blocked';
  appliedPolicyRevision: number;
  generation: number;
}>;

type PreviewConnection = Readonly<{
  // Issued and retired by the Module; callback closures reject retired identities.
  connectionId: string;
  generation: number;
  patch: PreviewPatch;
  onFacts(connectionId: string, facts: PreviewFacts): void;
  onNavigation(connectionId: string, result: PreviewNavigationResult): void;
}>;

type PreviewLease = Readonly<{
  update(update: Readonly<{ generation: number; patch: PreviewPatch }>): void;
  requestReload(
    request: Readonly<{
      requestId: string;
      expectedGeneration: number;
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

The patch, facts, requests, and results contain no functions outside the internal connection, raw content/URL, execution value, host target, or message channel. A fake host is injected with private artifact and policy resolvers.

### Transition table

| Current | Input | Required transition/result |
| --- | --- | --- |
| detached | attach valid source/profile | Module issues connection/generation; host reports `preparing` before content work. |
| preparing | all restrictions verified and controlled content committed | `ready` for current artifact revision; native iframe `load` alone cannot cause this. |
| preparing | source missing, profile mismatch, or restriction unverified | `unavailable` with bounded reason; no content attaches. |
| preparing/ready | resolver/renderer failure | `error`; target content is revoked and fallback remains reachable. |
| ready | any content navigation/download/popup attempt | Host blocks it, reports bounded kind/outcome, stays `ready`; raw URL is discarded or kept only in App security audit. |
| ready | reload with matching expected generation/policy | Module creates a new generation; old target/resources terminate; new state is `preparing`. |
| any live state | source/trust/profile/policy replacement | New generation and policy verification before content; no weaker fallback. |
| any live state | old callback/result | Ignore by retired connection, generation, or policy revision. |
| any live state | host crash | Current `error`/`unavailable` with reason; no automatic privilege change. |
| any live state | detach/dispose | Revoke target, observers, navigation hooks, object URLs/custom-protocol lease, resolver callbacks, Focus/A11y target mappings; no later delivery. |

### Fake-host exercise

1. attach `surface-3` / `artifact-7@r4` under policy revision 2; verify `preparing` precedes resolver work;
2. make each required policy proof fail independently; observe `unavailable` with the exact bounded reason and zero content attachment;
3. resolve approved static content privately; observe `ready` only after policy verification and controlled commit, not a simulated iframe load;
4. attempt same-document, descendant, top, popup, external, and download navigation; assert each is blocked once, raw destinations never cross, and state remains ready;
5. assert no message listener/IPC/port exists and no content event can invoke reload, close, external-open, or App action;
6. invoke reload with stale/current generation and policy revisions; reject stale, create a new current generation, and revoke the old target/object URL before replacement;
7. replace source/policy/target and collide host-local counters; Module connection/generation/policy identity rejects old facts/navigation;
8. route frame naming through a separate A11y fake and focus through a separate Focus fake; Preview facts contain neither name nor focused state;
9. dispose, then emit resolver completion, crash, navigation, resize, focus, and synthetic message; observe zero callbacks/resources/actions;
10. recursively inspect all portable values and prove no HTML/code/URI/CSP/sandbox token, host target, object URL, controller, Window/webview/WebContents, MessagePort, or executable value appears.

This fake evidence proves protocol shape and fail-closed state transitions only. It does not prove actual browser/native sandbox enforcement, origin isolation, network denial, focus behavior, accessibility, or resource cleanup.

## Focus, accessibility, layout, and lifecycle

- Focus facts/requests remain in Focus. The Preview Host Capability exposes the current physical focus entry target only to Focus integration; Preview facts do not report `focused`.
- The Web Harness profile reserves `F6`/`Shift+F6` for next/previous Harness regions and provides an adjacent named Proto UI Button to leave the preview. Bare Escape is not a universal Preview action; if the Preview is inside a real Dialog, Dialog owns Escape/trap/restore.
- Option B rejects interactive inner controls. Tab may enter the embedded document for screen-reader/static-document navigation; the reserved Focus route and visible leave control guarantee exit. A host that cannot provide both reports the surface unavailable.
- App-provided frame name/description flows through A11y IR and the Adapter to the frame target. The static artifact pipeline owns the inner document's title, language, headings, links-as-text policy, and content semantics. Frame name does not name the inner document.
- Status/error/unavailable is exposed through ordinary composition and bounded App announcements. Inner document mutations do not drive a Proto UI live region.
- Parent-controlled viewport dimensions and responsive containment are host presentation. Inner scroll remains embedded-document/browser behavior and is not projected as `C-SCROLL-0001` facts. No child size or raw geometry enters portable state.
- Zoom/reflow, high contrast, reduced motion, color scheme, and accessible static markup are artifact/engine responsibilities. The fixed profile rejects active animation that the trusted artifact pipeline cannot bound. Proto UI owns only accessible/reflowing chrome and explicit degradation.
- One stable surface may receive multiple Module-issued generations/connections. Source, trust, profile, policy, target, or session replacement terminates old work before current facts publish.
- Disposal removes target listeners/observers, navigation/new-window/permission hooks, Focus/A11y target bindings, resource/custom-protocol leases, object URLs, renderer subscriptions, and target/controller references. Option B has no message listener to remove.
- Disposing the Preview lease does not delete the artifact or revoke App authorization globally; those are App lifetimes. It revokes only the host resources it owns.

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

1. **Portable negatives:** reject raw HTML/code/URI, CSP/sandbox token list, executable callback, iframe/Window/webview/WebContents/native view, MessagePort/IPC, DOM/framework object, object URL, permission handle, renderer/controller, raw navigation destination, and content-provided label.
2. **Policy negotiation:** each required execution/network/navigation/permission/message restriction fails independently to `unavailable`; no partial profile loads or weak fallback.
3. **State/generation:** preparing precedes content work; controlled commit—not iframe load—causes ready; source/profile/policy/reload replacements issue Module generations and retire old connections; stale callbacks reject.
4. **Navigation/actions:** every navigation/new-window/download kind is blocked; raw URL stays in security infrastructure; content cannot invoke App actions or external open.
5. **No bridge:** static inspection and runtime spies prove no message listener, port, preload, IPC handler, or content-to-App request path.
6. **Focus/A11y:** separate Focus/A11y fakes own target focus and naming; F6/Shift+F6 and visible leave control; frame label plus inner document metadata; Preview facts contain neither focus nor naming.
7. **Lifecycle:** target/source/policy/session replacement; crash; reload; object URL/custom protocol; observer/listener/hook/resolver cleanup; no post-dispose delivery.
8. **Real Web security:** a controlled adversarial fixture attempts script, parent DOM access, subresource network, form, navigation, popup, download, permissions, storage, and messaging; every denied capability is observed at the host boundary without unsafe real side effects.
9. **Real Web accessibility/layout:** frame label and static document semantics, keyboard entry/exit, fallback/error announcement, 320px/390px/desktop, zoom/reflow, high contrast, reduced motion, target replacement, and cleanup.
10. **Non-Web:** independent Electron/native profile proves process/origin isolation, Node/API denial, permissions, navigation/new-window/external-open, no IPC, accessibility, focus, crash, and cleanup before multi-host language.

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
