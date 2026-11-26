# Styled Scroll Area passive corner

## Bounded direction

This follows Issues #783 and #788 and the draft styled Scrollbar corner criteria. The horizontal styled Scrollbar owns one private, pointer-inert ordinary Template surface at its physical lower-right reserved intersection. Brutalist uses lavender and foreground structural borders; Shadcn uses the muted surface/border palette. The outer carrier takes its width from the existing host-local opposite-track inset and clips all paint, including borders, at zero reservation. There is no BaseCorner, public export, new prop, focus target, control, portable geometry fact, RTL normalization, or change to Root/Viewport/Scrollbar/Thumb ownership.

The two-layer private Template accounts for each family's existing border box. Border paint belongs to the inner layer; the outer zero-width overflow clip keeps hidden/missing opposite tracks from leaking a two-pixel border. Exact native bounds and pointer hit checks, rather than just token strings, validate this geometry.

## Prerequisites and reproduction

PR #830 supplies the atomic ordinary-Template static carrier across four Web adapters. Its exact source `8f7c9ef7` passed the baseline/candidate/resolver native fixture in all four runtimes. During the actual Scrollbar horizontal-to-vertical test, WC left the former owned span in its slot-only fast path. The isolated follow-up `28c9a9f1` fixes that ownership cleanup with seven production lines and a red/green WC regression. Both are dependency candidates, not already merged main guarantees.

The passive-corner test is red twice against the unchanged styled Scrollbar sources with the dependency present: neither family creates the required private surface. The candidate additionally proves supported CSS token closure, horizontal/vertical replacement, old span removal, caller slot identity/class preservation and terminal removal. That dynamic identity test is WC-specific. An exploratory Vue slot-only/owned-sibling topology identity limitation is recorded in #830 and is not presented as a four-adapter dynamic identity guarantee.

## Validation and remaining evidence

Focused family, Base, shared host geometry, four-adapter Move journey, style renderer and private-corner tests are run before commit, as are narrow TypeScript, prototype catalog, runtime test plan and generated style/GPUI checks. Generated preset and native fixture artifacts are regenerated from source, never patched by hand.

The normal PR-triggered corner workflow compares the same 1100-by-900 browser viewport and actual family root crops. Its candidate checks now include passive paint, no control identity, pointer-inert inheritance, strict corner hit testing, fractional 22.5-pixel width, zero-reservation clipping, hidden tracks, overflow transitions, both-axis drag and unchanged focus geometry. Exact-source PNGs remain pending the new native CI run. The old geometry-only screenshots are not evidence of this fill. Independent acceptance and the actual combined package budget remain separate gates; existing budget thresholds are not loosened to make this candidate pass.

## Native inventory follow-up

Exact candidate `8ee2e4ab` failed macOS style-map completeness: the new Web-only `height: calc(100% + 2px)` and `calc(100% + 4px)` declarations were absent from GPUI's explicit unmapped-value inventory. GPUI's definite length cannot combine a parent fraction and fixed pixels without layout context. The follow-up records both exact values with their family-specific border rationale, rather than pretending they map to 100% or weakening the inventory assertion. Native macOS CI must confirm the inventory matches; no GPUI corner support is claimed.

Local `cargo fmt` could not run because this cloud executor has no Cargo binary. The new Rust inventory entry validation remains pending the normal macOS CI job; no local Rust pass is claimed.
