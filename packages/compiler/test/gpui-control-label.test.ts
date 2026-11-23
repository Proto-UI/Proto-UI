// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compileFile, compilePrototype } from '../src/compile';

const prototype = (
  body: string
) => `import {definePrototype,createAnatomyFamily} from '@proto.ui/core';
  import {asControlLabel} from '@proto.ui/hooks';
  const family=createAnatomyFamily('native-direct-pair',{roles:{root:{cardinality:{min:1,max:1}},label:{cardinality:{min:1,max:1}},target:{cardinality:{min:1,max:1}}},relations:[{kind:'contains',parent:'root',child:'label'},{kind:'contains',parent:'root',child:'target'}]});
  export default definePrototype({name:'native-direct-pair',setup(def){${body};return r=>r.slot();}});`;

describe('GPUI direct control-label lowering', () => {
  it.each(['button/button', 'label/root', 'input/root'])(
    'compiles the complete unchanged official %s source',
    async (entry) => {
      const result = await compileFile(`packages/prototypes/base/src/${entry}.proto.ts`, {
        root: process.cwd(),
        profile: 'gpui-source-v1',
        gpuiDependency: 'workspace',
      });
      expect(result.ok, JSON.stringify(result.ok ? null : result.diagnostics)).toBe(true);
    }
  );
  it('admits a callback that tests its live association request', () => {
    const result = compilePrototype(
      prototype(`asControlLabel().target((run,request)=>{
      if(request.isCurrent()&&request.source==='pointer')run.update();});`),
      { profile: 'gpui-source-v1' }
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });
  it.each([
    "asControlLabel().label({family,labelRole:'label',targetRole:'target'})",
    "asControlLabel().target(()=>{},{family,labelRole:'label',targetRole:'target'})",
  ])('does not silently discard an anatomy descriptor: %s', (body) => {
    const result = compilePrototype(prototype(body), { profile: 'gpui-source-v1' });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI_GPUI_CONTROL_LABEL_ANATOMY' }],
    });
  });
});
