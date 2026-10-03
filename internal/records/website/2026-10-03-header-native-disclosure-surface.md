# Native Header disclosure with an owned family surface

This is a Website consumer record for #559 and #777, not a new Base guarantee.

The navigation disclosure has one application-owned open state and native links.
The desktop navigation stays inline; the compact navigation is rendered from the
same action data inside the popup, with unique group IDs. Only the applicable
navigation is visible and focusable. Crossing a breakpoint keeps open state and
returns focus to the current menu Button if the focused link becomes hidden.

A real `SitePreviewSurface` Prototype owns the popup's family paint. Website CSS
owns positioning, width, overflow and content layout, and adds no outer border,
background or shadow. This passive surface has no menu/dialog role or focus stop.
The application's existing native subtree is placed in the Prototype's physical
slot only during publication. Its elements and input state keep their identity;
rollback restores the prior slot, and retired disposal cannot move newer content.
The WC Adapter's synchronous-move lifecycle is exercised with an actual uncontrolled
Toggle; this is a test fixture, not an extra Header control.

On the homepage the surface joins the existing page generation and rollback.
Documentation uses a bounded Header-surface scope that reads the saved runtime and
observes subsequent preferences. An initial renderer failure retains native
content and the next request starts from its latest runtime intent. No claim is
made that every documentation control is one atomic page transaction.

The disclosure remains the sole owner of visibility, aria-expanded/controls,
Escape, outside interaction and return focus. A portaled Select is exempt from
outside dismissal only when a Header control names that exact popup via
aria-controls. An unrelated listbox does not gain this exception.

Current family paint is bound to the checked-in SitePreviewSurface recipes.
The independently reviewed neobrutalism.dev alignment can update those recipes
without replacing disclosure semantics with CSS or changing Base contracts.

Evidence: real four-runtime slot/state tests, actual WC state retention,
homepage generation tests and disclosure breakpoint/portal negatives run locally.
Native-link and homepage capture suites record the actual popup frame, same-page
coordinates, outer-paint absence and mobile/desktop screenshots. Browser results
and final visual acceptance remain pending the published candidate SHA.

Co-author by OpenAI Dots
