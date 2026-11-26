# Finf strict consumer relative declaration repair

Date: 2026-10-09 (UTC)

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Scope and diagnosis

Independent follow-up to the frozen Finf candidate `0010e65aa`; no public API, prototype source, runtime behavior, dependency or compatibility-policy change. The package surface map's publishable artifact rule and each public package's `type: module` / `types` exports govern the emitted ESM artifacts.

A real offline installation of the 15-package prototype-family closure exposed TS2307 under TypeScript 5.9.3, strict NodeNext, `skipLibCheck: false`: `prototypes-base/dist/dialog/{content,overlay}.proto.d.ts` contained inferred `import("..")` references. Bundler resolution accepted the same declarations. The source compiler inferred these references; the existing distribution specifier rewrite matched `./name` and `../name` but omitted bare `.` and `..`. This is a packaging normalization defect, not a new semantic contract.

## Repair

Extend all three existing rewrite patterns (static imports/exports, import expressions/types and side-effect imports) to cover bare relative directories and trailing-slash directory forms. Keep the existing target lookup and already-suffixed path handling. Never hand-edit generated declarations.

Add `scripts/release/test/public-package-relative-specifiers.test.mjs`: build actual TypeScript sources, validate native ESM static/side-effect imports, invoke dynamic imports and check real values, then compile the emitted declaration consumer with strict NodeNext and Bundler, both with `skipLibCheck: false`.

## Evidence

- Before repair: the new regression fails with `ERR_UNSUPPORTED_DIR_IMPORT`.
- After repair: the new regression plus `public-package-export-roots.test.mjs` and `public-package-plan.test.mjs` pass, 8/8.
- Rebuild Base from unchanged prototype source with the corrected canonical builder: 294 output files. Against the original packed Base, only the two failing `.d.ts` files differ; all runtime JavaScript remains identical.
- Repack that output, then install a new isolated consumer with `npm install --offline --ignore-scripts --no-audit --no-fund`: 15 packages, all lockfile resolutions are local tarballs, zero symlinks or workspace links.
- Three families × eight public subentries plus root: 27/27 native ESM imports pass; resolved URLs are asserted to be inside the isolated consumer.
- The same 27 entry/root imports pass strict NodeNext and Bundler with `skipLibCheck: false`, without source aliases or repository type paths.
- Node 24.19.0; TypeScript 5.9.3. Fixed Base tarball SHA-256: `f4276bddb561aee6166c52ac710b828c4cc150f18ca73ad809d564336db3fdce`.

Focused reproducible check:

```sh
node --test scripts/release/test/public-package-relative-specifiers.test.mjs \
  scripts/release/test/public-package-export-roots.test.mjs \
  scripts/release/test/public-package-plan.test.mjs
```

No new dependencies were installed in the repository. Existing dependencies were reused for the build. The original failing consumer was preserved. The first local pack attempt failed because npm's default cache directory did not exist; retry with a dedicated temporary npm cache succeeded. An initial copied ESM harness retained the old consumer's absolute path assertion; after binding it to the new consumer, the full import and locality assertions passed.

## Remaining boundary

This is focused build/declaration and isolated-consumer evidence, not a new full workspace, browser, native or all-public-package acceptance claim. No external push or release was performed. Independent review and integration belong to a separate successor change; the frozen publication candidate is untouched.
