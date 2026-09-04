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
| Proto UI Terminal semantic owner | One logical surface identity; attachment/display facts; resolved input mode; observational committed text/key intent; resize correlation; bounded attention/error; view-lease identity, policy generation, and stale-result rejection. | Plain immutable facts/requests plus Focus-domain identity, view epoch, eligibility, and request/fact participation; Focus remains sole fact owner. | Cell/grid/scrollback, raw bytes, host events/geometry, engine modes/controllers, focus fact ownership, App credentials or process authority; no second input send path. |
| Terminal Surface Host Capability | Resolve a replaceable target/view binding to a session-affine engine, immutable backend binding, and session-scoped resize coordinator; attach/detach the view without resetting the session engine; bridge keyboard/IME/focus; synchronously enforce current generation/input policy; encode and write accepted input to the backend exactly once; optionally report normalized input observation; suppress terminal mouse reports while preserving local selection; compute/apply serialized resize across view leases; expose native accessibility; own/clean view resources. | Immutable session/backend requirement, generation-stamped plain policy updates, observational callbacks, and adapter-injected resolver. | No raw target/engine/backend sink in portable authoring; no cross-session engine reuse without complete recreation/reset evidence; no session-engine disposal from view-lease cleanup; no Module-to-backend replay of observed input. |
| Adapter profile | Materialize `boundaryTarget` and actual presentation/input/a11y targets; wire the Host Capability; translate lifecycle and Focus participation. | Governed Module requirement and capability token after admission. | No semantic reinterpretation and no support/provision relation before profile-specific evidence. |
| Composition/design language | Tabs, toolbar, label, connection badge, reconnect/close, status, search/copy controls when separately admitted, visible leave-terminal control. | App facts and ordinary Proto UI control events. | Terminal protocol, key encoding, PTY/process control, buffer/selection state, engine-owned accessibility tree. |

The engine can remain completely outside Proto UI. Host configuration resolves a session-affine engine and resize coordinator by opaque `sessionId`, then the backend sink by immutable `backendBindingId`; none crosses portable authoring. The session host owns engine/parser/buffer/coordinator lifetime independently of replaceable Terminal view leases and backend bindings.

## Portable facts, requests, and information paths

### Candidate first-slice values

The proposal may evaluate these plain values; names are illustrative and not an admitted API:

- App input: immutable stable `surfaceId`, opaque `sessionId` and `backendBindingId`, resolved `inputMode: interactive | read-only | disabled`, independent Module/composition connection/process status, and shortcut-policy ID. Name/description remain A11y facts.
- Host facts: attachment, composition, dimensions, input/resize/accessibility/keyboard-route/mouse-reporting support with bounded reasons, and revision-bound resize outcome. Focus remains in Focus; App connection/process status and title stay outside Host policy.
- Requests/results: committed text, bounded key intent/special-key request, serialized resize with applied/rejected result, and attention/error. Focus/blur remain Focus requests.

`columns` and `rows` are neutral positive integer character-cell counts. Pixels, rectangles, font metrics, device scale, observers, and layout objects remain host-local. The first slice admits exactly one active resize-owner `surfaceId` per `sessionId`; a Host session coordinator atomically grants that owner before ready and rejects a different active surface with `resize-owner-conflict`. The same surface may transfer ownership only after its old view lease retires and pending resize settles. The coordinator then permits at most one unresolved engine/backend resize across every old or replacement view connection and retains only the newest geometry observed while that request is pending. A resize becomes a fact only after the host reports completion with the Module-issued revision and effective dimensions; only then may the coordinator dispatch the retained newest size. Replacement must cancel and await the operation, or await completion and reapply the newest size, before its view becomes ready. Thus an older operation cannot execute after a newer operation, and differently sized surfaces cannot fight over one PTY. Terminal-controlled title sequences do not enter portable facts: they are process-controlled, unbounded, and may change at render cadence. If chrome needs a title, the App/backend may observe it outside Proto UI, remove control characters, enforce its own length/cadence policy, and supply a bounded App-owned label through ordinary composition.

A current accessible text snapshot can be a plain diagnostic/test result, but should not be continuously copied into portable State. The first slice should expose `host-bridge | bounded-snapshot | unavailable` support and prefer a host-owned accessibility bridge. Any later author-facing snapshot request requires a separate privacy, size, cadence, and stale-revision decision.

Selection summaries and copy requests are technically expressible as plain values, but are not needed by option C. The engine keeps default selection/copy behavior. No selected text or Clipboard payload enters portable State. Programmatic selection, search, Clipboard, mouse reporting, and hyperlinks remain option D.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| App connection/process facts | App -> Terminal Module -> composition status | Independent transport and process labels/badges; neither dimension falsifies the other. | Current logical instance revision; no Terminal Host policy update. |
| Output bytes/VT data | App backend -> session engine directly | Engine updates visible grid/cursor/scrollback. | Session engine write/render queue; **zero portable grid updates**. |
| IME/text/key input | Physical target -> Host keyboard/engine encoder -> immutable backend binding | The Host synchronously checks current generation and `interactive`, then writes encoded input exactly once; `onInputObserved` is optional post-send observation only and can never write. `read-only`/`disabled` produce zero backend writes. | Host's current Module-issued policy generation plus session/backend binding identity; stale events drop before sink access. |
| Harness shortcut | Host keyboard arbiter -> App command owner | Harness action, with no duplicate terminal forwarding. | Keydown decision before engine processing. |
| Terminal key | Host keyboard arbiter fallthrough -> engine | Engine encodes and writes input to backend once, then may report normalized observation. | Same key event, once, under the accepted policy generation. |
| Host geometry | Exclusive active surface -> Target/font/DPR observers -> Host Capability -> session-scoped resize coordinator -> engine/backend resize | Coordinator rejects another surface for the same session; the owner keeps engine/process rows/columns converged with one mutation in flight across old/replacement views; result carries Module revision/effective dimensions. | Atomic owner grant by `{ sessionId, surfaceId }`; monotonic resize revision within the logical session; old operation completes/cancels before owner transfer, replacement ready, or newest retained dispatch. |
| Focus request or user entry | Focus domain eligibility/topology/request -> Host Capability's focus bridge -> physical engine input target | One focused logical terminal surface; `disabled` rejects entry, while focus facts return only through Focus. | The runtime commits resolved input mode and Focus eligibility together; current Focus/view epoch; Terminal facts do not duplicate focused state. |
| Accessible terminal content | Engine buffer -> host accessibility bridge | Platform screen reader navigates bounded/current content. | Host accessibility lifecycle; not generic Proto State. |
| Bell/error | Engine/host -> normalized attention fact -> App/composition policy | Bounded visual/audible/status response respecting user settings. | Deduplicated semantic signal, not per-cell output. |

## Fake-engine / fake-host protocol sketch

The connection callbacks below are Module-to-Host internals. They are not Prototype props and do not make functions or engine values portable.

```ts
type TerminalDimensions = Readonly<{ columns: number; rows: number }>;
type TerminalSize = TerminalDimensions & Readonly<{ revision: number }>;

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
      revision: number;
      outcome: 'rejected';
      requested: TerminalDimensions;
      effective: null;
      reason: 'resize-unavailable' | 'backend-rejected';
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
  // Immutable: identity or backend replacement requires a fresh attach.
  surfaceId: string;
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
  // The Host session coordinator serializes this across old/replacement view leases.
  requestResize(size: TerminalSize): void;
  snapshot(): TerminalSurfaceSnapshot;
  dispose(): void;
}>;

type TerminalSurfaceHost = Readonly<{
  attach(connection: TerminalSurfaceConnection): TerminalSurfaceLease;
}>;
```

A fake host resolves a session-affine engine and resize coordinator from immutable `sessionId`, atomically assigns at most one active resize-owner `surfaceId`, then resolves a backend sink from `backendBindingId`; the objects/bytes never enter patches. The Module owns connection identity and strictly increasing policy generation; the Host's session-scoped coordinator owns exclusive resize participation plus one-in-flight serialization across the owner's view leases and backend replacement. A11y/Focus/composition remain separate. A Host callback echoes the generation captured when its event or probe began, not whatever generation is current when delayed work completes. A snapshot returns the generation that produced its cached facts and never restamps old facts with the current generation. The sole input send path is Host/engine encoding directly to the immutable backend sink after a synchronous current-generation/mode check; `onInputObserved` is post-send observation and the Module never forwards it. The red-first exercise:

1. attach `surface-7/session-7/backend-2` at generation 1; atomically grant `surface-7` resize ownership, receive ready with input/resize/accessibility, `keyboardRoute: available`, `mouseReporting: denied`, and A11y projection; atomically snapshot generation 1 plus those facts;
2. attach different `surface-8` to live `session-7`; reject it with `resize-owner-conflict` before ready and prove its geometry never enters the coordinator. After `surface-7` retires and pending resize settles, owner release permits `surface-8` to attach;
3. transition process to exited while transport remains connected in Module/composition only; issue no Host update;
4. start a generation-1 support probe/event, update through read-only generation 2 to disabled generation 3, then complete old work; Host drops stale input before sink access, and delayed observed-input/support callbacks plus a generation-1 snapshot produce no current state change or backend replay;
5. keep read-only Focus-eligible, then commit disabled plus Focus-ineligible together; a keyboard/user entry and programmatic Focus request are rejected through Focus before the host bridge;
6. return to interactive generation 4 and request mobile Escape under that generation; engine encodes and writes once, then one observational callback arrives. Arbitrary or generation-mismatched keys reject before the sink;
7. enable terminal mouse protocol in fake engine; pointer reports produce zero backend writes while local text selection changes;
8. make F6 reservation unavailable; report `keyboard-route-unavailable` and reject composed acceptance independently of Button check;
9. as current owner, dispatch resize 1, observe sizes 2 and 3 while it is unresolved, and assert no second backend mutation; replace the target/view lease for the same `surfaceId` while 1 is pending and submit its size through the same coordinator; replacement cannot become ready or dispatch until 1 completes/cancels, then applies only newest retained size at 120x40; reject next resize with reason/no effective size;
10. reconnect same session/surface through `backend-3` while resize is pending; retire old view/sink, keep coordinator/owner, await/cancel old completion, and reapply newest size before new view ready; old sink receives zero later input while engine retains grid/parser/scrollback;
11. replace only the target/view lease and rebind the same session engine/coordinator/owner; assert visible engine state survives and stale view callbacks cannot revive;
12. attempt same-session engine replacement without complete replay/rehydration and fail closed; replace session and obtain distinct engine/coordinator/owner grant;
13. try to reuse a borrowed engine for another session; reject `engine-session-mismatch` unless host proves complete reset before attach;
14. simulate each missing/unverified support and assert bounded reason;
15. omit/disable leave Button and reject at composition; then provide Button plus Focus topology;
16. with no resize pending, dispose view lease and emit input observation/bell/error/focus/pointer; observe zero view callbacks/writes while live session engine/coordinator/owner remains intact; final logical surface detach releases owner;
17. prove no engine/target/buffer/stream/sink/title/A11y duplicate/cell grid appears in portable values.

This makes exclusive resize ownership, generation-stamped snapshots, single-path input, policy-generation rejection, Focus eligibility, keyboard escape support, mouse suppression, engine session affinity, backend rebinding, independent status, session-scoped resize serialization, engine-state preservation, A11y/Focus/composition ownership, and cleanup testable. It does not prove real host behavior or Adapter conformance.

## Input, shortcut, and focus policy

- **IME:** candidate/composition UI stays host-owned. Only committed text may use text intent; composition command keys do not duplicate. Before encoding or sink access, the Host checks the current Module-issued generation and resolved input mode. It writes accepted input exactly once through engine/backend, then may emit `onInputObserved`; the Module can consume the normalized observation but must never forward it to the backend. A stale observation changes neither state nor input.
- **Resolved input mode:** one enum replaces conflicting booleans. `interactive` permits committed text/key routing; `read-only` preserves Focus eligibility and local selection but suppresses all backend input; `disabled` suppresses input and is projected through the governed Focus route as ineligible. The runtime commits the Terminal policy generation and Focus eligibility together; Focus rejects later entry requests and reconciles an already-focused target under Focus policy. Terminal does not own focus facts.
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

- One logical Terminal `surfaceId` holds a Module connection plus immutable session/backend requirement. Detach, target replacement, or capability replacement retires the replaceable view callback/lease before fresh attach; update cannot change identity or requirement.
- Before ready, the Host session coordinator atomically grants resize ownership to one `surfaceId`. A different concurrently active surface for the same `sessionId` is unavailable with `resize-owner-conflict`; it cannot submit geometry or input. Same-surface view replacement retains the grant. Final logical-surface detach releases it only after pending resize settles, allowing another surface to acquire.
- Policy-sensitive callbacks/results carry the `connectionId` plus the Module-issued generation under which their work began. The Host rejects stale input events before sink access; the Module rejects retired identities/stale observation or fact delivery before state change. Snapshots atomically pair cached facts with their captured generation. Resize results instead carry the session coordinator's one pending Module-issued resize revision; title stays host-local.
- View-lease disposal removes input/paste/pointer listeners, Focus bridge, geometry observers, A11y nodes, renderer/view subscriptions, and target/backend references. It does not dispose the session engine, resize coordinator/owner grant, parser, grid, scrollback, or process/PTY.
- Engine/parser/buffer and resize-coordinator lifetimes are session-scoped and independent of view leases. Target replacement for the same surface rebinds the same engine/coordinator and retains resize ownership. A same-session engine replacement fails closed unless complete replay/rehydration establishes the current grid, parser modes, cursor, alternate screen, and scrollback before ready.
- App-owned session teardown terminates process/PTY and releases a capability-created session engine/coordinator/owner grant. A borrowed engine remains host-owned and session-affine; another session cannot bind it without proven complete reset/recreation.
- Backend binding replacement, including reconnect of the same session/surface, creates a fresh view connection/lease and revokes old sink references while preserving the session engine/coordinator/owner. It cannot become ready until an old in-flight resize is cancelled and awaited, or completes and is followed by the newest size on the new binding.
- At most one resize mutation is dispatched per session coordinator across all old/replacement view connections of its owner. The Host reports applied/rejected only after the engine/backend operation completes; then the coordinator may dispatch its retained newest size. Old view result delivery may be discarded, but coordinator completion always releases the slot. Undispatched stale sizes are cancelled.
- Unsupported engine/session/backend/input/keyboard-route/mouse-denial/A11y/resize or conflicting resize owner fails closed with a bounded reason.

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

1. **Portable negatives:** reject engine/target/buffer/stream/event/controller/geometry/grid/sink/arbitrary key/functions; reject surface/session/backend identity in mutable patch and App status in Host policy.
2. **Fake view lease:** immutable surface/session/backend attach, exclusive per-session resize-owner acquisition/conflict/release, backend reconnect reattach, target/capability replacement, session-engine preservation across same-surface view replacement, same-session engine replacement rejection without replay, session-affine borrowed engine, cleanup, connection stale suppression.
3. **Policy/input/Focus:** strictly increasing policy generations; generation-stamped snapshots; stale Host event rejection before sink; Host/engine as sole backend path with observation-only callback; all resolved modes; disabled-to-Focus eligibility projection; rejected disabled entry; IME; printable/key split; bounded key; shortcut precedence; keyboard-route support; mobile key; zero duplicate/stale backend sends.
4. **Mouse exclusion:** process enables mouse mode; Host blocks reports and backend writes while local selection works.
5. **Resize:** second active surface conflict; one owner and one in-flight mutation per session across same-surface view/backend replacement; newest-only coalescing; cancel/await or completion before owner transfer/replacement ready/next dispatch; exact applied/rejected branches; connection/revision rejection.
6. **Performance:** rapid grid updates create zero portable content allocation/publication.
7. **A11y/composition/Focus:** only A11y name/mode; independent App statuses; Host keyboard support plus composition Button/topology; bounded attention.
8. **Real Web:** engine double; owner conflict/transfer; modes/policy generations/snapshots/IME/keyboard/F6/single input path/mouse suppression/session-scoped resize/backend reconnect/session-engine preservation across target replacement/A11y/cleanup.
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
