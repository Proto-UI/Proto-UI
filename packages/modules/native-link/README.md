# Native Link

Draft native navigation target, declared before materialization with `declareNativeLink()` and bound during setup with `asNativeLink()`.

`sync({ href, target, rel, disabled })` replaces all four fields; omitted fields reset. It is callback-only. Safe relative routes and HTTP, HTTPS, mailto, tel, sms, FTP and FTPS schemes are accepted. Other schemes and URL control characters fail closed to no destination. `_blank` adds `noopener` without discarding explicit rel tokens. Template props remain style-only.

The browser owns URL previews, copying destinations, Enter activation, modifier/middle clicks and default navigation. The module does not call a router, `location`, `window.open`, synthetic click or keyboard activation. `on('navigate', ...)` is a read-only observation delivered in a later task after native event/default processing. It carries href, target, rel and modified, never a native event or cancellation handle. Cancelled activations, disabled targets, disposed leases and superseded configurations do not emit. Closing a menu in the observer cannot erase the destination before native default activation. Consumers requiring a synchronous routing veto need another contract.

Disabled targets have no href, carry aria-disabled and are removed from native tab order. Cleanup restores only attributes still owned by its lease; stale disposal cannot overwrite newer host/lease values. React, Vue and Vue2 use an actual anchor root. Web Component light DOM and ordinary Shadow DOM retain their custom-element owner with one local anchor containing the rendered/caller content; accessibility, styling and focus use that anchor. Shadow-split is explicitly unsupported.

Compiler-produced Web, Flutter, Qt and GPUI navigation are not implemented by this package and must not be represented as supported or emulate navigation with an outward request. Current evidence uses synthetic host tests, including real adapter wiring; native-browser URL preview, context menu, new-tab and accessibility-tree acceptance remains pending. See `C-NATIVE-LINK-0001`.
