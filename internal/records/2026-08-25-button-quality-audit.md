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
| Package | Base `./button` | exported | `@proto.ui/prototypes-base/button` — types + import + default |
| Package | Shadcn `./button` | exported | `@proto.ui/prototypes-shadcn/button` — types + import + default |
| Package | Brutalist `./button` | exported | `@proto.ui/prototypes-brutalist/button` — types + import + default |
| Build | All packages | 41/41 | `build:packages` complete |
| CLI | base-button | registered + smoke-tested | `packages/cli/src/registry/components.ts:654`; exercised in React add path in release consumer smoke |
| CLI | shadcn-button | registered + smoke-tested | `packages/cli/src/registry/components.ts:212`; exercised in release consumer smoke |
| CLI | brutalist-button | registered | `packages/cli/src/registry/components.ts:414`; not in release consumer smoke RELEASE_ROOTS |
| Docs | Button demos | 12 demo files + 3 demo scripts | `demo_components/button/` (12 files), `demo-base-button.demo.ts`, `demo-shadcn-button.demo.ts`, `demo-brutalist-button.demo.ts` |
| Docs | Button pages | 6 pages | Base/Shadcn/Brutalist button.mdx in en + zh-cn |
| Consumer | Release smoke | Base + Shadcn only | `scripts/release/consumer-smoke-cli.mjs` installs packed artifacts for Base and Shadcn; Brutalist is not in RELEASE_ROOTS |
| Types | Workspace | clean | 0 errors / 0 warnings / 0 hints |

## Gaps found

1. **No dedicated browser journey for Base Button.** The Brutalist browser journey exercises Button in WC/React/Vue but through the Brutalist projection, not the Base prototype directly. A Base-level browser journey would prove the semantic owner's adapter parity independently of any design-language projection.
2. **No automated WCAG contrast-ratio test for Button.** The Brutalist Button uses `bg-main`/`text-main-foreground` and the Shadcn Button uses `bg-primary`/`text-primary-foreground` but no automated contrast-ratio test exists in the test suite (manual contrast was measured and retained in P-SHADCN-BUTTON from #454).

## Conclusion

The Button vertical is well-covered across spec, source, unit tests, package exports, CLI registry (including smoke tests), consumer verification, browser journeys, and docs. The two remaining gaps are: (1) Base-level browser journey (no dedicated Base Button browser test), (2) automated WCAG contrast-ratio test (manual contrast was measured and retained in P-SHADCN-BUTTON from #454; only the automated test is missing). None are semantic defects.
