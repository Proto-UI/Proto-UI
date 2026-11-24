import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { intrinsicResult } from '../src/value-types';
import type { ValueType } from '../src/ir';

const prefix = `import{definePrototype}from'@proto.ui/core';
const IDS=['vega','nova'] as const;
type Id=(typeof IDS)[number];`;
function parse(body: string) {
  // A runtime input keeps the proof obligation open. A fixed 'vega' caller is
  // now safely specialized by the closed source graph before this assertion.
  return parsePrototype(`${prefix}
function normalize(value:unknown):Id|null{${body}}
export default definePrototype({name:'membership',setup(def){
  def.expose.method('normalize',(input:string)=>normalize(input));return r=>r.el('button');
}});`);
}

describe('finite string membership', () => {
  it('admits the unchanged assertion pattern and portable true-branch proof', () => {
    const result = parse(`if(IDS.includes(value as Id))return value as Id;return null;`);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
  });

  it.each([
    `IDS.includes(value as Id);return value as Id;`,
    `if(!IDS.includes(value as Id))return value as Id;return null;`,
    `const found=IDS.includes(value as Id);if(found)return value as Id;return null;`,
    `let current=value;if(IDS.includes(current as Id))return current as Id;return null;`,
    `const box={value};if(IDS.includes(box.value as Id))return box.value as Id;return null;`,
    `if(IDS.includes(value as Id,0))return value as Id;return null;`,
    `if(IDS?.includes(value as Id))return value as Id;return null;`,
    `return value as Id;`,
  ])('does not grant unsupported proof: %s', (body) => {
    expect(parse(body)).toMatchObject({ ok: false });
  });

  it('checks portable membership arity while permitting ordinary array domains', () => {
    const finite: ValueType = {
      kind: 'array',
      element: {
        kind: 'union',
        members: [
          { kind: 'literal', value: 'vega' },
          { kind: 'literal', value: 'nova' },
        ],
      },
    };
    expect(intrinsicResult('array.includes', [finite, 'unknown'])).toBe('boolean');
    for (const args of [[finite], [finite, 'unknown', 'number']]) {
      expect(() => intrinsicResult('array.includes', args as ValueType[])).toThrow();
    }
    // Ordinary membership is a Boolean operation; only the finite literal
    // receiver can additionally establish a finite string proof.
    for (const args of [
      [{ kind: 'array', element: 'string' }, 'unknown'],
      [{ kind: 'array', element: 'number' }, 'unknown'],
      [{ kind: 'array', element: { kind: 'union', members: [] } }, 'unknown'],
    ]) {
      expect(intrinsicResult('array.includes', args as ValueType[])).toBe('boolean');
    }
  });

  it('retains checked const tuple proof and ordinary widened array membership', () => {
    const result = parse(`if(IDS.includes(value))return value;return null;`);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
    const widened = parsePrototype(`${prefix}
      export default definePrototype({name:'widened-membership',setup(def){
        const ids=['vega','nova'];ids.includes('vega');
      }});`);
    expect(widened.ok, JSON.stringify(widened)).toBe(true);
    if (widened.ok)
      expect(validateIR(JSON.parse(JSON.stringify(widened.value)))).toMatchObject({ ok: true });
  });

  it('retains module const tuple proof through authored parentheses', () => {
    const result = parsePrototype(`import{definePrototype}from'@proto.ui/core';
      const IDS=((['vega','nova'] as const));
      type Id=(typeof IDS)[number];
      function normalize(value:unknown):Id|null{
        if(IDS.includes(value as Id))return value as Id;return null;
      }
      export default definePrototype({name:'wrapped-membership',setup(def){
        def.expose.method('normalize',()=>normalize('vega'));return r=>r.el('button');
      }});`);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok)
      expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
  });

  it('rejects serialized receiver and result forgeries', () => {
    const result = parse(`if(IDS.includes(value as Id))return value as Id;return null;`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const mode of ['arity', 'result']) {
      const ir = JSON.parse(JSON.stringify(result.value));
      let changed = false;
      const visit = (node: any): void => {
        if (!node || typeof node !== 'object') return;
        if (node.kind === 'intrinsic' && node.name === 'array.includes') {
          if (mode === 'arity') node.arguments.push(node.arguments[1]);
          else node.type = 'run';
          changed = true;
          return;
        }
        Object.values(node).forEach(visit);
      };
      visit(ir);
      expect(changed).toBe(true);
      expect(validateIR(ir)).toMatchObject({ ok: false });
    }
  });
});
