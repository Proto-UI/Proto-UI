# Bootstrap 2.3.2 attribution

Bootstrap v2.3.2, Copyright 2012 Twitter, Inc, is licensed under Apache License 2.0. The full license is in `LICENSE-BOOTSTRAP`.

Upstream sources: <https://github.com/twbs/bootstrap/tree/v2.3.2>, especially `less/buttons.less`, `less/variables.less`, `less/forms.less`, and `docs/assets/css/bootstrap.css`.

This implementation changes the original material into independent TypeScript Proto UI declarations. Base Button supplies activation, focus and disabled semantics. The first slice retains the default/primary palette, vertical gradients, raised/inset shadows, 4px corners and standard-scale button metrics. It replaces legacy browser hacks and jQuery behavior, uses scalable spacing, a stronger focus-visible ring, and omits text-shadow, border-bottom shading, background-position animation and additional sizes/variants. These differences are explicit rather than an exact pixel-compatibility claim.

The Web style translator's finite gradient and inset-shadow tokens are derived from these same published visual values. Preserve this notice and license with downstream source material. No upstream JavaScript, documentation prose or Glyphicons assets are bundled.

The state/text control increment also adapts the form-control inset shadow and compact field geometry. Base owns all checkbox/switch/toggle/editor behavior; Switch and Toggle are Proto UI design-language extensions: core Bootstrap 2.3.2 supplies no Switch, and its stateful button plugin is not the inherited Base Toggle protocol. Checkbox is a custom root/indicator projection rather than an exact copy of the native upstream checkbox.

The Collapsible increment independently projects `less/accordion.less` at the same v2.3.2 reference: group border/radius, toggle spacing and inner spacing/top border. Proto UI Base Collapsible owns Root/Trigger/Content state, activation, accessibility and presence. This is a single disclosure, not the upstream Accordion group or jQuery Collapse runtime. Height transitions and upstream DOM/class API compatibility are not claimed.

Collapsible spacing expresses the v2.3.2 15px/9px values as 0.9375rem/0.5625rem at a 16px root size so text-size changes also scale safe padding.

The Select increment uses the v2.3.2 `less/dropdowns.less` and `less/button-groups.less` design references. Upstream used native HTML select; this custom five-part select-only protocol is a Proto UI design-language extension. It retains the button gradient, filled caret, 6px popup corners, 0/5/10px shadow and scalable 5px menu / 3px-by-20px item padding. Changes include wrapping labels, collision-bounded fixed portals, preserved focus outlines, a darker #0077b3-to-#005580 highlight for white-text contrast, and a persistent selection check. No upstream dropdown JavaScript or API compatibility is claimed. Text adds independent Base typography axes using historical system-font stacks and contrast-safe muted ink; no third-party font files are distributed.

The Field increment independently adapts the archived form error tone (`#b94a48`) as the family destructive color. Six Field atoms consume the new independent Base Field protocol; no Bootstrap JavaScript, DOM/class compatibility, form submission or validation engine is inherited.

The Library entry uses the archived text-capable Thumbnail composition from `less/thumbnails.less` and its type scale from `less/type.less`. Existing passive Surface inputs explicitly select its border/depth, while the website owns the 4px shell and 9px caption layout. No new Card/Thumbnail component API or full-family admission is introduced. The native link Surface and Button reuse one family paint definition; no nested interaction owner is added. Historical text sizes/insets use rem scaling. Contrast-safe muted ink and visible native-link focus remain intentional accessibility differences.

The Tabs increment adapts v2.3.2 `less/navs.less`: 12px/8px padding, 2px inter-tab spacing, upper 4px corners, a list bottom border and the active panel-edge opening. Root/List/Trigger/Content use Proto UI Base Tabs, not the upstream jQuery plugin or anchor navigation. Family theme colors and stronger focus indication are deliberate differences. The optional transparent underline recipe belongs to the Runtime Box consumer and is not the historical Bootstrap default. No upstream JavaScript is executed or bundled.
