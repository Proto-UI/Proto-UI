# GPUI ScrollSurface physical binding

This bounded compiler host profile implements the existing draft
`HC-SCROLL-SURFACE-0001` and `C-SCROLL-AXIS-SYNC-0001` responsibilities. It does
not promote either entity or introduce an author-visible native controller.

## Ownership and inputs

An authored `asScrollSurface()` owns configuration, observed facts and semantic
requests. The native host owns layout, wheel/touch integration, clipping and
virtualization. The default compiler root supplies an ordinary `ScrollHandle`.
When native content already owns a scroller, the host may bind that same handle
through `NativeScrollTarget::new(handle)` and `attach_scroll_surface`.

The target is a retained opaque host identity. A clone refers to the same
physical surface; replacing a physical surface requires a new target. The
caller retains the target and the returned `NativeScrollLease` for the view's
lifetime. One live logical surface can claim a target at a time. A second
acquisition refuses without disturbing the first. The target and handle are
never available through Proto props, state, methods or compiled author values.

## Projection and lifecycle

While an external target is bound, the compiler root does not add a second
`track_scroll` or overflow container. Host content continues to project its
native clipping and virtual-list layout; facts and requests use its exact
handle. The host content projects the applicable allowed axes; virtual vertical
lists are a vertical host surface. The source retains request-axis authority.

Measurement runs after slot prepaint so virtual content can establish the
actual extent before pending end requests are applied. A physical target must
be layout-ready in the owner's window before delivery resolves to `system`.
Native content may report consumed physical wheel/touch input through
`NativeScrollLease::note_input`; this is an input observation, not an alternate
navigation policy.

Dropping a lease, detaching its view or replacing its target retires pending
end movement, input activity and target references. An old lease or late input
cannot detach or publish into its replacement. Release never changes the
foreign handle's offset. A retired external surface stays unavailable until a
new attachment or the explicit `use_builtin_scroll_surface` host operation.
There is no silent fallback that could apply an old request to another box.

`scroll.sync({ axes })` remains callback-only, accepts only the existing axis
enum, preserves an omitted axis and is a no-op for the same value. It changes
neither projection nor end-follow policy. A queued movement on an axis that
becomes unavailable is rejected. The GPUI backend lowers this existing atom;
other compiler backends keep an explicit unsupported result until implemented.
Automatic end-follow also requires that its configured axis is currently
allowed. Growth observed while that axis is unavailable is consumed without a
movement; restoring the axis permits later growth to follow, without replaying
the disabled interval or changing the authored follow policy.

## Acceptance evidence

`packages/compiler/test/scroll-axis-sync.test.ts` exercises authored intake,
serialized IR, phase/type refusals and native lowering. The real generated
consumer in `test/fixtures/gpui-ordinary-values` exercises nonzero native
geometry, shared-handle requests/facts, exclusive acquisition, replacement,
late-lease cleanup and detach. These tests are separate from OS input and
assistive-technology acceptance; their actual execution receipts determine the
claim, not the presence of the files.
