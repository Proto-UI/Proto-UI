# 2026-09-05 Scroll end-follow first slice

> Internal record. Non-normative. The authoritative rules are the current `C-SCROLL-END-FOLLOW-0001`, `M-SCROLL-0001`, `HC-SCROLL-SURFACE-0001`, and mapped `T-SCROLL-END-FOLLOW-0001` entities.

## Decision

End-follow belongs to the existing Scroll domain. It does not justify a new Module or Host Capability, and composition-only ownership would contradict the existing prohibition on prototype-owned host geometry. A dedicated contract keeps end-follow distinct from ordinary normalized scrolling and from #520 visual-anchor preservation or #521 virtualization.

The portable configuration is a discriminated `endFollow` policy: `{ mode: 'off' }` or `{ mode: 'while-at-end', axis }`. The default is off. The host chooses a bounded proximity threshold; no pixel threshold enters portable state. Each axis exposes `atEnd`. The end-follow handle exposes state `off | pending | following | paused` and request status `idle | pending | applied | rejected`. `{ kind: 'to-end', axis }` is the semantic jump/resume request.

## Ownership

| Owner | Responsibilities | Must not own |
| --- | --- | --- |
| Scroll Module | portable policy, observed handles, stable logical identity, request/fact causality, lease epoch | raw target, offsets/extents, application unread/session state |
| Scroll Surface Host Capability | proximity threshold, layout/content observation, input classification, one-layout coalescing, concrete end movement, cleanup | Message/Agent meaning, Live Region policy, composition controls |
| Composition | opt-in and presentation of jump/new-content controls; semantic `to-end` request | geometry measurement, unread truth, persistence |
| App Maker | item meaning/count, unread state, ordering, persistence, session/thread selection | generic Scroll state machine |

## Transition table

| Transition | Pre-state | Host/module action | Result |
| --- | --- | --- | --- |
| Initial materialization | policy `while-at-end`, new epoch | wait for layout, mark pending, coalesce one end application | `following`, request `applied`, `atEnd=true` |
| Append while at end | `following` | observe extent growth, schedule one layout-ready end application | remains `following` |
| Append while away | `paused` | publish geometry/facts only; issue no end movement | position remains host-owned and away |
| Rapid streaming appends | `following`, layout already pending | retain the existing scheduled application | one application at the latest extent |
| Reader input during pending follow | `pending` | cancel scheduled automatic movement when evidence identifies departure | `paused`; unapplied request `rejected` |
| Reader reaches end naturally | `paused`, host reports `atEnd=true` | reactivate lease without synthetic movement | `following` |
| Explicit jump to end | any live state, matching axis | report pending, schedule layout-ready end, apply directly without forced smooth motion | request `applied`; enabled policy resumes `following` |
| Viewport resize/reflow | following or paused | run the same lease rule after layout | following realigns; paused emits no end movement |
| Content collapse/expand near end | following or paused | run the same lease rule after extent observation | following realigns; paused emits no end movement |
| Session/target replacement | old live epoch | dispose old lease and cancel its scheduled work before attaching new target | old callbacks cannot update new epoch |
| Detach/rematerialize | attached then detached | exact cleanup; rematerialization creates a fresh lease | fresh initial transition; no old state attribution |
| Dispose and late callback | disposed | observers/listeners/timers/frames revoked; callbacks fail closed | no facts or movement after disposal |

## Input and accessibility boundary

Web evidence may classify wheel, touch-start, and supported scroll-key input as reader intent, then confirm departure from host facts. Unclassified scroll callbacks still update facts but do not let code guess that zoom, reflow, or screen-reader virtual navigation was a pointer action. Automatic and explicit end movement never focuses the viewport or a control. Live Region announcement remains separate and token-level streams are not announced by this contract. End movement is direct; reduced-motion profiles are never forced into smooth animation.

## Compatibility

Existing surfaces keep `endFollow: { mode: 'off' }`; their position and request semantics do not change. The new fields are additive draft 0.3.0-alpha.0 surface. Horizontal RTL and writing-mode normalization remain under `C-SCROLL-0001-Q-DIRECTION`; first-slice real-browser evidence covers vertical logical end only.

## Evidence

Red-first host tests cover every table row and exact cleanup. Cross-adapter evidence proves WC, React, Vue 3, and Vue 2 consume the same portable policy/facts/request. A real Chromium journey streams content, confirms away-from-end non-interference, checks explicit resume, and proves focus remains stable.
