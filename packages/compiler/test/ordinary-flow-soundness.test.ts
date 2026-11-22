// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { FunctionIR, PrototypeIR } from '../src/ir';

const source = (body: string) =>
  `import{definePrototype}from'@proto.ui/core';export default definePrototype({name:'flow',setup(def){${body}}});`;
function checked(body: string): PrototypeIR {
  const result = parsePrototype(source(body));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const serialized = JSON.parse(JSON.stringify(result.value));
  const validated = validateIR(serialized);
  if (!validated.ok) throw new Error(JSON.stringify(validated.diagnostics));
  return validated.value;
}
describe('ordinary flow facts are tied to current binding values', () => {
  it.each([
    'let value:number|null=1;const hadValue=value!==null;value=null;if(hadValue){const invalid:number=value;}',
    'let value:number|null=1;if(value!==null){value=null;const invalid:number=value;}',
    'let value:number|null=1;if(value!==null){if(true)value=null;const invalid:number=value;}',
    'const box:{value:number|null}={value:1};const hadValue=box.value!==null;box.value=null;if(hadValue){const invalid:number=box.value;}',
  ])('does not use a stale predicate after mutation: %s', (body) => {
    expect(parsePrototype(source(body))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006' }],
    });
  });

  it('retains immutable predicate proofs and keeps a branch-local shadow out of the outer scope', () => {
    checked(
      `const read=(value:number|null)=>{const hasValue=value!==null;if(hasValue)return value+1;return 0;};let outer=1;if(true){const outer='shadow';}def.expose.value('outer',outer);def.expose.method('read',read);`
    );
  });

  it('rederives mutable flow facts when importing IR', () => {
    const ir = checked(
      'let value:number|null=1;if(value!==null){value=null;def.expose.value("after",value);}'
    );
    const branch = ir.setup.body.find((statement) => statement.kind === 'if');
    if (branch?.kind !== 'if') throw new Error('missing guarded branch');
    const last = branch.then.at(-1);
    if (
      last?.kind !== 'effect' ||
      last.expression.kind !== 'operation' ||
      last.expression.operation !== 'expose.value'
    )
      throw new Error('missing after-write observation');
    const read = last.expression.arguments[1];
    if (read.kind !== 'lexical-read') throw new Error('missing mutable read');
    expect(read.type).toEqual('null');
    read.type = 'number';
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('keeps readonly permission through aliases and erased assertions', () => {
    for (const transport of [
      'const mutable: {value:number}=readonly;',
      'const mutable=readonly as {value:number};',
      'const mutable=readonly as unknown as {value:number};',
      'const mutable=(readonly as unknown as Readonly<{value:number}>) as {value:number};',
    ])
      expect(
        parsePrototype(
          source(`const readonly:Readonly<{value:number}>={value:1};${transport}mutable.value=2;`)
        )
      ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
    checked(
      'const readonly:Readonly<{value:number}>={value:1};const copy={...readonly};copy.value=2;def.expose.value("copy",copy);'
    );
  });

  it('does not let portable narrowing remove readonly write protection', () => {
    const ir = checked(
      'const readonly:Readonly<{value:number}>={value:1};def.expose.value("value",readonly.value);'
    );
    const declared = ir.setup.body[0];
    if (declared.kind !== 'const') throw new Error('missing readonly declaration');
    ir.setup.body.push({
      kind: 'effect',
      span: declared.span,
      expression: {
        kind: 'narrow',
        value: {
          kind: 'reference',
          name: declared.name,
          bindingId: declared.bindingId,
          type: declared.value.type,
          span: declared.span,
        },
        type: { kind: 'record', fields: [{ name: 'value', type: 'number' }] },
        span: declared.span,
      },
    });
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});

describe('mutation ends observations across calls, aliases and control flow', () => {
  it.each([
    'let value:number|null=1;const clear=()=>{value=null;};if(value!==null){clear();const invalid:number=value;}',
    'const box:{value:number|null}={value:1};const alias=box;if(box.value!==null){alias.value=null;const invalid:number=box.value;}',
    'let value:number|null=1;if(value!==null){try{value=null;}finally{}const invalid:number=value;}',
    'let value:{n:number}|null={n:1};if(value!==null){const clear=()=>{value=null;};clear();def.expose.value("crash",value.n);}',
    'let value:number|null=1;const clear=()=>{value=null;return true;};if(value!==null&&clear()){const invalid:number=value;}',
    'let value:number|null=1;const clear=()=>{value=null;return true;};if(value!==null){true?clear():false;const invalid:number=value;}',
    'let value:number|null=1;const clear=()=>{value=null;return true;};if(value!==null){true&&clear();const invalid:number=value;}',
    'let value:number|null=1;const clear=()=>{value=null;};if(value!==null){try{throw 0;}catch{clear();}const invalid:number=value;}',
    'const box:{value:number|null}={value:1};const readonly:Readonly<{value:number|null}>=box;const clear=()=>{box.value=null;};if(readonly.value!==null){clear();const invalid:number=readonly.value;}',
    'const box:{value:number|null}={value:1};const alias=box;if(box.value!==null){const read=()=>box.value;alias.value=null;const invalid:number=read();}',
    'let value:number|null=1;const clear=()=>{value=null;return {ok:true};};if(value!==null){const record={...clear(),number:value};const invalid:number=record.number;}',
    'let value:{n:number}|null={n:1};const flag=def.state.bool("flag",false);flag.watch(()=>{value=null;});def.lifecycle.onMounted(()=>{if(value){flag.set(true);const invalid:number=value.n;}});',
  ])('rejects stale proof after a possible mutation: %s', (body) => {
    expect(parsePrototype(source(body))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006' }],
    });
  });

  it.each([
    'let value:number|null=1;const clear=()=>{value=null;};if(value!==null){const snapshot=value;clear();const valid:number=snapshot;}',
    'let value:number|null=1;const clear=()=>{value=null;};if(value!==null){clear();if(value!==null){const valid:number=value;}}',
    'let value:number|null=1;const read=()=>value;if(value!==null){read();const valid:number=value;}',
    'const box:{value:number|null}={value:1};if(box.value!==null){box.value=null;}',
    'let value:number|null=1;const clear=()=>{value=null;return {ok:true};};if(value!==null){const record={number:value,...clear()};const valid:number=record.number;}',
    'const record:{value:number|null}|null={value:1};const clear=()=>{if(record)record.value=null;};if(record){clear();def.expose.value("record",record.value);}',
  ])('preserves a fresh observation, immutable snapshot or known readonly call: %s', (body) => {
    checked(body);
  });

  it('derives readonly alias effects from checked code rather than retained unused source', () => {
    const body =
      'let count=0;const step=()=>{count++;};const view:Readonly<{value:number|null}>={value:1};if(view.value!==null){step();const valid:number=view.value;}';
    const input = source(body).replace(
      'export default',
      'function unused(box:{value:number|null}){box.value=null;}export default'
    );
    const parsed = parsePrototype(input);
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.moduleBindings).toBeUndefined();
    expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
    const baseline = checked(body);
    expect(parsed.value.exposes).toEqual(baseline.exposes);
  });

  it.each([
    'let value:number|null=1;const clear=()=>{value=null;};if(value!==null){clear();def.expose.value("after",value);}',
    'const box:{value:number|null}={value:1};const alias=box;if(box.value!==null){alias.value=null;def.expose.value("after",box.value);}',
    'let value:number|null=1;if(value!==null){try{value=null;}finally{}def.expose.value("after",value);}',
    'let value:number|null=1;const clear=()=>{value=null;return true;};if(value!==null&&clear()){def.expose.value("after",value);}',
    'let value:number|null=1;const clear=()=>{value=null;return true;};if(value!==null){true?clear():false;def.expose.value("after",value);}',
  ])('rederives the invalidation before trusting a portable read type: %s', (body) => {
    const ir = checked(body);
    let observation: Record<string, unknown> | undefined;
    const find = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(find);
        return;
      }
      const node = value as Record<string, unknown>;
      if (node.kind === 'operation' && node.operation === 'expose.value') {
        const args = node.arguments as { kind: string; value?: unknown }[];
        if (args[0].value === 'after') observation = args[1] as Record<string, unknown>;
      }
      for (const [key, child] of Object.entries(node))
        if (!['type', 'span', 'sourceFiles'].includes(key)) find(child);
    };
    find(ir.setup);
    if (!observation) throw new Error('missing after-effect read');
    observation.type = 'number';
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', message: 'IR expression type mismatch.' }],
    });
  });
});

describe('parameter defaults use their own lexical environment', () => {
  it.each([
    'const value=10;const f=(value:number=value)=>value;',
    'const later=10;const f=(value:number=later,later=1)=>value;',
  ])('does not fall back to a shadowed outer binding: %s', (body) => {
    expect(parsePrototype(source(body))).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1006', message: expect.stringContaining('uninitialized parameter') },
      ],
    });
  });

  it('allows left-to-right defaults and delayed capture of a later parameter', () => {
    const ir = checked(
      `const later='outer';const f=(read=()=>later,later=1)=>read();const g=(a=1,b=a+1)=>b;def.expose.value('f',f());def.expose.value('g',g());`
    );
    expect(ir.exposes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'f', type: 'number' }),
        expect.objectContaining({ name: 'g', type: 'number' }),
      ])
    );
    const declaration = ir.setup.body.find((node) => node.kind === 'const' && node.name === 'f');
    if (declaration?.kind !== 'const' || declaration.value.kind !== 'function')
      throw new Error('missing function');
    const fn = declaration.value.function;
    const fallback = fn.parameters[0].default;
    if (fallback?.kind !== 'function') throw new Error('missing closure default');
    expect(fallback.function.captures).toEqual([
      { bindingId: fn.parameters[1].bindingId, name: 'later', storage: 'value' },
    ]);
  });

  it('revalidates direct later-parameter reads in portable defaults', () => {
    const ir = checked('const f=(a=1,b=2)=>a+b;def.expose.value("value",f());');
    const declaration = ir.setup.body.find((node) => node.kind === 'const' && node.name === 'f');
    if (declaration?.kind !== 'const' || declaration.value.kind !== 'function')
      throw new Error('missing function');
    const fn: FunctionIR = declaration.value.function;
    fn.parameters[0].default = {
      kind: 'reference',
      name: 'b',
      bindingId: fn.parameters[1].bindingId,
      type: 'number',
      span: fn.span,
    };
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI2002', message: expect.stringContaining('uninitialized parameter') },
      ],
    });
  });
});
