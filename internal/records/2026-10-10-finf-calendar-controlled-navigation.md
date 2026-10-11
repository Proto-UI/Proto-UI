# Calendar controlled navigation and disabled policy

Date: 2026-10-10 UTC. Local baseline `59218c40`; previously frozen snapshots are unchanged.

## Verified failures

The supplied fixed-snapshot audit was executed unchanged against its source. PageDown from selected/focused `2026-10-31` requested `2026-11` while controlled canonical month remained `2026-10`, but all 42 offset days lost their Tab entry. A second actual consumer showed Root disabled did not reach Next's exposed disabled state, focus participation or `aria-disabled`. The audit's consumer-detach case already passed and was not altered.

Before the repair, seven new Calendar navigation cases had four failures and three passes. The original three-case audit had two failures and one pass.

## Repair boundary

- Keyboard navigation now delegates its date intent to the Calendar Root. It no longer writes an unaccepted cross-month active date directly into shared context.
- Root retains the current valid active date while a controlled month request is pending or refused. Synchronous/delayed owner acceptance commits the pending target only against the accepted month and current availability; unavailable targets use the existing valid entry fallback.
- A root-owned focus request is consumed by the matching materialized Day. Focus is requested only if a Calendar day still held focus at acceptance, avoiding stealing focus back from an external control.
- New navigation supersedes prior pending intent. Selection, disable, unmount or redirection away from the originating/requested month invalidates it.
- Previous and Next combine Root disabled with their own Button disabled prop, synchronizing exposed state, accessibility, focus participation and transient press/hover state. Their existing Button composition is retained; no Base-dependency policy decision is made here.

## Evidence

- Ten dedicated Calendar cases pass: refusal, synchronous acceptance, delayed acceptance, already-rendered outside-day refusal, unavailable/max-boundary navigation, availability changed before acceptance, superseding intent, external focus preservation and both navigation controls' disabled updates.
- Calendar, controlled navigation, Date Picker/compositions and four-family consumers: 59/59 tests passed across four files.
- The original audit copied with only source/config roots redirected to this worktree passes 3/3: refused month retains `tabs=[2026-10-31]`; disabled Next reports `true`, `tabIndex=-1`, `aria-disabled=true`. This rerun is local evidence, not a new independent review.
- Scoped Calendar source/test TypeScript passed with pinned offline pnpm 10.32.1. Vite's existing CJS API deprecation warning remains visible.
- No native GPUI/Rust, visual recipe fidelity, real-browser screenshot or full Finf acceptance is claimed. Public family typing audit and exact upstream-style repairs are separate follow-ups.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
