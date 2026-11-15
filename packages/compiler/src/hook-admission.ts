import type { SemanticOperation } from './operations';

type HookOperation = Extract<SemanticOperation, `hook.${string}`>;

type HookAdmission =
  | { readonly status: 'admitted'; readonly operation: HookOperation }
  | { readonly status: 'unsupported'; readonly reason: string };

/**
 * One compile-time disposition for each public asHook. Import validation and
 * operation lowering consume the same table; admission is not an implementation
 * of an otherwise unsupported capability or a claim of target conformance.
 */
export const HOOK_ADMISSION = {
  asTrigger: { status: 'admitted', operation: 'hook.asTrigger' },
  asFocusable: { status: 'admitted', operation: 'hook.asFocusable' },
  asAccessible: { status: 'admitted', operation: 'hook.asAccessible' },
  asFocusEntry: { status: 'admitted', operation: 'hook.asFocusEntry' },
  asFocusScope: { status: 'admitted', operation: 'hook.asFocusScope' },
  asFocusRoving: { status: 'admitted', operation: 'hook.asFocusRoving' },
  asOverlay: { status: 'admitted', operation: 'hook.asOverlay' },
  asScrollSurface: { status: 'admitted', operation: 'hook.asScrollSurface' },
  asTextControl: { status: 'admitted', operation: 'hook.asTextControl' },
  asImageView: { status: 'admitted', operation: 'hook.asImageView' },
  asTableStructure: { status: 'admitted', operation: 'hook.asTableStructure' },
  asBoundary: { status: 'admitted', operation: 'hook.asBoundary' },
  asHitParticipation: { status: 'admitted', operation: 'hook.asHitParticipation' },
  asCollection: { status: 'admitted', operation: 'hook.asCollection' },
  asCollectionItem: { status: 'admitted', operation: 'hook.asCollectionItem' },
  asControlLabel: {
    status: 'unsupported',
    reason: 'Control Label association and activation lowering is not implemented.',
  },
  asAxisInput: {
    status: 'unsupported',
    reason: 'Axis Input capability lowering is not implemented.',
  },
  asContextMenuInput: {
    status: 'unsupported',
    reason: 'Context Menu Input capability lowering is not implemented.',
  },
  asNativeLink: {
    status: 'unsupported',
    reason: 'Native Link capability lowering is not implemented.',
  },
} as const satisfies Readonly<Record<string, HookAdmission>>;

export function hookAdmission(name: string): HookAdmission | undefined {
  return Object.hasOwn(HOOK_ADMISSION, name)
    ? HOOK_ADMISSION[name as keyof typeof HOOK_ADMISSION]
    : undefined;
}

export function admittedHookOperation(name: string): HookOperation | undefined {
  const admission = hookAdmission(name);
  return admission?.status === 'admitted' ? admission.operation : undefined;
}
