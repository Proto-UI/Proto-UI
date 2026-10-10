# Finf Brutalist Separator contentless repair

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and authority

This PR #872 successor starts at `c2cbb8d6fce71e949f84f0358189184783505989`. `P-BASE-SEPARATOR-CONTENTLESS` requires no descendant content and `P-BRUTALIST-SEPARATOR-BASE-INHERITANCE` retains the Base protocol. Both remain draft. This fixes the caller Prototype renderer only; it changes no definition, Compiler, CLI, module, host, family geometry, or lifecycle.

## Failure and repair

`asSeparatorRoot()` supplies the Base setup but does not install the caller's renderer. The Brutalist caller previously returned no renderer, so the default slot retained an authored button even with `aria-hidden=true`. Base, Shadcn, and Bootstrap already explicitly return a null renderer. Brutalist now does the same.

The regression mounts a real authored button in each decorative mode, checks that the original child is disconnected and the control has no descendants or interaction surface, changes decorative/orientation props live, and reconnects the same separator and button twice. The unchanged implementation failed both new cases for the intended reason: one button remained instead of zero children. The original two cases still passed.

## Validation and limits

Node 24.19.0, pnpm 10.32.1, Vitest 2.1.9. Run at 2026-10-10 10:00 UTC, with one worker:

- Before: Brutalist Separator 2 passed / 2 failed.
- After: `packages/prototypes/{base,shadcn,brutalist}/test/separator.test.ts`, 3 files / 14 tests passed.
- These are actual Web Component runtime / happy-dom observations, not a real-browser visual or native input result. No new browser screenshot was captured; visual evidence remains pending.
- No Full delivery checkbox, lifecycle promotion, packed consumer, trusted CI, public push, or PR comment is claimed.
