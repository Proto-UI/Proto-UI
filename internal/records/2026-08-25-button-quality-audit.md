# Button quality audit — 2026-08-25

Non-normative record. Authorized by #505. Does not create a stable spec guarantee, public API, release gate, or package change.

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
| Spec | P-BASE-BUTTON | active | `spec/prototypes/P-BASE-BUTTON.yaml` |
| Spec | P-SHADCN-BUTTON | active | `spec/prototypes/P-SHADCN-BUTTON.yaml` |
| Spec | P-BRUTALIST-BUTTON | active | `spec/prototypes/P-BRUTALIST-BUTTON.yaml` |
| Test | T-BASE-BUTTON-0001 | active | `spec/tests/T-BASE-BUTTON-0001.yaml` |
| Test | T-SHADCN-BUTTON-0001 | active | `spec/tests/T-SHADCN-BUTTON-0001.yaml` |
| Test | T-BRUTALIST-BUTTON-0001 | active | `spec/tests/T-BRUTALIST-BUTTON-0001.yaml` |
| Source | Base Button | passing | `packages/prototypes/base/src/button/` (button.proto.ts, types.ts, index.ts) |
| Source | Shadcn Button | passing | `packages/prototypes/shadcn/src/button/` (button.proto.ts, types.ts, index.ts) |
| Source | Brutalist Button | passing | `packages/prototypes/brutalist/src/button/` (button.proto.ts, types.ts, index.ts) |
| Unit | Base Button | 3/3 | `packages/prototypes/base/test/as-button.test.ts` |
| Unit | Shadcn Button | 3/3 | `packages/prototypes/shadcn/test/button.test.ts` |
| Unit | Brutalist Button | 11/11 | `packages/prototypes/brutalist/test/button.test.ts` + `button-live-theme.test.ts` |
| Package | Base `./button` | exported | `@proto.ui/prototypes-base/button` — types + import + default |
| Package | Shadcn `./button` | exported | `@proto.ui/prototypes-shadcn/button` — types + import + default |
| Build | All packages | 41/41 | `build:packages` complete |
| CLI | shadcn-button | registered | `packages/cli/src/registry/components.ts:212` |
| CLI | brutalist-button | registered | `packages/cli/src/registry/components.ts:414` |
| Docs | Button demos | present | 5 demo files in `apps/www/src/content/docs/demo_components/button/` |
| Types | Workspace | clean | 0 errors / 0 warnings / 0 hints |

## Gaps found

1. **Base button package export not independently verified.** The `@proto.ui/prototypes-base/button` export path is declared in `package.json` but no built-consumer test imports the built `dist/button/index.js` to verify the exact export names. A future omission could remain green.
2. **No browser journey for Base Button.** Shadcn and Brutalist have browser/journey tests; Base Button only has unit tests. A Base-level browser journey would prove WC/React/Vue rendering parity for the semantic owner.
3. **CLI smoke test does not cover `proto-ui add shadcn-button`.** The CLI registry entry exists but the smoke test does not exercise the Button add path specifically.
4. **No WCAG contrast evidence for Button.** The Brutalist Button uses `bg-main`/`text-main-foreground` and the Shadcn Button uses `bg-primary`/`text-primary-foreground` but no automated contrast ratio evidence exists in the test suite.

## Conclusion

The Button vertical is well-covered across spec, source, unit tests, package exports, CLI, and docs. The four gaps are evidence-boundary issues, not semantic defects. Addressing them would strengthen the quality model but does not block the current Button guarantee.
