// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

const prototype = (setup: string, callback: string) => `
  import {definePrototype,type RunHandle} from '@proto.ui/core';
  export default definePrototype({name:'json-provenance',setup(def){
    def.expose.event('changed',{payload:'json'});
    ${setup}
    def.event.on('press.commit',run=>{${callback}});
    return r=>r.slot();
  }});`;

const view = (hidden: string) => `const original={value:'ok',hidden:${hidden}};
  const view:Readonly<{value:string}>=original;`;
const optionalOverlay = (hidden: string) => `
  const original={value:'ok',hidden:${hidden}};
  const extra:{hidden?:string}={};
  if(flag.get())extra.hidden='safe';
  const merged={...original,...extra};
  const view:Readonly<{value:string}>=merged;`;

describe('outward JSON retains actual ordinary-value provenance', () => {
  const pointerSource = (payload: string) => `
    import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'optional-root-data',setup(def){
      def.expose.event('changed',{payload:'json'});
      def.event.on('pointer.move',(run,event)=>run.expose.emit('changed',${payload}));
    }});`;

  it('keeps optional root scalar alternatives at the existing root void boundary', () => {
    const result = compilePrototype(pointerSource('event.pointerType'), {
      profile: 'react-dom-source-v1',
    });
    expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
    if (!result.ok) return;
    expect(validateIR(JSON.parse(JSON.stringify(result.value.ir))).ok).toBe(true);
  });

  it.each(['{value:event.pointerType}', '[event.pointerType]'])(
    'retains the nested undefined rejection for %s',
    (payload) => {
      const result = parsePrototype(pointerSource(payload));
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.diagnostics[0].message).toContain('declared data boundary');
    }
  );

  const negative = [
    ['hidden undefined', view('undefined'), `run.expose.emit('changed',view);`],
    ['hidden nested undefined', view('{nested:undefined}'), `run.expose.emit('changed',view);`],
    ['hidden array undefined', view('[undefined]'), `run.expose.emit('changed',view);`],
    [
      'nested readonly view',
      `const original={child:{value:'ok',hidden:undefined}};
      const view:Readonly<{child:Readonly<{value:string}>}>=original;`,
      `run.expose.emit('changed',view);`,
    ],
    ['alias', `${view('undefined')} const alias=view;`, `run.expose.emit('changed',alias);`],
    [
      'helper parameter',
      `${view('undefined')}
      const emit=(run:RunHandle,payload:Readonly<{value:string}>)=>run.expose.emit('changed',payload);`,
      `emit(run,view);`,
    ],
    [
      'helper result',
      `const make=():Readonly<{value:string}>=>({value:'ok',hidden:undefined});
      const view=make();`,
      `run.expose.emit('changed',view);`,
    ],
    [
      'fresh wrapper retains its child',
      view('undefined'),
      `run.expose.emit('changed',{child:view});`,
    ],
    [
      'object spread copies hidden fields',
      view('undefined'),
      `run.expose.emit('changed',{...view});`,
    ],
    [
      'Object.assign copies its actual nested value',
      `const original={value:'ok',hidden:undefined};
      const view:{value:string}=original;`,
      `run.expose.emit('changed',Object.assign({},{child:view}));`,
    ],
    [
      'later mutation through an alias',
      `const original:{value:string,hidden:string|undefined}={value:'ok',hidden:'safe'};
      const view:Readonly<{value:string}>=original;`,
      `original.hidden=undefined;run.expose.emit('changed',view);`,
    ],
    [
      'later lexical replacement',
      `${view('undefined')} let current:Readonly<{value:string}>={value:'safe'};`,
      `current=view;run.expose.emit('changed',current);`,
    ],
    [
      'an absent optional spread cannot hide the existing undefined field',
      `const flag=def.state.bool('flag',false);`,
      `${optionalOverlay('undefined')}run.expose.emit('changed',view);`,
    ],
  ];
  it.each(negative)(
    'rejects %s only when the retained value reaches the sink',
    (_, setup, callback) => {
      const result = parsePrototype(prototype(setup, callback));
      expect(result.ok, JSON.stringify(result)).toBe(false);
      if (!result.ok)
        expect(result.diagnostics[0].message).toContain('Outward JSON payload retains');
    }
  );

  it.each([
    [
      'local-only view and explicit fresh scalar copy',
      view('undefined'),
      `run.expose.emit('changed',{value:view.value});`,
    ],
    [
      'fresh nested copy',
      `const original={child:{value:'ok',hidden:undefined}};
      const view:Readonly<{child:Readonly<{value:string}>}>=original;`,
      `run.expose.emit('changed',{child:{value:view.child.value}});`,
    ],
    ['hidden JSON data', view('{nested:[1,2]}'), `run.expose.emit('changed',view);`],
    [
      'defined scalar snapshot',
      `const data:{value:string|undefined}={value:'ok'};`,
      `const value=data.value??'fallback';run.expose.emit('changed',{value});`,
    ],
    [
      'ordinary scalar conversions',
      '',
      `run.expose.emit('changed',{value:String(42),count:Number('3')});`,
    ],
    ['ordinary arrays', '', `run.expose.emit('changed',{values:[1,2,3]});`],
    [
      'optional spread preserves an already safe existing field',
      `const flag=def.state.bool('flag',false);`,
      `${optionalOverlay("'original'")}run.expose.emit('changed',view);`,
    ],
  ])('preserves %s', (_, setup, callback) => {
    const result = compilePrototype(prototype(setup, callback), { profile: 'gpui-source-v1' });
    expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
  });

  it.each([
    ['direct hidden field', view('undefined'), ''],
    [
      'optional spread overlay',
      `const flag=def.state.bool('flag',false);`,
      optionalOverlay('undefined'),
    ],
  ])(
    'independently rejects serialized IR substitution of %s for a fresh copy',
    (_, setup, beforeEmit) => {
      const parsed = parsePrototype(
        prototype(setup, `${beforeEmit}run.expose.emit('changed',{value:view.value});`)
      );
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const ir: PrototypeIR = JSON.parse(JSON.stringify(parsed.value));
      let changed = false;
      const visit = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        const node = value as ExpressionIR;
        if (node.kind === 'operation' && node.operation === 'expose.emit') {
          const payload = node.arguments[1];
          if (payload.kind !== 'record' || payload.entries[0].value.kind !== 'member')
            throw new Error('fresh snapshot fixture');
          node.arguments[1] = JSON.parse(JSON.stringify(payload.entries[0].value.object));
          changed = true;
          return;
        }
        Object.values(value).forEach(visit);
      };
      visit(ir);
      expect(changed).toBe(true);
      const result = validateIR(ir);
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.diagnostics[0].message).toContain('Outward JSON payload retains');
    }
  );
});
