# Bounded A2UI catalog comparison

This is the reproducible #757 experiment, not a public integration package. It realizes the same pinned A2UI 1.0 literal Tabs/Text input through Radix React Tabs and actual Proto-UI Base Tabs + React Adapter. The [record](../../../internal/records/2026-11-22-sprint-7-declarative-agent-ui.md) contains the null result, original failed attempt, exact source identity, reviewed expectation correction and limits.

From a prepared Proto-UI checkout with its frozen workspace dependencies:

```sh
npm ci --prefix scripts/analysis/declarative-agent-ui --ignore-scripts --no-audit --no-fund
npm run check:types --prefix scripts/analysis/declarative-agent-ui
node --test scripts/analysis/declarative-agent-ui/schema.test.mjs
node scripts/analysis/declarative-agent-ui/build.mjs /absolute/new-build-directory
CHROME_PATH=/absolute/path/to/chromium node scripts/analysis/declarative-agent-ui/run.mjs /absolute/new-build-directory /absolute/new-evidence-directory
```

Both output directories must be new. Supply an installed Chromium executable with a writable temporary filesystem. `build.json` binds source files, upstream schemas, the shared input, protocol, dependencies and emitted assets; the runner verifies those emitted hashes again and records bytes actually served to the browser.

This directory is an independently installed npm consumer. Its dedicated strict TypeScript project checks `app.tsx`, the actual JavaScript implementation of `mapping.mjs` (`checkJs: true`), and imported Proto-UI sources. `check-types.mjs` merges the workspace's source aliases with the consumer's React 18 type resolution, matching the runtime binding in `build.mjs`; it does not mix in the Adapter's React 19 development types. CI installs this consumer's frozen lock and runs its type and schema checks explicitly before the workspace check. Only this exact directory moves out of the workspace TypeScript project. The added dependencies are compiler/type packages; both catalog paths keep the same original runtime dependency versions, common fixture and protocol.

`result.json` contains each terminal cell, every first divergence, actual state snapshots and input events. Individual Playwright trace ZIPs and selected PNG captures are retained. The repository evidence stores traces in each attempt's `traces/` directory; the trace manifest gives their hashes. A failed setup or missing cell cannot be scored as a semantic detection.

`protocol.json` is the task/oracle definition. `mapping.mjs` is shared by both renderers. `app.tsx` contains the ordinary and Proto catalog wrappers. The `upstream/` files are unmodified pinned A2UI material with their license and attribution. `schema.test.mjs` separates official schema validity from mapper support. `run.mjs` exercises actual keyboard/pointer journeys and the rendered negative controls.

The interface permits a group-level initial tabstop before native Tab enters; after entry the selected trigger must receive focus and the roving trigger invariant must hold. Do not restore the first attempt's invalid assumption that all correct implementations expose a trigger tabstop before entry.

These repeats do not represent independent Agent implementations. Function RPC, data binding, controlled selection, other hosts, physical devices, assistive technology and economic advantage are outside the performed experiment.

The November 23 type-boundary repair makes external messages enter the shared mapper as `unknown` and validates their shape before producing a typed surface. Malformed object/array/accessibility values fail explicitly for both renderers. Historical experiment receipts remain bound to their recorded source; a successful current type check does not rewrite those measurements or claim a new model experiment.
