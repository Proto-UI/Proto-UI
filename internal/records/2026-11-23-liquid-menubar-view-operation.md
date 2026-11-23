# Liquid material Menubar fixture continuation — 2026-11-23

## Existing authority and fault

`C-LIFECYCLE-VIEW-OPERATION-0001-CAPTURE` and `-SUPPORT` require explicit host support for a captured source-view operation. `P-BASE-MENUBAR-SOURCE-ENTRY` consumes that operation before opening can invoke author callbacks; `P-LIQUID-GLASS-MENUBAR-BASE` retains the Base protocol. These entities keep their existing draft lifecycle and separate native admission.

The original Liquid material-only Runtime fixture provided no view-operation capability. Running its complete file reproduced **20 passed / 1 failed**: the Menubar controlled-refusal case threw `E_CAP_UNAVAILABLE(lifecycle.view-operation)`. Its detached DOM event targets are a deterministic material consumer, not a browser host; an always-current capability would hide the missing ownership model.

## Bounded correction

The fixture now supplies a stable virtual host provider whose admission and generation follow actual Runtime mount-phase events. Non-mounted phases retire the captured generation; terminal disposal permanently closes admission. The captured immutable operation does not subscribe, schedule or manipulate native focus. A new consumer case captures before mount, after mount, after unmount, after remount and after terminal disposal, retaining the old operation across every boundary.

With that real lifecycle model in place, the old request oracle became the remaining failure: it expected a single press to issue both a trigger and a keyboard proposal. The existing Base source-entry consumer (`packages/prototypes/base/test/navigation-overlays/menubar-focus-entry.test.ts`, committed-press case) requires one request with reason `trigger`, and its existing source implementation prepares opening entry before making that request. The family assertion now checks that exact payload for both Menubar and NavigationMenu. A second independent rejected press must emit another trigger proposal, preserving the original selected owner and material candidate. The later owner update changes the candidate without emitting another request. This distinguishes single-command duplication from blanket deduplication; product source and Focus behavior are unchanged.

## Actual evidence

The intermediate provider-only run is retained: **30/31 passed**, with the sole old two-request oracle failing. The final run passed **87/87 tests in four complete files**, with no skipped tests. Counts:

- `liquid-overlays-source-r91.test.ts`: 22
- `lifecycle.view-operation.contract.test.ts`: 9
- `menubar-focus-entry.test.ts`: 15
- `menubar-request.test.ts`: 41

Focused strict TypeScript and Prettier checks both exited 0 on the exact final test-source SHA-256 `579fabf93b22536dadbbd8117e5d9e6b42d119b05eb79c0450443ae1b5726477`. The logs, JSON results, commands, UTC intervals and source receipts are retained in `internal/records/evidence/2026-11-23-liquid-view-operation/`; its manifest hashes all retained files.

This closes the deterministic fixture mismatch. It does not supply Liquid material-provider, native rendering, Apple, assistive-technology or 120 Hz acceptance.
