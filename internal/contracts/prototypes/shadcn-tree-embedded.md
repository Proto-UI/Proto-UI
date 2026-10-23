# Draft Shadcn Tree embedded appearance

Scope: #910 family presentation, #523 Tree semantic ownership, #785 / PR926 code-file consumer. This is a bounded proposed contract, not Tree-wide acceptance or a stable lifecycle promotion.

Reference: shadcn-ui/ui ba1503c64472b82256d9de95e2e62c5901a38e8b, apps/v4/components/block-viewer.tsx and registry/new-york-v4/ui/sidebar.tsx. No upstream source is executed or copied as a third-party runtime.

Root and Item add optional appearance: default | embedded, defaulting to default. Each part receives its own explicit appearance; no hidden context API or new Base semantic state. Existing default tokens remain unchanged. Changing appearance must not change selection, expanded keys, role, roving focus, activation count or lifecycle ownership.

Embedded Root owns transparent, borderless, shadowless, zero-padding vertical layout with 0.375rem row gap. Embedded Item owns square rows, 0.875rem font, 0.5rem inline padding/gap, 2rem minimum height and 0.25rem vertical padding. Upstream fixes h-8; minimum height intentionally permits long filenames and enlarged text to wrap without clipping. Single-line rows at default text scale must compute to2rem. This avoids the prior44px button-like rows while remaining above WCAG2.2 minimum24px target size. The narrow stacked file browser is an intentional adaptation; upstream hides its desktop browser on small screens.

Selected rows use bg-muted-foreground/15 and font-medium, preserving foreground color instead of primary inverse fill. Focus retains inherited focusVisible ring and forced-colors-focus-outline; selected weight and aria-selected remain distinguishable when forced colors suppress surface color. Real browser forced-color verification is required, not inferred from tokens.

A private family-only embeddedHovered state may paint the same light surface for unselected enabled rows. It responds only to pointer enter/leave/cancel and clears on appearance change, disabled transition and unmount. It adds no key/press listeners, activation, focus or selection owner. Selected and hover paint rules are exclusive. Base Tree semantics, compiler and adapters are unchanged.

CodeExample supplies application-owned canonical paths, indentation, real16px Lucide File/Folder/Chevron, and decorative leaf chevron spacing. It must not override Shadcn row height/font or Root display. Sidebar header and source caption are3rem high, with compositional dividers; no nested card. Terminal remains separate. File/host keyboard journeys, WIP status, exact active-source Copy, seven no-JS host panels and four readable source files remain required.

Evidence needed: default token parity; live appearance switching; selected/hover/focus/disabled and pointer cancellation; detach/remount; exact generated token closure; actual row/icon/header geometry in light/dark, desktop/narrow,200% text/zoom and forced colors; unchanged49 codebox journeys. Existing unrelated-looking Scroll Area158px base/candidate differential remains unexplained and blocking until owner diagnosis. No AT or fullCI acceptance is claimed by this contract.
