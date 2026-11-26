# Finf safe-area and spacing audit

Source: `59e3b825affddd7c5a59af60ca87d912f4486247`. 159 catalog identities / 160 source entries. Read-only audit; no repository code edited.

## Result and evidence boundary

Confirmed rendered defect at 30d477c1: Shadcn centered Dialog at 390px has zero side margin. HEAD moved to 59e3b825 during the audit through unrelated governance-observation changes; no inventoried source/spec or inspected geometry host changed. The screenshot remains 30d evidence, not a fresh 59e render. Brutalist repeats the same width tokens. Anchored families, long-content handling and ordinary-layout combinations have source-confirmed gaps or explicit runtime risk cases, not blanket native failures.

Every current identity is assigned to a responsible family/ancestor and acceptance profile below. The JSON contains exact source hashes, line evidence, catalog links, all 159 identities and required-missing projection cells. Source inspection never equals native acceptance.

## Findings

### EDGE-01 — rendered-confirmed-and-source-confirmed
Centered Shadcn Dialog has zero horizontal margin at 390px. Source uses w-full max-w-lg; pinned upstream already subtracts 2rem.

Evidence: packages/prototypes/shadcn/src/dialog/content.proto.ts:18; pr858-evidence/30d-candidate/dialog-docs-390-normal.png (viewed by this worker); Parent/repair worker DOM facts x=0,right=390; screenshot is not a new device run

Acceptance: CENTER, ENV

### EDGE-02 — source-confirmed-omission-rendered-unverified
Base direct Dialog only centers; Brutalist Dialog repeats w-full max-w-lg. Centered family has no shared max-height/content-scroll/usable-viewport contract in inspected source.

Evidence: packages/prototypes/base/src/dialog/content.proto.ts:260; packages/prototypes/brutalist/src/dialog/content.proto.ts:19; packages/modules/overlay/src/impl.ts:46,549

Acceptance: CENTER, ENV

### EDGE-03 — source-confirmed-gap-runtime-impact-unverified
Dropdown/HoverCard/Tooltip collisionPadding defaults to 0; Select uses 10. Host uses viewport flip/shift/size but inspected layer has no explicit hardware-safe-area contract. Dialog is non-anchored and cannot be fixed by merely increasing anchored collisionPadding.

Evidence: packages/prototypes/base/src/dropdown/content.proto.ts:52; packages/prototypes/base/src/hover-card/content.proto.ts:53; packages/prototypes/base/src/tooltip/content.proto.ts:52; packages/prototypes/base/src/select/content.proto.ts:51; packages/modules/positioning/src/web/floating-ui-host.ts:76-99

Acceptance: ANCHOR, CENTER, ENV

### EDGE-04 — source-confirmed-gap-runtime-impact-unverified
Positioning publishes --proto-ui-available-width, but no current prototype consumes it. Dropdown/Select clamp vertical available height and scroll; Select fixes/min-width to anchor width. Oversize anchors/unbreakable text/narrow viewports need horizontal policy.

Evidence: packages/modules/positioning/src/web/floating-ui-host.ts:97; packages/prototypes/shadcn/src/dropdown/content.proto.ts:19; packages/prototypes/shadcn/src/select/content.proto.ts:29; packages/prototypes/brutalist/src/dropdown/content.proto.ts:26; packages/prototypes/brutalist/src/select/content.proto.ts:19

Acceptance: ANCHOR, ENV

### EDGE-05 — source-confirmed-gap-runtime-impact-unverified
HoverCard uses fixed w-64 without available-width/height caps. Tooltip has no width/height cap; Shadcn overflow-hidden does not establish legible long-content handling. These are risk cases, not proven rendered failures.

Evidence: packages/prototypes/shadcn/src/hover-card/content.proto.ts:21; packages/prototypes/brutalist/src/hover-card/content.proto.ts:21; packages/prototypes/shadcn/src/tooltip/content.proto.ts:5-15; packages/prototypes/brutalist/src/tooltip/content.proto.ts:13

Acceptance: ANCHOR, ENV

### EDGE-06 — composition-risk-native-verification-required
Absolute close icon plus long title has no explicit reserved title area; Shadcn footer is unwrapped flex row. Long labels, short height and keyboard must be verified together with vertical containment.

Evidence: packages/prototypes/shadcn/src/dialog/close-icon.proto.ts:17; packages/prototypes/shadcn/src/dialog/header.proto.ts:8; packages/prototypes/shadcn/src/dialog/footer.proto.ts:8; packages/prototypes/brutalist/src/dialog/close-icon.proto.ts:20

Acceptance: CENTER, CONTROL, ENV

### EDGE-07 — composition-risk-native-verification-required
Fixed-height/nowrap/nonshrinking controls and tabstrips, w-fit badges and unwrapped Card header/footer need narrow-width/localized-label policy at their actual composition owner. They are not each a reason to add viewport margins.

Evidence: packages/prototypes/shadcn/src/tabs/list.proto.ts:14; packages/prototypes/brutalist/src/tabs/list.proto.ts:15; packages/prototypes/brutalist/src/card/header.proto.ts:10; packages/prototypes/brutalist/src/card/footer.proto.ts:10

Acceptance: CONTROL, TABSTRIP, CARD, ENV

### EDGE-08 — source-present-runtime-unverified
Scroll host supplies overflow behavior, composed track corner inset and restoration. Shadcn/Brutalist viewport focus rings are inset. Preserve these mechanisms; verify finite ancestor dimensions, chrome overlap and focused-descendant reveal rather than labeling missing leaf margins a defect.

Evidence: packages/modules/scroll/src/web/create-web-scroll-host.ts:276-278,350-455; packages/prototypes/shadcn/src/scroll-area/viewport.proto.ts:25; packages/prototypes/brutalist/src/scroll-area/viewport.proto.ts:23-30

Acceptance: SCROLL, ENV

### EDGE-09 — ancestor-owned-contract-evidence-required
These leaves do not own page safe-area margins. Their actual parent must prove long-content reflow/scroll, image/table sizing, visual gap, loading replacement and focus/paint safety. Every identity remains bound to a named composition profile; no blanket N/A.

Evidence: packages/prototypes/base/src/surface/root.proto.ts; packages/prototypes/base/src/image/root.proto.ts; packages/prototypes/base/src/table/root.proto.ts; packages/prototypes/brutalist/src/skeleton/root.proto.ts

Acceptance: FLOW, SURFACE, STATUS, CONTROL, ENV

### EDGE-10 — absent-current-family-future-contract-required
No Sheet/Drawer source family exists among current Base/four projections. This is an inventory boundary, not passing evidence and not grounds to relabel current centered Dialog. Future edge-docked families require their own contract.

Evidence: complete 160-source-file inventory

Acceptance: EDGE_FUTURE, ENV

## Executable acceptance profiles

### ENV
Finf cross-family composition owner + selected Web Adapter owner

- Run actual components in React/Vue/Vue2/Web Component at 320x568,390x900,768x1024,1280x800 and short landscape 844x390. Bind screenshots and DOM measurements to exact commit, adapter and device.
- Repeat with long localized labels, unbroken URLs, 200% text sizing and supported browser zoom; include asymmetric safe areas and real mobile browser chrome/soft-keyboard open/close. Synthetic geometry tests do not certify real keyboard/notch behavior.
- Record panel/control/visual viewport rects, clipping ancestor, scroll extents and focused element. No critical control may become unreachable; any intentional crop/scroll/presentation-mode change needs an explicit owner rule.

### CENTER
Dialog Content + shared available-viewport/Overlay boundary; style projection owns aesthetic gutter and maximum width

- For centered presentation, explicitly set and measure the chosen projection gutter within the usable viewport; reproduce current React390 panel x=0 and show candidate correction. Do not add gutter to full-screen Mask.
- Open a dialog taller than the available viewport: title, close, first/last form field and primary/secondary actions must remain reachable by an intentional bounded scrolling composition while the background remains modal-locked.
- Open input near the bottom, show/hide real soft keyboard, rotate and resize while open; preserve entered data/focus and recompute bounds without reopening.
- Repeat enter/leave/interrupted reopen and 200% text; long title must not collide with absolute Close; footer actions must wrap/stack/scroll by explicit responsive policy.

### ANCHOR
Base anchored overlay + positioning host, projected Content width/wrapping, ancestor safe-viewport provider

- Place trigger at each of four viewport corners and in clipping/scroll ancestors; test flip/shift and documented collisionPadding. Verify rects against the chosen usable viewport; zero collisionPadding does not establish a safe-area or aesthetic-gutter contract.
- Use long unbroken text, very wide anchors, panel larger than viewport and large text. Consume/constrain both available axes or document a safe alternative; overflow-hidden alone is not proof content is usable.
- Resize, scroll ancestors, change content/theme and move anchor while open; preserve anchor relationship, focus, target selection, dismissal and focus return.
- Tooltip and HoverCard need separate content policy: do not force a scrollable interactive body into a Tooltip. Keep supplemental text readable or explicitly bounded; dismissibility remains accessible.

### SCROLL
ScrollArea Root sizing composition + Viewport/scroll host + Scrollbar/Thumb geometry

- In a finite-size ancestor, test large content on each axis and both axes together; reach final row/column and last focused control without inaccessible clipping or unintended page overflow.
- Measure composed scrollbar/corner occupied area and ensure text, close controls, focus rings and interaction targets are not covered; test RTL and native/composed projection switches.
- Repeat when parent shrinks, keyboard appears, content grows, overflow disappears and reappears; preserve scroll/focus appropriately. Parent must supply available dimensions; h-full without a sized ancestor is insufficient evidence.

### TABSTRIP
Tabs List owns selected overflow policy; Root/Content own layout; roving focus owner reveals destination

- At narrow width with many long tab labels and large text, explicitly wrap, scroll or adapt the strip; every tab remains reachable by pointer and arrow-key focus.
- When focus/selection moves to last tab, reveal it without document-wide horizontal overflow; indicator follows visible selected rect after scroll/resize.
- Tab Content participates in long-content/input-in-dialog compositions and does not inherit an arbitrary viewport gutter on each leaf.

### CONTROL
Control owns internal padding, label/icon/hit/focus geometry; enclosing form/card/dialog/layout owns viewport and inter-control spacing

- Compose controls in narrow cards, dialog headers/footers and toolbars using long localized text, icons, loading indicators and large type. Choose explicit wrapping/truncation/min-size policy; keep names and actions available.
- Measure visible box and hit/focus area, include disabled/checked/pressed states and Brutalist translated/shadow paint; controls must not overlap or be clipped by their ancestor.
- For checkbox/radio/switch parts, verify indicator/thumb stays within track while surrounding labels wrap. Do not mechanically add page margins to control atoms.

### TEXT_ENTRY
Input/Textarea internal text and caret geometry + form/dialog/scroll ancestor viewport owner

- Long value, placeholder, selection, IME, error/help text and 200% type remain legible within chosen width; focus ring not cut by ancestor.
- For textarea resize/long content, retain caret/last line reachability and do not expand beyond ancestor without intentional scrolling.
- On real mobile keyboard, focused field and completion/dismiss actions remain accessible; preserve value/selection on viewport changes. Do not claim keyboard handling from CSS vh or source inspection alone.

### FLOW
Enclosing layout/scroll container owns available dimensions; passive content atom owns intrinsic/wrap/fit semantics

- Compose long text/unbroken content, wide table, oversized image and decorative parts inside finite-width card/dialog/scroll area; no essential information is silently clipped.
- Table uses an explicit horizontal overflow/reflow policy and preserves header/caption relationships; Image fit mode is not itself a parent-size constraint.
- Text remains selectable/readable where applicable; decorations do not capture gestures or create accidental empty focus stops.

### CARD
Card Root + Header/Content/Footer own internal rhythm and narrow-layout rules; page ancestor owns outer safe area

- Measure header/content/footer insets and vertical rhythm as a whole, including paired py/px/gap; do not infer padding from one part alone.
- Use long title plus trailing action and long multi-button footer at 320px/large type. Define shrink/wrap/stack behavior; preserve actions, focus rings and hard shadow paint.
- Embed controls, textarea, image and scroll area; constrain overflow intentionally while retaining card structure.

### SURFACE
Surface is passive visual skin; the named consuming page/card/overlay composition owns size, padding and safe viewport

- Test Surface as card/container/overlay skin with explicit consuming layout dimensions and padding. The absence of default Surface padding is intentional only when the consumer contract is demonstrated.
- Rounded clipping, border, material fallback, focus treatment and translated/shadow paint cannot obscure child content/actions.
- Bootstrap and LiquidGlass are included even while packages are private; package availability does not waive this composition evidence.

### STATUS
Async/Live Region owner preserves semantics; named containing flow owns spacing and sizing

- Replace short content with long loading/error/status text inside narrow form, card and dialog; ensure reflow, focused controls and scroll reachability survive the update.
- LiveRegion is announcement semantics, not a Toast or fixed banner. Skeleton/Spinner sizing and surrounding label/gap must be supplied by the consuming loading composition.

### TRANSITION
Transition owns presence/timing; participating panel/container owns geometry across phases

- Record start/entered/leaving/interrupted/reopened geometry for Dialog and anchored surfaces; no transient critical-control occlusion or destructive scroll/focus jumps.
- Reduced-motion path retains same usable bounds and cleanup; do not bake viewport margins into generic Transition.

### EDGE_FUTURE
Future Sheet/Drawer/Toast or edge-docked family owner + safe viewport host

- No current Sheet/Drawer implementation was found in this snapshot. When introduced, record intentional attachment edges versus protected content edges, available height, gesture/dismiss area, safe-area and keyboard policy.
- Do not infer that a future edge-attached panel should receive centered-Dialog four-sided margins or claim existing Dialog alert mode provides every AlertDialog/Sheet behavior.

## Complete family / identity register

### base/async-region (status-content-container)
Busy semantic content host, not viewport overlay; containing form/dialog owns changing-content layout.

Identities: P-BASE-ASYNC-REGION

Profiles: STATUS, FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/base/src/async-region/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/async-region/root.proto.ts)

### base/button (interactive-control)
Control internal geometry and focus target; wrapping toolbar/form/card/dialog parent owns available width/gutter.

Identities: P-BASE-BUTTON

Profiles: CONTROL, ENV; findings: EDGE-07.

- [packages/prototypes/base/src/button/button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/button/button.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/button.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/button

### base/checkbox (compound-interactive-control)
Root hit/label composition and Indicator fit; surrounding form/layout owns external spacing.

Identities: P-BASE-CHECKBOX-INDICATOR, P-BASE-CHECKBOX

Profiles: CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/base/src/checkbox/indicator.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/checkbox/indicator.proto.ts)
- [packages/prototypes/base/src/checkbox/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/checkbox/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/checkbox.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/checkbox

### base/dialog (centered-overlay)
Content owns panel bounds; Mask covers the viewport; Root owns lifecycle; title/description/header/footer and close/trigger participate in long-content/control layout.

Identities: P-BASE-DIALOG, P-BASE-DIALOG-MASK, P-BASE-DIALOG-TITLE, P-BASE-DIALOG-TRIGGER, P-BASE-DIALOG-CLOSE, P-BASE-DIALOG-CONTENT, P-BASE-DIALOG-DESCRIPTION

Profiles: CENTER, ENV; findings: EDGE-02, EDGE-03.

- [packages/prototypes/base/src/dialog/close.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/dialog/close.proto.ts)
- [packages/prototypes/base/src/dialog/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/dialog/content.proto.ts)
- [packages/prototypes/base/src/dialog/description.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/dialog/description.proto.ts)
- [packages/prototypes/base/src/dialog/overlay.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/dialog/overlay.proto.ts)
- [packages/prototypes/base/src/dialog/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/dialog/root.proto.ts)
- [packages/prototypes/base/src/dialog/title.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/dialog/title.proto.ts)
- [packages/prototypes/base/src/dialog/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/dialog/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/dialog.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/dialog

### base/dropdown (anchored-menu)
Content owns listbox/menu bounds and item reachability; Trigger owns anchor geometry; item text and Root lifecycle are verified in the same composition.

Identities: P-BASE-DROPDOWN-MENU, P-BASE-DROPDOWN-MENU-CONTENT, P-BASE-DROPDOWN-MENU-TRIGGER, P-BASE-DROPDOWN-MENU-ITEM

Profiles: ANCHOR, CONTROL, ENV; findings: EDGE-03, EDGE-04.

- [packages/prototypes/base/src/dropdown/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/dropdown/content.proto.ts)
- [packages/prototypes/base/src/dropdown/item.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/dropdown/item.proto.ts)
- [packages/prototypes/base/src/dropdown/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/dropdown/root.proto.ts)
- [packages/prototypes/base/src/dropdown/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/dropdown/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/dropdown-menu.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/menu

### base/hover-card (anchored-supplemental-panel)
Content owns supplemental panel bounds; Trigger/root lifecycle and outside pointer reachability participate.

Identities: P-BASE-HOVER-CARD, P-BASE-HOVER-CARD-CONTENT, P-BASE-HOVER-CARD-TRIGGER

Profiles: ANCHOR, ENV; findings: EDGE-03, EDGE-04.

- [packages/prototypes/base/src/hover-card/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/hover-card/content.proto.ts)
- [packages/prototypes/base/src/hover-card/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/hover-card/root.proto.ts)
- [packages/prototypes/base/src/hover-card/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/hover-card/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/hover-card.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/preview-card

### base/image (passive-media)
Image fit/source state is not maximum container size; containing layout proves dimensions and overflow.

Identities: P-BASE-IMAGE

Profiles: FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/base/src/image/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/image/root.proto.ts)

### base/input (text-entry-control)
Control owns text/caret/internal padding; form/dialog/scroll ancestor owns safe viewport.

Identities: P-BASE-INPUT

Profiles: TEXT_ENTRY, CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/base/src/input/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/input/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/input.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/input

### base/live-region (announcement-content-container)
Announcement semantics do not imply Toast layout; named containing flow proves content expansion.

Identities: P-BASE-LIVE-REGION

Profiles: STATUS, FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/base/src/live-region/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/live-region/root.proto.ts)

### base/radio-group (compound-selection-layout)
Group wrapping/spacing and Item/Indicator geometry must be verified together with long labels.

Identities: P-BASE-RADIO-GROUP, P-BASE-RADIO-GROUP-INDICATOR, P-BASE-RADIO-GROUP-ITEM

Profiles: CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/base/src/radio-group/indicator.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/radio-group/indicator.proto.ts)
- [packages/prototypes/base/src/radio-group/item.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/radio-group/item.proto.ts)
- [packages/prototypes/base/src/radio-group/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/radio-group/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/radio-group.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/radio-group

### base/scroll-area (bounded-scroll-container)
Root/ancestor provide dimensions; Viewport owns scrollable reachability; scrollbar/thumb reserve and respect track/corner geometry.

Identities: P-BASE-SCROLL-AREA-SCROLLBAR, P-BASE-SCROLL-AREA, P-BASE-SCROLL-AREA-VIEWPORT, P-BASE-SCROLL-AREA-THUMB

Profiles: SCROLL, ENV; findings: EDGE-08.

- [packages/prototypes/base/src/scroll-area/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/scroll-area/root.proto.ts)
- [packages/prototypes/base/src/scroll-area/scrollbar.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/scroll-area/scrollbar.proto.ts)
- [packages/prototypes/base/src/scroll-area/thumb.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/scroll-area/thumb.proto.ts)
- [packages/prototypes/base/src/scroll-area/viewport.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/scroll-area/viewport.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/scroll-area.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/scroll-area

### base/select (anchored-listbox)
Content/anchor-width policy and scrolling are shared with Trigger; Value/Item long text participates in horizontal constraint and keyboard selection tests.

Identities: P-BASE-SELECT-CONTENT, P-BASE-SELECT, P-BASE-SELECT-ITEM, P-BASE-SELECT-VALUE, P-BASE-SELECT-TRIGGER

Profiles: ANCHOR, CONTROL, ENV; findings: EDGE-03, EDGE-04.

- [packages/prototypes/base/src/select/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/select/content.proto.ts)
- [packages/prototypes/base/src/select/item.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/select/item.proto.ts)
- [packages/prototypes/base/src/select/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/select/root.proto.ts)
- [packages/prototypes/base/src/select/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/select/trigger.proto.ts)
- [packages/prototypes/base/src/select/value.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/select/value.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/select.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/select

### base/separator (passive-separator)
Separator spans its parent; parent owns dimensional constraint and surrounding gap.

Identities: P-BASE-SEPARATOR

Profiles: FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/base/src/separator/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/separator/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/separator.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/separator

### base/surface (passive-visual-skin)
No automatic outer gutter or inner padding; concrete consuming layout must supply and verify both where needed.

Identities: P-BASE-SURFACE

Profiles: SURFACE, FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/base/src/surface/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/surface/root.proto.ts)

### base/switch (compound-interactive-control)
Root track/hit/label composition and Thumb fit; surrounding form/layout owns external spacing.

Identities: P-BASE-SWITCH, P-BASE-SWITCH-THUMB

Profiles: CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/base/src/switch/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/switch/root.proto.ts)
- [packages/prototypes/base/src/switch/thumb.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/switch/thumb.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/switch.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/switch

### base/table (wide-structured-content)
Table semantics and rows/cells are preserved inside an explicitly responsive or horizontally scrollable ancestor.

Identities: P-BASE-TABLE-CAPTION, P-BASE-TABLE-HEADER-CELL, P-BASE-TABLE-CELL, P-BASE-TABLE-ROW, P-BASE-TABLE

Profiles: FLOW, SCROLL, ENV; findings: EDGE-09.

- [packages/prototypes/base/src/table/caption.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/table/caption.proto.ts)
- [packages/prototypes/base/src/table/cell.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/table/cell.proto.ts)
- [packages/prototypes/base/src/table/header-cell.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/table/header-cell.proto.ts)
- [packages/prototypes/base/src/table/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/table/root.proto.ts)
- [packages/prototypes/base/src/table/row.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/table/row.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/table.mdx

### base/tabs (tabstrip-and-content-layout)
List owns strip overflow policy; trigger/indicator stay reachable and aligned; Content participates in bounded long-content layout.

Identities: P-BASE-TABS-CONTENT, P-BASE-TABS-INDICATOR, P-BASE-TABS, P-BASE-TABS-LIST, P-BASE-TABS-TRIGGER

Profiles: TABSTRIP, CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/base/src/tabs/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/tabs/content.proto.ts)
- [packages/prototypes/base/src/tabs/indicator.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/tabs/indicator.proto.ts)
- [packages/prototypes/base/src/tabs/list.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/tabs/list.proto.ts)
- [packages/prototypes/base/src/tabs/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/tabs/root.proto.ts)
- [packages/prototypes/base/src/tabs/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/tabs/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/tabs.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/tabs

### base/text (passive-text)
Typography leaf; enclosing content layout owns line measure/wrapping/overflow and safe area.

Identities: P-BASE-TEXT

Profiles: FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/base/src/text/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/text/root.proto.ts)

### base/textarea (multiline-text-entry)
Control owns text/caret/resize; form/dialog/scroll ancestor supplies maximum usable area.

Identities: P-BASE-TEXTAREA

Profiles: TEXT_ENTRY, CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/base/src/textarea/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/textarea/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/textarea.mdx

### base/toggle (interactive-control)
Control internal geometry and state/focus; toolbar/form parent owns available width/gutter.

Identities: P-BASE-TOGGLE

Profiles: CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/base/src/toggle/toggle.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/toggle/toggle.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/toggle.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/toggle

### base/tooltip (anchored-supplemental-text)
Content owns readable text bounds; Group/root/trigger coordinate positioning and dismissibility, not a generic interactive scroll panel.

Identities: P-BASE-TOOLTIP-GROUP, P-BASE-TOOLTIP-TRIGGER, P-BASE-TOOLTIP-CONTENT, P-BASE-TOOLTIP

Profiles: ANCHOR, ENV; findings: EDGE-03, EDGE-04.

- [packages/prototypes/base/src/tooltip/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/tooltip/content.proto.ts)
- [packages/prototypes/base/src/tooltip/group.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/tooltip/group.proto.ts)
- [packages/prototypes/base/src/tooltip/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/tooltip/root.proto.ts)
- [packages/prototypes/base/src/tooltip/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/tooltip/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/tooltip.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/tooltip

### base/transition (presence-controller)
Geometry belongs to participating panel/container through all presence phases.

Identities: P-BASE-TRANSITION

Profiles: TRANSITION, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/base/src/transition/as-transition.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/transition/as-transition.proto.ts)
- [packages/prototypes/base/src/transition/transition.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/base/src/transition/transition.proto.ts)

### shadcn/button (interactive-control)
Control internal geometry and focus target; wrapping toolbar/form/card/dialog parent owns available width/gutter.

Identities: P-SHADCN-BUTTON

Profiles: CONTROL, ENV; findings: EDGE-07.

- [packages/prototypes/shadcn/src/button/button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/button/button.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/button.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/button

### shadcn/checkbox (compound-interactive-control)
Root hit/label composition and Indicator fit; surrounding form/layout owns external spacing.

Identities: P-SHADCN-CHECKBOX-INDICATOR, P-SHADCN-CHECKBOX

Profiles: CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/shadcn/src/checkbox/indicator.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/checkbox/indicator.proto.ts)
- [packages/prototypes/shadcn/src/checkbox/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/checkbox/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/checkbox.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/checkbox

### shadcn/dialog (centered-overlay)
Content owns panel bounds; Mask covers the viewport; Root owns lifecycle; title/description/header/footer and close/trigger participate in long-content/control layout.

Identities: P-SHADCN-DIALOG-HEADER, P-SHADCN-DIALOG-TRIGGER, P-SHADCN-DIALOG-CONTENT, P-SHADCN-DIALOG-MASK, P-SHADCN-DIALOG-CLOSE, P-SHADCN-DIALOG-TITLE, P-SHADCN-DIALOG-FOOTER, P-SHADCN-DIALOG-DESCRIPTION, P-SHADCN-DIALOG-CLOSE-ICON, P-SHADCN-DIALOG

Profiles: CENTER, ENV; findings: EDGE-01, EDGE-06.

- [packages/prototypes/shadcn/src/dialog/close-icon.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dialog/close-icon.proto.ts)
- [packages/prototypes/shadcn/src/dialog/close.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dialog/close.proto.ts)
- [packages/prototypes/shadcn/src/dialog/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dialog/content.proto.ts)
- [packages/prototypes/shadcn/src/dialog/description.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dialog/description.proto.ts)
- [packages/prototypes/shadcn/src/dialog/footer.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dialog/footer.proto.ts)
- [packages/prototypes/shadcn/src/dialog/header.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dialog/header.proto.ts)
- [packages/prototypes/shadcn/src/dialog/overlay.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dialog/overlay.proto.ts)
- [packages/prototypes/shadcn/src/dialog/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dialog/root.proto.ts)
- [packages/prototypes/shadcn/src/dialog/title.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dialog/title.proto.ts)
- [packages/prototypes/shadcn/src/dialog/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dialog/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/dialog.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/dialog

### shadcn/dropdown (anchored-menu)
Content owns listbox/menu bounds and item reachability; Trigger owns anchor geometry; item text and Root lifecycle are verified in the same composition.

Identities: P-SHADCN-DROPDOWN-MENU-CONTENT, P-SHADCN-DROPDOWN-MENU-TRIGGER, P-SHADCN-DROPDOWN-MENU, P-SHADCN-DROPDOWN-MENU-ITEM

Profiles: ANCHOR, CONTROL, ENV; findings: EDGE-04.

- [packages/prototypes/shadcn/src/dropdown/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dropdown/content.proto.ts)
- [packages/prototypes/shadcn/src/dropdown/item.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dropdown/item.proto.ts)
- [packages/prototypes/shadcn/src/dropdown/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dropdown/root.proto.ts)
- [packages/prototypes/shadcn/src/dropdown/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/dropdown/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/dropdown-menu.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/menu

### shadcn/hover-card (anchored-supplemental-panel)
Content owns supplemental panel bounds; Trigger/root lifecycle and outside pointer reachability participate.

Identities: P-SHADCN-HOVER-CARD-CONTENT, P-SHADCN-HOVER-CARD, P-SHADCN-HOVER-CARD-TRIGGER

Profiles: ANCHOR, ENV; findings: EDGE-04, EDGE-05.

- [packages/prototypes/shadcn/src/hover-card/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/hover-card/content.proto.ts)
- [packages/prototypes/shadcn/src/hover-card/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/hover-card/root.proto.ts)
- [packages/prototypes/shadcn/src/hover-card/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/hover-card/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/hover-card.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/preview-card

### shadcn/input (text-entry-control)
Control owns text/caret/internal padding; form/dialog/scroll ancestor owns safe viewport.

Identities: P-SHADCN-INPUT

Profiles: TEXT_ENTRY, CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/shadcn/src/input/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/input/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/input.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/input

### shadcn/radio-group (compound-selection-layout)
Group wrapping/spacing and Item/Indicator geometry must be verified together with long labels.

Identities: P-SHADCN-RADIO-GROUP-INDICATOR, P-SHADCN-RADIO-GROUP-ITEM, P-SHADCN-RADIO-GROUP

Profiles: CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/shadcn/src/radio-group/indicator.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/radio-group/indicator.proto.ts)
- [packages/prototypes/shadcn/src/radio-group/item.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/radio-group/item.proto.ts)
- [packages/prototypes/shadcn/src/radio-group/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/radio-group/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/radio-group.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/radio-group

### shadcn/scroll-area (bounded-scroll-container)
Root/ancestor provide dimensions; Viewport owns scrollable reachability; scrollbar/thumb reserve and respect track/corner geometry.

Identities: P-SHADCN-SCROLL-AREA-SCROLLBAR, P-SHADCN-SCROLL-AREA, P-SHADCN-SCROLL-AREA-THUMB, P-SHADCN-SCROLL-AREA-VIEWPORT

Profiles: SCROLL, ENV; findings: EDGE-08.

- [packages/prototypes/shadcn/src/scroll-area/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/scroll-area/root.proto.ts)
- [packages/prototypes/shadcn/src/scroll-area/scrollbar.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/scroll-area/scrollbar.proto.ts)
- [packages/prototypes/shadcn/src/scroll-area/thumb.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/scroll-area/thumb.proto.ts)
- [packages/prototypes/shadcn/src/scroll-area/viewport.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/scroll-area/viewport.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/scroll-area.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/scroll-area

### shadcn/select (anchored-listbox)
Content/anchor-width policy and scrolling are shared with Trigger; Value/Item long text participates in horizontal constraint and keyboard selection tests.

Identities: P-SHADCN-SELECT-VALUE, P-SHADCN-SELECT-ITEM, P-SHADCN-SELECT-TRIGGER, P-SHADCN-SELECT, P-SHADCN-SELECT-CONTENT

Profiles: ANCHOR, CONTROL, ENV; findings: EDGE-04, EDGE-07.

- [packages/prototypes/shadcn/src/select/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/select/content.proto.ts)
- [packages/prototypes/shadcn/src/select/item.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/select/item.proto.ts)
- [packages/prototypes/shadcn/src/select/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/select/root.proto.ts)
- [packages/prototypes/shadcn/src/select/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/select/trigger.proto.ts)
- [packages/prototypes/shadcn/src/select/value.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/select/value.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/select.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/select

### shadcn/separator (passive-separator)
Separator spans its parent; parent owns dimensional constraint and surrounding gap.

Identities: P-SHADCN-SEPARATOR

Profiles: FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/shadcn/src/separator/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/separator/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/separator.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/separator

### shadcn/surface (passive-visual-skin)
No automatic outer gutter or inner padding; concrete consuming layout must supply and verify both where needed.

Identities: P-SHADCN-SURFACE

Profiles: SURFACE, FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/shadcn/src/surface/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/surface/root.proto.ts)

### shadcn/switch (compound-interactive-control)
Root track/hit/label composition and Thumb fit; surrounding form/layout owns external spacing.

Identities: P-SHADCN-SWITCH-THUMB, P-SHADCN-SWITCH

Profiles: CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/shadcn/src/switch/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/switch/root.proto.ts)
- [packages/prototypes/shadcn/src/switch/thumb.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/switch/thumb.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/switch.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/switch

### shadcn/tabs (tabstrip-and-content-layout)
List owns strip overflow policy; trigger/indicator stay reachable and aligned; Content participates in bounded long-content layout.

Identities: P-SHADCN-TABS-TRIGGER, P-SHADCN-TABS-CONTENT, P-SHADCN-TABS, P-SHADCN-TABS-LIST

Profiles: TABSTRIP, CONTROL, ENV; findings: EDGE-07.

- [packages/prototypes/shadcn/src/tabs/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/tabs/content.proto.ts)
- [packages/prototypes/shadcn/src/tabs/list.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/tabs/list.proto.ts)
- [packages/prototypes/shadcn/src/tabs/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/tabs/root.proto.ts)
- [packages/prototypes/shadcn/src/tabs/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/tabs/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/tabs.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/tabs

### shadcn/text (passive-text)
Typography leaf; enclosing content layout owns line measure/wrapping/overflow and safe area.

Identities: P-SHADCN-TEXT

Profiles: FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/shadcn/src/text/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/text/root.proto.ts)

### shadcn/textarea (multiline-text-entry)
Control owns text/caret/resize; form/dialog/scroll ancestor supplies maximum usable area.

Identities: P-SHADCN-TEXTAREA

Profiles: TEXT_ENTRY, CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/shadcn/src/textarea/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/textarea/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/textarea.mdx

### shadcn/toggle (interactive-control)
Control internal geometry and state/focus; toolbar/form parent owns available width/gutter.

Identities: P-SHADCN-TOGGLE

Profiles: CONTROL, ENV; findings: EDGE-07.

- [packages/prototypes/shadcn/src/toggle/toggle.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/toggle/toggle.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/toggle.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/toggle

### shadcn/tooltip (anchored-supplemental-text)
Content owns readable text bounds; Group/root/trigger coordinate positioning and dismissibility, not a generic interactive scroll panel.

Identities: P-SHADCN-TOOLTIP-GROUP, P-SHADCN-TOOLTIP-TRIGGER, P-SHADCN-TOOLTIP-CONTENT, P-SHADCN-TOOLTIP

Profiles: ANCHOR, ENV; findings: EDGE-04, EDGE-05.

- [packages/prototypes/shadcn/src/tooltip/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/tooltip/content.proto.ts)
- [packages/prototypes/shadcn/src/tooltip/group.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/tooltip/group.proto.ts)
- [packages/prototypes/shadcn/src/tooltip/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/tooltip/root.proto.ts)
- [packages/prototypes/shadcn/src/tooltip/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/shadcn/src/tooltip/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/tooltip.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/tooltip

### brutalist/badge (passive-label)
w-fit/shrink-0 label needs long-text policy in actual parent; no page gutter on atom.

Identities: P-BRUTALIST-BADGE

Profiles: FLOW, CARD, ENV; findings: EDGE-07.

- [packages/prototypes/brutalist/src/badge/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/badge/root.proto.ts)
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/button (interactive-control)
Control internal geometry and focus target; wrapping toolbar/form/card/dialog parent owns available width/gutter.

Identities: P-BRUTALIST-BUTTON

Profiles: CONTROL, ENV; findings: EDGE-07.

- [packages/prototypes/brutalist/src/button/button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/button/button.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/button.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/button
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/card (ordinary-content-container)
Card parts own inner rhythm and responsive Header/Footer; page ancestor owns outer safe area.

Identities: P-BRUTALIST-CARD-HEADER, P-BRUTALIST-CARD-CONTENT, P-BRUTALIST-CARD-FOOTER, P-BRUTALIST-CARD

Profiles: CARD, FLOW, ENV; findings: EDGE-07.

- [packages/prototypes/brutalist/src/card/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/card/content.proto.ts)
- [packages/prototypes/brutalist/src/card/footer.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/card/footer.proto.ts)
- [packages/prototypes/brutalist/src/card/header.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/card/header.proto.ts)
- [packages/prototypes/brutalist/src/card/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/card/root.proto.ts)
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/checkbox (compound-interactive-control)
Root hit/label composition and Indicator fit; surrounding form/layout owns external spacing.

Identities: P-BRUTALIST-CHECKBOX, P-BRUTALIST-CHECKBOX-INDICATOR

Profiles: CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/brutalist/src/checkbox/indicator.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/checkbox/indicator.proto.ts)
- [packages/prototypes/brutalist/src/checkbox/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/checkbox/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/checkbox.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/checkbox
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/dialog (centered-overlay)
Content owns panel bounds; Mask covers the viewport; Root owns lifecycle; title/description/header/footer and close/trigger participate in long-content/control layout.

Identities: P-BRUTALIST-DIALOG, P-BRUTALIST-DIALOG-HEADER, P-BRUTALIST-DIALOG-MASK, P-BRUTALIST-DIALOG-CONTENT, P-BRUTALIST-DIALOG-CLOSE-ICON, P-BRUTALIST-DIALOG-CLOSE, P-BRUTALIST-DIALOG-TRIGGER, P-BRUTALIST-DIALOG-DESCRIPTION, P-BRUTALIST-DIALOG-TITLE, P-BRUTALIST-DIALOG-FOOTER

Profiles: CENTER, ENV; findings: EDGE-02, EDGE-06.

- [packages/prototypes/brutalist/src/dialog/close-icon.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dialog/close-icon.proto.ts)
- [packages/prototypes/brutalist/src/dialog/close.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dialog/close.proto.ts)
- [packages/prototypes/brutalist/src/dialog/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dialog/content.proto.ts)
- [packages/prototypes/brutalist/src/dialog/description.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dialog/description.proto.ts)
- [packages/prototypes/brutalist/src/dialog/footer.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dialog/footer.proto.ts)
- [packages/prototypes/brutalist/src/dialog/header.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dialog/header.proto.ts)
- [packages/prototypes/brutalist/src/dialog/overlay.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dialog/overlay.proto.ts)
- [packages/prototypes/brutalist/src/dialog/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dialog/root.proto.ts)
- [packages/prototypes/brutalist/src/dialog/title.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dialog/title.proto.ts)
- [packages/prototypes/brutalist/src/dialog/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dialog/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/dialog.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/dialog
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/dropdown (anchored-menu)
Content owns listbox/menu bounds and item reachability; Trigger owns anchor geometry; item text and Root lifecycle are verified in the same composition.

Identities: P-BRUTALIST-DROPDOWN-MENU-TRIGGER, P-BRUTALIST-DROPDOWN-MENU, P-BRUTALIST-DROPDOWN-MENU-ITEM, P-BRUTALIST-DROPDOWN-MENU-CONTENT

Profiles: ANCHOR, CONTROL, ENV; findings: EDGE-04.

- [packages/prototypes/brutalist/src/dropdown/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dropdown/content.proto.ts)
- [packages/prototypes/brutalist/src/dropdown/item.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dropdown/item.proto.ts)
- [packages/prototypes/brutalist/src/dropdown/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dropdown/root.proto.ts)
- [packages/prototypes/brutalist/src/dropdown/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/dropdown/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/dropdown-menu.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/menu
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/hover-card (anchored-supplemental-panel)
Content owns supplemental panel bounds; Trigger/root lifecycle and outside pointer reachability participate.

Identities: P-BRUTALIST-HOVER-CARD-CONTENT, P-BRUTALIST-HOVER-CARD, P-BRUTALIST-HOVER-CARD-TRIGGER

Profiles: ANCHOR, ENV; findings: EDGE-04, EDGE-05.

- [packages/prototypes/brutalist/src/hover-card/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/hover-card/content.proto.ts)
- [packages/prototypes/brutalist/src/hover-card/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/hover-card/root.proto.ts)
- [packages/prototypes/brutalist/src/hover-card/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/hover-card/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/hover-card.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/preview-card
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/scroll-area (bounded-scroll-container)
Root/ancestor provide dimensions; Viewport owns scrollable reachability; scrollbar/thumb reserve and respect track/corner geometry.

Identities: P-BRUTALIST-SCROLL-AREA-THUMB, P-BRUTALIST-SCROLL-AREA-VIEWPORT, P-BRUTALIST-SCROLL-AREA-SCROLLBAR, P-BRUTALIST-SCROLL-AREA

Profiles: SCROLL, ENV; findings: EDGE-08.

- [packages/prototypes/brutalist/src/scroll-area/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/scroll-area/root.proto.ts)
- [packages/prototypes/brutalist/src/scroll-area/scrollbar.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/scroll-area/scrollbar.proto.ts)
- [packages/prototypes/brutalist/src/scroll-area/thumb.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/scroll-area/thumb.proto.ts)
- [packages/prototypes/brutalist/src/scroll-area/viewport.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/scroll-area/viewport.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/scroll-area.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/scroll-area
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/select (anchored-listbox)
Content/anchor-width policy and scrolling are shared with Trigger; Value/Item long text participates in horizontal constraint and keyboard selection tests.

Identities: P-BRUTALIST-SELECT-VALUE, P-BRUTALIST-SELECT-TRIGGER, P-BRUTALIST-SELECT-CONTENT, P-BRUTALIST-SELECT-ITEM, P-BRUTALIST-SELECT

Profiles: ANCHOR, CONTROL, ENV; findings: EDGE-04, EDGE-07.

- [packages/prototypes/brutalist/src/select/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/select/content.proto.ts)
- [packages/prototypes/brutalist/src/select/item.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/select/item.proto.ts)
- [packages/prototypes/brutalist/src/select/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/select/root.proto.ts)
- [packages/prototypes/brutalist/src/select/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/select/trigger.proto.ts)
- [packages/prototypes/brutalist/src/select/value.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/select/value.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/select.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/select
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/separator (passive-separator)
Separator spans its parent; parent owns dimensional constraint and surrounding gap.

Identities: P-BRUTALIST-SEPARATOR

Profiles: FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/brutalist/src/separator/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/separator/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/separator.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/separator
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/skeleton (loading-decoration)
Consumer-supplied dimensions and gaps; verify loading-to-content transition in named card/form/flow.

Identities: P-BRUTALIST-SKELETON

Profiles: STATUS, FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/brutalist/src/skeleton/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/skeleton/root.proto.ts)
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/spinner (loading-decoration)
Fixed visual size is not hit or layout policy; verify beside actual loading control/status label.

Identities: P-BRUTALIST-SPINNER

Profiles: STATUS, CONTROL, ENV; findings: EDGE-09.

- [packages/prototypes/brutalist/src/spinner/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/spinner/root.proto.ts)
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/surface (passive-visual-skin)
No automatic outer gutter or inner padding; concrete consuming layout must supply and verify both where needed.

Identities: P-BRUTALIST-SURFACE

Profiles: SURFACE, FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/brutalist/src/surface/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/surface/root.proto.ts)
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/switch (compound-interactive-control)
Root track/hit/label composition and Thumb fit; surrounding form/layout owns external spacing.

Identities: P-BRUTALIST-SWITCH, P-BRUTALIST-SWITCH-THUMB

Profiles: CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/brutalist/src/switch/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/switch/root.proto.ts)
- [packages/prototypes/brutalist/src/switch/thumb.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/switch/thumb.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/switch.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/switch
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/tabs (tabstrip-and-content-layout)
List owns strip overflow policy; trigger/indicator stay reachable and aligned; Content participates in bounded long-content layout.

Identities: P-BRUTALIST-TABS-CONTENT, P-BRUTALIST-TABS-LIST, P-BRUTALIST-TABS-TRIGGER, P-BRUTALIST-TABS

Profiles: TABSTRIP, CONTROL, ENV; findings: EDGE-07.

- [packages/prototypes/brutalist/src/tabs/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/tabs/content.proto.ts)
- [packages/prototypes/brutalist/src/tabs/list.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/tabs/list.proto.ts)
- [packages/prototypes/brutalist/src/tabs/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/tabs/root.proto.ts)
- [packages/prototypes/brutalist/src/tabs/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/tabs/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/tabs.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/tabs
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/text (passive-text)
Typography leaf; enclosing content layout owns line measure/wrapping/overflow and safe area.

Identities: P-BRUTALIST-TEXT

Profiles: FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/brutalist/src/text/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/text/root.proto.ts)
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/textarea (multiline-text-entry)
Control owns text/caret/resize; form/dialog/scroll ancestor supplies maximum usable area.

Identities: P-BRUTALIST-TEXTAREA

Profiles: TEXT_ENTRY, CONTROL, ENV; findings: ancestor-owned composition evidence remains required.

- [packages/prototypes/brutalist/src/textarea/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/textarea/root.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/textarea.mdx
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/toggle (interactive-control)
Control internal geometry and state/focus; toolbar/form parent owns available width/gutter.

Identities: P-BRUTALIST-TOGGLE

Profiles: CONTROL, ENV; findings: EDGE-07.

- [packages/prototypes/brutalist/src/toggle/toggle.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/toggle/toggle.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/toggle.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/toggle
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### brutalist/tooltip (anchored-supplemental-text)
Content owns readable text bounds; Group/root/trigger coordinate positioning and dismissibility, not a generic interactive scroll panel.

Identities: P-BRUTALIST-TOOLTIP, P-BRUTALIST-TOOLTIP-TRIGGER, P-BRUTALIST-TOOLTIP-CONTENT, P-BRUTALIST-TOOLTIP-GROUP

Profiles: ANCHOR, ENV; findings: EDGE-04, EDGE-05.

- [packages/prototypes/brutalist/src/tooltip/content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/tooltip/content.proto.ts)
- [packages/prototypes/brutalist/src/tooltip/group.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/tooltip/group.proto.ts)
- [packages/prototypes/brutalist/src/tooltip/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/tooltip/root.proto.ts)
- [packages/prototypes/brutalist/src/tooltip/trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/brutalist/src/tooltip/trigger.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/tooltip.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/tooltip
- Reference/provenance: ProtoUI pinned Neo-Brutalist reference policy — https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/spec/knowledge/K-BRUTALIST-0001.yaml

### bootstrap-2-3-2/button (interactive-control)
Control internal geometry and focus target; wrapping toolbar/form/card/dialog parent owns available width/gutter.

Identities: P-BOOTSTRAP-2-3-2-BUTTON

Profiles: CONTROL, ENV; findings: EDGE-07.

- [packages/prototypes/bootstrap-2-3-2/src/button/button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/bootstrap-2-3-2/src/button/button.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/button.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/button
- Reference/provenance: Bootstrap 2.3.2 — https://getbootstrap.com/2.3.2/base-css.html
- Reference/provenance: Bootstrap 2.3.2 — https://getbootstrap.com/2.3.2/components.html

### bootstrap-2-3-2/surface (passive-visual-skin)
No automatic outer gutter or inner padding; concrete consuming layout must supply and verify both where needed.

Identities: P-BOOTSTRAP-2-3-2-SURFACE

Profiles: SURFACE, FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/bootstrap-2-3-2/src/surface/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/bootstrap-2-3-2/src/surface/root.proto.ts)
- Reference/provenance: Bootstrap 2.3.2 — https://getbootstrap.com/2.3.2/base-css.html
- Reference/provenance: Bootstrap 2.3.2 — https://getbootstrap.com/2.3.2/components.html

### liquid-glass/button (interactive-control)
Control internal geometry and focus target; wrapping toolbar/form/card/dialog parent owns available width/gutter.

Identities: P-LIQUID-GLASS-BUTTON

Profiles: CONTROL, ENV; findings: EDGE-07.

- [packages/prototypes/liquid-glass/src/button/button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/liquid-glass/src/button/button.proto.ts)
- Reference/provenance: shadcn/ui — https://github.com/shadcn-ui/ui/blob/debae9baea4d5c6bd0b1a857b09664db4b925818/apps/v4/content/docs/components/base/button.mdx
- Reference/provenance: Base UI — https://github.com/mui/base-ui/tree/f292461437fd97932421379b8c52f9caa018f1a1/docs/src/app/(docs)/react/components/button
- Reference/provenance: Apple HIG design reference, independent ProtoUI projection — https://developer.apple.com/design/human-interface-guidelines/layout
- Reference/provenance: Apple HIG Materials — https://developer.apple.com/design/human-interface-guidelines/materials

### liquid-glass/surface (passive-visual-skin)
No automatic outer gutter or inner padding; concrete consuming layout must supply and verify both where needed.

Identities: P-LIQUID-GLASS-SURFACE

Profiles: SURFACE, FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/liquid-glass/src/surface/root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/liquid-glass/src/surface/root.proto.ts)
- Reference/provenance: Apple HIG design reference, independent ProtoUI projection — https://developer.apple.com/design/human-interface-guidelines/layout
- Reference/provenance: Apple HIG Materials — https://developer.apple.com/design/human-interface-guidelines/materials

### lucide/icon (decorative-or-control-glyph)
Glyph size is not hit size; owning button/label/layout supplies padding and semantics.

Identities: P-LUCIDE-ICON

Profiles: CONTROL, FLOW, ENV; findings: EDGE-09.

- [packages/prototypes/lucide/src/icon/icon.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/59e3b825affddd7c5a59af60ca87d912f4486247/packages/prototypes/lucide/src/icon/icon.proto.ts)
- Reference/provenance: Lucide official — https://github.com/lucide-icons/lucide

## Reference facts

- shadcnPinnedDialog: max-w-[calc(100%-2rem)] and sm:max-w-lg already present; default 390px viewport/16px root gives 16px side margins. https://github.com/shadcn-ui/ui/blob/f31ed81983653919dd4fe77aee4b4859f610f1dc/apps/v4/registry/new-york-v4/ui/dialog.tsx#L63-L69
- shadcnCurrentNova: Same 2rem subtraction, sm:max-w-sm. Vega/Maia use md desktop cap; Lyra/Mira sm. Width cap is style-owned. https://github.com/shadcn-ui/ui/blob/17e1129c9b9de15f78cdd79d69777082821da428/apps/v4/registry/styles/style-nova.css#L467-L469
- appleLayout: Respect system safe areas/margins/guides; no universal 16px/24px Web modal gutter mandate. https://developer.apple.com/design/human-interface-guidelines/layout
- appleSheet: Presentation adapts by platform and task; sheet is not equivalent to every centered Dialog. https://developer.apple.com/design/human-interface-guidelines/sheets
- appleKeyboard: Medium sheets can grow for keyboard then restore; compact-height sheet can attach to bottom and span safe-area width. https://developer.apple.com/videos/play/wwdc2021/10063/

## Scope and next steps

- No current Sheet/Drawer source family; add its own intentional edge attachment and safe-content contract when implemented.
- Private Bootstrap/LiquidGlass packages remain in scope; publication status does not waive spacing/safety evidence.
- The shared positioning host publishes available width but current prototypes do not consume it. Existing height scrolling, scroll-host chrome geometry and inset focus rings are preserved evidence, not reasons to report complete safety.
- Dialog fixes stay with existing Overlay/Dialog owner; leaf/control fixes stay with their actual owners. Finf maintains cross-family acceptance and evidence debt.
- Finite scan is complete. Continue Finf implementation and targeted native validation rather than expanding audit indefinitely.
