# Exact audit resolver profile after #857 integration

## Integration and source review

The contrast carrier normally merges published #857 `27331cebfc30565fd70835c26a32c64f838c5ca6`, preserving its authors/history and its parser-owned script masking, module-edge production graph guard, exactly three reviewed WC bridge paths and decoder gate separation. The merge is conflict-free. It includes already accepted main 48b80f8b ancestry, not unpublished website UI work. #857 remains an explicit acceptance dependency.

The resulting Astro configuration differs from #857 only by the existing contrast provenance import and the `PROTO_UI_CONTRAST_AUDIT === '1'` plugin-list insertion. Independent source review verified that resolver functions, aliases, manual chunks and graph emitter are unchanged. The imported plugin is serve-only: no resolve/load/transform or production-build hooks; its configuration touches watcher behavior and its server middleware records source identity.

The strict promotion resolver now admits exactly two independently reviewed profiles:

- Original #857 config SHA-256 `d96e4e9086541e713e95f1fa8cda44a7af04795f37f4a91f9f3f93de75ea9f30`, retained without requiring an unused audit helper.
- Combined audit config SHA-256 `b07dfc4350c16a8bee3b65717887cc5d592002f2cb492e134c60a3d18519a6de`, additionally requiring `apps/www/scripts/contrast-provenance.mjs` SHA-256 `a1e7103b44b29063a9bc47d6e7d0881122b9184ff29c239275e00cba8315462a` and recording that helper in promotion metadata.

Missing, modified, directory or symlink helper inputs, symlink ancestors, unknown config/resolver edits and config symlinks remain rejected. No generic plugin shape, arbitrary config, optional helper or dynamic execution is admitted. The previous 2314-pass/5-fail attempt remains recorded; all five failed on the previously unrecognized exact configuration, rather than a package resolver behavior mismatch.

## Candidate checks

- Full source gate: OK, 2 matrices.
- Full coverage test directory: 2410 passed, 1 explicitly unrun real-decoder integration, 0 failures (2411 total). That skipped integration is not a decode pass.
- Focused old resolver and new profile controls: 15/15 passed, including original-profile admission, exact-helper metadata and fail-closed mutations.
- Public/audit controls: 200/200. Provenance subset: 22/22, including explicit audit flag off/0/on and actual installed Vite production `resolveConfig` excluding the serve-only plugin even when opted in.
- The Vite test evaluates only the checked-in plugin-list expression with inert production plugin factories, then uses installed Vite's actual build filtering. It does not claim a production website build or browser run.
- Four exact marker-boundary controls and the explicit native text-shadow inheritance fixture correction retain their separate records. New native 39-calibration/family results remain pending; prior 38/39 failure is preserved.
- Product probe, palette, numerical thresholds and strict ownership/fingerprint guards are unchanged by this profile registration. Independent approval and new-head native/aggregate CI remain required.
