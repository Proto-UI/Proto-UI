# Native action appearance, without a new Link interaction owner

Status: bounded implementation under #559 and #865, carried by #926. Browser acceptance and independent review remain pending.

The homepage's two primary navigation actions remain real anchors. The previous 44px website action layout was not a family Button default, and native anchor identity did not justify leaving action labels selectable. Official shadcn's current homepage composes Button appearance over Link: fixed source 25af02b1b467fcd53b63e0c6d6d324c57c16ef18, apps/v4/app/(app)/(root)/page.tsx. Its 35px first-action override is page-specific and is not copied into Proto UI.

Public `shadcnActionAppearance` and `brutalistActionAppearance` are pure Web composition recipes. They reuse the real family Surface and Text prototypes and choose layout matching each family's default wrapped Button (36px and 40px at a 16px root). They are not prototypes, do not admit Base Link, do not extend Base Surface props, and do not attach interaction handlers. The native anchor remains the only navigation/focus owner. Its passive child can paint observed hover/pressed/focus facts. Existing one-pixel / four-pixel motion envelopes remain outside the painted body and are not misreported as body height.

Action-label selection suppression is local. Ordinary navigation, neighboring prose and editor text stay selectable. Href, target and rel are preserved; no role=button, Space activation emulation, fake asChild, click interception or new adapter behavior is introduced. Disabled-anchor behavior is not a new API in this slice.

SSR explicitly opts the hero action composition into the same public layout. Other HomeActions usages retain their existing navigation/icon purpose. The runtime consumer only selects the family recipe; the family owns action geometry, not a homepage min-height exception.

Regression coverage compares public minimum height against real wrapped Button tokens and compiled CSS, checks ordinary navigation is unaffected, and extends the existing four-runtime/two-family browser cases with real anchor identity, native Space non-activation, painted height and drag selection. Existing editor selection, exact keyboard commit, Button height and 200% tests remain. Theme selection paint and motion curves are separate pending slices; passing this slice does not close all of #559/#865/#911.
