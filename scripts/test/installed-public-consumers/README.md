# Installed public Usage consumers

This runner continues the actual scripts recovered from [the Sprint 3 Tooltip record](../../../internal/records/2026-11-22-sprint3-tooltip-public-consumers.md). The original archives and their failed preparation rounds remain historical evidence. They are not relabelled as a current candidate pass.

## Run

Use a clean checkout with its frozen workspace dependencies, Node 24, Python 3, and an installed Chromium that can run with its sandbox enabled. The runner does not install a browser or disable its sandbox. Run one heavy owner at a time. The output must be a new directory outside the checkout. The process owner and its descendant controls require Linux/POSIX process groups.

From the repository root:

```sh
python3 -B -m unittest discover -s scripts/test/installed-public-consumers -p 'test_*.py'
node --test scripts/test/installed-public-consumers/native-cleanup.test.mjs scripts/test/installed-public-consumers/verify-native.test.mjs scripts/test/installed-public-consumers/verify-result.test.mjs

CANDIDATE_SHA="$(git rev-parse HEAD)"
CHROME_PATH=/absolute/path/to/chrome \
python3 -B scripts/test/installed-public-consumers/run.py \
  --repository "$PWD" \
  --candidate "$CANDIDATE_SHA" \
  --output /absolute/path/to/new-installed-public-usage-evidence

node scripts/test/installed-public-consumers/verify-result.mjs \
  /absolute/path/to/new-installed-public-usage-evidence "$PWD" "$CANDIDATE_SHA"
```

The default old-CLI fixture is committed beside its provenance. An explicit `--old-cli-record /absolute/path/to/recovered-old-cli.json` also accepts the original recovered packet, after the same fixed byte and manifest checks.

The runner invokes the existing `scripts/release/publish.mjs --pack --only ...` for the current internal dependency closure. It does not publish packages. All App dependencies use those actual tarballs. Each App has its own npm lock; the npm executable comes from the frozen workspace dependency. React, Vue and Vue 2 consumer toolchain versions remain the versions recorded by the original experiment. Vue 2 is explicitly 2.6.14. All installs and App builds are serial. SIGTERM/SIGINT cancellation is sticky: the owner sends TERM only to its own active process group, waits a bounded grace period, then sends KILL and waits. It cannot start another App/stage after interruption. Unsupported CLI add is accepted only as a normal exit 1, never a signal, timeout or cancellation.

## Three separate results

| Group | Exact subjects | Authored source | Required native behavior |
| --- | --- | --- | --- |
| `tooltip` | Base, Shadcn and Brutalist × WC, React, Vue, Vue 2: 12 Apps | Actual `baseTooltipFiles`, `shadcnTooltipFiles`, `brutalistTooltipFiles` | Native Tab; connected Content in body outside the App; browser AX description; direct sibling Tab; Escape retains Trigger focus and clears description; reopen; actual host unmount; no stale Trigger, Tooltip or portal mount |
| `select` | Base × WC, React, Vue, Vue 2: 4 Apps | Actual `codeMap[host]['demo-base-select']` | Named combobox; native Enter/ArrowDown/Enter; transient focus does not commit; committed `vue`/`Vue`; restored focus; Escape; actual body portal; unmount with no remaining listbox or portal mount |
| `old-cli` | One Shadcn React mixed counterfactual | Same current public App, current other packages, original 830287 CLI tarball only | Actual connected Tooltip and browser AX description must first pass; the original body-outside-App assertion must specifically reject; sibling keyboard, Escape, reopen and unmount still run |

The original 12 have not become 16 or 17. Select and the historical CLI override have distinct preparation and native receipts. The old-CLI native control uses `status: passed` only when the expected defect was actually observed and all other prerequisites and cleanup passed. It records `observedProductOutcome: rejected`; it is not a product pass, an all-current package result, or a whole historical checkout result.

The modern CLI `init --prototypes shadcn` loads its embedded style preset and does not generate a Shadcn facade. Base consumers therefore need only their actual public package closure. Tooltip's separate `add` command generates the real Shadcn facade; unsupported Base/Brutalist targets must reject without changing the CLI config.

## Source and artifact binding

The pipeline binds the exact clean candidate HEAD/tree/status and lockfile, helper bytes, the owned pack command/result, manifest SHA-256, each tarball's SHA-256/SHA-512/SHA-1, and all shipped internal package files. The installed bytes are checked before/after each App build and again before/after the native run. Authored App files cannot change during installation, CLI generation or compilation. The browser build must resolve its real installed public packages within the standalone App; repository aliases and linked workspace source are rejected.

React and the original WC TypeScript entries receive strict TypeScript checks with `skipLibCheck`. Select's WC panel is an actual HTML JavaScript module; it is bundled as JavaScript, without a TypeScript-check claim. Vue and Vue 2 use their official SFC compilers and a browser bundle; this is not a claim of full Vue typechecking. The authored SFC styles are included in the browser CSS.

The source extractor writes its machine JSON to a dedicated new file; compiler stdout/stderr remain in `extract.log`. Each authored App is checked against those actual exported public source strings again before native use.

The native verifier requires a passed preparation aggregate and the exact group inventory before resolving Playwright or opening a listener. Its own HTTP server serves only recorded dist files whose hashes still match. It uses real Chromium keyboard input and CDP's accessibility tree. The owner closes the browser and HTTP listener even after a browser-close error. Failed or unrun App/group rows prevent an overall pass.

`pipeline.json` is the overall terminal receipt. Each group has `<group>/execution.json` and `<group>-native/native.json`, plus command logs, authored files, generated facades/styles, installed locks, build metafiles and open/closed PNGs. Retain the complete output directory, including failures. Run `verify-result.mjs` even after a failed runner in CI, then upload all evidence except the disposable `**/node_modules/**` trees. It rechecks the terminal stage inventory, exact source and installed bytes, three native receipts and all required PNG hashes and the actual served HTML/JS/CSS path/hash/size records. Missing, failed or unrun evidence exits nonzero. Keep the packed tarballs, locks, logs and build outputs when omitting installed trees.

A successful automatic run establishes only the stated installed-consumer assertions. Screenshots still need visual review; physical assistive technology and actual application adoption are separate obligations.

## Original fixture provenance

`fixtures/old-cli-830287.tgz` is the original 198,259-byte CLI tarball from:

- Historical source: `830287f95959a4a1a4fb797df68b0bd6889e0bae`.
- Archive: `tooltip-public-consumers-history.tar.gz`.
- Archive SHA-256: `8a0ff2bc26bf2321a50a33e88edc1ea2ce3d9946ba6e73465f87a7ebda8e2885`.
- Member: `tooltip-public-consumers-history/baseline-history/pack/tarballs/proto.ui-cli-0.3.0-alpha.2.tgz`.
- Tarball SHA-256: `0dd1537bdb151fa6f265df07c1ba35cef37adc20b7e2e7c69e7e0f2e60b7af9d`.

The adjacent machine provenance retains the original pack-manifest hash and CLI integrity/shasum. The original pack recorded documentation edits, so it does not claim a clean whole historical checkout. The fixture is never rebuilt and labelled as the old bytes.
