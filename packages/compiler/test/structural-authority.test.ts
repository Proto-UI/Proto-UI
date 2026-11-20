// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { PrototypeIR, ValueType } from '../src/ir';

const core = "import{definePrototype}from'@proto.ui/core';";
const source = (body: string, module = '') =>
  `${core}${module}export default definePrototype({name:'structural-authority',setup(def){${body}}});`;
function checked(body: string, module = ''): PrototypeIR {
  const result = parsePrototype(source(body, module));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const portable = validateIR(JSON.parse(JSON.stringify(result.value)));
  if (!portable.ok) throw new Error(JSON.stringify(portable.diagnostics));
  return portable.value;
}
const dataView: ValueType = { kind: 'record', fields: [{ name: 'value', type: 'number' }] };

describe('contiguous assertions retain an already proven capability', () => {
  const types =
    "import type {DefHandle,RunHandle,State,BorrowedStateHandle} from '@proto.ui/core';";

  it.each([
    'def as unknown as DefHandle',
    '<DefHandle>(<unknown>def)',
    '((def as DefHandle) as unknown as unknown) as DefHandle',
    '(<unknown>(def as DefHandle)) as DefHandle',
  ])('retains the checked operand for %s', (expression) => {
    const ir = checked(
      `const view=${expression};view.props.define({choice:{type:'string'}});view.props.setDefaults({choice:'inherit'});`,
      types
    );
    const declared = ir.setup.body[0];
    if (declared.kind !== 'const') throw new Error('missing capability alias');
    expect(declared.value).toMatchObject({ kind: 'reference', name: 'def', type: 'def' });
    expect(ir.props).toMatchObject([{ name: 'choice', type: 'string' }]);
    expect(ir.setup.body[2]).toMatchObject({
      kind: 'effect',
      expression: {
        kind: 'operation',
        operation: 'props.setDefaults',
        arguments: [{ kind: 'record', entries: [{ key: 'choice', value: { value: 'inherit' } }] }],
      },
    });
  });

  it('retains a generic handle view without changing its authored declaration or defaults', () => {
    checked(
      `const view=retain(def);view.props.define({choice:{type:'string'}});view.props.setDefaults({choice:'inherit'});`,
      `${types}function retain<Props extends {choice?:string},Exposes>(value:DefHandle<Props,Exposes>){return value as unknown as DefHandle<{choice?:string}>;}`
    );
  });

  it('retains a checked call once rather than replaying its operand', () => {
    const ir = checked(
      'const read=()=>def;const view=read() as unknown as DefHandle;view.expose.value("value",1);',
      types
    );
    const declared = ir.setup.body[1];
    if (declared.kind !== 'const') throw new Error('missing call result');
    expect(declared.value).toMatchObject({ kind: 'call', type: 'def' });
  });

  it.each([
    'const recover=(value:unknown)=>value as unknown as DefHandle;recover(def);',
    'const recover=(value:unknown)=><DefHandle>(<unknown>value);recover(def);',
    'let erased:unknown=def;erased={};const view=erased as unknown as DefHandle;',
    'const view=({} as unknown) as DefHandle;',
    'const view=def as unknown as RunHandle;',
    'const view=def as unknown as RunHandle as unknown as DefHandle;',
    'const recover=(value:BorrowedStateHandle<number>)=>value as unknown as State<number>;',
  ])('rejects unproven or substituted capability authority: %s', (body) => {
    expect(parsePrototype(source(body, types))).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI1006',
          message: expect.stringContaining('A type assertion cannot grant unproven'),
        },
      ],
    });
  });

  it.each(['unknown', 'run'] as const)(
    'independently rejects portable %s to DefHandle narrowing',
    (type) => {
      const ir = checked('const view=def as unknown as DefHandle;', types);
      const declared = ir.setup.body[0];
      if (declared.kind !== 'const') throw new Error('missing capability alias');
      const origin = declared.value;
      declared.value = {
        kind: 'narrow',
        value: {
          kind: 'narrow',
          value: origin,
          type,
          span: declared.span,
        },
        type: 'def',
        span: declared.span,
      };
      expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI2002' }],
      });
    }
  );
});

describe('structural type views preserve runtime authority', () => {
  it.each([
    'const raw={value:1,secret:def};const view:{value:number}=raw;def.expose.value("view",view);',
    'const raw={value:1,next:()=>1};const view:{value:number}=raw;def.expose.value("view",view);',
    'const raw={value:1,next:()=>1};const view=raw as {value:number};def.expose.value("view",view);',
    'const raw={value:1,next:()=>1};const view=raw as unknown as {value:number};def.expose.value("view",view);',
    'const raw={value:{count:1,next:()=>1}};const view:{value:{count:number}}=raw;',
    'const raw={value:1,next:()=>1};const accept=(value:{value:number})=>value;accept(raw);',
    'const raw={value:1,next:()=>1};const create=():{value:number}=>raw;def.expose.method("create",create);',
    'const raw={value:1,next:()=>1};const create:()=>{value:number}=()=>raw;def.expose.method("create",create);',
    'const create=()=>()=>1;const hidden:()=>void=create;def.expose.method("hidden",hidden);',
  ])('rejects erasing callable or owner fields without a runtime transformation: %s', (body) => {
    expect(parsePrototype(source(body))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006' }],
    });
  });

  it('keeps ordinary width subtyping for additional pure-data fields', () => {
    checked(
      'const raw={value:1,extra:{count:2}};const view:{value:number}=raw;def.expose.value("view",view);'
    );
    checked(
      'const raw:Readonly<{value:number;extra:number}>={value:1,extra:2};const view:Readonly<{value:number}>=raw;def.expose.value("view",view);'
    );
    checked(
      'const raw={value:1,next:()=>1};const view:{value:number;next:()=>number}=raw;def.expose.value("view",view);'
    );
  });

  it('does not put an actual owner closure into a finite-data module slot', () => {
    const module = 'let saved:number|{value:number}=0;';
    expect(
      parsePrototype(
        source(
          'let count=0;const raw={value:1,next:()=>++count};saved=raw;def.expose.value("saved",saved);',
          module
        )
      )
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
    checked('saved={value:1,extra:2};def.expose.value("saved",saved);', module);
  });

  it('rejects forged portable narrow nodes that hide runtime callable fields', () => {
    const ir = checked('const raw={value:1,next:()=>1};def.expose.value("raw",raw);');
    const declared = ir.setup.body[0];
    if (declared.kind !== 'const') throw new Error('missing raw record');
    declared.value = { kind: 'narrow', value: declared.value, type: dataView, span: declared.span };
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', message: expect.stringContaining('authority') }],
    });
  });

  it('rejects a forged module write even though its destination schema is finite data', () => {
    const ir = checked(
      'const raw={value:1,next:()=>1};def.expose.method("read",()=>saved);',
      'let saved:number|{value:number}=0;'
    );
    const module = ir.moduleBindings![0],
      raw = ir.setup.body[0];
    if (raw.kind !== 'const') throw new Error('missing raw record');
    const stored = module.value.type;
    if (typeof stored === 'string' || stored.kind !== 'cell')
      throw new Error('missing module cell');
    ir.setup.body.push({
      kind: 'effect',
      span: raw.span,
      expression: {
        kind: 'lexical-write',
        cell: {
          kind: 'reference',
          name: module.name,
          bindingId: module.bindingId,
          type: stored,
          span: module.span,
        },
        value: {
          kind: 'reference',
          name: raw.name,
          bindingId: raw.bindingId,
          type: raw.value.type,
          span: raw.span,
        },
        type: stored.value,
        span: raw.span,
      },
    });
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI2002', message: expect.stringContaining('Lexical write type mismatch') },
      ],
    });
  });
});
