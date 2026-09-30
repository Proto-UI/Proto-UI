// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractContextKeyDeclaration } from '../src/context-declarations';
import { acceptsValue } from '../src/data-types';
import { CompilerRejection } from '../src/diagnostics';
import { SourceGraph } from '../src/parser-module';

function extract(source: string, binding = 'KEY') {
  const graph = new SourceGraph(source, { fileName: 'keys.ts' });
  return extractContextKeyDeclaration(graph.load('keys.ts'), binding);
}

function rejected(source: string) {
  try {
    extract(source);
  } catch (error) {
    if (error instanceof CompilerRejection) return error.diagnostic;
    throw error;
  }
  throw new Error('Expected a checked context declaration rejection.');
}

const core = "import { createContextKey } from '@proto.ui/core';\n";

describe('static context declarations', () => {
  it('keeps same-name declarations distinct in one module and across relative source identities', () => {
    const source = `${core}
export const KEY = createContextKey<{count:number}>('shared');
export const OTHER = createContextKey<{count:number}>('shared');`;
    const graph = new SourceGraph(source, {
      fileName: 'left/keys.ts',
      files: { 'right/keys.ts': source },
    });
    const left = graph.load('left/keys.ts');
    const first = extractContextKeyDeclaration(left, 'KEY');
    const second = extractContextKeyDeclaration(left, 'OTHER');
    const right = extractContextKeyDeclaration(graph.load('right/keys.ts'), 'KEY');
    expect(first.name).toBe(second.name);
    expect(first.name).toBe(right.name);
    expect(new Set([first.id, second.id, right.id]).size).toBe(3);
    expect(first.id).toBe('left/keys.ts#KEY');
  });

  it('preserves declaration identity and original spans through imported aliases and re-exports', () => {
    const shared = `import { createContextKey as key } from '@proto.ui/core';
export const KEY = key<{count:number}>('shared');`;
    const graph = new SourceGraph("import { renamed as LOCAL } from './bridge';", {
      fileName: 'consumer.ts',
      files: {
        'keys.ts': shared,
        'bridge.ts': "export { KEY as renamed } from './keys';",
        'other.ts': "import { KEY as OTHER } from './keys';",
      },
    });
    const origin = extractContextKeyDeclaration(graph.load('keys.ts'), 'KEY');
    const consumer = extractContextKeyDeclaration(graph.load('consumer.ts'), 'LOCAL');
    const other = extractContextKeyDeclaration(graph.load('other.ts'), 'OTHER');
    expect(consumer).toEqual(origin);
    expect(other).toEqual(origin);
    expect(consumer.span.file).toBe('keys.ts');
    expect(consumer.span.line).toBe(2);
  });

  it('extracts structural record constraints from aliases, interface inheritance and nested JSON data', () => {
    const key = extract(`import { createContextKey as key } from '@proto.ui/core';
type Mode = 'open' | 'closed';
interface Base { readonly count: number }
interface Value extends Base {
  mode: Mode;
  items: readonly { label: string; active: boolean }[];
  note?: string | null;
}
export const KEY = key<Value>('record');`);
    expect(acceptsValue(key.type, {
      count: 3, mode: 'open', items: [{ label: 'row', active: true }],
    })).toBe(true);
    expect(acceptsValue(key.type, {
      count: 3, mode: 'invalid', items: [],
    })).toBe(false);
    expect(acceptsValue(key.type, {
      count: 3, mode: 'closed', items: [{ label: 'row', active: 'yes' }],
    })).toBe(false);
    expect(acceptsValue(key.type, { mode: 'open', items: [] })).toBe(false);
    expect(JSON.parse(JSON.stringify(key))).toEqual(key);
  });

  it('preserves a discriminated union of object shapes instead of collapsing its data contract', () => {
    const key = extract(`${core}
type Value = {kind:'ready'; value:number} | {kind:'pending'; reason:string};
export const KEY = createContextKey<Value>('status');`);
    expect(acceptsValue(key.type, { kind: 'ready', value: 1 })).toBe(true);
    expect(acceptsValue(key.type, { kind: 'pending', reason: 'loading' })).toBe(true);
    expect(acceptsValue(key.type, { kind: 'ready', reason: 'loading' })).toBe(false);
  });

  it('rejects computed names and reports the original name expression span', () => {
    const source = `${core}export const KEY = createContextKey<{count:number}>('scope' + suffix);`;
    const diagnostic = rejected(source);
    expect(diagnostic.code).toBe('PUI1021');
    expect(source.slice(diagnostic.span.start, diagnostic.span.end)).toBe("'scope' + suffix");
    expect(diagnostic.span.file).toBe('keys.ts');
  });

  it('rejects host and executable values at their original nested type spans', () => {
    for (const type of ['Date', '() => void', 'undefined', 'bigint']) {
      const source = `${core}export const KEY = createContextKey<{value:${type}}>('invalid');`;
      const diagnostic = rejected(source);
      expect(diagnostic.code).toBe('PUI1020');
      expect(source.slice(diagnostic.span.start, diagnostic.span.end)).toBe(type);
    }
  });

  it('rejects scalar root types even when they are serializable JSON values', () => {
    const source = `${core}export const KEY = createContextKey<string>('scalar');`;
    const diagnostic = rejected(source);
    expect(diagnostic.code).toBe('PUI1021');
    expect(source.slice(diagnostic.span.start, diagnostic.span.end)).toBe('string');
  });

  it('fails closed on recursive aliases and conflicting interface inheritance', () => {
    const recursive = `${core}
type Value = {next:Value | null};
export const KEY = createContextKey<Value>('recursive');`;
    expect(rejected(recursive)).toMatchObject({ code: 'PUI1020' });
    const conflict = `${core}
interface Base {value:number}
interface Value extends Base {value:string}
export const KEY = createContextKey<Value>('conflict');`;
    expect(rejected(conflict)).toMatchObject({ code: 'PUI1020' });
  });

  it('rejects dynamic record shapes and generic aliases instead of erasing their constraints', () => {
    const dynamic = `${core}
type Value = {[name:string]:number};
export const KEY = createContextKey<Value>('dynamic');`;
    expect(rejected(dynamic)).toMatchObject({ code: 'PUI1020' });
    const generic = `${core}
type Value<T> = {value:T};
export const KEY = createContextKey<Value<number>>('generic');`;
    expect(rejected(generic)).toMatchObject({ code: 'PUI1020' });
    const computed = `${core}
type Value = {['value']:number};
export const KEY = createContextKey<Value>('computed');`;
    const diagnostic = rejected(computed);
    expect(computed.slice(diagnostic.span.start, diagnostic.span.end)).toBe("['value']");
  });

  it('does not resolve a factory or data type by its spelling alone', () => {
    const source = `${core}
function counterfeit() { return null; }
export const KEY = counterfeit<{value:number}>('fake');`;
    expect(rejected(source)).toMatchObject({ category: 'unsupported-input' });
    const importedType = `${core}import type { Value } from './foreign';
export const KEY = createContextKey<Value>('foreign');`;
    expect(rejected(importedType)).toMatchObject({ code: 'PUI1020' });
  });
});
