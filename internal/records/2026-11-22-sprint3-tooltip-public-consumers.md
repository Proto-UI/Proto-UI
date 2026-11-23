# Sprint 3 public Tooltip consumer preparation

Date: 2026-11-22. Related conditions: [#1455](https://github.com/Proto-UI/Proto-UI/issues/1455), [#1042](https://github.com/Proto-UI/Proto-UI/issues/1042) and [#1175](https://github.com/Proto-UI/Proto-UI/issues/1175).

The twelve Base/Shadcn/Brutalist × Web Component/React/Vue/Vue2 public consumers have verified installation and browser-build inputs. Their native browser acceptance is **pending**. The final prepared set explicitly combines eleven successful rows from the strengthened validation round with one successful controlled build recovery; that round's original 11/12 failed aggregate remains unchanged.

The [machine record](./2026-11-22-sprint3-tooltip-public-consumers.json) contains all twelve rows, authored-file and build-output hashes, all selected packages, raw-receipt hashes, archive manifests, and eighteen runner/helper versions with exact hashes and entry commands. This is evidence for the named source, not a release verdict or a pass for a later integration head.

## Source and public responsibility

The package source is the clean integration commit `c8a5cfdfbd3054f6ea11794c68d316d6c151ccfa`, tree `433459491224e6ec0f6482289b39a8b82fd4b4a7`. Source HEAD, tree and working status were checked before and after packaging, consumer validation and recovery.

The public example change originated in `016cfa1b903d35d3087999641e61e27113f6db78`. Its owning producer is `apps/www/src/content/docs/demo_components/tooltip-usage.ts`; Base's four-host Code projection and all six localized Tooltip pages consume or describe those complete files. The source chain is the existing draft Tooltip Group/Root/Trigger/Content prototypes, their public package exports, the real host Adapter or existing CLI facade, and the authored application. No new prototype property, component registry target or compiler behavior is introduced by the documentation change.

Base and Brutalist import real public `@proto.ui/prototypes-*/tooltip` exports and construct the real host Adapter. Their missing CLI `add` targets remain explicit; the validation checks that their rejected `add` commands leave configuration unchanged. Shadcn uses the existing `shadcn-tooltip` CLI target and its actual four-host generated facade.

Independent review found that the direct React examples and the old CLI facade supplied `React` without `react-dom`'s `createPortal`. The React Adapter therefore rendered Tooltip Content inline. The direct examples now pass `{ ...React, createPortal }`. The root-owned CLI repair is `520428abf087a53748bf5ef1b3c9da5ca2e105a0`; it supplies the real Portal function and declares the required React DOM runtime. Both are included in the tested `c8a5cfdf` package source. This record does not reassign that CLI change to the documentation implementation.

The public pages retain the same-subject Trigger/Button composition and the same-tree ShadowRoot destination recipe. A default body portal cannot establish an IDREF description across different DOM roots. The previous native ShadowRoot evidence remains in the [component consumer record](./2026-11-22-sprint3-component-consumers.md), under its own source and scope.

## Selected package scope

The pack command selected **46 packages**, all at `0.3.0-alpha.2`: the dependency closure of the CLI, four Web Adapters, and Base/Shadcn/Brutalist. It invoked the existing `scripts/release/publish.mjs --pack --only ... --out-dir ...`; it did not publish packages.

The full default public pack inventory is **47**. The only public package omitted by this selected experiment is `@proto.ui/prototypes-lucide`, which is not reached by these Tooltip roots. Twelve other repository packages are private or already excluded by their release scan metadata. The 46-package result does not complete the 47-package release BOM. The machine record preserves the actual selected names and full command.

The original pnpm install attempt failed for all twelve combinations: pnpm attempted to resolve unavailable transitive `0.3.0-alpha.2` packages from the registry, despite the root file tarballs. Those failures and their individual logs remain preserved. The subsequent successful installation uses the existing release smoke method: npm installs the complete actual internal tarball closure into each clean App. No package version, registry publication or `latest` substitution is inferred.

The validation toolchain was Node 24.22.3, npm 11.14.1, TypeScript 5.9.3 and esbuild 0.25.12. React/React DOM were 19.2.6; Vue and `@vue/compiler-sfc` were 3.5.31; Vue2 and `vue-template-compiler` were 2.6.14, with `vue-template-es2015-compiler` 1.9.1. The Vue2 public profile remains `>=2.6.0 <2.7`. These measured App versions do not change the inspected Shenko pin or claim upstream adoption.

## Twelve consumer results

Every row installed actual tarballs, ran actual CLI initialization, generated Shadcn's facade or observed the expected unsupported target rejection, and bundled only files from its installed App. The copied build driver rejects bundle inputs outside that App. It does not alias packages back to the source checkout.

| Family | Host | Clean npm install | Strengthened build round | Prepared result | Native browser |
| --- | --- | --- | --- | --- | --- |
| Base | WC | passed | passed | passed | pending |
| Shadcn | WC | passed | passed | passed | pending |
| Brutalist | WC | passed | passed | passed | pending |
| Base | React | passed | passed | passed | pending |
| Shadcn | React | passed | SIGKILL; controlled recovery passed | passed with explicit recovery | pending |
| Brutalist | React | passed | passed | passed | pending |
| Base | Vue | passed | passed | passed | pending |
| Shadcn | Vue | passed | passed | passed | pending |
| Brutalist | Vue | passed | passed | passed | pending |
| Base | Vue2 | passed | passed | passed | pending |
| Shadcn | Vue2 | passed | passed | passed | pending |
| Brutalist | Vue2 | passed | passed | passed | pending |

The six WC/React rows passed strict TypeScript checking before their browser bundles. The six Vue/Vue2 rows passed their official SFC compiler and browser bundling; full Vue type checking was not run. Compilation is not a native interaction, Portal, layout or assistive-technology result.

The first `c8a5cfdf` npm round passed all twelve builds before independent review strengthened provenance verification. That first record remains separately preserved. All twelve first-round dist output inventories were later compared with the prepared inputs and match exactly. This readback does not retroactively describe the earlier verifier as having performed the new checks.

In the strengthened round, the Shadcn React build process received `SIGKILL` (`-9`) after approximately 0.67 seconds with an empty build log. Installation, CLI initialization, generated facade and installed-byte checks had already passed. An after-only resource snapshot did not establish the cause, so the record does not call this a proven out-of-memory event. The other eleven rows reached their own passed terminal states, and the wrapper remained failed.

Only that build was repeated, against the same installed App, using `node --max-old-space-size=512 build.mjs`. It exited 0 with no strict TypeScript diagnostics. Authored App files, generated facade, installed package bytes, source HEAD/tree/status and pack binding remained unchanged. The recovery receipt identifies the original failed receipt by SHA256. `prepare-native-inputs.py` then copied the eleven passed rows and this recovered row into a new input directory, preserving both ancestor receipts and the original failed step. It did not replace or edit the failed aggregate.

## Same-App Portal negative and positive

The original and corrected Shadcn React experiments use the identical authored App SHA256:

`3acc16acc3d8238b76b64dcaa4c79df7fd5ac9fbe8fcc66dffb57f384088c9ea`

With the old CLI package built from `830287f95959a4a1a4fb797df68b0bd6889e0bae`, clean npm installation, strict TypeScript and browser bundling passed. Focusing the actual Account Trigger produced connected Content, the exact expected description and a real `aria-describedby` relation. The Content remained inside the authored App, so the original body Portal ownership assertion failed. The failure therefore reached the intended regression witness; it was not caused by a missing node or failed mount.

With the corrected `c8a5cfdf` package, the same App produced connected Content outside the authored App, and the ownership assertion passed. Both experiments unmounted the actual React root and observed zero Tooltip Content nodes and zero Portal mounts. The raw old/new facade hashes and observations are in the machine record and the archive.

These observations use actual React and CLI code in happy-dom 15.11.7. They establish synthetic DOM ownership only. Native Chromium input, AX computation, rendering, and physical OS assistive technology remain separate evidence. The old baseline's pack receipt also preserves the contemporaneous documentation-only dirty files; it is not described as a fully clean checkout.

## Evidence integrity and independent readback

The strengthened verifier binds the passed pack receipt to the exact clean source and the original manifest hash. It checks all 46 actual tarballs against the manifest's SHA512 integrity and SHA1 shasum and records 3,505 shipped-file hashes. Every selected installed Proto UI package is compared with its tarball before and after its successful build. The authored files, generated facade, copied build driver and source state are also read back. A negative control supplied the old CLI tarball with the same `0.3.0-alpha.2` version; it was rejected because its bytes do not match the current manifest.

The native entry rejects a failed preparation aggregate before importing Playwright or opening its HTTP listener. The default twelve-row path also verifies the preparation binding hash and unchanged source/pack records. The explicit historical one-row control must have its own passed preparation. Two direct entry controls—twelve individually passed rows with an overall failed status, and one individually passed historical row with an overall failed status—both exited 1 before starting a browser.

Cleanup is layered: a rejected `browser.close()` cannot skip closure of the owned HTTP server or the final failed result. Three executable controls used actual HTTP listeners and covered successful teardown, browser-close rejection and server-close failure.

The independent website reviewer re-read these changes and recalculated the copied ancestor hashes. The original failed aggregate, successful recovery and new composed preparation matched their recorded hashes. The reviewer found no remaining related provenance or cleanup issue and did not claim another build or native run.

## Immutable archives and runner inventory

The native archive is `tooltip-public-consumers-c8a5cf.tar.gz`, **16,255,621 bytes**, SHA256:

`d4e598f872d92c4ae69c4aec871e98a37d81e55c7723ee7b0a30909c176da776`

Its `ARCHIVE-FILES.json` lists **371 payload files**, each checked again by byte count and SHA256. The manifest itself is one additional regular archive entry. It contains the current twelve prepared consumers, the original one-row negative consumer, actual current tarballs, source/install/build/recovery receipts, and the native runner plus its cleanup helper. It contains no `node_modules`.

The historical supplement is `tooltip-public-consumers-history.tar.gz`, **1,934,121 bytes**, SHA256:

`8a0ff2bc26bf2321a50a33e88edc1ea2ce3d9946ba6e73465f87a7ebda8e2885`

Its manifest covers **157 payload files**. It adds the original pnpm failure receipts/logs, executed historical drivers, old tarballs, first npm results and the archive-producing scripts. Creating the supplement did not change the 371-file archive. The machine record lists each executed or prepared runner/helper's archive, relative path, exact hash and command; the pending native entry is labelled pending.

The local retained artifact directory is `/workspace/scratch/828b7e591003/s3-tooltip-usage-evidence/c8a5cfdf/`. Local presence is not an upload receipt. The root contributor owns review publication and permanent artifact delivery.

## Native execution still required

After checking the archive SHA256 and extracting it, run from `tooltip-public-consumers-c8a5cf/` with the already installed sandbox-compatible Chromium and a real checkout that supplies `playwright-core`. Both output directories must be new. The native runner serves only recorded build outputs and verifies their bytes before each response.

```sh
CHROME_PATH=/absolute/path/to/chrome \
node evidence/verify-native.mjs \
  current /absolute/path/to/repository /absolute/path/to/new-current-output

CHROME_PATH=/absolute/path/to/chrome \
node evidence/verify-native.mjs \
  baseline /absolute/path/to/repository /absolute/path/to/new-baseline-output \
  shadcn/react
```

The first command plans twelve cases: actual native Tab focus, connected body Portal outside the authored App, browser-computed AX description, sibling Tab, Escape retaining focus and removing the description, reopen and actual framework unmount, old Trigger retirement, and zero remaining Content/Portal nodes. Successful rows produce open/closed screenshots for visual inspection. The second command is the original negative: acceptance requires a connected inline Content witness before the expected body ownership failure. A setup failure cannot substitute for that witness.

The local pack/build jobs used the shared acceptance lock followed by the shared validation lock. Continue native work in the parent's single heavy-job queue. The validation drivers retain their original local paths and record actual command arguments; they are evidence tools, not a newly supported public installation API.

The existing twelve-consumer inputs, source package version and archives make the next operation concrete. They do not complete native acceptance, final-head CI, full BOM/release rehearsal, actual Shenko Tooltip adoption, physical OS assistive technology, true non-DOM/GPUI, or experimental-family conditions. Those conditions remain on the relevant issues and parent trackers.
