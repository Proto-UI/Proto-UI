# Independent source review: generated native-browser consumer suite

Reviewer: `/root/collections`, independent of the implementation author. Human-assisted / current-user. Reviewed commit `ee943e59d6f6bd9a418c2ba6f11487e349d5ccc1`; no implementation changes and no native-browser execution by this reviewer.

## Executable inventory and consumer boundaries

The suite contains 20 cases: four Web targets × three unchanged public Button families (12), followed by four targets × synchronous/queued controlled TextControl owners (8). The canonical compiler creates 16 distinct definitions, because the same generated TextControl component is exercised under two owner schedules. Each generated artifact is imported by the target's ordinary framework consumer. React uses the generated `CompiledComponent` export, Vue 3 uses its normal default slot, Vue 2 uses its ordinary child array and events, and Web Components register a custom element with actual light-DOM children.

The consumer bundle rejects retained Proto-UI runtime/module/prototype implementations and Floating UI. The independent TextControl definition is explicitly labeled a shared-contract fixture, not an unchanged application or family implementation. The public Button definitions remain the real Base, Shadcn and Brutalist sources. Styling in the test page supplies only visible geometry and focus indicators; semantic style-token assertions observe the generated component's own projection. This is not a complete visual-family acceptance suite.

## Behavior and discrimination reviewed

Button cases assert the button role and actual ordinary child, trusted pointer activation and Enter activation, focus, exact emitted activation counts, disabled rejection after a same-owner update, and unchanged Root/owner/child identity. Shadcn exercises native dark-media state followed by an explicit document light theme; Brutalist exercises native reduced-motion media. Disposal must reject held exposed handles, remove the physical owner and release all observed media listeners.

TextControl cases use actual Playwright keyboard input, not synthetic dispatch for the accepted candidate. Typing `678` after initial `5` must yield canonical/physical `5678`, caret 4 and matching selection facts under both synchronous and queued owner acceptance. Rejection must restore the previous owner value and caret. Detachment clears selection, an explicitly synthetic event on the retired input cannot update the retained owner, and reconnection keeps the logical owner and canonical value. The document's captured real input events must all be trusted. The synthetic stale event occurs on the disconnected node and is deliberately a separate negative control. Final disposal rejects the retained handle and leaves no physical owner or media listeners.

Each case has a separate browser context. Runtime page errors and blocked external requests fail it. The suite preserves case state snapshots, trusted-event observations, screenshots and traces, and includes the compiler assembly manifest hash in each case record. A failed assertion remains a failed Vitest case. Static compilation failures reject `beforeAll`; they do not create successful browser cases. The aggregate queue must still require all 20 selected test names/results, and a browser launch or common fixture failure must remain incomplete/failed rather than an empty success.

No source defect blocking those bounded journeys was identified. This review does not certify native execution, AT, OS IME, physical touch, exact family visual fidelity, all original compiler semantics or a real downstream application journey.

## Retained static assembly readback

The author's retained `/tmp/sprint2-native-kVanLX` build is a 4,587,670-byte browser bundle created at source HEAD `a165c4058188aa802b475d1d50ce46ab0d574320` with the three new test files still untracked. I independently verified all 207 written generated artifacts and all 181 actual bundle inputs against the manifest hashes. The bundle and entry hashes also match. `compiler-native-browser-static-review.json` binds this independent readback.

The initial evidence-source discrepancy is reconciled without changing the old manifest or log. The saved assembly log reports SHA-256 `a8e58a6fb6cc663ab0f17df7d32a35884375f92af06e5094175793812a8caac3`; independent recomputation proves that this is the compact JSON object serialization. The saved pretty-printed manifest bytes hash to `b9d510cdfc66497fa42212bfd2d0fe9a7bfb924aa47ab0361af3d56a83995e59`. The old fixture used those two different serializations for its returned hash and stored file. Commit ee943e5 now computes the reported hash from the exact string written to disk.

Of 164 recorded source files, the only difference from the later reviewed commit is that fixture's final manifest serialization/hash calculation. The owner restored `/tmp/sprint2-native-kVanLX/executed-fixture.ts`; I independently verified its 8,645 bytes against the recorded source SHA-256 `ef457dec029dd8d5a93cbb2ac4b890170b19aec2ce5f239eb85c0933332e93b3` and compared its entire contents with the committed file. The sole delta is the correction described above; the type-level profile `as const` was already present during this retained assembly. The independent readback JSON preserves that exact diff and both hashes. There is no unresolved source discrepancy for this static observation. It remains the original pre-commit assembly, not a source-identical final integrated-head or browser-success receipt.

The actual native run remains outstanding. Neither static assembly nor these independent file checks replace it.
