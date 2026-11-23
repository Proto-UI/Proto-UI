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

it.each(['', 'return () => null;', 'return () => "caption";', 'return r => r.slot();'])(
  'preserves the scalar or native renderer borrowed from authored capture: %s',
  (body) => {
    const source = `import {defineAsHook,definePrototype} from '@proto.ui/core';
      const asContent=defineAsHook({name:'arbitrary-captured-content',setup(){${body}}});
      export default definePrototype({name:'arbitrary-capture-recipient',setup(){
        const content=asContent();return content.render;
      }});`;
    const compiled = compilePrototype(source, { profile: 'gpui-source-v1' });
    expect(compiled.ok, JSON.stringify(compiled.ok ? null : compiled.diagnostics)).toBe(true);
    if (compiled.ok)
      expect(validateIR(JSON.parse(JSON.stringify(compiled.value.ir))).ok).toBe(true);
  }
);
