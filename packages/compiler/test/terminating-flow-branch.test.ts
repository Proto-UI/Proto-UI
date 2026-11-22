// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

function source(body: string): string {
  return `import {definePrototype, type RunHandle} from '@proto.ui/core';
  export default definePrototype({name:'flow-branch-consumer',setup(def){
    def.props.define({disabled:{type:'boolean',default:false}});
    let run:RunHandle<{disabled?:boolean}>|null=null;
    const cancel=()=>{run=null;};
    const sample=(invalid:boolean)=>{if(!run)return false;${body}
      return run.props.get().disabled!==true;};
    def.expose.method('sample',sample);
    def.lifecycle.onMounted(current=>{run=current;});
  }});`;
}

it.each([
  'if(invalid){cancel();return false;}',
  'if(invalid){cancel();throw new Error("invalid");}',
  'if(invalid){if(invalid){cancel();return false;}else{return false;}}',
  'if(!invalid){}else{cancel();return false;}',
])('retains a captured handle proof on the distinct continuing path: %s', (body) => {
  const result = parsePrototype(source(body));
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
  if (!result.ok) return;
  const portable = validateIR(JSON.parse(JSON.stringify(result.value)));
  expect(portable.ok, JSON.stringify(portable.ok ? {} : portable.diagnostics)).toBe(true);
});

it.each([
  'if(invalid){cancel();}',
  'if(invalid){}else{cancel();}',
  'if(invalid){cancel();return false;}cancel();',
  'if(invalid){cancel();}else{cancel();}',
])('rejects a captured handle when a continuing path can invalidate it: %s', (body) => {
  const parsed = parsePrototype(source(body));
  const checked = parsed.ok ? validateIR(JSON.parse(JSON.stringify(parsed.value))) : parsed;
  expect(checked.ok).toBe(false);
});
