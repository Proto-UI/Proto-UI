# Collapsible four-family source increment

## Scope and source

Finf #872, independent topic based on `297accc027e60aac546a1782f374d55112798e69`. The Finf integration owner retains the sole PR/ref and coverage-checklist write boundary. This is a source increment toward the requested complete delivery, not completion of Liquid Glass optics, GPUI/native parity, visual acceptance or stable admission.

The existing draft `P-BASE-COLLAPSIBLE`, `P-BASE-COLLAPSIBLE-TRIGGER` and `P-BASE-COLLAPSIBLE-CONTENT` remain the semantic authority. Each of Shadcn, Brutalist, Bootstrap 2.3.2 and Liquid Glass adds exactly three direct prototypes which invoke its matching `asCollapsible*` hook. No Button, Toggle, Accordion or Overlay protocol is composed into those parts. Root alone owns expansion; Trigger derives interaction/focus state; Content retains Base L1/keepMounted semantics and remains role-neutral.

## Delivered source

- Twelve direct prototypes, corresponding type aliases and package root/subpath exports, with one P entity per part and `T-COLLAPSIBLE-PROJECTIONS-0001`.
- Four Web-host facade entries. Bootstrap and Liquid remain private source-only; installed-consumer generation rejects them before attempting installation.
- Eight new bilingual documents, four real DemoSpecs, exact projection manifests and lazy module loaders. Existing human index prose is preserved; only a link is appended. The controlled acceptance action uses the same family's existing Button separately from the disclosure Trigger.
- Four real Adapter drivers exercise each projection's actual setup, keeping the existing Base controls. Direct-entry tests independently mount the exported prototypes, rather than replacing their presentation with Base defaults.
- Twelve GPUI peer/ScriptedHost checks carry real three-part parent composition, controlled/disabled facts and retained/detached view epochs. These do not run the Rust host and are not native rendering evidence.
- Registered native-browser journeys: 16 family/runtime input and lifetime journeys, 16 family/runtime 320px/200%-type journeys covering light/dark, and four Chinese narrow pages. A dedicated exact-head read-only CI workflow records screenshots and source SHA. These journeys have not run locally.

## Design and dependency decisions

The pinned Shadcn Collapsible at `f31ed81983653919dd4fe77aee4b4859f610f1dc` (`apps/v4/registry/new-york-v4/ui/collapsible.tsx`) and Neobrutalism Collapsible at `3306a802724874a85f93079702b2795370a279d4` (`src/components/ui/collapsible.tsx`) are unstyled wrappers. The safe host spacing, focus treatment and family surfaces here are declared Proto UI presentation deltas, not copied upstream semantics or an upstream implementation dependency. Existing MIT attribution stays intact.

Bootstrap specifically references v2.3.2 `less/accordion.less`: 4px group corners, 8px/15px trigger spacing and 9px/15px inner spacing with a 1px top border. The reference's jQuery behavior, Accordion grouping and height animation are not imported. The existing Apache 2.0 notice receives an additive Collapsible entry. The only shared CSS translator extension is finite `border-t`, symmetric with existing `border-b`; no semantic Module or Host Capability is added.

Long labels use existing `whitespace-pre-wrap` and `wrap-anywhere` lowering, `min-w-0`/`max-w-full`, scalable padding and no fixed content height. Brutalist reuses its established color-pair, hard-shadow, translation and hit-envelope vocabulary. Surrounding DemoSpec padding preserves ring/shadow space.

Liquid is currently an opaque functional presentation. Its shared material owner has not yet supplied the final typed self-optical/adaptive-native interface. Trigger is the candidate material control and already exposes Base pressed and disabled handles. Root and long-form Content are not assigned a second pressed state or forced into a refractive layer. Explicit Liquid Glass must use the self-implemented optical model; native blur cannot silently replace it. No component-private material flag or unsupported full-material claim is added.

## Verification and retained failures

- First red: absent four-family modules/exports/CLI entries, eight failing compiler tests and an unresolved direct-entry suite. This establishes the actual gap.
- First implementation red: unsupported `break-words`/`whitespace-normal`, then Bootstrap `border-t`. Reused existing supported wrapping tokens and added the bounded top-border lowering rather than suppressing compiler diagnostics.
- Projection conformance red: a slash in a test-only generated custom-element name made the WC driver invalid; canonicalized the fixture prefix. Product code was not changed for that harness failure.
- GPUI test red: the fixture initially read a nonexistent `expose.event` wire kind, then observed view epochs before async reconciliation. It now uses actual `expose.signal` and waits for the peer reconciliation microtasks. No shared peer or Rust behavior was weakened.
- Final focused run: 202/202 across 11 files: Base 24; four real Web Adapter drivers 25 each (five Base plus five per projection); GPUI peer 12; direct presentation 8; Collapsible compiler 10; shared CSS 27; projection manifest 17; actual DemoSpec loading 4. Synthetic DOM, source and protocol-model results are explicitly distinct from native browser input/paint.
- Workspace TypeScript passed. Astro check passed 508 files with zero errors, zero warnings and six existing hints. The initial Astro invocation failed because its default config directory was absent; retry used a writable XDG config directory and disabled telemetry. Its preceding CLI build and website style generation succeeded.
- Public build completed the 15-package dependency graph for Shadcn and Brutalist. Built JS imports resolved all six public entries; workspace-source imports resolved all six private entries. Local `pnpm pack` archives for the two public packages contain each Collapsible JS/declaration entry and third-party notice. Prepack was explicitly disabled only after the successful build; no registry request or publication ran. Bootstrap and Liquid were not packed/published.
- Public docs check passed: 129 bilingual primary routes. Spec lifecycle authoring passed all 13 new catalog inputs. Package manifests and all four style/token generators passed their check modes. Runtime browser-plan controls: 121/121.
- Prototype catalog on the topic's original base reports only three pre-existing `T-AVAILABLE-SPACE-0001` exercises omissions for Dialog Content. The integration owner independently fixed those in `8c3133a6690ed1daf0307f5631d0edac2d493027`; this topic does not duplicate that edit or claim its baseline check passed.

## Remaining acceptance

The integration owner must bind the delivered source to the final combined Finf candidate and rerun canonical budgets, all aggregate checks and trusted exact-head CI. Native browser journeys/screenshots, complete visual comparison, applicable optical material integration, Rust/GPUI execution, assistive-technology checks and independent acceptance remain open. Local Chrome socket constraints are not a reason to substitute old images or synthetic screenshots. All new entities remain draft; no release/publish permissions, protection rules or npm registry state changed.

## Post-freeze typography and scalable-padding correction

A source self-review after `e38cde13a4fb17d32b0e9cc12a0845428832cbd1` found that Brutalist Root/Content did not carry the family's existing sans/medium typography and Bootstrap's literal 15px/9px spacing did not scale with text size. A two-case red demonstrated both omissions. The correction adds existing `font-sans font-medium` tokens and expresses the Bootstrap reference values as `0.9375rem`/`0.5625rem` at a 16px root size. It does not change Base semantics or make a native paint claim. The focused direct/compiler/peer rerun passed 30/30; the generated token manifests, docs and notice were reconciled. Earlier build and package archives remain evidence for the earlier source and require refreshed final-source artifacts; no historical pass is rewritten.

## Per-item source-bound state comparison evidence

The native suite now produces a JSON sidecar alongside each actual public component screenshot. It records the checkout SHA, runtime, viewport, theme, root text size, actual part rectangles/padding/ARIA/presence and passively observed native input events with their `isTrusted` values. Captures include initial closed/retained/disabled states, pointer-open, keyboard-focus closed/open, controlled acceptance and 320px/200%-type light/dark states. These are explicitly state comparisons of a new component, never invented screenshots of a nonexistent old implementation. Liquid capture metadata continues to label the opaque intermediate scope. The exact-head CI artifact can be reported as each bounded item completes, without waiting for the entire Finf portfolio. No native run or new screenshot is claimed by merely registering this evidence output.
