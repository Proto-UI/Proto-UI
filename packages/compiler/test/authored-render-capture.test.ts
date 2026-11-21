// @vitest-environment node
import { expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { validateIR } from '../src/ir-validation';

it.each([
  ['void', ''],
  ['fragment', 'return r => r.el("output", String(7));'],
])('forwards an optional %s authored render without losing String admission', (_kind, body) => {
  const source = `import {defineAsHook,definePrototype} from '@proto.ui/core';
    const asFragment=defineAsHook({name:'fragment',setup(){${body}}});
    export default definePrototype({name:'owner',setup(){
      String(8);
      const inherited=asFragment();
      return inherited.render;
    }});`;
  const compiled = compilePrototype(source, { profile: 'react-dom-source-v1' });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  expect(validateIR(JSON.parse(JSON.stringify(compiled.value.ir)))).toMatchObject({ ok: true });
});
