// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { compilePrototype } from '../src/compile';

describe('independent closure provenance controls', () => {
  it.each([
    `const create=()=>def.state.bool('flag',true);create();`,
    `const create=()=>def.state.bool('flag',true);const alias=create;alias();`,
    `const create=()=>def.state.bool('flag',true);const first=create;const second=first;second();`,
    `const factory=()=>()=>def.state.bool('flag',true);factory()();`,
  ])('captures the same direct hook state through ordinary call transport: %s', (body) => {
    const parsed = parsePrototype(`import{definePrototype,defineAsHook}from'@proto.ui/core';
      const install=defineAsHook({name:'captured',setup(def){${body}}});
      export default definePrototype({name:'consumer',setup(def){const handle=install();
        def.expose.method('read',()=>handle.getState?.('flag')?.get());
      }});`);
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (parsed.ok)
      expect(parsed.value.hooks[0].capture?.states).toEqual([
        { name: 'flag', type: 'state:boolean' },
      ]);
  });

  function compile(body: string) {
    const compiled = compilePrototype(
      `import{definePrototype}from'@proto.ui/core';import{asOverlay}from'@proto.ui/hooks';
      export default definePrototype({name:'demand',setup(){${body}return r=>r.el('div',[]);}});`,
      { profile: 'react-dom-source-v1' }
    );
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
    if (!compiled.ok) throw new Error('expected admitted source');
    return compiled.value.output;
  }
  it.each([
    `const unused=()=>asOverlay();`,
    `let unused=()=>asOverlay();`,
    `const unused=()=>asOverlay();const box={unused};`,
    `const create=()=>()=>asOverlay();const unused=create();`,
    `const ignore=(callback:()=>void)=>{};ignore(()=>{asOverlay();});`,
  ])(
    'does not reach host support merely by creating/transporting an uncalled closure: %s',
    (body) => {
      const output = compile(body);
      expect(output.dependencies.map((item) => item.name)).not.toContain('@floating-ui/dom');
      expect(output.supportingFiles?.filter((file) => file.path.includes('/interaction/'))).toEqual(
        []
      );
    }
  );
  it('retains host support when the ordinary closure is actually called', () => {
    expect(
      compile(`const install=()=>asOverlay();install();`).dependencies.map((item) => item.name)
    ).toContain('@floating-ui/dom');
  });
});
