import type { PrototypeIR } from './ir';

type ModuleBinding = NonNullable<PrototypeIR['moduleBindings']>[number];

/** Semantic helpers close over the current generated owner; scalar module cells do not. */
export function partitionModuleBindings(ir: PrototypeIR): {
  shared: ModuleBinding[];
  owned: ModuleBinding[];
} {
  const bindings = ir.moduleBindings ?? [];
  const owned = new Set<string>();
  const dependencies = new Map<string, Set<string>>();
  for (const binding of bindings) {
    if (binding.value.kind !== 'function') continue;
    const calls = new Set<string>();
    function visit(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      const node = value as Record<string, unknown>;
      if (node.kind === 'operation' || node.kind === 'authored-hook') owned.add(binding.name);
      if ((node.kind === 'helper-call' || node.kind === 'reference') && typeof node.name === 'string')
        calls.add(node.name);
      for (const [key, child] of Object.entries(node))
        if (key !== 'type' && key !== 'span') visit(child);
    }
    visit(binding.value.function.body);
    dependencies.set(binding.name, calls);
  }
  let changed: boolean;
  do {
    changed = false;
    for (const [name, calls] of dependencies) {
      if (!owned.has(name) && [...calls].some((name) => owned.has(name))) {
        owned.add(name);
        changed = true;
      }
    }
  } while (changed);
  return {
    shared: bindings.filter((binding) => !owned.has(binding.name)),
    owned: bindings.filter((binding) => owned.has(binding.name)),
  };
}
