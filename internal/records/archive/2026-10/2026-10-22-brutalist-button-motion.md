# Brutalist Button continuous motion (#911, #926)

## Source and bounded change

The pinned neobrutalism-components Button at 3306a802724874a85f93079702b2795370a279d4 declares transition-all. The previous Proto UI source-alignment record explicitly retained instantaneous snapping. This follow-through restores one CSS timing writer on the public Brutalist Button, not a homepage-only transition and not a transform-only approximation.

Two mutually exclusive bounded rules observe preference.reducedMotion. No-preference emits transition-all; reduce or unknown emits transition-none. The existing compiler maps the former to 150ms cubic-bezier(0.4,0,0.2,1). There is no resident timing declaration, new compiler vocabulary, adapter change or sampled legacy environment snapshot. Live preference updates must affect the same mounted subject.

Hover and pressed already share the positive translation / zero-shadow endpoint. Press does not add another displacement. Entry and release must interpolate both transform and the hard shadow. Translation follows rem (4px at root16, 8px at root32); the hard shadow remains 4px with zero blur/spread. Full transition-all also interpolates palette changes and focus-ring layers, so existing exact endpoint consumers need bounded settled-paint observation rather than immediate reads after state/attribute changes.

## Evidence and limitations

The first new unit test failed against the prior implementation (9 passed / 1 failed), then passed with the public preference rules (10 passed). The frame-checker has synthetic positive and deliberately broken traces; those validate the checker only, not browser animation. Browser acceptance remains pending for the published candidate.

The real browser evidence uses native pointer input and requestAnimationFrame samples with CSS transition currentTime, connected subject identity, computed transform and composed shadow. It checks multiple intermediate values, exact endpoints, declared easing, reduced-motion changes, both directions and two text scales. Diagnostic screenshots and records precede assertions. It does not use simulated time, repeat activation, or a fixed sleep to make a failing endpoint pass.

The existing Brutalist Button browser suite retains its exact geometry, shadow and ring assertions with bounded settled observation. The separately owned live-theme consumer was raised in the existing #921 coordination thread with an exact proposed helper adjustment; it is not silently overwritten here.

This does not resolve the independent Base keyboard press-start/up/cancel lifecycle, alter Drawer or other command timing, or claim identical timing across Shadcn, Bootstrap and Liquid Glass. No passing endpoint-only screenshot is evidence of a continuous curve. Complete project CI and independent approval remain separate gates.
