# Homepage task composition correction

This dated record supplements the earlier homepage dogfood and entry-copy records. It does not rewrite their historical observations or promote draft semantics.

The maintainer requested a homepage that demonstrates usable component combinations and realizes its controls through Proto UI. The rejected composition repeatedly explained runtime/definition boundaries around an isolated Button row. The approved bounded replacement is one working workspace-settings task using existing Select, Switch, Textarea and Button projections. The established bilingual hero title, supporting line, and localized quick-start links stay intact.

## Candidate and ownership

- `apps/www/src/components/Homepage/homepage-showcase.ts` declares the website-owned `website-workspace-settings` recipe with explicit, selected-library concrete part identities. It is not a public Prototype definition, Base extension, or Template composition feature.
- The four existing Adapter materializers and the page-owned atomic generation transaction remain responsible for actual runtime changes. Library and runtime selection remain independent. The homepage single-component picker is intentionally removed; component documentation and examples are retained.
- The app owns controlled draft and saved snapshots, Save/Restore commands, dirty feedback, and note count. Prototype-owned selection, switch activation, editing/IME, focus, events and accessibility stay with the existing components. Exactly one event channel is bound per Adapter; stale generations and cleanup revoke app actions.
- “Save to this page” changes only the current example's in-memory saved snapshot. Restore defaults updates the draft. Both snapshots reset on runtime/library remount. No backend or durable storage is added.
- The page wrapper owns layout and typography only. It provides no hand-styled card, border, radius, fill, shadow or component state appearance. Both lanes use their actual PUI controls; there is no invented Shadcn Card.
- Conceptual heading, source-caption bands, implementation-boundary paragraphs and WASM research copy are removed from the homepage and placed in the existing bilingual Runtime Architecture documentation. Earlier records and evidence remain intact.
- Explicit content recipes now publish their own recipe ID in the projection-content marker instead of incorrectly inheriting the fallback component ID. The materializer's existing known-member input is retained; the website does not widen the generic preview protocol.

## Verification scope and debt

Focused source/contract tests cover exact slogans and CTAs, explicit recipe closure, page generation/rollback, event channels, actual app-state transitions, IME save guards, disposal and remount reset. Browser probes are updated to exercise Select/Switch/Textarea edit → Save feedback → Restore defaults rather than treating the first task root as a Button. Immutable baseline capture keeps its original Button procedure and revision binding. Four-runtime ownership, keyboard and native-link coverage remain applicable.

Local browser/server execution is unavailable under this task's established execution boundary. Browser tests and capture procedures are authored for the separately authorized exact-head GitHub CI run. Until that run succeeds and its fresh screenshots are inspected, visual quality, native keyboard/IME behavior, real Adapter parity and screenshot publication remain evidence debt. Source and unit-test success do not resolve those debts.

## Review correction: controlled event feedback

The first frozen candidate explicitly closed the task Select inside `valueChange`. Review initially suspected that this would consume keyboard focus restoration before Base's `closeOnSelect` path. Actual PUI checks in Happy DOM did not reproduce lost focus in either library across Web Components, Vue and Vue 2. The extra close is removed solely to leave one close owner, not as a claimed reproduced focus fix.

The first review harness checked output values but missed `window.error`. A retained real-renderer Vitest fixture and a corrected error-observing harness exposed a different failure in both libraries: synchronous WC controlled Switch feedback re-entered the current owner through the demo renderer's prop update, and the continuing Switch callback reported `[Context] illegal phase for run.context.update: unknown`. The app now coalesces all WC event-triggered prop writes, including Save/Restore disabled state, in one microtask after the outward callback returns. It does not change Base, Runtime or Adapter semantics and does not swallow errors.

This scheduling is WC-specific. Applying the same extra microtask to Vue/Vue 2 was countertested and moved the caret backward even though final text was correct: the frameworks' owner-prop staging then followed TextControl's restoration microtask. Their existing synchronous staging is preserved. React's scheduling is unchanged; local React 19 does not substitute for the target React 18 browser evidence.

Action entry still requires the active, ready generation. A queued accepted WC update requires only a live, current generation, so a temporarily preparing generation can retain accepted input when replacement fails. Successful replacement or unmount revokes queued writes; cleanup clears the queue. Tests cover coalescing, no synchronous prop re-entry, temporarily locked/retained ownership, supersession and disposal. The real WC renderer fixture exercises both libraries' Select keyboard selection/close/focus, normal text and caret, synthetic composition and caret, rejected mid-composition save, completed save, restored draft and default save, while capturing runtime errors. These Happy DOM checks remain distinct from rendered-browser evidence.

## React synchronous renderer follow-up

Exact-head Chromium capture for `b3cd7c862befd1a796f6dfd1b13969aaa4b259d5` completed the visible settings journeys but still failed the unchanged no-page-errors assertion: each of eight homepage cases recorded two Context phase errors. Each sequence exercises the task twice in React. That correspondence alone is not event-level attribution because the original capture retained only error messages; the capture now records stack, runtime and fine-grained task stage without relaxing acceptance.

The installed React 19.2.6 development dependency was used only as an explicitly labeled local negative control with the actual React Adapter and website demo renderer. Both libraries reproduced the same Switch `publishContext` callback-phase error. The demo renderer's React prop path uses `flushSync`, so it shares the synchronous re-entry risk already observed in WC. The website consumer now queues prop feedback for WC and React, while Vue/Vue2 retain their original staging to preserve the previously measured caret ordering. No Base, Runtime, Adapter or target React dependency is changed.

The retained local React 19 regression fixture captures `window.error` and checks Select keyboard choice/close/focus, Switch, normal caret, composition caret, guarded save, restore and default save. Its initial action sequence was corrected to wait for the next action's actual role/disabled projection after React's whole-tree refresh, rather than click a temporarily pending node. The production fix does not add a delay to tests or suppress errors. Passing this supplementary React 19 fixture does not accept the homepage's React 18 CDN path; that remains an exact-head native-browser CI obligation.

## Chinese Demo CTA wording

The maintainer explicitly selected `试试 Demo` for the Chinese homepage CTA. Keep that wording verbatim, its existing `#home-demo-previewer` destination, and the approved bilingual hero lines. This page-specific copy decision does not change the English CTA and is not a general design-skill rule.
