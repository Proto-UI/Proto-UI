# 2026-07-29 Base prototype admission and Brutalist styled-only boundary

> Approved design record. Defines how Proto UI decides whether a component-shaped concept belongs in the official Base prototype library, and applies that decision to PRs #337 and #338. This record does not itself promote catalog entities to stable status.

## 1. Context

The Brutalist incubation work initially modeled several familiar component-library names as Base families so that styled prototypes could inherit them. Maintainer review of PRs #337 and #338 identified that this reverses the intended ownership boundary:

- Base is not a catalog-shaped inheritance layer for styled libraries.
- A styled library may define useful formal prototypes without a matching Base family.
- Base admission depends on a transferable semantic or behavioral responsibility, not on whether a component name is common.

This review covers Separator, Skeleton, Badge, Card, interactive/selectable card concepts, Avatar, and the dependency boundary with a possible future Image prototype.

## 2. Core decision

A Base Prototype is an independently addressable, cross-host, testable protocol subject. It must own at least one information path from an input fact to an observable output.

An input fact may be:

- an author-provided prop;
- a host event;
- a context or relationship fact;
- owned internal state.

An observable output may be:

- exposed state, event, request, or method;
- an accessibility-tree projection;
- focus, keyboard, pointer, or activation behavior;
- a mandatory content-model or structural constraint.

User interaction is not mandatory. A non-interactive subject can belong in Base when it owns a stable semantic projection. Conversely, props, anatomy names, source files, or an `asHook` entry do not establish a protocol by themselves.

## 3. Admission criteria

A candidate Base family must satisfy all of the following.

### 3.1 Independent subject

The family exists because it owns a transferable responsibility, not because a styled implementation needs an inheritance hook or a familiar package subpath.

### 3.2 Explicit information path

Its specification identifies the input facts, their owner, the observable output, and the synchronization or transition rules between them.

### 3.3 Cross-host stability

The protocol has the same meaning in React, Vue, Web Component, and other adapters. A DOM-only implementation trick is not sufficient evidence.

### 3.4 Distinct responsibility

The subject cannot be expressed without loss by an existing Base protocol or a composition of existing subjects. Navigation, activation, persistent pressed state, exclusive selection, disclosure, and status announcement remain owned by their respective protocols.

### 3.5 Negative boundary

The specification states what the subject does not own, including visual variants, business state, loading ownership, announcement policy, focus behavior, layout, or replacement timing where applicable.

### 3.6 Executable evidence

Every retained P criterion has substantive source and T evidence. Directory presence, empty setup functions, anatomy-only claims, and catalog placeholders do not count as verification.

## 4. Two legitimate prototype categories

### 4.1 Base protocol prototype

A Base prototype satisfies the admission criteria and provides a transferable semantic or behavioral contract. Styled families may project it when they need that same contract.

### 4.2 Styled-only prototype

A styled-only prototype is still a formal Proto UI Prototype. It may own:

- design-language props and variant vocabulary;
- visual feedback rules;
- a deliberate content model;
- design-language-specific anatomy;
- P/T entities that verify those claims.

It does not need a Base counterpart and must not fabricate one for reuse. Its specification must avoid claiming interaction, accessibility, loading, focus, or announcement ownership that belongs to another subject or to the application.

## 5. Family decisions

| Family | Official decision | Owned information path or boundary |
| --- | --- | --- |
| Separator | Base protocol plus Brutalist projection | `orientation` and `decorative` facts determine role, applicable orientation, and accessibility-tree presence. It is contentless, non-focusable, and non-interactive. |
| Skeleton | Brutalist-only styled prototype | Visual loading feedback only. The parent async/loading region owns busy state, announcement, replacement timing, and focus continuity. |
| Badge | Brutalist-only styled prototype | Passive visual label. Status, activation, pressed/filter state, and selection are composed from their actual protocol owners. |
| Card | Brutalist-only visual surface | Passive grouping and visual anatomy only. It owns no generic activation or selection semantics. |
| Interactive/selectable card | No generic Card mode | Project Link, Button, Toggle, Checkbox/Radio, or Disclosure semantics according to the actual information path. |
| Avatar | Deferred | Do not establish Base Avatar until native image facts and fallback orchestration can be modeled on a verified Image capability. |
| Image | Maintainer-owned future work | This record defines only Avatar's dependency on it; it does not freeze Image props, state, events, or a11y behavior. |
| Tooltip | Maintainer-owned | The maintainer continues Base Tooltip from PR #342. No further contributor implementation is in scope. |
| Scroll Area | Maintainer-owned if further work is needed | The maintainer may continue Base Scroll Area from PR #343. No proactive contributor implementation is in scope. |

## 6. Separator contract

Separator is admitted because it owns a stable semantic projection even though it has no user interaction.

### 6.1 Inputs

- `orientation: horizontal | vertical`
- semantic versus decorative mode (the current authoring name may remain `decorative`)

### 6.2 Semantic mode output

- project the separator role;
- project the applicable orientation;
- remain present in the accessibility tree.

### 6.3 Decorative mode output

- project no separator semantics;
- remain absent from the accessibility tree or use the adapter's presentation-equivalent behavior;
- remove semantic-only orientation output rather than leaving stale ARIA state.

### 6.4 Invariants

- contentless;
- no visible or interactive descendants;
- no tab stop;
- no keyboard, pointer, command, activation, or mutable value channel;
- no ownership of length, thickness, color, spacing, or layout.

A resizable divider, splitter, or resize handle is a separate future protocol. It would require value ownership, pointer drag, keyboard adjustment, focus, bounds, and relationships to adjacent panels.

## 7. Skeleton boundary

Skeleton is not admitted to Base because it has no independent state, event, command, focus model, or semantic output. A Base implementation that only hides itself and returns no content is an empty inheritance shell.

Brutalist Skeleton may directly define:

- a contentless render contract;
- exclusion from the accessibility tree;
- consumer-owned dimensions;
- Brutalist surface, border, shadow, and motion feedback;
- reduced-motion-safe visual behavior if motion is present.

It must not own:

- `loading` or `aria-busy` state;
- live announcements;
- the relationship between placeholder and real content;
- reveal or replacement timing;
- focus restoration or continuity.

A future portable loading protocol must begin as a separate async/loading-region design exercise covering those responsibilities.

## 8. Badge boundary

Badge is not admitted to Base because a passive label has no independent interaction or accessibility protocol.

Brutalist Badge should use a design-language-native API. A tone/color axis and, if justified, an emphasis axis are preferable to copying Shadcn's `default | secondary | destructive | outline` vocabulary. Every Brutalist badge already has a strong outline, so `outline` is not a meaningful variant axis.

The prototype must pair foreground and background colors to preserve contrast and must remain passive and non-focusable by default.

Composition rules:

- dynamic status announcement belongs to a Status/live-region owner;
- navigation belongs to Link;
- single activation belongs to Button;
- pressed/filter state belongs to Toggle or Checkbox-like semantics;
- selection belongs to Radio/Checkbox or a collection selection protocol.

## 9. Card boundary

A passive card is a visual grouping surface, not a general Base interaction protocol. A seven-part Base anatomy copied from another library does not establish portable semantics.

Brutalist Card should define only the parts its own visual grammar needs. The expected starting point is Root plus the smallest justified subset of Header, Content, and Footer.

- Title and Description remain ordinary typography/content unless a later protocol demonstrates a distinct responsibility.
- Action is composed from Button or Link rather than becoming a semantic Card part.
- Passive Card receives no default role or tab stop.

Interactive uses select the true protocol owner:

- navigation card: Link;
- single-action card: Button;
- persistent on/off card: Toggle or Checkbox-like protocol;
- exclusive selectable card: Radio or collection selection protocol;
- expandable card: Disclosure/Collapsible;
- card containing independent controls: passive visual Card containing those controls.

A generic `interactive`, `clickable`, or `selectable` Card mode is forbidden because it obscures state ownership and creates nested-interactive-content hazards.

## 10. Image and Avatar deferral

The withdrawn Avatar implementation did not receive native load/error facts. Its `loaded` state was initialized from the presence of `src`, so it could not represent image completion, failure, retry, fallback timing, or native alternative-text behavior.

Avatar remains deferred until all of the following are available:

- a host-neutral Image capability can project the required native image facts and attributes;
- load and failure facts are observable across supported adapters;
- alternative-text and accessible-name ownership is explicit;
- decorative versus informative image behavior is defined;
- SSR/hydration and already-cached image behavior have executable evidence;
- fallback visibility and timing can consume verified Image facts without fabricating success.

The maintainer may add Image independently. This record does not pre-empt that design or freeze its API.

## 11. PR #337 disposition

PR #337 should be revised as follows:

1. retain and tighten Base Separator;
2. retain Brutalist Separator as its visual projection with consumer-owned length;
3. ensure decorative mode removes semantic-only orientation output;
4. verify semantic/decorative accessibility-tree behavior, both orientations, contentlessness, non-focusability, and absence of interaction channels;
5. remove Base Skeleton from Base exports, CLI, source, tests, and P/T catalog;
6. retain Brutalist Skeleton as a direct styled-only prototype with no `asSkeletonRoot()` dependency;
7. give retained Base and Brutalist entities substantive P/T/source correspondence.

## 12. PR #338 disposition

PR #338 should be revised as follows:

1. remove Base Badge and Base Card families from Base exports, source, tests, and catalog;
2. retain Brutalist Badge as a direct styled-only prototype with a Brutalist-native tone/emphasis API;
3. retain Brutalist Card as a direct styled-only visual surface with reduced, justified anatomy;
4. remove default roles, focusability, and generic interaction modes from both families;
5. demonstrate Button/Link or selection/disclosure composition separately when useful, without making those modes part of Card or Badge;
6. restore exact `.proto.ts` to P/T/source mapping with substantive criteria only;
7. remove the directional border-width `style.merge.semantic.v0` behavior change from this PR. Any semantic-merge contract revision requires a separately versioned contract, source, and test scope.

## 13. Ownership and non-goals

The contributor will not continue implementation on Base Tooltip or Base Scroll Area unless the maintainer requests it. Image remains maintainer-owned future work.

This design does not authorize:

- a generic Base visual-atom layer;
- a generic interactive Card protocol;
- a loading/async-region protocol;
- Image or Avatar API implementation;
- Tooltip or Scroll Area changes;
- Input, Textarea, Native Control, or Composer work;
- changes to immutable historical release evidence.

## 14. Approval record

Approved on 2026-07-29 in the maintainer/contributor design discussion:

- use transferable protocol responsibility, not component-library naming, as the Base admission test;
- keep Separator in Base;
- make Skeleton, Badge, and Card Brutalist-owned styled-only prototypes;
- defer Avatar behind the maintainer's possible Image prototype;
- hand Base Tooltip and possible Base Scroll Area continuation to the maintainer.
