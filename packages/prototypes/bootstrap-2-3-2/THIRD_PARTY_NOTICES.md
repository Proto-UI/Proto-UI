# Bootstrap 2.3.2 attribution

Bootstrap v2.3.2, Copyright 2012 Twitter, Inc, is licensed under Apache License 2.0. The full license is in `LICENSE-BOOTSTRAP`.

Upstream sources: <https://github.com/twbs/bootstrap/tree/v2.3.2>, especially `less/buttons.less`, `less/variables.less`, `less/forms.less`, and `docs/assets/css/bootstrap.css`.

This implementation changes the original material into independent TypeScript Proto UI declarations. Base Button supplies activation, focus and disabled semantics. The first slice retains the default/primary palette, vertical gradients, raised/inset shadows, 4px corners and standard-scale button metrics. It replaces legacy browser hacks and jQuery behavior, uses scalable spacing, a stronger focus-visible ring, and omits text-shadow, border-bottom shading, background-position animation and additional sizes/variants. These differences are explicit rather than an exact pixel-compatibility claim.

The Web style translator's finite gradient and inset-shadow tokens are derived from these same published visual values. Preserve this notice and license with downstream source material. No upstream JavaScript, documentation prose or Glyphicons assets are bundled.

The state/text control increment also adapts the form-control inset shadow and compact field geometry. Base owns all checkbox/switch/toggle/editor behavior; Switch and Toggle are Proto UI design-language extensions: core Bootstrap 2.3.2 supplies no Switch, and its stateful button plugin is not the inherited Base Toggle protocol. Checkbox is a custom root/indicator projection rather than an exact copy of the native upstream checkbox.

The Collapsible increment independently projects `less/accordion.less` at the same v2.3.2 reference: group border/radius, toggle spacing and inner spacing/top border. Proto UI Base Collapsible owns Root/Trigger/Content state, activation, accessibility and presence. This is a single disclosure, not the upstream Accordion group or jQuery Collapse runtime. Height transitions and upstream DOM/class API compatibility are not claimed.

Collapsible spacing expresses the v2.3.2 15px/9px values as 0.9375rem/0.5625rem at a 16px root size so text-size changes also scale safe padding.
