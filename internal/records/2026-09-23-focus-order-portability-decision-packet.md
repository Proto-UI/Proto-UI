# Focus roving order on non-DOM hosts: decision packet

Date: 2026-09-23

Status: non-normative decision packet for #687. It changes no spec entity, capability, implementation, or guarantee. It asks the maintainers for one semantic direction so that a later pull request can catalog it.

Refs: #687, `M-FOCUS-0001-Q-PORTABILITY`, `internal/records/2026-09-22-gpui-adapter-architecture-decision.md` (section E, Ordering), `internal/records/2026-09-08-focus-catalog.zh-CN.md`.

Baseline: `main` at `1b1ee9e6`, catalog `0.3.0-alpha.1`.

## Question

When a host's Focus targets are not DOM nodes, where does the relative order of roving members, and of scope members, come from? This is the order that first, last, next, previous and the "selected or first" fallback use.

This is the ordering half of `M-FOCUS-0001-Q-PORTABILITY`. Its other half, one shared center versus several focus domains, stays out of scope.

## What is governed, and what is not

Governed (all entities `draft` unless noted):

- `M-FOCUS-0001` states no ordering rule in criteria -A to -E. Its `requires.hostCaps` lists `HC-FOCUS-TARGET-0001`, `HC-FOCUS-ENTRY-0001` and `HC-DEFAULT-ACTION-0001`, none of which orders anything. `Q-PORTABILITY` records that the current order is "host HTMLElement document order" and that the bounded Web catalog "does not admit an independent non-Web ordering protocol".
- `C-AS-FOCUS-ROVING-0001` defines first, last, next, previous and selected movement without defining the order. Its -I speaks of "host order", not document order.
- `C-FOCUS-0002-A` takes topology from the host's logical parent chain "rather than DOM containment"; -D allows a fallback only for compatibility, not as the long-term primary model.
- `HC-FOCUS-TARGET-0001-A` identifies targets independently of their current physical view.
- `D-COLLECTION-FOCUS-ROVING-RELATIONSHIP-0001-B`: roving may consume Collection but must not strictly depend on it. `C-ANATOMY-ORDER-0001-D`: roving focus must not be assigned to `anatomy.order`.
- The four Adapter profiles (`A-WEB-COMPONENT-0001`, `A-REACT-18-19-0001`, `A-VUE-3-0001`, `A-VUE-2-0001`, all `active`, all `platform: web`) guarantee roving membership, not order.

Not governed:

- "Document order" appears only in the `Q-PORTABILITY` context, `packages/modules/focus/README.md`, and the 2026-09-08 catalog record, which left the question open on purpose.
- `spec/MODULE-HOST-CAP-ADAPTER-CATALOGING.zh-CN.md` says a DOM node must not become a portable baseline, and that a question backed by one host's evidence belongs in `openQuestions`.

## What the implementation does

- `packages/modules/focus/src/center.ts` `compareEntries` returns 0 for a missing or identical target. Otherwise it calls `aEl.compareDocumentPosition(bEl)` and reads `Node.DOCUMENT_POSITION_FOLLOWING` and `PRECEDING`, with no guard for either. Scope members, roving members, first, last, next, previous, looping and pending roving entries all sort through it.
- A null target falls back to registration order. A mix of null and non-null targets makes the comparator inconsistent, and a detach followed by an upsert moves a member to the end. No entity describes this.
- Every target-taking focus capability in `packages/modules/focus/src/caps.ts` is typed `HTMLElement`. There is no ordering capability.
- By reading, not by running: a target without `compareDocumentPosition` throws a `TypeError`, and a realm without a `Node` global throws a `ReferenceError`. The GPUI peer's targets are plain `{ ref }` objects in Node, so the first multi-member roving Prototype it runs, Base Tabs, would fail on its first arrow key. The peer's bundle holds no roving Prototype yet, so nothing fails today.

Evidence gap: every test runs under happy-dom (`vitest.config.ts`). The runtime contract tests fake `compareDocumentPosition` with an order that always equals mount order, and the adapter conformance fixture mounts members in DOM order. No test tells document order apart from registration order, and none uses non-DOM targets. So today's evidence cannot falsify either A or B below on the Web.

## Information path

A key press reaches the List's global `key.down` lease. `packages/modules/focus/src/create.ts` maps it to a roving operation and asks the shared center. The center collects the members whose nearest roving ancestor is the List, sorts them with `compareEntries`, picks the next target, and asks the host to focus it through `FOCUS_REQUEST_FOCUS_CAP`. The host applies focus and reports it back as a focus fact, and the member's `focused` state follows.

The order is needed synchronously, inside the key handler, in whatever realm runs the Module. For a host whose Module runs in a peer, such as GPUI over T0, the peer must be able to answer "does a come before b" without a round trip to the host.

## Choices

**A. A host capability supplies the order.** The Focus module compares two targets through an Adapter-provided capability. The Web realization is document order of the physical target, so Web behavior does not change. A non-DOM host realizes its own order. For GPUI, that is the order of its projected surface tree, which it can give the peer ahead of time.

- For: matches "host order" in `C-AS-FOCUS-ROVING-0001-I` and the host-sourced topology of `C-FOCUS-0002-A`. It keeps DOM types out of the portable baseline. It is the direction the merged architecture record already names.
- Against: a new capability means new catalog surface and a new obligation on every Adapter. Currently the Web Adapters meet it only implicitly.
- Falsified by: a Web case where document order differs from registration order and roving still follows document order under the capability, and a non-DOM case where roving follows the host's comparator.

**B. Focus keeps a stable fallback order of its own.** When two targets cannot be compared, Focus orders them by registration. This is already the behavior for null targets.

- For: no new capability. It matches the Anatomy precedent (`C-ANATOMY-ORDER-0001-C`).
- Against: on a non-DOM host, registration order is the only order, so reordering members requires re-registering them. If order counts as topology, `C-FOCUS-0002-D` permits a fallback only for compatibility, not as the primary model.

**C. Focus takes its order from Collection or Anatomy.** Excluded as the required source by `D-COLLECTION-FOCUS-ROVING-RELATIONSHIP-0001-B`, `M-FOCUS-0001-C`, and `C-ANATOMY-ORDER-0001-D`. Optional consumption stays permitted by the same -B, but it cannot cover members that are not declared items.

**D. Keep non-Web order outside the catalog.** This is the current state: every profile is `platform: web`. It does not answer the question for a non-DOM host. Any non-Web profile would have to omit or qualify multi-member roving, which covers Tabs, Radio Group, Select and Dropdown Menu content, and the Shadcn and Brutalist Prototypes built on them.

## Recommendation

**A, with B as its declared fallback.**

- Catalog a host capability that compares two focus targets within one center.
- On the Web, it is realized as document order.
- When a host provides no comparison, or cannot compare two targets, Focus falls back to stable registration order instead of throwing.

The Web keeps its behavior. The fallback removes today's undescribed null-target path and replaces it with a stated rule. Non-DOM hosts get a supported path.

## Exclusions

- No geometric or "visual" order claim. The capability promises whatever order the host defines, and on the Web that is document order. This stays within what `HC-ANATOMY-ORDER-0001-A` claims for Anatomy.
- No change to Collection or Anatomy ownership.
- No position on focus domains, cross-tree order for portals and shadow roots, or right-to-left arrow mapping. Each stays open.

## Residual risks

- A host comparator that is not a consistent total order would make movement erratic. The capability should require consistency within one navigation.
- Radio Group reads Collection order for checked safety and roving order for movement. Off the Web, the two could disagree, and no entity says whether they must agree.
- `apps/www/src/content/docs/en/ui-libraries/base/radio-group.mdx` calls Radio Group "host-neutral", while roving order is Web-only today.

## Proposed graph, if A is chosen

These are for a follow-up pull request after the decision, not for this record.

- `HC-FOCUS-ORDER-0001` (draft):
  - A: the host compares two focus targets of one center, consistently within a navigation.
  - B: the Web realization is document order of the physical target.
  - C: when there is no comparison, or two targets are incomparable, Focus uses stable registration order and does not throw.
  - D: the capability requires no DOM type.
- `M-FOCUS-0001`:
  - Add `HC-FOCUS-ORDER-0001` to `requires.hostCaps`, needed only when a scope or roving group has more than one member.
  - Add a criterion that roving and scope order is host order.
  - Resolve the ordering half of `Q-PORTABILITY`, and keep the focus-domain half open under its own question.
- Adapter profiles: the four Web profiles provide `HC-FOCUS-ORDER-0001` through document order. They are `active`, so this needs a lifecycle disposition for the release that carries it.
- `T-FOCUS-ORDER-0001` covers:
  1. On the Web, document order differs from registration order, and roving follows document order.
  2. With non-DOM targets and a host comparator, roving follows the comparator.
  3. Incomparable targets fall back to registration order without throwing.
  4. Scope first and last use the same order. Case 1 closes the evidence gap above.
- Implementation, after the spec change:
  - Add a Focus capability for the comparison.
  - `compareEntries` uses it, with the guarded fallback.
  - Each Web Adapter provides document order explicitly.
  - The GPUI peer provides the host's surface order.

## Decision needed

One choice: **A** (host-supplied order, Web document order, stable registration fallback), **B** (stable registration order only), or **D** (non-Web order stays uncataloged for now).

With A or B, the next pull request catalogs the chosen rule as `draft`, with the tests above, and resolves the ordering half of `M-FOCUS-0001-Q-PORTABILITY`. With D, Base Tabs and every other multi-member roving family stay out of the GPUI host's scope until the question is reopened.
