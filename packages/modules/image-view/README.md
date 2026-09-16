# @proto.ui/module-image-view

Proto UI portable image-view host protocol module.

This module owns the host boundary for a semantic host-owned image presentation requirement: opaque URI source, a11y binary input (informative/decorative), fit, generation-bound lease lifecycle, loading status transitions, and stale completion rejection.

The draft catalog is `M-IMAGE-VIEW-0001` → `HC-IMAGE-VIEW-0001` → `T-IMAGE-VIEW-0001`. Web Component, React, Vue 3 and Vue 2 now have bounded physical-image and generation-lifetime evidence. This does not certify non-Web loading readiness.

Listener registration and its returned cancellation are setup-only. Runtime synchronization and status transitions use callback scope. Asset resolution, alternate readiness definitions and broader A11y API redesign remain separate work.
