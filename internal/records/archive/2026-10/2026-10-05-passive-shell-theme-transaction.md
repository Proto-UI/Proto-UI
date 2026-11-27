# Passive shell family/theme transaction repair

## Scope and authority

Review [#777 / 5412143225](https://github.com/Proto-UI/Proto-UI/pull/777#pullrequestreview-5412143225), thread `4178824687`, identified that a failed shell-family request retained the previous public SurfaceRoot while applying the rejected family's theme. The affected baseline is `c2866b712098d6075377feacf15b2f8ffd5bc5f7`.

`D-HOST-PROTOTYPE-PROJECTION-SCOPE-0001` remains **draft**. Its `ATOMIC-GENERATION`, `NO-HYBRID-PRESENTATION` and `FAIL-CLOSED` criteria govern this Website-local correction. This change does not promote that decision, amend its semantics, introduce a Prototype or change the Adapter boundary.

The repair is limited to `apps/www/src/components/PrototypePreviewer/passive-shell-composition.ts` and a new colocated regression suite. Existing public family SurfaceRoot implementations, Base lineage, renderer ownership and borrowed LightDOM content remain in use. Header, hero, icon recipes and copy are outside this slice.

## Observed failure and correction

The executable baseline mounted a real Shadcn SurfaceRoot with `--pui-background: #123456`, then requested Brutalist with `#abcdef` behind an explicitly deferred loader. Before the loader completed, the retained surface still reported `data-projection-family="shadcn"` but its inline background input had become `#abcdef`. All four installed Web Adapters reproduced that first divergence. A second case rejected the latest competing request and measured the retained Shadcn surface with `#654321` instead of `#123456` after rejection.

The source cause was `update()` writing the next theme to every entry in the generation surface map before asking the scope controller to replace the family. Consequently, loader failure could retain the old family identity without its matching theme. These are measured DOM identity and explicit theme-input facts; they are not browser-paint or screenshot evidence.

Each materialization now captures a copy of the request's theme before its first asynchronous load. The hidden candidate is rendered with that captured theme, and the existing scope activation/publication transaction makes the candidate family and theme available together. Failed and stale candidates cannot recolor the retained surface. A same-family update still writes synchronously, but only to the committed generation's surface. No theme is broadcast to pending or retired candidates.

## Executable evidence

Environment: Node `24.19.0`, pnpm `10.32.1`, Vitest `2.1.9`, Happy DOM, one worker. The tests run actual public SurfaceRoot Prototypes and WC/React/Vue/Vue2 Adapters. Installed frameworks replace the Website's CDN loaders; a pass-through public Prototype-loader mock injects only bounded delays or failures. The content is a borrowed native input with observable identity and uncontrolled value. No mocked shell or fake Adapter substitutes for the implementation.

Before the production edit, the new suite produced **7 failures / 5 passes**. All failing assertions concerned the incorrect retained theme, not startup, imports or selectors. The same assertions passed unchanged after the correction: **12 / 12**.

Coverage includes:

- Pending and rejected family changes, followed by successful retry, across all four Web Adapters.
- Immediate same-family theme updates without extra loads, remounting, content movement or focus loss across all four Adapters.
- A late stale success after the latest different-family request failed.
- Two pending requests for the same target family, completing newest first.
- Returning to the committed family while another family is pending.
- Synchronous LightDOM return on destroy, no post-destroy publication and eventual shell cleanup.

The expanded command passed **114 tests across all 6 explicitly selected files**:

```sh
COREPACK_HOME=/tmp/corepack corepack pnpm@10.32.1 exec vitest run \
  apps/www/src/components/PrototypePreviewer/passive-shell-composition.test.ts \
  apps/www/src/components/PrototypePreviewer/runtime-preview-surface.test.ts \
  apps/www/src/components/PrototypePreviewer/projected-previewer-shell.integration.test.ts \
  apps/www/src/components/PrototypePreviewer/projection-scope.test.ts \
  apps/www/src/components/PrototypePreviewer/projection-theme.test.ts \
  apps/www/src/components/PrototypePreviewer/native-content-lease.test.ts \
  --maxWorkers=1 --minWorkers=1
```

The 30 RuntimeBox tests and 20 real-caller integration tests cover the unchanged downstream shell consumers; scope, theme and native-content suites cover the underlying transaction and lease boundaries. This is scoped executable evidence, not a claim that the entire repository or hosted browser suite passed.

`check:types` passed the workspace TypeScript stage. Its first docs attempt stopped before diagnostics because Astro telemetry could not create its default home config directory. A bounded retry with task-local `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` and `ASTRO_TELEMETRY_DISABLED=1` checked 393 files. It reported one error in the concurrently edited `Homepage/homepage-runtime-client.ts:127`: an icon placeholder's `tag` widened to `string` instead of the allowed literal union. No passive-shell diagnostic was reported. That independent hero-slice error was handed to its owner and corrected there. A final identical docs check passed over the combined worktree: **393 files, 0 errors, 0 warnings, 3 hints**. Formatting and the production diff whitespace check passed for this slice.

## Remaining evidence and handoff

The source-bound state walkthrough above and executable red/green evidence establish the bounded transaction correction. Hosted-browser paint/captures, independent final-diff review, exact published-head CI and per-commit PR evidence remain separate parent-owned work. No old screenshot is presented as evidence of this candidate, and this slice performed no GitHub mutation.

Co-author by OpenAI Dots
