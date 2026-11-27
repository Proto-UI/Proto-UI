import type { ExternIR, SourceSpan } from './component-ir.ts';
import { reject } from './validation/diagnostic.ts';

interface TargetBinding {
  react: { readonly module: string; readonly export: string };
  gpui: { readonly path: string };
}

const requiredFields = { react: ['module', 'export'], gpui: ['path'] } as const;

type BindingTable<Target extends keyof TargetBinding> = Readonly<
  Record<string, TargetBinding[Target]>
>;
export type ReactExternBindings = BindingTable<'react'>;
export type GpuiExternBindings = BindingTable<'gpui'>;

/** Resolve a reached extern by its declared public name in the selected target's table. */
export function requireExternBinding<Target extends keyof TargetBinding>(
  external: ExternIR,
  target: Target,
  bindings: BindingTable<NoInfer<Target>> | undefined,
  source: SourceSpan,
  callPath: readonly string[]
): TargetBinding[Target] {
  if (!external.targets.includes(target)) {
    return reject(
      'extern-unbound',
      source,
      `Extern ${JSON.stringify(external.name)} does not declare the ${target} target. Select a declared target or add a supported binding to the declaration and host.`,
      callPath
    );
  }
  const binding =
    bindings && Object.hasOwn(bindings, external.name) ? bindings[external.name] : undefined;
  const fields = requiredFields[target];
  if (
    binding == null ||
    typeof binding !== 'object' ||
    Array.isArray(binding) ||
    !fields.every((field) => typeof Reflect.get(binding, field) === 'string')
  ) {
    return reject(
      'extern-unbound',
      source,
      `Register extern ${JSON.stringify(external.name)} in the ${target} host binding table with string fields ${fields.join(', ')}.`,
      callPath
    );
  }
  return binding;
}
