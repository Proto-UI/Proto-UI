// @vitest-environment node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { callableEffectIssue } from '../src/callable-effects';

const source = (body: string) =>
  `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'host-record-fixed-point',setup(def){${body}}});`;

describe('finite host callback parameter provenance', () => {
  it('converges when an external record is retained across callback visits', () => {
    // The unfixed analyzer grows one new host record on every revisit. A child
    // process bounds this regression without relying on an in-process timer
    // that cannot interrupt synchronous analysis.
    const inputs = [
      source(`let bound:number|null=null;
        def.expose.method('bind',(next:number)=>{if(bound!==null)return;bound=next;});`),
      source(`let bound:{run:()=>void}|null=null;
        def.expose.method('bind',(next:{run:()=>void})=>{if(bound)return;bound=next;});`),
    ];
    const program = `
      import {compilePrototype,validateIR} from ${JSON.stringify(new URL('../src/index.ts', import.meta.url).href)};
      const results = ${JSON.stringify(inputs)}.map(source => {
        const compiled = compilePrototype(source, {profile:'gpui-source-v1'});
        if (!compiled.ok) return {compiled};
        const checked = validateIR(JSON.parse(JSON.stringify(compiled.value.ir)));
        return {compiled:{ok:true},checked:checked.ok ? {ok:true} : checked};
      });
      console.log(JSON.stringify(results));
    `;
    const child = spawnSync(
      process.execPath,
      ['--max-old-space-size=512', '--import', 'tsx', '--input-type=module', '--eval', program],
      {
        cwd: path.resolve(__dirname, '../../..'),
        env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 4 * 1024 * 1024,
      }
    );
    expect(child.error, child.stderr).toBeUndefined();
    expect(child.signal, child.stderr).toBeNull();
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual([
      { compiled: { ok: true }, checked: { ok: true } },
      { compiled: { ok: true }, checked: { ok: true } },
    ]);
  }, 15_000);

  const isolation = (shape: 'parameters' | 'fields', invoke: 'first' | 'second') => {
    const parameters =
      shape === 'parameters'
        ? 'first:{run:()=>void},second:{run:()=>void}'
        : 'both:{first:{run:()=>void};second:{run:()=>void}}';
    const member = (name: string) => (shape === 'parameters' ? name : `both.${name}`);
    return source(`def.expose.method('inspect',(${parameters})=>{
      ${member('first')}.run=()=>{def.state.bool('forbidden',true);};
      ${member('second')}.run=()=>{};
      ${member(invoke)}.run();
    });`);
  };

  it.each(['parameters', 'fields'] as const)(
    'keeps same-type host %s separate when one is overwritten',
    (shape) => {
      expect(parsePrototype(isolation(shape, 'second')).ok).toBe(true);
      expect(parsePrototype(isolation(shape, 'first'))).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI1007', message: 'state.bool is not permitted in callback.' }],
      });
    }
  );

  it.each(['parameters', 'fields'] as const)(
    'rechecks same-type host %s independently in serialized IR',
    (shape) => {
      const parsed = parsePrototype(isolation(shape, 'second'));
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const ir = JSON.parse(JSON.stringify(parsed.value));
      expect(validateIR(ir).ok).toBe(true);
      const registration = ir.setup.body.find(
        (statement: any) =>
          statement.kind === 'effect' && statement.expression.operation === 'expose.method'
      );
      const callback = registration.expression.arguments[1].function;
      const invoke = callback.body.at(-1).expression;
      expect(invoke.kind).toBe('call');
      expect(invoke.callee.kind).toBe('member');
      expect(invoke.callee.property).toBe('run');
      const receiver = invoke.callee.object;
      if (shape === 'parameters') {
        expect(receiver.kind).toBe('reference');
        receiver.name = callback.parameters[0].name;
        receiver.bindingId = callback.parameters[0].bindingId;
      } else {
        expect(receiver.kind).toBe('member');
        receiver.property = 'first';
      }
      expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
    }
  );
});

describe('payload-free events keep callable analysis bounded', () => {
  it('compiles and cold-validates the complete authored Transition without a data escape', () => {
    const program = `
      import { readFileSync } from 'node:fs';
      import path from 'node:path';
      import { compilePrototype, validateIR } from ${JSON.stringify(new URL('../src/index.ts', import.meta.url).href)};
      const files = {};
      for (const name of ['as-transition.proto.ts', 'machine.ts', 'types.ts'])
        files['transition/' + name] = readFileSync(path.join(process.cwd(), 'packages/prototypes/base/src/transition', name), 'utf8');
      const source = "import { definePrototype } from '@proto.ui/core';" +
        "import { asTransition } from './transition/as-transition.proto';" +
        "export default definePrototype({name:'payload-free-authored',setup(def){" +
        "const handle=asTransition();handle.configure({enterDuration:10,leaveDuration:7});" +
        "return r=>r.el('section',[handle.transitionState.get(),r.slot()]);}});";
      const compiled = compilePrototype(source, { profile: 'react-runtime-v1', fileName: 'entry.proto.ts', files });
      if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
      const checked = validateIR(JSON.parse(JSON.stringify(compiled.value.ir)));
      if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
      console.log(JSON.stringify({ compiled: true, cold: true }));
    `;
    // A subprocess deadline catches synchronous analysis stalls. The original
    // generated-type and ordinary consumer suites retain their own deadlines.
    const child = spawnSync(
      process.execPath,
      ['--max-old-space-size=768', '--import', 'tsx', '--input-type=module', '--eval', program],
      {
        cwd: path.resolve(__dirname, '../../..'),
        env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
        encoding: 'utf8',
        timeout: 15_000,
        maxBuffer: 4 * 1024 * 1024,
      }
    );
    expect(child.error, child.stderr).toBeUndefined();
    expect(child.signal, child.stderr).toBeNull();
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({ compiled: true, cold: true });
  }, 20_000);

  it.each(['', ',undefined'])(
    'keeps the actual absent payload %s valid in source and cold IR',
    (argument) => {
      const parsed = parsePrototype(
        source(`def.expose.event('done');
      def.event.on('press.commit',run=>run.expose.emit('done'${argument}));`)
      );
      expect(parsed.ok, JSON.stringify(parsed.ok ? null : parsed.diagnostics)).toBe(true);
      if (parsed.ok) expect(validateIR(JSON.parse(JSON.stringify(parsed.value))).ok).toBe(true);
    }
  );

  it.each(['({bad:undefined})', '({bad:()=>1})'])(
    'does not erase a real return value %s behind a void callable view',
    (returned) => {
      const parsed = parsePrototype(
        source(`def.expose.event('done');
        const payload:()=>void=()=>${returned};
        def.event.on('press.commit',run=>run.expose.emit('done',payload()));`)
      );
      expect(parsed).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
    }
  );

  it('keeps callback phase checks when every outward event has no payload', () => {
    const parsed = parsePrototype(
      source(`def.expose.event('done');
      const bad=()=>{def.state.bool('forbidden',true);};
      def.event.on('press.commit',run=>{bad();run.expose.emit('done');});`)
    );
    expect(parsed).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007', message: 'state.bool is not permitted in callback.' }],
    });
  });

  it('rejects a forged void expression in cold IR without trusting its declared type', () => {
    const parsed = parsePrototype(
      source(`def.expose.event('done');
      def.event.on('press.commit',run=>{run.expose.emit('done',undefined);});`)
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = JSON.parse(JSON.stringify(parsed.value));
    const registration = ir.setup.body.find(
      (statement: any) =>
        statement.kind === 'effect' && statement.expression.operation === 'event.on'
    );
    const emit = registration.expression.arguments[1].function.body[0].expression;
    emit.arguments[1] = {
      kind: 'record',
      entries: [{ key: 'bad', value: emit.arguments[1] }],
      type: 'void',
      span: emit.span,
    };
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('retains actual payload provenance even when cold event metadata claims void', () => {
    const parsed = parsePrototype(
      source(`def.expose.event('done',{payload:'json'});
      const original={good:'ok',hidden:undefined};
      const view:Readonly<{good:string}>=original;
      def.event.on('press.commit',run=>{run.expose.emit('done',{good:'ok'});});`)
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = JSON.parse(JSON.stringify(parsed.value));
    const view = ir.setup.body.find(
      (statement: any) => statement.kind === 'const' && statement.name === 'view'
    );
    const registration = ir.setup.body.find(
      (statement: any) =>
        statement.kind === 'effect' && statement.expression.operation === 'event.on'
    );
    const emit = registration.expression.arguments[1].function.body[0].expression;
    emit.arguments[1] = {
      kind: 'reference',
      name: view.name,
      bindingId: view.bindingId,
      type: view.value.type,
      span: emit.span,
    };
    ir.exposes.find((item: any) => item.kind === 'event').payload = 'void';
    // The regular schema/operation validator rejects forged metadata. The
    // value-flow layer must independently keep the hidden field, too.
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
    expect(callableEffectIssue(ir)).toMatchObject({
      code: 'PUI1006',
      message: expect.stringContaining('Outward JSON payload retains'),
    });
  });
});
