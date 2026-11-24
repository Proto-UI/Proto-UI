import { traceCallableDemand } from './callable-effects';
import type { CompilerDiagnostic, ExpressionIR, PrototypeIR } from './ir';

/** A direct emitter must enforce the same new module boundary as its registry
 * path. An operation name's generic spelling is not a native implementation. */
export function unsupportedLifecycleModules(ir: PrototypeIR, target: string): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const seen = new Set<ExpressionIR>();
  let opaque = false;
  function expression(value: ExpressionIR): void {
    if (seen.has(value)) return;
    seen.add(value);
    if (
      (value.kind === 'member' && value.type === 'run-lifecycle') ||
      (value.kind === 'operation' && value.operation === 'lifecycle.setPresentFromModule')
    )
      diagnostics.push({
        code: 'PUI4003',
        category: 'unsupported-input',
        message: `First-class lifecycle modules are not lowered by ${target}.`,
        span: value.span,
      });
  }
  traceCallableDemand(ir, {
    expression,
    function() {},
    hook() {},
    opaque() {
      opaque = true;
    },
  });
  if (opaque) {
    // Unclosed or recursive call provenance cannot establish that a new module
    // is absent. Keep the same conservative closure as target admission.
    function retain(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) return value.forEach(retain);
      const node = value as Record<string, unknown>;
      if (typeof node.kind === 'string' && node.span && node.type !== undefined)
        expression(value as ExpressionIR);
      for (const [key, child] of Object.entries(node))
        if (!['type', 'span', 'captures', 'capture'].includes(key)) retain(child);
    }
    retain(ir.moduleBindings);
    retain(ir.setup);
    ir.hooks.forEach((hook) => {
      retain(hook.setup);
      retain(hook.projectHandle);
      retain(hook.configure);
    });
  }
  return diagnostics;
}
