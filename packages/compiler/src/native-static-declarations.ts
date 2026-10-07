import { createHash } from 'node:crypto';
import type { ModuleDeclarationIR, StaticCapabilityIR, StaticValue } from './ir';

/** One stable declaration-reference module per identity, like shared Context keys. */
export interface NativeStaticDeclarations {
  files: { path: string; contents: string; kind: 'source' }[];
  capabilities: Map<string, { name: string; kind: StaticCapabilityIR['kind']; file: string }>;
  modules: Map<string, ModuleDeclarationIR['config']>;
}

function staticLiteral(value: StaticValue): string {
  if (value === null || typeof value !== 'object')
    return typeof value === 'number' && Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (Array.isArray(value))
    return `Object.freeze([${value.map(staticLiteral).join(', ')}] as const)`;
  return `Object.freeze({${Object.entries(value)
    .map(([key, item]) => `[${JSON.stringify(key)}]: ${staticLiteral(item)}`)
    .join(', ')}} as const)`;
}

function declarationFile(kind: StaticCapabilityIR['kind'], name: string, id: string): string {
  const digest = createHash('sha256').update(id).digest('hex').slice(0, 32);
  const base =
    kind === 'anatomy-family'
      ? 'anatomy/family'
      : kind === 'focus-scope-key'
        ? 'focus/scope-key'
        : kind === 'focus-roving-key'
          ? 'focus/roving-key'
          : 'a11y/ref';
  return `.proto-ui/declaration/${base}-${digest}.ts`;
}

/** Emits checked static family/focus-key/a11y-ref declaration modules for native targets. */
export function buildNativeStaticDeclarations(
  capabilities: readonly StaticCapabilityIR[],
  modules: readonly ModuleDeclarationIR[]
): NativeStaticDeclarations {
  const files: { path: string; contents: string; kind: 'source' }[] = [];
  const capabilityFiles = new Map<
    string,
    { name: string; kind: StaticCapabilityIR['kind']; file: string }
  >();
  const seen = new Set<string>();
  for (const capability of capabilities) {
    if (seen.has(capability.id)) continue;
    seen.add(capability.id);
    const path = declarationFile(capability.kind, capability.name, capability.id);
    const exported = `declaration`;
    if (capability.kind === 'anatomy-family') {
      files.push({
        path,
        kind: 'source',
        contents: `// Native anatomy family v1. No Proto package, interpreter or host dependency.\n// Original declaration ${JSON.stringify(capability.id)}\nconst roles = ${staticLiteral(capability.config.roles ?? {})};\nconst relations = ${staticLiteral(capability.config.relations ?? [])};\nconst profiles = ${staticLiteral(capability.config.profiles ?? {})};\nexport const ${exported} = Object.freeze({ debugName: ${JSON.stringify(capability.name)}, roles, relations, profiles });\n`,
      });
    } else if (capability.kind === 'focus-scope-key' || capability.kind === 'focus-roving-key') {
      files.push({
        path,
        kind: 'source',
        contents: `// Native focus key v1. No Proto package, interpreter or host dependency.\n// Original declaration ${JSON.stringify(capability.id)}\nconst meta = ${staticLiteral(capability.config)};\nexport const ${exported} = Object.freeze({ id: Symbol(${JSON.stringify(capability.kind === 'focus-scope-key' ? '@proto.ui/focus-scope' : '@proto.ui/focus-roving')}), meta });\n`,
      });
    } else {
      files.push({
        path,
        kind: 'source',
        contents: `// Native a11y semantic object ref v1. No Proto package, interpreter or host dependency.\n// Original declaration ${JSON.stringify(capability.id)}\nexport const ${exported} = Object.freeze({});\n`,
      });
    }
    capabilityFiles.set(capability.id, {
      name: capability.name,
      kind: capability.kind,
      file: path,
    });
  }
  const moduleConfigs = new Map<string, ModuleDeclarationIR['config']>();
  for (const declaration of modules) moduleConfigs.set(declaration.id, declaration.config);
  return { files, capabilities: capabilityFiles, modules: moduleConfigs };
}
