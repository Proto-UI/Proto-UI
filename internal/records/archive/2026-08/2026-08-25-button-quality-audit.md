# Button quality audit — 2026-08-25

Non-normative record. Refs #505. This record is a non-normative audit authorized by the maintainer checkpoint at #503 issuecomment-5420062799. Does not create a stable spec guarantee, public API, release gate, or package change.

## Baseline

- `main` commit: `24cfabbe8a9c`
- Node: v22.23.1
- pnpm: 10.32.1 (via corepack)
- `check:types`: 0 errors / 0 warnings / 0 hints (168 files)
- `build:packages`: 41/41 public packages

## Audit scope

Vertical: Base Button → Shadcn Button → Brutalist Button → Web Component / React / Vue adapters → public package subpaths → CLI registry → docs/demos → tests → styles/tokens.

## Evidence matrix

| Layer | Entity | Status | Evidence |
| --- | --- | --- | --- |
| Spec | P-BASE-BUTTON | draft | `spec/prototypes/P-BASE-BUTTON.yaml` |
| Spec | P-SHADCN-BUTTON | draft | `spec/prototypes/P-SHADCN-BUTTON.yaml` |
| Spec | P-BRUTALIST-BUTTON | draft | `spec/prototypes/P-BRUTALIST-BUTTON.yaml` |
| Test | T-BASE-BUTTON-0001 | draft | `spec/tests/T-BASE-BUTTON-0001.yaml` |
| Test | T-SHADCN-BUTTON-0001 | draft | `spec/tests/T-SHADCN-BUTTON-0001.yaml` |
| Test | T-BRUTALIST-BUTTON-0001 | draft | `spec/tests/T-BRUTALIST-BUTTON-0001.yaml` |
| Source | Base Button | passing | `packages/prototypes/base/src/button/` (button.proto.ts, types.ts, index.ts) |
| Source | Shadcn Button | passing | `packages/prototypes/shadcn/src/button/` (button.proto.ts, types.ts, index.ts) |
| Source | Brutalist Button | passing | `packages/prototypes/brutalist/src/button/` (button.proto.ts, types.ts, index.ts) |
| Unit | Base Button | 3/3 | `packages/prototypes/base/test/as-button.test.ts` |
| Unit | Shadcn Button | 3/3 | `packages/prototypes/shadcn/test/button.test.ts` |
| Unit | Brutalist Button | 11/11 | `packages/prototypes/brutalist/test/button.test.ts` + `button-live-theme.test.ts` |
| Adapter | Base Button | WC + React + Vue verified | `packages/adapters/web-component/test/focus.test.ts`, `packages/adapters/react/test/focus.test.ts`, and `packages/adapters/vue/test/focus.test.ts` exercise `asButton()` focus/expose behavior at the recorded baseline |
| Adapter | Shadcn Button | WC + React + Vue packed-consumer verified | `scripts/release/consumer-smoke-cli.mjs` installs packed artifacts, adds `shadcn-button` for all three adapters, type-checks the generated consumer, and renders each adapter fixture |
| Adapter | Brutalist Button | WC live-theme + composed-dialog runtime + React/Vue/WC CLI codegen verified; React/Vue runtime and packed-consumer gaps | `packages/prototypes/brutalist/test/button-live-theme.test.ts` mounts `brutalistButton` through `AdaptToWebComponent`; `packages/prototypes/brutalist/test/dialog.test.ts` mounts the Button as a Web Component and proves role, tab stop, visual tokens, activation, and Dialog dismissal; `packages/cli/test/cli.test.ts` renders the complete registered Brutalist facade inventory for React, Vue, and WC and separately exercises the React `brutalist-button` add path; no equivalent React/Vue runtime-execution case or installed packed-artifact consumer smoke is present |
| Package | Base `./button` | exported | `@proto.ui/prototypes-base/button` — types + import + default |
| Package | Shadcn `./button` | exported | `@proto.ui/prototypes-shadcn/button` — types + import + default |
| Package | Brutalist `./button` | exported | `@proto.ui/prototypes-brutalist/button` — types + import + default |
| Build | All packages | 41/41 | `build:packages` complete |
| CLI | base-button | registered + smoke-tested | `packages/cli/src/registry/components.ts:654`; exercised in React add path in release consumer smoke |
| CLI | shadcn-button | registered + smoke-tested | `packages/cli/src/registry/components.ts:212`; exercised in release consumer smoke |
| CLI | brutalist-button | registered | `packages/cli/src/registry/components.ts:414`; not in release consumer smoke RELEASE_ROOTS |
| Docs | Button demos | 12 files (11 demos + 1 code map) + 3 standalone demo scripts | `apps/www/src/content/docs/demo_components/button/` (12 files), `apps/www/src/content/docs/zh-cn/demo-base-button.demo.ts`, `apps/www/src/content/docs/zh-cn/demo-shadcn-button.demo.ts`, `apps/www/src/content/docs/zh-cn/demo-brutalist-button.demo.ts` |
| Docs | Button pages | 6 pages | Base/Shadcn/Brutalist button.mdx in en + zh-cn |
| Consumer | Installed packed-artifact release smoke | Base React + Shadcn WC/React/Vue only | `scripts/release/consumer-smoke-cli.mjs` installs packed artifacts for Base and Shadcn; Brutalist is not in `RELEASE_ROOTS`. This is narrower than workspace CLI tests, which already generate a React Brutalist consumer facade. |
| Types | Workspace | clean | 0 errors / 0 warnings / 0 hints |

## Gaps found

1. **No dedicated Button browser journey for any surface.** No dedicated Button browser journey exists for Base, Shadcn, or Brutalist. The existing `demo-brutalist-controls.browser.test.ts` covers Switch, Tabs, Scroll Area, Textarea, and Dropdown, but not Button. A Button browser journey would prove the visual grammar, interaction states, and adapter parity across WC/React/Vue.
2. **No installed packed-artifact release consumer verification for Brutalist.** Brutalist Button is not in release consumer smoke `RELEASE_ROOTS`. This does not erase the existing workspace consumer evidence: `packages/cli/test/cli.test.ts` renders the complete React/Vue/WC Brutalist facade inventory, separately runs `add react brutalist-button`, and checks the generated facade; `packages/prototypes/brutalist/test/dialog.test.ts` provides composed WC activation/dismissal evidence; and `build:packages` validates the Brutalist export targets. The remaining gap is specifically installation and execution from packed release artifacts plus React/Vue runtime execution; WC already has both live-theme and composed-dialog runtime evidence, and cross-adapter CLI codegen is covered.
3. **No automated WCAG contrast-ratio test for Button foreground/background pairs.** `packages/prototypes/brutalist/test/theme.test.ts` already verifies that the shared Brutalist focus ring used by Button reaches at least 3:1 against page and panel backgrounds. The remaining gap is the Button text/surface pairs: Brutalist uses `bg-main`/`text-main-foreground`, and Shadcn uses `bg-primary`/`text-primary-foreground`, but those pairs have no automated ratio assertion (manual Shadcn contrast was measured and retained in P-SHADCN-BUTTON from #454).
4. **Cataloged Shadcn parity gaps remain outside the current passing subset.** `P-SHADCN-BUTTON-Q-UPSTREAM-DIFFERENCES` and `packages/prototypes/shadcn/src/button/button.proto.ts` retain native/className forwarding, aria-invalid styling, nested-SVG sizing, `xs`/`icon-xs`/`icon-sm`/`icon-lg` sizes, and exact size/visual-token parity as implementation or review gaps. This audit inventories them because styles/tokens are in scope; it does not promote them into current guarantees.

## Conclusion

The audited Button vertical has evidence across spec, source, unit tests, package exports, CLI registry, adapter paths, and docs, but the evidence is not uniform across prototype families or adapters. Four gap groups remain in this audit scope: (1) no dedicated Button browser journey for Base, Shadcn, or Brutalist; (2) no installed packed-artifact release consumer verification for Brutalist and no React/Vue runtime execution, despite existing React/Vue/WC CLI codegen plus WC live-theme and composed-dialog evidence; (3) no automated WCAG ratio assertion for the Button foreground/background pairs, while the shared Brutalist focus-ring contrast is already covered; and (4) the cataloged Shadcn compatibility gaps listed above. These are baseline coverage or compatibility gaps, not newly discovered semantic defects.
