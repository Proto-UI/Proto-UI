import type { ModuleIR, PrototypeIR, SsaFunction } from './types';

/** Diagnostic serialization of typed IR. Target source is printed by target SDKs. */
function printIR(value: unknown): string {
  return (
    JSON.stringify(
      value,
      (_key, field: unknown) => {
        if (typeof field === 'bigint') return { $bigint: field.toString() };
        if (typeof field === 'number') {
          if (Object.is(field, -0)) return { $number: '-0' };
          if (!Number.isFinite(field)) return { $number: String(field) };
        }
        return field;
      },
      2
    ) + '\n'
  );
}

export function printSsaFunction(fn: SsaFunction): string {
  return printIR(fn);
}
export function printPrototypeIR(proto: PrototypeIR): string {
  return printIR(proto);
}
export function printModuleIR(module: ModuleIR): string {
  return printIR(module);
}
