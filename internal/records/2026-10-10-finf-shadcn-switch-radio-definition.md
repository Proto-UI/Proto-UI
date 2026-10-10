# Finf Shadcn Switch and RadioGroup draft reference migration

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

The independent coordinating reviewer read the five Prototype and three Test deltas against the exact source below and recomputed both registry/TSX hash pairs before allowing this definition to precede implementation. This changes draft presentation goals only, not Base ownership, public props/anatomy, Compiler, CLI semantics or lifecycle status.

## Content-pinned official sources

Retrieved 2026-10-10; the mutable registry supplied no upstream Git revision. MIT notices remain in the Shadcn package. Third-party sources were read statically, not executed.

- [Switch](https://ui.shadcn.com/r/styles/base-nova/switch.json): registry SHA256 `1f22350ccbf358a3aa198305c41d91e146abc0a7d5b18a9a23488b8d6b264ab4`, TSX SHA256 `d232e2ffcfa122c59099872bcb8395eaad36d42fa9d2e0e40382ad19994065e2`.
- [RadioGroup](https://ui.shadcn.com/r/styles/base-nova/radio-group.json): registry SHA256 `874b30662ba338d06362491b663cae9198281a4bc385b6be6425f2de442384d7`, TSX SHA256 `f779542f2370b82fcbb91278fb94f7ad4af59d0f36512633492604b27da48e8d`.

RadioGroup targets grid/full-width/gap-2, checked primary fill plus primary-foreground ink, and a full 8px primary-foreground dot. Existing explicit passive Indicator and host-neutral flex centering remain intentional composition differences. Invalid, field-label and expanded-hit-target selectors are not implemented by this slice.

## Switch implementation is blocked on hit target

The source default track is 32 by 18.4px, the thumb 16px with 14px horizontal travel, with no additional horizontal padding inside the 1px border. Vertically there is still 0.4px total space (18.4 minus 2 minus 16), centered by flex. Upstream sm and its size API are not admitted here.

Directly shrinking the current 44 by 24px Root would reduce its pointer target, while the source expands that target through pseudo-elements. Current author syntax has no governed static cross-host hit-envelope capability. `hit-envelope-translate-1` is specifically movement compensation for a translated bordered host and cannot be repurposed as a static touch target. Consequently the current Switch implementation remains unchanged; its draft geometry/palette target and fresh source/CSS/packed/browser evidence stay planned. This is a host/style capability gap for the owning workstream, not a request to add a component-specific Compiler exception. No Full delivery checkbox is closed.
