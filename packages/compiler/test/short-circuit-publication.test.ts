// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

const source = (body: string) => `
  import {definePrototype} from '@proto.ui/core';
  export default definePrototype({name:'short-circuit-publication',setup(def){
    const flag=def.state.bool('flag',false);
    def.expose.event('changed',{payload:'json'});
    def.event.on('pointer.move',(run,event)=>{${body}});
    return r=>r.slot();
  }});`;

describe('short-circuit publication keeps only returned alternatives', () => {
  it.each([
    [
      'optional pointer fields',
      `run.expose.emit('changed',{
      kind:event.pointerType??'absent', buttons:event.pointerButtons??'absent'
    });`,
    ],
    [
      'ordinary undefined alternative',
      `const value=flag.get()?undefined:'ready';
      run.expose.emit('changed',{value:value??'fallback'});`,
    ],
    [
      'ordinary null alternative',
      `const value=flag.get()?null:'ready';
      run.expose.emit('changed',{value:value??'fallback'});`,
    ],
    [
      'two nullish alternatives',
      `const value=flag.get()?null:undefined;
      run.expose.emit('changed',{value:value??'fallback'});`,
    ],
    [
      'logical-or default',
      `const value=flag.get()?undefined:'ready';
      run.expose.emit('changed',{value:value||'fallback'});`,
    ],
    [
      'nested default chain',
      `const value=flag.get()?undefined:'ready';
      const fallback=flag.get()?null:'backup';
      run.expose.emit('changed',{value:value??fallback??'last'});`,
    ],
    [
      'helper result default',
      `const maybe=()=>flag.get()?undefined:'ready';
      run.expose.emit('changed',{value:maybe()??'fallback'});`,
    ],
    [
      'falsy values stay non-nullish',
      `const value=flag.get()?false:0;
      const original={value:'fallback',hidden:undefined};
      const view:Readonly<{value:string}>=original;
      run.expose.emit('changed',{value:value??view});`,
    ],
    [
      'empty string stays non-nullish',
      `const value=flag.get()?'':'ready';
      const original={value:'fallback',hidden:undefined};
      const view:Readonly<{value:string}>=original;
      run.expose.emit('changed',{value:value??view});`,
    ],
  ])('admits %s through source and serialized IR', (_, body) => {
    const compiled = compilePrototype(source(body), { profile: 'react-dom-source-v1' });
    expect(compiled.ok, JSON.stringify(compiled.ok ? null : compiled.diagnostics)).toBe(true);
    if (!compiled.ok) return;
    const cold = validateIR(JSON.parse(JSON.stringify(compiled.value.ir)));
    expect(cold.ok, JSON.stringify(cold.ok ? null : cold.diagnostics)).toBe(true);
  });

  it.each([
    [
      'logical-and retains undefined',
      `const value=flag.get()?undefined:'ready';
      run.expose.emit('changed',{value:value&&'present'});`,
    ],
    [
      'nullish coalescing retains hidden data',
      `const original={value:'ok',hidden:undefined};
      const view:Readonly<{value:string}>=original;
      const maybe=flag.get()?view:undefined;
      run.expose.emit('changed',maybe??{value:'fallback'});`,
    ],
    [
      'logical-or retains a truthy record',
      `const original={value:'ok',hidden:undefined};
      const view:Readonly<{value:string}>=original;
      const maybe=flag.get()?view:undefined;
      run.expose.emit('changed',maybe||{value:'fallback'});`,
    ],
    [
      'a reachable default retains hidden data',
      `const original={value:'bad',hidden:undefined};
      const view:Readonly<{value:string}>=original;
      const maybe=flag.get()?undefined:'ready';
      run.expose.emit('changed',{value:maybe??view});`,
    ],
  ])('rejects %s', (_, body) => {
    const parsed = parsePrototype(source(body));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.diagnostics[0].message).toContain('data boundary');
  });

  it('checks effects in a reachable fallback', () => {
    const parsed = parsePrototype(
      source(`
      const maybe=flag.get()?undefined:'ready';
      const fallback=()=>{def.state.bool('late',false);return 'fallback';};
      run.expose.emit('changed',{value:maybe??fallback()});
    `)
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok)
      expect(parsed.diagnostics[0].message).toContain('state.bool is not permitted in callback');
  });
});
