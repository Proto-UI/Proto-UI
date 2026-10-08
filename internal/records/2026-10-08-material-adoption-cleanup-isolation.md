# Adoption review: isolate shared-observer cleanup failures

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

The immediate adoption notification added in `79f871456e2ee25176b6220538b329c2130a7e19` needed the same listener isolation already used by the material program pool. Independent review found that one migrated sink's provider-unsubscribe exception aborted the shared MutationObserver callback before other migrated sinks could retire. This left the second sink on old GPU and media leases while the old RAF remained suspended.

The observer now records the first thrown value, continues every migrated-host notification, schedules ordinary geometry for remaining listeners, and then rethrows the original failure. It neither swallows the error nor revives a RAF when all listeners have retired. No unrelated exception handling is changed.

Two geometry controls reproduce the failure with and without a stationary consumer. A real two-sink control also makes the first source provider throw from unsubscribe: before the fix, one old-document GPU consumer remains; after the fix, the second sink binds the destination and the first can recover on its next commit. All three red cases turn green; the adoption/geometry set passes 19 tests. Actual MutationObserver delivery is retained, with only an outer error recorder to prevent an intentionally uncaught exception from terminating the test runner. GPU, media and RAF remain controlled doubles.
