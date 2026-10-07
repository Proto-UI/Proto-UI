# Reviewed WC targets retain importer-origin checks

Review 4197481955 on #858 exposed the same source boundary in #857/#775: `reviewedBridgeModules` was excluded from reverse-edge seeds. Static shell checks admitted a reviewed Adapter target in the exact bridge chunk, so a co-located unrelated module could import that target without either reviewed API. The eight target/field mutations of the actual 83633a21 production graph all passed incorrectly; all four targets were verified to be real members of the bridge and module graph. The unchanged graph passed as the positive control.

The repair retains the existing non-bridge traversal and adds a separate reverse-origin trace for reviewed WC bridge targets. These origins can stop only at the exact renderer or the two already source-reviewed WC APIs: `site-shadcn-controls.ts` and `site-native-controls.ts`. The latter is the existing static native-link Surface/Text owner explicitly admitted by `WEBSITE_RAW_IMPORT_ALLOWLIST`; it is not a new generic path exemption. Bridge-owned helpers remain internally admitted, while outside callers of the same helper/target are traced and rejected. Keeping origin classes separate prevents the WC boundary from hiding an unreviewed React/Vue branch. Query lookalikes, bridge co-location and target membership alone grant no ownership.

The first repair attempt stopped only at site-shadcn-controls and falsely rejected three real Homepage paths through site-native-controls, even though all 241 older synthetic controls passed. That failed actual-graph attempt is preserved and drove the exact second-owner review. No Adapter module allowlist, production config, emitter, package or product behavior changes.

Permanent model controls cover all five reviewed site owners, four existing WC targets, static/dynamic edges and owner/bridge/renderer co-location, exact APIs and helpers, query lookalikes, foreign helper callers, non-WC boundary abuse and unemitted cycles. Against the original103 source, the new 150 controls produce140 intended failures/10 passes; the candidate passes all391 graph controls. The real unmodified graph passes and all eight actual-graph bypass mutations are rejected. These are graph-model tests on an actual emitted artifact, not new UI rendering or a generic JS security boundary.

Full source/coverage and exact-head production/native checks are reported on #857 after execution. Original failures and source labels remain retained. Other carriers should merge the shared source commit normally rather than copying a local checker fork.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
