# Current article visibility in the left sidebar

Human-assisted #784 / #777 slice, adjacent to #559 native navigation styling. Starlight's `aria-current=page` anchor remains route truth; this does not implement right-side TOC section following or a generic Scroll protocol.

The custom PageFrame's desktop scroll owner is `.docs-sidebar`, while the narrow open directory's owner is its inner scrollable pane. The app makes one bounded route-entry layout request: expand current-link ancestor groups, choose the nearest actual scrollable ancestor within that sidebar boundary, and minimally reveal the link. It does not call scrollIntoView, scroll the document, change selection or move focus. A hidden mobile pane waits for the existing contents-open event.

Font readiness, real projection marker changes and ResizeObserver may settle the pending request. After stable layout, measurement stops. Manual wheel/touch/scrollbar/key input yields ownership; delayed layout does not recenter a user who scrolled away. Route identity changes and persisted history return create new requests. Duplicate initialization, stale callbacks, Astro before-swap and explicit cleanup are owned by one root binding.

The existing nav slice preserves native anchor content/targets and uses the already introduced passive SiteLinkSurface for sidebar, TOC and pagination visuals. These are still source-conditional changes pending exact native browser evidence. Unit fixtures test geometry/lifecycle only; they are not actual scrolling evidence. New Actions cases capture current-article geometry at 1440/390/320 and retained manual-scroll choices. Additional history/route-transition, delayed-font and both-family observations remain part of the Issue acceptance, not implicitly completed by one smoke journey.

PageFrame viewer import/mount is intentionally unchanged here. The independent image-viewer #787 replaces it separately; preserve that change during integration.
