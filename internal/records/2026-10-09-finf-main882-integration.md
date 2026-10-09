# Finf integration of main #882

Source: `521b2c90ab9013ca9989e3f8003d83396af34f33`, tree `1d21136c1c075d35dbff17ef39dd6a8871a20078`. Its two real parents are the reviewed local proof `19b1d076a36a8556e0141a45a1eab72c988fe340` and main `ea19727838d85c05af5e4bca8d5fc235cb44e288` (#882). Main authors and history are preserved; no author certification was added to their commits.

## Change and conflict decision

Main introduced JavaScript/TypeScript facade selection. Finf already used `renderHostIndex`'s third argument for explicit workspace-only admission. The single conflicted function now accepts either the main language string or the existing options object, which may also specify language. Language and source mode are normalized independently. Defaults remain TypeScript and installed-source admission. Only explicit workspace mode permits draft source-only components. Malformed languages, modes, null, arrays and other invalid options fail before generating even an empty facade.

Main's language-specific presets, JavaScript root import paths, automatic project detection, explicit override and removal of obsolete opposite-extension facades are retained. The existing shadow-companion CLI test now reads the JavaScript facade produced for its JavaScript-only project and verifies no TypeScript facade remains. Its no-shadow and failed-command file-snapshot assertions are unchanged.

All sixteen source files from the reviewed dark-seed, Select and Field batch are byte-identical, as are their three source-wall fingerprint pins. This merge does not alter renderer safety thresholds, layout fixes, native assertions or timeouts.

## Fresh checks and retained failure

- CLI: 443/443 tests pass, including 35 new language/admission controls.
- The first complete CLI attempt passed 442/443. Its stale `index.ts` companion assertion failed because the JavaScript-only fixture now correctly generates `index.js`. The original JSON and log are retained.
- Full workspace TypeScript exits 0.
- The explicit CLI package build exits 0 (1 of 45 public packages built).
- Canonical proof check exits 0; source-wall validation passes both matrices; all 113 proof negative controls pass.
- A fresh initial-paint fixture build at clean source 521b exits 0. All 337 tracked source blobs, four installed dependency inputs and four generated assets match its source-bound manifest. This is not native execution.
- Independent checks parse generated JavaScript/TypeScript with esbuild and exercise parent-only negative controls. They do not claim native consumer rendering or a new complete release consumer smoke run.

The earlier 271 source tests, 141 governance checks and full website build remain evidence of their documented 5458 source, with the metadata-only 55d follow-up. They were not rerun or relabeled as execution on this merge. The source-level tests in this section are new execution on the merge's exact product tree. Canonical prototype bindings cover the 4,206 catalog/prototype paths, not a separate proof of CLI or browser behavior.

## Acceptance boundary

New-head native validation is pending. Earlier 342 general CI passed 8,555 tests, while its browser failures kept the final gate red. Light initial-paint continuity passed there, but the old dark scene was correctly refused for rendered contrast. Select/Field hit geometry and the calibrated positive dark scene still require new-head native results. No old screenshot proves this new source.

Complete acceptance remains 0/68; draft lifecycle, public SSR flags and private Card defaults do not change. The previously measured strict size failures remain WC 132,072/132,000, React 106,445/106,000 and Vue 106,280/106,000 bytes. These are retained prior-batch measurements, not a new budget run. Finf advisory success did not make `withinBudgets` true. No budget cap was raised.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
