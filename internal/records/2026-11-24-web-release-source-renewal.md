# Website release source renewal

This bounded repair follows the 0.3 release audit at `88fc0883bec70abbc0d7505d88370657c279639e`. The reviewed source candidate is `a54155f36de41a4fe47de6adc203d907bc117a25`, based on main `952722e5b619c60ddf797543fba11eea6c06d812`, with the Button documentation correction from `530fd9678912ac0a85f9eb49107a064578d68c90`. This is an author source review, not independent approval or release acceptance.

## Repaired development conditions

- The enlarged-text reading journey names the actual `安装` section. The bilingual documentation rewrite put a preview heading first and removed the old Brutalist Card contract heading. Selecting the first H2 therefore no longer exercised the intended reading anchor. The test now selects `h2[id="安装"]` and retains its existing reachability, geometry, scroll-margin and sticky-header offset assertions for both families at 320 and 390 px with 200% text.
- The Shadcn Dialog pages in English and Chinese restore the early-draft lifecycle and distinguish stable `0.2.0` installation (`wc`, `react`, `vue`) from the matching `0.3.0-alpha.2` workspace needed for Vue 2.6, Rhea and the current Mask pointer behavior. They link the existing Dialog Content coverage and keep incomplete keyboard, compatibility and screen-reader work visible. No protocol entity is promoted and no new behavior is claimed as tested.
- The markup reference retains all 33 direct-source identities and `sourceAdmission: unverified`. Its preceding bytes are preserved as `website-markup-provenance-bd2d1cf.json`. Only the four reviewed mismatches below are renewed; the source-binding checker and its rejection conditions are unchanged.

## Review of the four changed inputs

| Input | Reviewed change and owner |
| --- | --- |
| Base Transition Chinese page | The documentation rewrite introduces Preview/Installation/Usage sections and condenses the existing lifecycle description. The same two Transition demo IDs, runtime choices, producer imports and wrapper ownership remain. The page continues to identify source-workspace availability. |
| Shadcn Button Chinese page | The rewrite keeps the existing preview/example producers and pinned `0.2.0` install commands. The subsequent Button correction restores early-draft lifecycle, workspace-only Vue 2.6/style-profile availability and a coverage link. These are public documentation facts, not new host results. |
| Shadcn Dialog Chinese page | The rewrite keeps the existing Dialog preview, its four runtime choices and imported components. It moves the existing install card into the installation section. This repair pins its command to `0.2.0` and restores the matching-workspace, draft, compatibility and accessibility distinctions in both languages. |
| `pnpm-lock.yaml` | The only change from the preceding bound lockfile is the `@proto.ui/module-anatomy` workspace dependency of the feedback module (`link:../anatomy`). It adds no external package resolution. This source inventory does not certify transitive installed or served bytes. |

The exact previous/current SHA-256 values, source revision and historical-reference digest are retained in [source-renewal.json](evidence/2026-11-24-web-release-source-renewal/source-renewal.json). The retained [renewal script](evidence/2026-11-24-web-release-source-renewal/renew-reference.mjs) rejects any different predecessor or changed-path set and refuses to overwrite the historical reference.

## Validation and limits

The public-docs check passes with its stable `0.2.0` and workspace `0.3.0-alpha.2` baselines. The repository-docs check and focused Prettier check also pass. The unchanged markup-provenance negative controls pass 36/36; the renewed current source inventory reports no binding issues, and the archived reference equals its predecessor byte-for-byte. See [source-binding.json](evidence/2026-11-24-web-release-source-renewal/source-binding.json) and the retained command logs.

Native browser verification remains pending. An earlier attempt in the local execution environment reached real Astro routes but Chromium failed before any selected case ran because its sandbox process-singleton socket was denied (`Operation not permitted`). That attempt proves neither a product failure nor a browser pass. The separate authorized-device run must exercise the four enlarged-reading cases and the renewed original-response/runtime-switch/Copy scenarios. Demo Matrix initialization and Toggle visual behavior also need their own current-source receipts; the Toggle repair belongs to the CLI Rule-style extractor and does not change its Prototype or expected background.

## Agent evidence

The Agent's paraphrase of the request is to verify and repair concrete release-audit failures while preserving the declared release scope and truthful evidence. Source checks above are complete for their named scope. Actual rendered captures and browser receipts are pending; no local artifact is represented as an uploaded visual. The next Agent action is the authorized-device browser run against the integrated source, followed by independent review and the separate full release acceptance cycle.
