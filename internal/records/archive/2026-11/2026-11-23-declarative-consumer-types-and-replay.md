# Declarative catalog consumer: strict types and browser replay

The integrated CI [type-check failure](https://github.com/Proto-UI/Proto-UI/actions/runs/45146424504/job/137596731053) exposed that the independent #757 npm consumer had no installed React/Radix dependencies in the workspace TypeScript project. Its shared JavaScript mapper also entered the TSX application with implicit `any` types. This record covers the bounded repair and replay; it does not change the earlier experiment's null result or claim additional Agent-generated implementations.

## Repair and ownership

Source commit `a0e512fc720d6c095ae1c0ec4601089e2fe9fcbe` gives `scripts/analysis/declarative-agent-ui` its own strict TypeScript project. The project checks the actual `app.tsx` and `mapping.mjs` implementation with `checkJs: true`, its fixture and imported Proto-UI sources. The mapper accepts external values as `unknown`, validates objects and supported literal fields, then provides the typed surface to both renderers. Application globals and rejected/active/deleted surface states have concrete types; the `window as any` and deliberately invalid `as never` mutation are removed.

The compiler uses the consumer's frozen React 18 type packages for both catalog paths and the imported Adapter. `check-types.mjs` merges those exact aliases into the inherited workspace paths, preserving the remaining project settings. This prevents the Adapter's React 19 development type tree from contaminating a comparison whose actual runtime is React 18. It supplies no ambient module stub and does not suppress diagnostics.

Only the precise independent-consumer directory moves out of `tsconfig.workspace.json`. The existing CI type-check job explicitly runs its frozen `npm ci`, strict consumer check and schema tests before the unchanged workspace check. Existing runtime dependency versions are identical in the old and new locks. The only additional packages are TypeScript, React/React DOM type declarations and their compile-time dependencies.

## Type and schema evidence

[Local receipts and logs](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-s7-declarative-types/summary.json) retain command arguments, source hashes and outcomes:

- The strict consumer check passed.
- A temporary incompatible assignment in `app.tsx` failed with `TS2322` and exit 1.
- A temporary incompatible JSDoc assignment in `mapping.mjs` independently failed with `TS2322` and exit 1, confirming the JavaScript implementation is actually checked.
- Both controlled mutations were restored byte-for-byte. All 8 schema/mapping tests passed, including rejection of malformed external messages and updates without altering the current surface.
- Prettier and `git diff --check` passed. No existing runtime package version changed.

The raw compiler logs retain their actual local validation paths. Dependencies were independently installed for the consumer; unchanged workspace dependency directories were shared read-only for local compilation.

## Browser replay

A clean build at `a0e512fc` recorded `dirty: false`, Node `v24.22.3` and esbuild `0.25.12`. Its HTML SHA256 is `1d94ba803fdfa26ae8290881d0933388bdd118b732bf090ac09b657d5068c74f`; its application bundle is `9044a9d3cd29a12446b7304cdfb6d150385cb8612f8563270514d6fee4f063f0`. The original protocol SHA256 remains `315750430e7debd5023c4e94705e7afa8a10e1b5a3bcecfff4db3a1bee05749c`; the common fixture remains `d1e75981b398a7d2fa0339f338e12c4f317c3972d07be042cacf5015dc34c5ef`. The original browser runner was unchanged.

The prebuilt bytes were transferred to an isolated directory on doesvm and checked by the runner before serving. The replay used Google Chrome for Testing `145.0.7632.6`, executable SHA256 `481fea1516a1f2b76454664272f12cd9dd1f20117b21e1f1498e08bc7f872c00`, and Playwright Core `1.58.2`. [The browser receipt](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-s7-declarative-types/browser-receipt.json) binds the served asset hashes and every terminal outcome.

| Original condition | Actual result |
| --- | --- |
| Ordinary catalog × manual/automatic × 3 repetitions | 6/6 passed |
| Proto catalog × manual/automatic × 3 repetitions | 6/6 passed |
| Missing accessibility label, both paths | Both observed the intended behavioral-name failure |
| Swallowed Right arrow, both paths | Both observed the intended behavioral-focus failure |
| Dynamic title, both paths | Both explicitly rejected the unsupported value |

All 12 positive cells passed, all 6 controls reached their original expected outcomes, setup failure was null and the process exited 0. The wrapper ran from `09:46:22Z` to `09:48:46Z`; the browser report itself spans `09:47:22.710Z` to `09:48:45.952Z` on November 23. These are execution timestamps, not a performance comparison.

The complete replay archive `declarative-types-browser-2026-11-23.tar.gz` has SHA256 `36c6d8da857e075b1028fe31f73b85853ec1e9cf9c16547e2ff107f7dc92d6d1`, size `4,765,822` bytes. It is retained at `/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono/s67-757-typecheck-4deb/` with source files, the clean build and manifest, the original runner, all state/input observations, selected PNG captures, 18 traces and execution logs. Integration should preserve the same archive under `internal/records/evidence/2026-11-23-s7-declarative-types/`.

This is semantic regression evidence for a typing/installation-boundary repair. It does not replace the historical receipts, create a new timed participant run, measure model cost, establish cross-host advantage, complete an assistive-technology gate or promote draft conformance.
