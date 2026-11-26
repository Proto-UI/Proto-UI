# Internal compiler documentation

This directory holds the private compiler's engineering direction, source-language admission contract, and generated website demo inventories.

## Scope & Limits

- These documents describe the private compiler under `packages/compiler/**`; they do not promote any `spec/**` lifecycle status or claim public TypeScript/host certification.
- Generated inventories (`website-demo-migrations.json`, `browser-demo-delivery.json`) are machine-produced snapshots; update them through their scripts under `scripts/compiler/**`, never by hand.

## Directory map

| File | Role | Audience |
| --- | --- | --- |
| [atomic-lowering-completion.md](atomic-lowering-completion.md) | Thin-compiler completion standard: direct native lowering via compile-time IR without shipping an IR interpreter or second framework runtime. | Compiler & prototype engineers |
| [source-language.md](source-language.md) | Index and core contract for the closed source-language subset admitted by the compiler frontend and portable IR validator. | Compiler engineers |
| [language/](language/README.md) | Topic-scoped source-language admission specs (bindings/types, intrinsics/data, functions/hooks, targets/presentation). | Compiler engineers |
| [website-demo-migrations.json](website-demo-migrations.json) | Generated compact inventory of `apps/www` demo pages, declarations, and prototype admission status (`scripts/compiler/website-demo-inventory.mjs`). | Tooling & CI |
| [browser-demo-delivery.json](browser-demo-delivery.json) | Generated browser execution overlay bound to `website-demo-migrations.json` (`scripts/compiler/browser-delivery-index.mjs`). | Tooling & CI |

## Verification

```sh
node --test scripts/compiler/website-demo-inventory.test.mjs scripts/compiler/browser-delivery-index.test.mjs
```
