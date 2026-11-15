# Comprehensive 0.3 repair candidate

Date: 2026-11-15. This is an AI-assisted, current-user-directed repair and integration record. The requested outcome was one broad PR covering important 0.3 work and smaller defects, with parallel implementation and cross-review. It is not a release, independent approval or permission to merge.

**Disposition: draft; compilation compatibility blocks merge.** The new ControlLabel target declarations repair real Runtime consumers but make the previously compilable Base Button fail `react-dom-source-v1`. That change is isolated in its own commit and is not described as pre-existing compiler debt. The remaining repairs and their evidence are retained for review.

## Source binding and integration

- Original assessment baseline: `7d30a788f4bd79189cbe2dd499ded9ff22ba91e1`.
- Integrated code candidate tested remotely: `d45396af4b5b4381d8c0c0aabae7d4bfe086a2f7`.
- Code tree: `3f31d73bf84ae55e0553a52cfb97625aa556543b`.
- Main advanced to `ff24ed1a9e6cfa3486a2fdcc86b890556265e339`, independently merging #1451, #1440, #1439 and #1459 during this work.
- Reconciliation commit: `6ee6a5f97d2ec78983e9d837942099ec0e5e6acd`. Its tree is exactly the tested code tree above. The sole merge conflict concerned the new React host-prop diagnostic ref; retaining that ref produced no source-byte change.
- Local Calendar, workspace/docs types, documentation and inventory checks ran against the complete integrated working files. Before remote validation, all 94 post-integration changed/new file hashes were compared with those local files. The remote candidate was clean and committed. The local temporary merge state is not presented as an immutable source revision.
- This record is added after code validation; it does not change the tested product or test sources.

Original commits, authorship and certification trailers are preserved through merge ancestry. No original source branch, Issue state or PR review disposition was changed by this task.

| Source PR | Exact imported head | Contribution | State observed before publication |
| --- | --- | --- | --- |
| [#1435](https://github.com/Proto-UI/Proto-UI/pull/1435) | `3139922b91dd94111a6a290687ab43adc479788b` | Public Search composition/commands, Homepage retention and native React behavior | Open |
| [#1438](https://github.com/Proto-UI/Proto-UI/pull/1438) | `67ff069f039c3c85eb20aa484764e4cc5daa043c` | Contents ownership, Homepage/projection/theme/typography, WC teardown and Anatomy family boundaries | Open draft |
| [#1439](https://github.com/Proto-UI/Proto-UI/pull/1439) | `0133249b0334267e588593e361e31676e20e2a3a` | Select aligned popup row sizing | Merged independently |
| [#1440](https://github.com/Proto-UI/Proto-UI/pull/1440) | `fe687b22a8213deda18a06a5fd0b8d134d97929d` | Server-rendered Homepage family placeholders | Merged independently |
| [#1441](https://github.com/Proto-UI/Proto-UI/pull/1441) | `752af98fcb56c1c13b5c81f776789c0d85455630` | Bootstrap header and theme contrast; public Link/Text/Surface ownership | Open draft |
| [#1447](https://github.com/Proto-UI/Proto-UI/pull/1447) | `e71dc835b96cd3cbf37c602f0b640b6982883d0e` | Sidebar disclosure fixture correction | Open draft |
| [#1448](https://github.com/Proto-UI/Proto-UI/pull/1448) | `35a21913fa511dd0b9ca068e6defe74589007f66` | Calendar caption naming and representative native evidence definitions | Open draft |
| [#1451](https://github.com/Proto-UI/Proto-UI/pull/1451) | `331e44d50440c2c9bb5d76130e31b6b2e1efe56f` | Bilingual routes, InputShell/styleScope and catalog evidence integrity | Merged independently |
| [#1459](https://github.com/Proto-UI/Proto-UI/pull/1459) | `41282cb0ddc39283826e52e9932be123fc83eb47` | Explicit React update while first mount is pending | Merged independently |

The overlapping sidebar fixes were reconciled to open the native disclosure exactly once, preserving separate closed/open assertions. Source integration is not a declaration that all original PR criteria or historical findings are accepted.

## Additional repairs and reviewable boundaries

| Commit | Repair and reason | Remaining boundary |
| --- | --- | --- |
| `319d6c3215856238e30e695024d1deeccea6e5a2` | Centralizes public as-hook admission; fixes Vue 2 strict generated pointer typing; adds collision-checked shared project output; preserves Context notification ownership and falsy errors; avoids a secondary React startup error | Compiler remains private; four hooks remain explicitly unsupported; shared-project real consumer evidence is React |
| `b988fbf6b6acd9d167d43a55a12b70109e26d8ce` | Button, Toggle and ToggleGroup Item join the existing ControlLabel association channel, sharing their original activation operation and reentry/disabled/controlled guards | **New compiled Button regression; merge blocker** |
| `155d6d206f418a52429155e7462b1e08dfe91610` | Adds same-node Tooltip composition, shared horizontal Drawer geometry, React development diagnostics, public recipes and 18 native consumer cases | Combined native/type evidence depends on the ControlLabel commit; no all-host or full family visual acceptance |
| `d45396af4b5b4381d8c0c0aabae7d4bfe086a2f7` | Repairs Rhea Calendar props/anatomy, Search first-error capture, projection focus assertions, conditional Tooltip token assertions, Finf inventory and WC isolation preflight | Hosted native isolation and complete browser CI remain separate acceptance work |

### Compiler ownership

The admission table accounts for all 19 current public `as*` hooks: 15 admitted, with `asControlLabel`, `asAxisInput`, `asContextMenuInput` and `asNativeLink` rejected with explicit reasons. Renamed imports and forwarding retain the actual source callee/range. This is not implementation of every hook or `defineHook`.

The project-output writer shares generated modules only when path, kind and bytes agree. It rejects entry/support collisions, unsafe names and snapshot conflicts, and writes create-only outputs with provenance. The real React consumer uses one generated declaration identity across entries; independently published graphs remain isolated in the negative control.

For Context delivery, queued work records `record`, `provider`, `key`, `callback`, `next` and `prev`. Before a callback executes, current resolution must still equal its captured provider. A recipient that rebinds during an earlier callback therefore cannot receive a stale provider transition. A separate `failed` boolean preserves the first thrown value even when it is `undefined`, `null`, `false`, `0` or an empty string; finite queued delivery drains before that value is rethrown. Executable cases are in `packages/compiler/test/react-context-source.test.ts` and `project-context-source.test.ts`.

### Component consumers

ControlLabel target requests reuse the control's private activation path rather than synthesizing outward click signals. Focus reentry, accepted controlled state followed by association withdrawal, and disabled controls retain their owners. No generic host-attribute forwarding or label Prop is added.

`useTooltipTrigger()` observes focus/hover and adds an owned description on the existing command node. It has no outward exposes, avoiding duplicate focus/state owners; standalone Trigger behavior remains supported. Re-enabling Tooltip while an already-focused command never loses focus was not specified as a new reopen guarantee.

Horizontal Drawer now uses the existing four-edge AvailableLayout model. Its default maximum remains 20 root-text units; explicit logical/available maxima, fractions, drag and resize use one geometry owner. The documented `display: contents` Root is an explicit consumer layout choice. The default wrapper is retained.

React warns once per undeclared host-looking prop key in development. Declared Prototype props, documented Adapter inputs and custom `getProps` retain their behavior; production bundling without a Node `process` global is tested.

### Website and evidence

The Rhea Calendar demo uses supported trigger props and complete Shadcn Select Content/Surface/Viewport/ItemText anatomy. Month assertions target the popup owned by the trigger; the 101-year range remains complete. Calendar naming, locale labels and controlled synchronization remain covered.

Search captures its first thrown browser error before attempting screenshots, and capture failure cannot replace that error. Projection entry tests wait for actual selected-entry DOM/public focus before exercising `focusSelf`. Tooltip tests assert the generated `data-[open]` motion rules and actual open-state attributes without changing presence or timing behavior.

The WC preflight checks a separate user/net namespace, loopback and absence of default routes before dependency installation. Failure remains nonzero and records source SHA/tree/lockfile plus zero browser journeys. It does not relax isolation, raise browser timeout budgets, or establish that a hosted runner is now eligible.

## Executed validation

Local environment: Node 24.22.1, TypeScript 5.9.3, Corepack pnpm 10.32.1. Remote committed-candidate validation: Node 24.21.0, pnpm 10.32.1, normal user, system Chrome with `chromiumSandbox: true`. Checks were serialized where needed to avoid memory contention.

| Check | Actual result | Binding and limitation |
| --- | --- | --- |
| Integrated changed non-browser suites | **48 suites, 1,012/1,012 passed, zero skipped** | Clean `d45396a` code tree; 111.72 seconds; excludes Calendar, run separately below |
| Calendar full suite | **29/29 passed, zero skipped** | Same integrated source files; original timeouts and complete 101-year options; 405.16 seconds |
| Native component consumers | **18/18 passed, zero skipped** | Clean `d45396a`; 24.30 seconds; Base/Shadcn/Brutalist × React/WC × Label/Tooltip/Drawer |
| Public package build | **47/47 passed** | Clean `d45396a`; 80.64 seconds; JS/declarations, exports and plain Node import checks; private compiler excluded |
| Workspace types | **Passed, exit 0** | Official `check:types:workspace`; 4 GB heap; 41.9 seconds; excludes `apps/www` by configuration |
| Docs types | **Passed, exit 0** | Official `check:types:docs`, including generators and Astro sync/check; 1,226 files, 0 errors, 0 warnings, 30 hints; 130.807 seconds |
| Public documentation tests | **461/461 passed** | Integrated local candidate |
| Public documentation policy | **Passed** | 305 bilingual primary routes, four inventories; stable 0.2.0 and workspace 0.3.0-alpha.1 remain distinct |
| Runtime inventory and isolation unit tests | **131/131 passed** | 125 inventory/discovery cases plus six namespace preflight cases |
| Compiler workstream focused validation | Passed in its bounded source candidate | Includes final affected 79 tests and four Web strict generated pointer graphs; not universal compiler acceptance |
| Search mobile menu probe | **1 passed, 82 explicitly filtered skips** | Earlier integrated website candidate, before final component integration; actual case 5.575 seconds; stronger normal-sandbox diagnostic driver; not the complete Search suite or hosted CI |

The native suite performs real keyboard and pointer actions, checks accessible names/descriptions, controlled refusal and disabled ownership, and measures Drawer edges, widths, dragging, resizing and grid layout. It captures at 1200×800, plus Drawer resizing to 600×800. It is a standalone fixture using actual source prototypes/adapters and collected styles, not fully themed website acceptance. Three final Shadcn React captures were inspected: Drawer edge/width and header/main relationship are coherent; Label names and Tooltip description are visible. The sparse fixture captures do not establish finished visual design, all themes/locales, or assistive-technology compatibility. Screenshot upload remains publication debt; no local file is presented as a public attachment.

### Retained failures and controlled reruns

- The first integrated 48-suite run had 1,011 passes and one catalog failure because new files were not yet in `git ls-files`. Registering all owned new files fixed discovery without source/spec/test edits. The original catalog suite then passed 13/13, and the clean committed rerun passed all 1,012 tests.
- Earlier Homepage typography collection lacked officially generated CSS. Running its generator restored collection and its 17 tests passed. Generated files were not hand-edited.
- Two old Shadcn Tooltip assertions expected unconditional tokens instead of actual open-conditional CSS. The original source reproduced both failures; corrected assertions preserve motion, presence and exit checks, and all five cases passed, also within the final integrated run.
- The initial projection entry test observed Root open before deferred selected-entry focus. The repair waits on the actual entry owner; all 56 projection cases passed, also within the final integrated run.
- Initial Rhea tests exposed unsupported ghost appearance. A first candidate test also incorrectly counted options in detached closed portals; it was corrected to assert the owned month popup, not to truncate data. The final full 29-case suite includes the complete year-selection consumer.
- A component workstream full workspace type attempt was killed with exit 137. The final serialized official workspace and docs checks both passed. The earlier failure remains historical evidence, not an earlier success.
- Actual hosted WC namespace eligibility and earlier browser shard timeouts were not repaired by claiming the preflight ready. No 900-second shard budget or per-test threshold was increased.

## Reproduce the merge-blocking compiler regression

From the candidate repository root with its dependencies installed:

```sh
git worktree add --detach ../proto-ui-baseline-7d30a788 7d30a788f4bd79189cbe2dd499ded9ff22ba91e1
node --import tsx --input-type=module <<'JS'
import path from 'node:path';
import { compileFile } from './packages/compiler/src/compile.ts';
const entry = 'packages/prototypes/base/src/button/button.proto.ts';
const profile = 'react-dom-source-v1';
for (const [label, root] of [
  ['baseline-prototype', path.resolve('../proto-ui-baseline-7d30a788')],
  ['candidate-prototype', process.cwd()],
]) {
  const result = await compileFile(entry, { root, profile });
  console.log(JSON.stringify({ label, profile, entry, ok: result.ok,
    diagnostics: result.ok ? [] : result.diagnostics }, null, 2));
}
JS
git worktree remove ../proto-ui-baseline-7d30a788
```

Both calls use the candidate compiler. The baseline Prototype returns `ok: true`; the candidate returns `ok: false`, `PUI1003`, at the Button `asControlLabel` import: Control Label association and activation lowering is not implemented.

The public association ref is nominally branded by Core. An independently emitted copy cannot recognize those existing refs, while importing Core would violate the present standalone source-profile boundary. The next compiler-owned step is to govern that interoperability contract, implement generic association/activation lowering, then prove naming, activation, disabled/controlled state, focus reentry and disposal in real compiled consumers. No no-op lowering, component-name dispatch or invented ABI was added to hide this gap.

## Acceptance and publication debt

The draft remains blocked on the new compiler regression, independent review and actual current-head CI. The compiler is still private; this does not complete #1458, the 0.3 milestone, every Finf family/host, SSR or native-platform admission. The nine guarded official Calendar native evidence cases and full Search/browser matrix were not executed here. Existing source PR acceptance findings remain with their original owners.

Before marking ready, resolve the compiler contract, run affected compiled consumers and the relevant hosted browser/namespace jobs, inspect and publish final visual evidence through an approved destination, and obtain the repository's normal independent review and native DCO/check results. No Issue checkbox or release lifecycle was promoted on the strength of this draft.
