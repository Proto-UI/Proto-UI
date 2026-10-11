# GPUI AvailableSpace reconstruction

Date: 2026-10-07. Related work: #872; draft `HC-AVAILABLE-SPACE-0001` and `M-POSITIONING-0001-AVAILABLE`.

## Recovery and source boundary

The later AvailableSpace tree `475d23ecdbf381283d0868ea9b15bdaf6775f9e2` was not available from GitHub's Git-tree API after workspace recovery. The underlying local code commits `76e6c8692af318fa5c06cce74ddf193661da756b` and `b42088b203ed8da47b08881c363a112c0e2bed0f` were also unavailable. This is a new implementation and new evidence; the historical 133-test claim is not reused.

This packet starts from the recovered fifth source `7a7c0bed14592562b127dad34bc3527c2001429a`, with the independently staged capture repair tree `e298af4464cb4da9c17f80e918cf665c6a509f72`. The integrator must retain the separately merged main `ProjectionOrder` changes and regenerate the combined protocol fixture and workspace lock. No GPUI upstream revision is changed.

## Implemented path

- The real peer provides Positioning's existing AvailableSpace capability and Overlay's typed target resolver, using one private root identity. Foreign objects cannot acquire a lease.
- Each message binds the session, peer view epoch, Module epoch and a new opaque lease ID. Replacement, terminal disposal, retained-view detach/reopen, late frames and older releases cannot revive a retired owner.
- The peer publishes the current lease before its projection transaction. If delayed Presence acquires the lease only after a missing-lease rejection, that lease may trigger one guarded resubmission. Repeated rejection cannot create an unbounded retry loop.
- Rust validates the lease generations and target/boundary. It obtains geometry from the pinned GPUI `Window.fully_visible_bounds()` and requires the actual `ProtoHostView` entity to be that window's root. It does not substitute a guessed zero rectangle for unknown geometry.
- Center and max-size use the same immutable frame. Host variables overlay a copied theme, so one window/frame cannot mutate another's catalog theme.
- The exact fixed-center recipe uses an actual native layout wrapper. Its root has `flex_shrink=0`, preserving a 600px width centered at x=-105 in a 390px region until an authored max-width constrains it. Other transforms/fixed recipes remain explicit unsupported results.
- The host remaps available-space style on actual render invalidation; no perpetual timer or synchronous guest roundtrip is added to paint. Losing the region/lease withdraws geometry and the corresponding rendered root.

## Verification

- PASS: 138 tests across all peer and TypeScript host-protocol suites, including 15 new lease/frame controls and two real Base Dialog peer lifecycle/retry tests.
- PASS: 69 tests in the real Rust protocol/style crates; one existing T0 test remains ignored in that ordinary command. The initial message roundtrip found integer coordinates being serialized as floating representations. A canonical coordinate serializer repaired that actual failure; the fixture stayed strict.
- PASS: TypeScript workspace check and docs check (522 files, zero errors and zero warnings; six existing hints).
- PASS: original-pin GPUI library and all non-feature-gated tests type-check for `x86_64-apple-darwin`. A missing Box in one new test was repaired and rechecked. This is real GPUI source/type checking, but it does not link/run a macOS window.
- PASS: generated message fixture consistency and whole-workspace Rust formatting.
- PASS: 34 actual GPUI headless tests (AvailableSpace 4, HostHub 30), plus 77 neighboring GPUI library/style/layout/composition/A11y tests. The 600px/390px fixture actually measured x=-105. The safe-region fixture measured x=26/y=76/width=338/height=358. Actual window resize changed the emitted region from 300px to 640px; an unchanged redraw emitted no duplicate frame. Exact lease retirement removed the rendered root; an old lease could not restore it.
- PASS: prototype catalog validation (213 declaration files, 272 static authoring entries, 212 cataloged P entities).
- PENDING: macOS SDK/window execution, decoded pixels, real OS accessibility interactions and independent source acceptance. Headless layout and A11y projection tests are not OS screenshot or VoiceOver acceptance.

The first docs-check attempt stopped on an unavailable local telemetry config directory, not a type error. The successful retry disabled telemetry only for that process and used a writable temporary config directory. The first Dialog close assertion ran before its normal leave animation ended; the deterministic test now explicitly supplies the supported reduced-motion preference rather than changing production timing or weakening the close/reopen assertion.

## Remaining acceptance

This is not full native Dialog, Overlay, Select, Compiler or material parity. The fixed-center path rejects physically nested roots and consumer-positioned roots until their portal/coordinate-chain ownership is implemented. Anchored `--proto-ui-available-width` is a different host fact and is not substituted with root-content `--proto-ui-available-region-width`. GPUI currently still lacks the new Select gradient/shadow lowering and full anchored placement. No Finf completion row or stable admission is implied by this packet.

Explicit Liquid Glass still requires the requested self-implemented optical provider. Native adaptive blur and screenshot capture cannot stand in for it.
