import type { SourceSpan, ValueType } from '../component-ir.ts';

const categories = {
  'ir-shape': 'invalid-ir',
  'duplicate-binding': 'invalid-ir',
  'duplicate-name': 'invalid-ir',
  'unknown-binding': 'invalid-ir',
  'type-mismatch': 'invalid-ir',
  'wrong-arity': 'invalid-ir',
  'invalid-phase': 'invalid-ir',
  'dependency-missing': 'invalid-ir',
  'invalid-text': 'source-invalid',
  'illegal-effect': 'source-invalid',
  'derived-cycle': 'source-invalid',
  'initialization-order': 'source-invalid',
  'cyclic-cfg': 'backend-missing',
  'recursive-helper': 'backend-missing',
  'failing-value': 'backend-missing',
  'action-result': 'backend-missing',
  'interactive-text': 'backend-missing',
  'host-name': 'backend-missing',
} as const;

type DiagnosticCode = keyof typeof categories;

export class ComponentIRDiagnostic extends Error {
  readonly #detail: string;
  readonly code: DiagnosticCode;
  readonly category: (typeof categories)[DiagnosticCode];
  readonly source: SourceSpan | undefined;
  readonly bindings: readonly string[];

  constructor(
    code: DiagnosticCode,
    source: SourceSpan | undefined,
    detail: string,
    bindings: readonly string[] = []
  ) {
    const location = source ? `${source.file}:${source.start}-${source.end}: ` : '';
    super(`${location}${detail}`);
    this.name = 'ComponentIRDiagnostic';
    this.#detail = detail;
    this.category = categories[code];
    this.code = code;
    this.source = source;
    this.bindings = bindings;
  }

  withCallPath(path: readonly string[]): ComponentIRDiagnostic {
    const calls = path.map((binding) => JSON.stringify(binding)).join(' -> ');
    return new ComponentIRDiagnostic(this.code, this.source, `${this.#detail} Call chain ${calls}.`, [
      ...path.slice(0, -1), ...this.bindings,
    ]);
  }
}

export function reject(
  code: DiagnosticCode,
  source: SourceSpan | undefined,
  detail: string,
  bindings?: readonly string[]
): never {
  throw new ComponentIRDiagnostic(code, source, detail, bindings);
}

export function unsupportedHostName(
  target: 'react' | 'gpui',
  name: string,
  source: SourceSpan,
  constraint: string,
  bindings: readonly string[] = [name]
): never {
  return reject('host-name', source, `${target} cannot expose ${JSON.stringify(name)}. ${constraint}`, bindings);
}

export function requireType(
  actual: ValueType,
  expected: ValueType,
  label: string,
  source: SourceSpan,
  bindings: readonly string[]
): void {
  if (actual !== expected) {
    reject('type-mismatch', source, `${label} requires ${expected}, received ${actual}. Supply a value of the declared type.`, bindings);
  }
}
