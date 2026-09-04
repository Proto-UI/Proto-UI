# Terminal Surface boundary for later Agent Harness work

Date: 2026-09-05

Status: non-normative research recommendation for #530. This record does not admit a Contract, Module, Host Capability, Prototype, Adapter relation, terminal engine, PTY backend, or implementation.

Refs: #513 (Agent Harness tracker), #514 (coverage matrix), #517 (Code Block), #521 (windowing), #530 (this research).

## Recommendation

Advance **option C: a narrow interactive Terminal Surface proposal checkpoint**. Keep the terminal emulator, mutable cell grid, escape parsing, alternate screen, scrollback, selection engine, mouse protocol, PTY/process lifecycle, transport, permissions, reconnection, and audit completely outside Proto UI portable state.

The next checkpoint should consider one semantic Module plus one lease-shaped Host Capability for low-cardinality status, focus entry/exit, committed text/key intent, character-cell resize negotiation, bounded attention/error facts, and host-owned accessibility projection. It should not admit an engine, public Prototype, or Adapter support claim yet.

This is smaller and more honest than option D, while unlike B it fulfills the first terminal-specific user job: interact with a full-screen or cursor-addressed process rather than merely read output. Option A remains the fallback for logs and static output.

Classification: **next proposal checkpoint**. The engine remains **infrastructure-exempt behind a narrow host surface**.

## Evidence and authority

### Repository authority

The following catalog entities are draft unless stated otherwise:

- `K-HOST-SURFACE-ROLES-0001-A..D` distinguishes `boundaryTarget`, `surfaceTarget`, and host-private targets/controllers. Splitting roles creates no second semantic owner or portable channel.
- `C-HOST-SURFACE-PROJECTION-0001-A/B/D/E` keeps lifecycle and logical identity at `boundaryTarget`, limits `surfaceTarget` to presentation, leaves focus/a11y/event/native targets to their domains, and requires replacement cleanup.
- `C-TEXT-CONTROL-0001-A/C/F/G/H`, `D-TEXT-CONTROL-PROJECTION-0001-A/C/D/E`, and `HC-TEXT-CONTROL-0001` are the worked precedent for portable requirements, a host-owned engine, normalized events, a bounded lease, editing-session preservation, and Web-only evidence limits. They do not authorize expanding Textarea into a terminal.
- `C-FOCUS-0001-B/C/D/G` distinguishes focus facts/requests/eligibility/topology/policy, keeps fact ownership in Focus, and lets entry regions delegate without creating Terminal-specific focused state.
- `C-A11Y-0001-B/D/E/G/H/I` and `HC-A11Y-0001` govern semantic-object name/description/state/relation facts, state-backed mode, updated name/description projection, and native/degraded host projection; Terminal patches do not form a second A11y channel.
- `C-SCROLL-0001-D/E`, `M-SCROLL-0001-D/E`, and `HC-SCROLL-SURFACE-0001-D` keep geometry and high-frequency host facts behind a lease, require released leases to stop delivery, and require stale-callback suppression and cleanup.
- Active `D-ADAPTER-PROFILE-0001-B/C/D/E` means an existing Adapter can claim Terminal Module support or Host Capability provision only after concrete reviewed evidence. Absence from an Adapter profile means uncataloged, not unsupported.

Current implementation and tests confirm those adjacent patterns:

- `packages/adapters/base/src/host/surface-projection.ts` keeps adapter-private boundary/surface mapping replaceable without owning a domain target.
- `packages/modules/text-control/src/caps.ts` expresses a data-only `attach`/`update`/`snapshot`/`dispose` lease.
- `packages/modules/text-control/test/impl-spec.test.ts` proves normalized fake-host callbacks and lease cleanup without leaking a host target.
- `T-HOST-SURFACE-PROJECTION-0001` and `T-TEXT-CONTROL-0001` bind those guarantees to executable evidence.
- Targeted searches found no Terminal Surface, PTY, or xterm implementation in `packages/**`. No `T-TERMINAL-*` evidence exists.

`apps/www/src/content/docs/en/build/host-caps.md` accurately projects the Module -> Host Capability -> Adapter split, lease lifetime, fake-host limits, and no-raw-target rule. `internal/records/2026-08-02-host-surface-projection.zh-CN.md` and `internal/records/2026-08-02-text-control-host-boundary.zh-CN.md` are context, not authority.

### External primary sources

Web evidence was inspected at xterm.js commit `c58ea3637f3968e0e6e79cd92cf9aace7ef89ee2`:

- [public typings](https://github.com/xtermjs/xterm.js/blob/c58ea3637f3968e0e6e79cd92cf9aace7ef89ee2/typings/xterm.d.ts) expose engine-owned DOM elements and input textarea, buffer/mode state, `onData`, binary mouse reports, key interception, resize, selection, title, bell, direct rendering, and disposal. `onWriteParsed` is already coalesced to at most once per frame, while resize documentation recommends debouncing before PTY propagation.
- [AccessibilityManager](https://github.com/xtermjs/xterm.js/blob/c58ea3637f3968e0e6e79cd92cf9aace7ef89ee2/src/browser/AccessibilityManager.ts) builds an engine-specific row list and live region, synchronizes rows with buffer/render/scroll, suppresses echoed input, stops normal announcement after 20 output rows, handles boundary focus, and disposes listeners and accessibility DOM.

Non-Web evidence was inspected in Microsoft Console and Windows Terminal sources at or before Microsoft Terminal commit `093e49e29a9f806ff83025c49be5d0c970673b00`:

- [Creating a Pseudoconsole session](https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session) assigns bidirectional handles, buffering, VT decoding, process creation, character-cell resize, final-frame draining, and close/deadlock hazards to the host/backend integration.
- [Window and Screen Buffer Size](https://learn.microsoft.com/en-us/windows/console/window-and-screen-buffer-size) states that VT window and screen-buffer sizes coincide and terminal scrollback belongs to the terminal rather than the addressable console area.
- [Windows Terminal selection](https://learn.microsoft.com/en-us/windows/terminal/selection) documents engine-specific mouse modes, keyboard mark mode, block selection, explicit copy, and input fallthrough.
- [Keyboard Selection spec](https://github.com/microsoft/terminal/blob/093e49e29a9f806ff83025c49be5d0c970673b00/doc/specs/%234993%20-%20Keyboard%20Selection/Keyboard-Selection.md) separates Terminal Control input policy from Terminal Core selection state and requires selection-change notification through UI Automation.
- [Search spec](https://github.com/microsoft/terminal/blob/093e49e29a9f806ff83025c49be5d0c970673b00/doc/specs/%23605%20-%20Search/spec.md) keeps terminal input and search-box input separate, defines focus transfer and Escape restoration in native XAML chrome, and lets the buffer/search engine own matching and selection.

These sources support a cross-host boundary, not cross-host conformance: engines own terminal protocol, buffers, selection, rendering, and platform accessibility mechanics; a narrow surface may coordinate portable facts and requests without copying those internals.

## User-job and slice comparison

| Option | User job | Benefit | Cost or failure | Disposition |
| --- | --- | --- | --- | --- |
| A. No Terminal domain | Read append-only output or a static code/log artifact. | Already has an honest path through App-authored content and the #517 Code Block composition boundary. | Cannot represent cursor addressing, alternate screen, terminal input modes, resize, or a mutable screen. | Keep as fallback; not a terminal. |
| B. Read-only terminal screen/scrollback | Inspect cursor-addressed or alternate-screen output without sending input. | Preserves visual terminal fidelity through an engine. | Pays nearly all emulator, accessibility, selection, rendering, and lifecycle cost while failing the primary interactive job. Static logs should use A. | Do not make the first Proto UI slice. A host may embed this privately as infrastructure. |
| C. Interactive input + resize | Focus a terminal, enter text/keys, observe status, and keep rows/columns synchronized. | Smallest terminal-specific end-to-end job; fakeable without raw engine values. | Requires explicit shortcut, IME, focus escape, accessibility, epoch, and cleanup policy. | **Recommended proposal checkpoint.** |
| D. Selection/search/clipboard/mouse | Operate full terminal workbench features. | Rich parity with mature terminal products. | Selection/core state, Clipboard, find UI, mouse reporting, and security policies widen several owners at once. | Defer. Preserve engine defaults where available; no portable API claim. |

## Responsibility and trust table

| Layer | Owns | Receives across the boundary | Must never expose to portable authoring |
| --- | --- | --- | --- |
| App/backend | Session identity; process/PTY lifecycle; command authorization; transport; reconnection; permissions; audit; authoritative connection/process state; explicit stop/restart. | Data-only terminal session reference; normalized resize request/result; bounded action requests. | PTY handles, pipes, sockets, streams, process handles, authorization tokens, raw transport callbacks. |
| Terminal engine infrastructure | VT/escape parsing; mutable cell grid; cursor and alternate screen; scrollback; reflow; glyph measurement; selection; terminal mouse modes; paste encoding; renderer; engine accessibility buffer; direct high-frequency diffs; session-scoped engine/parser/buffer lifetime. | Host-local target and backend byte/data channels supplied outside Proto UI authoring. | Engine instance, buffer, parser, renderer, DOM/canvas/native view, controller, mutable selection, raw output/input stream. |
| Proto UI Terminal semantic owner | Module-issued logical instance identity; attachment/display facts; resolved input mode; observational committed text/key intent; resize correlation; bounded attention/error; view-lease identity, policy generation, and stale-result rejection. | Plain immutable facts/requests plus Focus-domain identity, view epoch, eligibility, and request/fact participation; Focus remains sole fact owner. | Cell/grid/scrollback, raw bytes, host events/geometry, engine modes/controllers, App-selectable owner identity, focus fact ownership, App credentials or process authority; no second input send path. |
| Terminal Surface Host Capability | Atomically acquire one session resize-owner lease for the Module-issued instance; resolve replaceable target/view binding to session-affine engine and immutable backend binding; attach/detach views without releasing owner/resetting engine; bridge keyboard/IME/focus; synchronously enforce current generation/input/sink policy; encode/write accepted input exactly once; optionally report normalized observation; validate/serialize resize; expose native accessibility; clean view resources; release owner only on explicit final instance disposal. | Immutable Module instance/session/backend requirement, generation-stamped policy updates, observational callbacks, and adapter-injected resolver. | No raw target/engine/backend sink in portable authoring; no cross-session engine reuse without reset evidence; no owner release or session-engine disposal from view-lease cleanup; no Module-to-backend replay of observed input. |
| Adapter profile | Materialize `boundaryTarget` and actual presentation/input/a11y targets; wire the Host Capability; translate lifecycle and Focus participation. | Governed Module requirement and capability token after admission. | No semantic reinterpretation and no support/provision relation before profile-specific evidence. |
| Composition/design language | Tabs, toolbar, label, connection badge, reconnect/close, status, search/copy controls when separately admitted, visible leave-terminal control. | App facts and ordinary Proto UI control events. | Terminal protocol, key encoding, PTY/process control, buffer/selection state, engine-owned accessibility tree. |

The engine can remain completely outside Proto UI. Host configuration resolves a session-affine engine and resize coordinator by opaque `sessionId`, then the backend sink by immutable `backendBindingId`; none crosses portable authoring. The session host owns engine/parser/buffer/coordinator lifetime independently of replaceable Terminal view leases and backend bindings.

## Portable facts, requests, and information paths

### Candidate first-slice values

The proposal may evaluate these plain values; names are illustrative and not an admitted API:

- App input: opaque `sessionId` and `backendBindingId`, resolved `inputMode: interactive | read-only | disabled`, independent Module/composition connection/process status, and shortcut-policy ID. The Module mints the immutable per-logical-instance `terminalInstanceId`; the App cannot choose or collide it. Name/description remain A11y facts.
- Host facts: attachment, composition, dimensions, input/resize/accessibility/keyboard-route/mouse-reporting support with bounded reasons, and revision-bound resize outcome. Focus remains in Focus; App connection/process status and title stay outside Host policy.
- Requests/results: committed text, bounded key intent/special-key request, serialized resize with applied/rejected result, and attention/error. Focus/blur remain Focus requests.

`columns` and `rows` must be finite positive safe integers. The Module/Host rejects `0`, negatives, fractions, `NaN`, `Infinity`, and values above the safe-integer range as `invalid-dimensions` before allocating a resize revision, mutating the coordinator, or calling engine/backend; pixels, rectangles, font metrics, device scale, observers, and layout objects remain host-local. The first slice admits exactly one active Module-issued `terminalInstanceId` resize owner per `sessionId`. A Host session coordinator atomically grants a separate owner lease before any view can become ready and rejects a different live instance with `resize-owner-conflict`. Disposing/replacing a view cannot release the owner; same-instance replacement attaches through the retained owner lease. Explicit final instance release waits for pending resize settlement, then permits another instance to acquire. The coordinator permits at most one unresolved resize across the owner's old/replacement views and retains only newest valid geometry while pending. A resize becomes fact only after Host completion with Module revision/effective dimensions; only then may retained newest size dispatch. Replacement must cancel+await, or await completion and reapply newest size, before ready. Thus old work cannot execute after new, duplicate App IDs cannot alias ownership, and differently sized instances cannot fight over one PTY. Terminal-controlled title stays outside portable facts.

A current accessible text snapshot can be a plain diagnostic/test result, but should not be continuously copied into portable State. The first slice should expose `host-bridge | bounded-snapshot | unavailable` support and prefer a host-owned accessibility bridge. Any later author-facing snapshot request requires a separate privacy, size, cadence, and stale-revision decision.

Selection summaries and copy requests are technically expressible as plain values, but are not needed by option C. The engine keeps default selection/copy behavior. No selected text or Clipboard payload enters portable State. Programmatic selection, search, Clipboard, mouse reporting, and hyperlinks remain option D.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| App connection/process facts | App/backend revokes the current input sink before publishing exited/failed -> Terminal Module/composition status; Module commits a newer resolved `disabled` policy plus Focus-ineligible state | Transport/process labels remain independent; all post-exit input produces zero writes. Restart requires a fresh backend binding/connection before interactive mode. | App/backend process epoch and sink revocation precede visible exit; no raw status field in Terminal Host patch. |
| Output bytes/VT data | App backend -> session engine directly | Engine updates visible grid/cursor/scrollback. | Session engine write/render queue; **zero portable grid updates**. |
| IME/text/key input | Physical target -> Host keyboard/engine encoder -> immutable backend binding | Host synchronously checks current generation, `interactive`, and live sink/process binding, then writes encoded input exactly once; `onInputObserved` is optional post-send observation only and can never write. Read-only/disabled/revoked sink produces zero writes. | Host's current Module policy generation plus App/backend process/binding epoch; stale/dead events drop before sink access. |
| Harness shortcut | Host keyboard arbiter -> App command owner | Harness action, with no duplicate terminal forwarding. | Keydown decision before engine processing. |
| Terminal key | Host keyboard arbiter fallthrough -> engine | Engine encodes and writes input to backend once, then may report normalized observation. | Same key event, once, under accepted policy and live sink epoch. |
| Host geometry | Active Module-issued instance -> target/font/DPR observers -> owner lease/session coordinator -> engine/backend resize | Coordinator rejects another instance for same session; owner keeps engine/process rows/columns converged with one mutation across old/replacement views; result carries Module revision/effective dimensions. | Atomic owner grant by `{ sessionId, terminalInstanceId }`; valid dimensions only; old operation completes/cancels before owner release, replacement ready, or newest retained dispatch. |
| Focus request or user entry | Focus domain eligibility/topology/request -> Host Capability's focus bridge -> physical engine input target | One focused logical terminal surface; `disabled` rejects entry, while focus facts return only through Focus. | The runtime commits resolved input mode and Focus eligibility together; current Focus/view epoch; Terminal facts do not duplicate focused state. |
| Accessible terminal content | Engine buffer -> host accessibility bridge | Platform screen reader navigates bounded/current content. | Host accessibility lifecycle; not generic Proto State. |
| Bell/error | Engine/host -> normalized attention fact -> App/composition policy | Bounded visual/audible/status response respecting user settings. | Deduplicated semantic signal, not per-cell output. |

## Fake-engine / fake-host protocol sketch

The connection callbacks below are Module-to-Host internals. They are not Prototype props and do not make functions or engine values portable.

```ts
type TerminalDimensions = Readonly<{ columns: number; rows: number }>;
type TerminalSize = TerminalDimensions & Readonly<{ revision: number }>;
type TerminalResizeRejectReason = 'invalid-dimensions' | 'resize-unavailable' | 'backend-rejected';

type TerminalUnavailableReason =
  | 'engine-unavailable'
  | 'engine-session-mismatch'
  | 'backend-unavailable'
  | 'backend-binding-unavailable'
  | 'input-unavailable'
  | 'keyboard-route-unavailable'
  | 'mouse-reporting-not-denied'
  | 'accessibility-unavailable'
  | 'resize-unavailable'
  | 'resize-owner-conflict'
  | 'backend-rejected';

type TerminalResizeResult =
  | Readonly<{
      revision: number;
      outcome: 'applied';
      requested: TerminalDimensions;
      effective: TerminalDimensions;
      reason: null;
    }>
  | Readonly<{
      revision: number | null;
      outcome: 'rejected';
      requested: TerminalDimensions;
      effective: null;
      reason: TerminalResizeRejectReason;
    }>;

type TerminalSurfaceSupport = Readonly<{
  input: 'available' | 'read-only' | 'unavailable';
  keyboardRoute: 'available' | 'unavailable';
  mouseReporting: 'denied' | 'unverified';
  resize: 'available' | 'unavailable';
  accessibility: 'host-bridge' | 'bounded-snapshot' | 'unavailable';
  reasons: readonly TerminalUnavailableReason[];
}>;

type TerminalSurfaceRequirement = Readonly<{
  // terminalInstanceId is unique, immutable, and minted by the Module.
  terminalInstanceId: string;
  sessionId: string;
  backendBindingId: string;
}>;

type TerminalSurfacePatch = Readonly<{
  inputMode: 'interactive' | 'read-only' | 'disabled';
  shortcutPolicyId: string;
}>;

type TerminalSurfaceUpdate = Readonly<{
  // Strictly increasing and issued by the Module.
  generation: number;
  patch: TerminalSurfacePatch;
}>;

type TerminalLetter = Lowercase<
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'
>;

type TerminalKey =
  | TerminalLetter
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'Enter'
  | 'Escape'
  | 'Backspace'
  | 'Tab'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'
  | 'Insert'
  | 'Delete';

type TerminalKeyIntent = Readonly<{
  type: 'key';
  key: TerminalKey;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  repeat: boolean;
}>;

type TerminalInputIntent =
  | Readonly<{ type: 'text'; text: string; composing: false }>
  | TerminalKeyIntent;

type TerminalSurfaceFacts = Readonly<{
  attachment: 'detached' | 'attaching' | 'ready' | 'unavailable' | 'error';
  composing: boolean;
  columns: number | null;
  rows: number | null;
  support: TerminalSurfaceSupport;
}>;

type TerminalSurfaceSnapshot = Readonly<{
  // Captured atomically with facts; a stale generation cannot satisfy current policy.
  generation: number;
  facts: TerminalSurfaceFacts;
}>;

type TerminalSurfaceConnection = Readonly<{
  // Issued and retired by the Module; callback closures reject any retired identity.
  connectionId: string;
  requirement: TerminalSurfaceRequirement;
  initial: TerminalSurfaceUpdate;
  // generation is the policy generation under which the event/probe began.
  onFacts(connectionId: string, generation: number, facts: TerminalSurfaceFacts): void;
  onInputObserved(connectionId: string, generation: number, intent: TerminalInputIntent): void;
  onResizeRequest(connectionId: string, generation: number, dimensions: TerminalDimensions): void;
  // Completion may be observed by a retired view but always settles the session coordinator.
  onResizeResult(connectionId: string, result: TerminalResizeResult): void;
  onAttention(connectionId: string, generation: number, kind: 'bell' | 'error'): void;
}>;

type TerminalSurfaceLease = Readonly<{
  update(update: TerminalSurfaceUpdate): void;
  requestKey(generation: number, intent: TerminalKeyIntent): void;
  // The retained owner/session coordinator serializes across replacement views.
  requestResize(size: TerminalSize): void;
  snapshot(): TerminalSurfaceSnapshot;
  // View cleanup only; cannot release resize ownership.
  dispose(): void;
}>;

type TerminalResizeOwnerLease = Readonly<{
  attachView(connection: TerminalSurfaceConnection): TerminalSurfaceLease;
  // Final logical-instance disposal only; waits for/cancels pending resize before release.
  release(): void;
}>;

type TerminalResizeOwnerResult =
  | Readonly<{ status: 'acquired'; owner: TerminalResizeOwnerLease; reason: null }>
  | Readonly<{ status: 'unavailable'; owner: null; reason: 'resize-owner-conflict' }>;

type TerminalSurfaceHost = Readonly<{
  acquireResizeOwner(identity: {
    terminalInstanceId: string;
    sessionId: string;
  }): TerminalResizeOwnerResult;
}>;
```

A fake Module mints a unique `terminalInstanceId`; Host resolves a session-affine engine/coordinator from `sessionId`, atomically returns a separate resize-owner lease, then each view attach resolves its backend sink from `backendBindingId`. The objects/bytes never enter patches. App-authored values cannot select owner identity. View `dispose()` cannot release the owner; only explicit final `owner.release()` can, after pending resize settlement. Module owns connection/policy generations; Host owner/session coordinator owns exclusive participation and serialized resize across views/backend replacement. A Host callback echoes generation captured when work began; snapshots return generation that produced cached facts and never restamp. Sole input send path is Host/engine -> live immutable sink after synchronous generation/mode/process-epoch check; `onInputObserved` is post-send observation only. The red-first exercise:

1. Module mints `terminal-instance-7`; acquire owner for `session-7`, attach `backend-2` generation 1, receive ready support/A11y, snapshot generation 1;
2. App supplies a colliding label/value but Module mints distinct `terminal-instance-8`; its acquisition for live `session-7` rejects `resize-owner-conflict` and no geometry/input enters coordinator. Disposing/replacing instance 7's view does not release owner or let instance 8 acquire;
3. explicitly final-release instance 7 after pending resize settles; only then can instance 8 acquire. Releasing old view alone and duplicate App data never transfers ownership;
4. App/backend marks process exited while transport remains connected: revoke sink first, then publish exit; Module atomically commits disabled generation 2 plus Focus-ineligible. Raw/text/key/mobile input before/after Host update produces zero writes; returning interactive on old binding rejects. Restart uses fresh backend binding/connection;
5. start old support probe/event, update through read-only generation 3 to disabled generation 4, then complete old work; Host drops stale input before sink, and delayed observations/facts/old snapshot change nothing;
6. keep read-only Focus-eligible, then commit disabled plus Focus-ineligible; user/programmatic Focus entry rejects before Host bridge;
7. on a live process/binding return to interactive generation 5 and request mobile Escape; engine writes once, then one observation. Arbitrary/generation-mismatched keys reject before sink;
8. enable terminal mouse protocol; pointer reports produce zero backend writes while local selection changes;
9. make F6 reservation unavailable; report exact failure and reject composition independently of Button;
10. send dimensions `{0, 24}`, `{-1, 24}`, `{80.5, 24}`, `{NaN, 24}`, `{Infinity, 24}`, and unsafe integers; each rejects `invalid-dimensions` with null revision before coordinator/backend. Repeat invalid rows. Boundary `{1, 1}` proceeds;
11. as owner, dispatch resize 1, observe valid sizes 2/3 while unresolved, assert no second mutation; replace view through retained owner while pending; replacement cannot ready/dispatch until 1 completes/cancels, then applies newest at 120x40; reject next valid resize with backend reason;
12. reconnect same session/instance through `backend-3` while resize pending; retire old view/sink, retain owner/coordinator, await/cancel old completion, reapply newest before ready; old sink gets no later input while engine state remains;
13. replace target/view through same owner; engine state survives and stale callbacks cannot revive;
14. attempt same-session engine replacement without complete replay/rehydration and fail closed; session replacement final-releases old owner then acquires distinct engine/coordinator/owner;
15. try borrowed engine across sessions; reject mismatch absent complete reset;
16. simulate missing/unverified support; assert bounded reason;
17. omit/disable leave Button then provide Button + Focus topology;
18. with no resize pending dispose view and emit observations; zero view callbacks/writes while engine/coordinator/owner intact; call final owner release and prove another instance can acquire;
19. prove no engine/target/buffer/stream/sink/title/A11y duplicate/cell grid or owner lease enters portable authoring.

This makes Module-issued owner identity, owner/view lifetime separation, invalid-size rejection, post-exit input gating, generation-stamped snapshots, single-path input, policy-generation/Focus behavior, mouse suppression, session affinity, backend rebinding, session resize serialization, engine-state preservation, and cleanup testable. It does not prove real host behavior or Adapter conformance.

## Input, shortcut, and focus policy

- **IME:** candidate/composition UI stays host-owned. Only committed text may use text intent; composition command keys do not duplicate. Before encoding or sink access, Host checks current Module generation, resolved input mode, and App/backend process/binding epoch. It writes accepted input once through engine/backend, then may emit `onInputObserved`; Module never forwards observation. Stale/dead observation changes neither state nor input.
- **Resolved input mode/process gate:** one enum replaces conflicting booleans. Interactive permits input only while App/backend sink epoch is live; read-only preserves Focus eligibility/selection but suppresses input; disabled suppresses input and projects Focus-ineligible. On exited/failed, App/backend revokes sink before status publication, then runtime atomically commits newer disabled Terminal policy plus Focus eligibility. Restart/replacement requires a fresh backend binding/connection before interactive. Terminal owns no process or Focus facts.
- **Key versus text:** committed Unicode uses text; bounded non-text/modifier keys use `TerminalKey`. Letter/digit key intents require Ctrl/Alt/Meta; unmodified/Shift-only printable input uses text. Unsupported keys defer; no host event/raw encoding crosses.
- **Shortcut order:** configured Harness command wins before engine; other accepted keys fall through once. Host reports whether required F6/Shift+F6 reservation is available.
- **Escape route ownership:** bare Escape is terminal input. Host reports `keyboardRoute`; composition owns/requires reachable enabled leave Button and Focus topology. Either failure blocks composed acceptance.
- **Ctrl/Meta/Alt:** no blanket interception; only registered Harness chords stay local.
- **Paste:** App/host owns Clipboard/policy; committed paste routes only in interactive mode. Paths are text, not authority.
- **Pointer/mouse:** first slice requires Host suppression of engine terminal mouse reports even if the process enables them; pointer events produce zero backend writes while engine-local selection may remain. Custom mouse reporting is option D.
- **Mobile/virtual keyboard:** tapping may request host IME in interactive/read-only as appropriate. App-composed special-key Button uses `requestKey`; engine encodes only in interactive mode. Otherwise zero backend writes or explicit unavailable.

## Accessibility boundary

- The A11y domain supplies accessible name/description/mode to the resolved terminal target; App/Module facts and composition report independent connection/process/display status, focus entry, and the reliable exit control. Terminal patches do not duplicate A11y naming.
- The engine/Host Capability owns the mutable screen representation, cursor/selection mapping, row navigation, terminal modes, and platform accessibility API. Proto UI does not set a generic `textbox`, `application`, or `log` role for every terminal host.
- Streaming screen diffs never feed a generic Proto UI live region. The host bridge may announce bounded output according to engine/platform policy; App-level announcements are limited to state transitions such as connected, disconnected, input disabled, or a deduplicated bell/error.
- Engine-local keyboard selection and copy remain available when the host supports them. Any composition-provided Copy/Search control is a separately admitted ordinary Proto UI control invoking a host/App request; selected text and Clipboard contents stay outside portable state.
- Zoom, reflow, font metrics, glyph width, high contrast, cursor contrast, selection contrast, and screen-reader row geometry remain host/engine responsibilities. Resize results expose rows/columns plus acknowledged revision and applied/rejected outcome. Reduced-motion policy disables or reduces visual bell/cursor animation through host settings; the semantic attention fact is unchanged.
- A non-Web profile may use UI Automation or another native accessibility API and may degrade explicitly. Passing WC/React/Vue tests on the Web host cannot establish non-Web conformance.

## Performance, scrollback, and lifecycle

### High-frequency threshold

The portable threshold for terminal content is **zero cell/row/grid diffs**. The first cell mutation is engine-internal regardless of whether updates arrive once a second or once a frame; update rate is not a portable semantic. Low-cardinality facts may be deduplicated and coalesced to at most one publication per animation/frame scheduling turn, while status transitions and input/resize results remain lossless and ordered.

No portable Module receives `onRender`, `onWriteParsed`, buffer lines, dirty rectangles, glyph runs, or scroll positions. This avoids allocation/copy churn and prevents adapter profiles from re-litigating a grid schema.

Terminal scrollback is engine-owned. #521 windowed Collection applies to authored logical lists/logs, not a terminal buffer, cursor-addressed screen, alternate screen, or selection. A later App-exported immutable log snapshot may use Code Block/windowing after it leaves terminal semantics; that does not move live scrollback into Collection.

### Lifecycle rules

- One logical Terminal instance has a Module-minted immutable `terminalInstanceId`, one independent resize-owner lease, and replaceable view connections. App data cannot choose/collide owner identity. Target/backend/capability replacement disposes only view lease before fresh `owner.attachView`; update cannot change identity/requirement.
- Before first view ready, Host session coordinator atomically grants owner lease to one `terminalInstanceId`. A different live instance for same session is unavailable with `resize-owner-conflict` and cannot submit geometry/input. View disposal/replacement never releases grant. Explicit final instance `owner.release()` waits for/cancels pending resize, then releases; no replacement gap exists.
- Policy-sensitive callbacks carry connection plus Module generation. Host rejects stale/dead-process input before sink; Module rejects retired observation/facts. Snapshots atomically pair facts/generation. Resize results carry coordinator's pending Module revision; title stays host-local.
- View dispose removes input/paste/pointer listeners, Focus bridge, geometry observers, A11y nodes, renderer/view subscriptions, target/backend refs. It does not dispose/release session engine, coordinator, owner lease, parser, grid, scrollback, process/PTY.
- Engine/parser/buffer/coordinator lifetime is session-scoped. Same-instance target replacement attaches through retained owner. Same-session engine replacement fails closed absent complete replay/rehydration of grid, modes, cursor, alternate screen, scrollback.
- Process exit/failure revokes backend sink epoch before App publishes status; runtime resolves disabled plus Focus-ineligible in newer generation. Post-exit writes are impossible. Restart requires fresh `backendBindingId`, connection, and live sink before interactive.
- App-owned session teardown terminates process/PTY, disposes views, settles resize, explicitly releases owner, then releases capability-created engine/coordinator. Borrowed engine stays host-owned/session-affine; another session requires proven reset/recreation.
- Backend replacement for same session/instance uses fresh view connection through retained owner, revokes old sink, preserves engine/coordinator. It cannot ready until old resize cancel+await or completion+newest reapply.
- Coordinator validates finite positive safe-integer dimensions before revision allocation; invalid input returns `invalid-dimensions` with null revision and no coordinator/backend mutation. It dispatches at most one resize across owner's views; completion releases slot; old view result may drop; undispatched stale sizes cancel.
- Unsupported engine/session/backend/input/keyboard-route/mouse-denial/A11y/resize or conflicting owner fails closed with bounded reason.

## Proposed entity and evidence graph

If a maintainer accepts semantic admission in a later checkpoint, the smallest coherent graph is:

```text
C-TERMINAL-SURFACE-0001 (draft contract)
  <- satisfied by M-TERMINAL-SURFACE-0001
       -> requires HC-TERMINAL-SURFACE-0001
  <- verified by T-TERMINAL-SURFACE-0001

K-HOST-SURFACE-ROLES-0001
C-HOST-SURFACE-PROJECTION-0001
C-FOCUS-0001 / C-A11Y-0001
  <- referenced/depended on by the new contract as applicable

A-REACT-18-19-0001
  -> may later support M-TERMINAL-SURFACE-0001 and provide
     HC-TERMINAL-SURFACE-0001 only after reviewed Web evidence
```

No new Adapter identity is justified: React Web already has `A-REACT-18-19-0001`; a later non-Web implementation must bind to its own concrete profile. No public Prototype is justified by this research alone. Prototype identity/anatomy and composition chrome require a separate admitted authoring slice after the Module/Host Capability boundary is accepted.

### Bounded red-first plan

1. **Portable negatives:** reject engine/target/buffer/stream/event/controller/geometry/grid/sink/arbitrary key/functions/owner lease; reject Module instance/session/backend identity in mutable patch and App status in Host policy.
2. **Owner + view leases:** Module-issued collision-free instance ID; exclusive per-session owner acquire/conflict; view dispose/replace cannot release; explicit final release after pending settle; backend reconnect/target/capability view reattach; session-engine preservation; engine replacement rejection without replay; borrowed affinity; cleanup/stale suppression.
3. **Policy/input/Focus:** strictly increasing generations; generation-stamped snapshots; stale/process-exited Host event rejection before sink; sink revocation before exit publication; fresh binding for restart; Host/engine sole backend path with observation-only callback; resolved modes/disabled Focus eligibility; IME/key/shortcut/mobile; zero duplicate/stale/dead-process sends.
4. **Mouse exclusion:** process enables mouse mode; Host blocks reports/backend writes while local selection works.
5. **Resize:** reject 0/negative/fractional/NaN/Infinity/unsafe columns and rows before revision/backend; accept positive boundary; second instance conflicts; one owner/in-flight per session across same-instance view/backend replacement; newest coalescing; cancel/await before owner release/replacement ready/dispatch; exact result branches.
6. **Performance:** rapid grid updates create zero portable content allocation/publication.
7. **A11y/composition/Focus:** only A11y name/mode; independent App statuses; Host keyboard support plus composition Button/topology; bounded attention.
8. **Real Web:** Module ID collision attempt; owner acquire/view replace/final release; invalid dimensions; exited-process input denial/restart binding; modes/generations/snapshots/IME/keyboard/F6/single input path/mouse suppression/session resize/backend reconnect/engine-state preservation/A11y/cleanup.
9. **Cross-adapter Web only if claimed:** WC/React/Vue evidence for one admitted portable authoring source. This remains Web evidence.
10. **Non-Web:** independent native profile with native focus/input/resize/accessibility evidence before any multi-host statement.

## #513/#514 matrix consumption

PR #563 currently carries the intended authoritative file `internal/agent-harness/dogfood-coverage-matrix.md`, but it is not on `main`, is conflicting, and has an active `CHANGES_REQUESTED` review. This record must not copy that full matrix or create a second source of truth.

When the matrix carrier lands, a follow-up #530 carrier must update exactly these rows:

- `harness.future.terminal-chrome`: replace the pending-owner text with the option-C recommendation; keep state `research` until semantic admission, link this record as current evidence, name the proposed Module/Host Capability checkpoint, and trigger re-review on admission outcome, input/selection/mouse scope expansion, or a non-Web claim.
- `harness.future.terminal-engine`: retain `infrastructure-exempt`; replace “pending #530 ruling” with the settled exemption for engine/PTY/grid/scrollback/selection internals; state that engine selection, executable backend binding, message/input scope expansion, or ownership leakage triggers re-review.
- Recompute only the matrix totals if a state changes. This record recommends no state-count change yet.

#513 should receive a link to the landed record and matrix carrier; #514 remains the owner of the single matrix document. Until that projection lands, #530 is advanced rather than closed.

## Acceptance mapping

- Responsibility table covers App/backend, engine, Proto UI semantic owner, Host Capability/Adapter, and composition/design language, including trust exclusions.
- Options A-D are compared; C is the smallest admissible proposal and D is explicitly deferred.
- Input/shortcut/IME, accessibility, resize, performance, scrollback/windowing, lifecycle, and cleanup are bounded above.
- Code Block remains an honest static/log fallback; Textarea remains a plain-text control. Neither is expanded.
- No raw terminal engine, PTY, transport, target, buffer, grid, or host object enters portable authoring.
- The conclusion is one `next proposal checkpoint`; no materially different viable owner remains unresolved in this packet.
- The exact #513/#514 matrix rows and re-review triggers are identified; landing them remains the next #530 carrier because their authoritative file is not yet on `main`.

## Residual risks and smallest human decision

Residual risks: accessible terminal behavior varies substantially by engine/platform; terminal keymaps conflict with Harness commands; resize and Unicode cell-width behavior are engine-specific; a future engine may not expose a clean injected backend sink; sensitive input and screen text may make diagnostic snapshots inappropriate.

Smallest later human decision: accept or reject admission of the proposed `C-*` / `M-*` / `HC-*` / `T-*` graph for option C with the exclusions above. Acceptance would authorize a separate spec proposal, not an engine choice or implementation. Rejection leaves option A plus private infrastructure embedding and ordinary Proto UI chrome.
