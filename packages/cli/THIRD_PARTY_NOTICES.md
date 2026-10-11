# Third-party notices

## Bootstrap 2.3.2 visual values

Bootstrap v2.3.2, Copyright 2012 Twitter, Inc. Licensed under the Apache License 2.0, reproduced in `LICENSE-BOOTSTRAP`.

Sources: <https://github.com/twbs/bootstrap/blob/v2.3.2/less/buttons.less>, <https://github.com/twbs/bootstrap/blob/v2.3.2/less/variables.less>, <https://github.com/twbs/bootstrap/blob/v2.3.2/less/forms.less>, and <https://github.com/twbs/bootstrap/blob/v2.3.2/docs/assets/css/bootstrap.css>.

`src/services/proto-style-css.ts` adapts a finite set of published default/primary gradient, opaque fill and raised/inset shadow values into the Proto UI token translator. The original selectors, browser hacks and JavaScript runtime are not copied. The declarations use current CSS syntax and compose with the existing Proto UI ring/shadow mechanism. These modified values and their generated physical CSS are subject to the retained upstream notice/license; other original CLI code retains its existing license.

The corresponding draft family package carries its own attribution and license. This CLI notice is independently included in public package archives so it does not depend on installing that private source package.

The state/text control increment also adapts the form-control inset shadow and compact field geometry. Base owns all checkbox/switch/toggle/editor behavior; Switch and Toggle are Proto UI design-language extensions: core Bootstrap 2.3.2 supplies no Switch, and its stateful button plugin is not the inherited Base Toggle protocol. Checkbox is a custom root/indicator projection rather than an exact copy of the native upstream checkbox.

The Select increment also adapts `less/dropdowns.less` and `less/button-groups.less` from v2.3.2: 6px menu corners, the 0/5/10px 20% popup shadow, and scaled option/menu spacing. The dropdown highlight is deliberately darkened to #0077b3–#005580 for readable white text. This is an independently authored Base Select design-language extension, not the upstream native HTML select or jQuery Dropdown API.
