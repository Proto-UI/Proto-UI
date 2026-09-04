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
- `C-FOCUS-0001-B/D/G` keeps focus facts, requests, eligibility, topology, policy, and entry-region delegation in the Focus domain.
- `C-A11Y-0001-G/H` and `HC-A11Y-0001` allow native, degraded, or diagnostic host accessibility projection without making one host representation portable.
- `C-SCROLL-0001-D/E`, `M-SCROLL-0001-E`, and `HC-SCROLL-SURFACE-0001-D/E` keep geometry and high-frequency host facts behind a lease and require stale-callback suppression and cleanup.
- Active `D-ADAPTER-PROFILE-0001-C/D/E` means an existing Adapter can claim Terminal Module support or Host Capability provision only after concrete reviewed evidence. Absence from an Adapter profile means uncataloged, not unsupported.

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
| Terminal engine infrastructure | VT/escape parsing; mutable cell grid; cursor and alternate screen; scrollback; reflow; glyph measurement; selection; terminal mouse modes; paste encoding; renderer; engine accessibility buffer; direct high-frequency diffs. | Host-local target and backend byte/data channels supplied outside Proto UI authoring. | Engine instance, buffer, parser, renderer, DOM/canvas/native view, controller, mutable selection, raw output/input stream. |
| Proto UI Terminal semantic owner | One logical surface identity; attachment/display facts; read-only/input-enabled policy; focus requests/facts through Focus; committed text/key intent vocabulary; resize request/result correlation; bounded attention/error facts; lease epoch and stale-result rejection. | Plain immutable facts and request payloads only. | Cell/row diffs, scrollback, raw bytes/VT sequences, host events, raw geometry, engine modes/controllers, App credentials or process authority. |
| Terminal Surface Host Capability | Resolve the current physical target and engine through host configuration; attach the engine; bridge keyboard/IME/focus; compute character cells; apply resize; project native accessibility; route engine input to the App-owned backend sink; own listeners/observers/resources; dispose exactly. | Static portable requirement, latest plain patch, callbacks for normalized facts/results, and an adapter-injected engine/backend resolver keyed by session reference. | No raw target/engine/backend sink returned through Props, State, Event, Context, or Expose. |
| Adapter profile | Materialize `boundaryTarget` and actual presentation/input/a11y targets; wire the Host Capability; translate lifecycle and Focus participation. | Governed Module requirement and capability token after admission. | No semantic reinterpretation and no support/provision relation before profile-specific evidence. |
| Composition/design language | Tabs, toolbar, label, connection badge, reconnect/close, status, search/copy controls when separately admitted, visible leave-terminal control. | App facts and ordinary Proto UI control events. | Terminal protocol, key encoding, PTY/process control, buffer/selection state, engine-owned accessibility tree. |

The engine can remain completely outside Proto UI. The Host Capability resolves it from adapter/host configuration using an opaque session reference; the engine object never crosses the portable declaration or state boundary.

## Portable facts, requests, and information paths

### Candidate first-slice values

The proposal may evaluate these plain values; names are illustrative and not an admitted API:

- App input: opaque `sessionId: string`, `readOnly`, `inputEnabled`, App-authoritative connection/process status, accessible label/description, and a host-configured shortcut-policy identifier.
- Host facts: `attachment: detached | attaching | ready | unavailable | error`, `focused`, `composing`, `columns`, `rows`, display title as untrusted host text, accessibility projection mode, and monotonically increasing `epoch`/`revision`.
- Requests/results: `focus`, `blur`, committed `textInput`, normalized `keyInput`, resize `{ columns, rows, revision }`, and bounded `attention`/`error` signal.

`columns` and `rows` are neutral positive integer character-cell counts. Pixels, rectangles, font metrics, device scale, observers, and layout objects remain host-local. A resize request is not a fact until the host/backend reports the same or a newer revision as applied/rejected.

A current accessible text snapshot can be a plain diagnostic/test result, but should not be continuously copied into portable State. The first slice should expose `host-bridge | bounded-snapshot | unavailable` support and prefer a host-owned accessibility bridge. Any later author-facing snapshot request requires a separate privacy, size, cadence, and stale-revision decision.

Selection summaries and copy requests are technically expressible as plain values, but are not needed by option C. The engine keeps default selection/copy behavior. No selected text or Clipboard payload enters portable State. Programmatic selection, search, Clipboard, mouse reporting, and hyperlinks remain option D.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| App connection/process fact | App -> Terminal Module patch -> composition status | Label/badge/status only; no engine control implied. | Current logical instance revision. |
| Output bytes/VT data | App backend -> engine directly | Engine updates visible grid/cursor/scrollback. | Engine write/render queue; **zero portable grid updates**. |
| IME/text/key input | Physical input target -> host/engine -> App-owned backend sink | Terminal process receives engine-encoded input. Optional normalized intent is ephemeral, never retained State. | Current lease epoch and active input policy. |
| Harness shortcut | Host keyboard arbiter -> App command owner | Harness action, with no duplicate terminal forwarding. | Keydown decision before engine processing. |
| Terminal key | Host keyboard arbiter fallthrough -> engine | Engine emits encoded input to backend. | Same key event, once. |
| Host geometry | Target/font/DPR observers -> Host Capability -> character-cell resize request -> App backend/PTY | Engine and process converge on rows/columns; result fact updates after acknowledgement. | Monotonic resize revision; stale results ignored. |
| Focus request or user entry | Focus domain -> Host Capability -> physical engine input target | One focused logical terminal surface; focus facts return through Focus. | Current view/lease epoch. |
| Accessible terminal content | Engine buffer -> host accessibility bridge | Platform screen reader navigates bounded/current content. | Host accessibility lifecycle; not generic Proto State. |
| Bell/error | Engine/host -> normalized attention fact -> App/composition policy | Bounded visual/audible/status response respecting user settings. | Deduplicated semantic signal, not per-cell output. |

## Fake-engine / fake-host protocol sketch

The connection callbacks below are Module-to-Host internals. They are not Prototype props and do not make functions or engine values portable.

```ts
type TerminalSize = Readonly<{ columns: number; rows: number; revision: number }>;

type TerminalSurfacePatch = Readonly<{
  sessionId: string;
  readOnly: boolean;
  inputEnabled: boolean;
  shortcutPolicyId: string;
}>;

type TerminalInputIntent =
  | Readonly<{ type: 'text'; text: string; composing: false }>
  | Readonly<{
      type: 'key';
      key: string;
      ctrl: boolean;
      alt: boolean;
      shift: boolean;
      meta: boolean;
      repeat: boolean;
    }>;

type TerminalSurfaceFacts = Readonly<{
  epoch: number;
  attachment: 'detached' | 'attaching' | 'ready' | 'unavailable' | 'error';
  focused: boolean;
  composing: boolean;
  columns: number | null;
  rows: number | null;
  accessibility: 'host-bridge' | 'bounded-snapshot' | 'unavailable';
}>;

type TerminalSurfaceConnection = Readonly<{
  patch: TerminalSurfacePatch;
  onFacts(facts: TerminalSurfaceFacts): void;
  onInput(intent: TerminalInputIntent): void;
  onResizeRequest(size: TerminalSize): void;
  onAttention(kind: 'bell' | 'error'): void;
}>;

type TerminalSurfaceLease = Readonly<{
  update(patch: TerminalSurfacePatch): void;
  requestFocus(): void;
  requestBlur(): void;
  requestResize(size: TerminalSize): void;
  snapshot(): TerminalSurfaceFacts;
  dispose(): void;
}>;

type TerminalSurfaceHost = Readonly<{
  attach(connection: TerminalSurfaceConnection): TerminalSurfaceLease;
}>;
```

A fake host is constructed with a private map from `sessionId` to scripted fake engine; the map and engine never enter `TerminalSurfacePatch`. The red-first exercise is:

1. attach `session-7`; receive `attaching`, then `ready` with 80x24;
2. emit committed text and one modified key as immutable intent values;
3. issue resize revisions 1/2/3 and accept only revision 3 at 120x40;
4. replace the target/engine and verify the old lease is disposed before the new epoch reports facts;
5. dispose, then make the old fake emit input, resize, bell, and error; observe zero callbacks;
6. recursively validate every captured patch/fact/request as data-only and prove that no fake-engine identity, target, buffer, stream, callback source, or cell grid appears.

This sketch proves the boundary can be data-only. It does not prove browser layout, IME, screen-reader behavior, native focus, key routing, renderer performance, or an Adapter profile.

## Input, shortcut, and focus policy

- **IME:** candidate text and composition UI stay in the host engine's physical input target. Only committed text may leave the host bridge as `text` intent. `Enter`/other command keys during composition do not trigger Harness shortcuts or a duplicate terminal key.
- **Key versus text:** committed Unicode text uses `text`; non-text keys use a normalized key plus modifiers. A DOM `KeyboardEvent`, native key object, scan code, or engine-encoded VT string never enters portable state/events.
- **Shortcut order:** the adapter-injected Harness keyboard arbiter checks the configured local command map before the terminal engine. An explicitly reserved Harness chord wins; every other chord falls through exactly once to the engine. The policy resolver is host configuration, not a portable callback.
- **Escape route:** bare `Escape` is terminal input. The Web Harness profile must reserve `F6`/`Shift+F6` for next/previous Harness focus regions and provide an adjacent, named Proto UI Button that leaves the terminal. A host that cannot provide both a keyboard route and reachable visible control reports the interactive slice unavailable.
- **Ctrl/Meta/Alt:** no blanket interception. Only registered Harness chords are local. The engine receives the rest and owns platform-specific encoding.
- **Paste:** Clipboard acquisition and paste confirmation/policy are App/host services. The first slice may forward committed pasted text through the engine, including bracketed-paste behavior; it does not receive Clipboard objects. File paths are plain pasted text only—no file access, drop, or path authority.
- **Pointer/mouse:** first-slice terminal mouse reporting is disabled. Engine-local pointer selection may remain available. Custom pointer reports, block-selection APIs, and selection gestures belong to option D.
- **Mobile/virtual keyboard:** tapping the surface may request the engine input target and host IME. Hosts may provide visible special-key controls as ordinary App composition. If committed text/IME cannot be bridged without leaking a raw target, the host reports interactive input unavailable rather than claiming parity.

## Accessibility boundary

- The Terminal logical surface supplies an accessible label, description, mode (`interactive`/`read-only`), connection/display status, focus entry, and a reliable exit path.
- The engine/Host Capability owns the mutable screen representation, cursor/selection mapping, row navigation, terminal modes, and platform accessibility API. Proto UI does not set a generic `textbox`, `application`, or `log` role for every terminal host.
- Streaming screen diffs never feed a generic Proto UI live region. The host bridge may announce bounded output according to engine/platform policy; App-level announcements are limited to state transitions such as connected, disconnected, input disabled, or a deduplicated bell/error.
- Engine-local keyboard selection and copy remain available when the host supports them. Any composition-provided Copy/Search control is a separately admitted ordinary Proto UI control invoking a host/App request; selected text and Clipboard contents stay outside portable state.
- Zoom, reflow, font metrics, glyph width, high contrast, cursor contrast, selection contrast, and screen-reader row geometry remain host/engine responsibilities. Resize results expose only rows/columns. Reduced-motion policy disables or reduces visual bell/cursor animation through host settings; the semantic attention fact is unchanged.
- A non-Web profile may use UI Automation or another native accessibility API and may degrade explicitly. Passing WC/React/Vue tests on the Web host cannot establish non-Web conformance.

## Performance, scrollback, and lifecycle

### High-frequency threshold

The portable threshold for terminal content is **zero cell/row/grid diffs**. The first cell mutation is engine-internal regardless of whether updates arrive once a second or once a frame; update rate is not a portable semantic. Low-cardinality facts may be deduplicated and coalesced to at most one publication per animation/frame scheduling turn, while status transitions and input/resize results remain lossless and ordered.

No portable Module receives `onRender`, `onWriteParsed`, buffer lines, dirty rectangles, glyph runs, or scroll positions. This avoids allocation/copy churn and prevents adapter profiles from re-litigating a grid schema.

Terminal scrollback is engine-owned. #521 windowed Collection applies to authored logical lists/logs, not a terminal buffer, cursor-addressed screen, alternate screen, or selection. A later App-exported immutable log snapshot may use Code Block/windowing after it leaves terminal semantics; that does not move live scrollback into Collection.

### Lifecycle rules

- One logical instance holds one current lease epoch. Detach, target replacement, engine replacement, session switch, capability replacement, and disposal revoke the old epoch before attaching another.
- Every input, fact, resize result, accessibility callback, title, bell, and error is epoch/revision checked. Late callbacks are ignored.
- `dispose()` removes keyboard/composition/paste/pointer/focus listeners, geometry/DPR observers, accessibility nodes/listeners, engine subscriptions, renderer resources owned by the lease, target references, and backend-sink references.
- Disposing a view lease does **not** terminate the process or PTY. The App/backend owns explicit process stop and decides whether detach preserves or closes a session.
- If the Host Capability created an engine for the lease, it disposes that engine after draining/revoking its callbacks. If the host injected a shared engine, the lease only detaches its owned bindings. Ownership must be explicit; double-disposal is an error.
- Resize bursts are latest-revision-wins. The host coalesces geometry changes, the backend result confirms applied/rejected size, and replacement/disposal cancels pending work.
- Unsupported engine attachment, input bridge, accessibility route, or resize must fail closed to `unavailable`/read-only with reason; no fake success state.

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

1. **Portable negatives:** compile-time and runtime fixtures reject engine, target, buffer, stream, DOM/native event, mutable controller, raw pixels, cell grids, and functions in portable patch/fact/request values.
2. **Fake lease:** attach/update/snapshot/dispose, missing capability, target/engine replacement, session switch, exactly-once cleanup, and stale-epoch suppression.
3. **Input policy:** IME candidate stays host-local; committed text emits once; reserved Harness chord stays local; other modified keys reach the engine once; bare Escape reaches the engine; F6 exits.
4. **Resize:** invalid/zero dimensions reject; bursts coalesce to the newest revision; applied/rejected result is revision-bound; late results do not change current facts.
5. **Performance:** replay rapid cursor/grid/alternate-screen updates and assert zero portable content publications/allocations; only deduplicated low-cardinality facts cross.
6. **Accessibility fake:** support negotiation, label/mode/status, bounded attention, unavailable degradation, and no generic live-stream snapshot.
7. **Real Web:** engine double mounted behind React; real keyboard/IME/focus/F6/resize/target replacement/dispose; accessibility-tree inspection; high-frequency renderer path; no retained listeners/observers/targets.
8. **Cross-adapter Web only if claimed:** WC/React/Vue evidence for one admitted portable authoring source. This remains Web evidence.
9. **Non-Web:** independent native profile with native focus/input/resize/accessibility evidence before any multi-host statement.

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
