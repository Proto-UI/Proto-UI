// @vitest-environment node
import { expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';

it.each(['null', "'captured text'", '42'])(
  'captures an authored hook scalar renderer before ordinary handle transport: %s',
  (result) => {
    const source = `import {definePrototype,defineAsHook} from '@proto.ui/core';
      const asContent=defineAsHook({name:'arbitrary-content',setup(){return()=>${result};}});
      export default definePrototype({name:'arbitrary-consumer',setup(){return asContent().render;}});`;
    const output = compilePrototype(source, { profile: 'gpui-source-v1' });
    expect(output.ok, JSON.stringify(output.ok ? {} : output.diagnostics)).toBe(true);
    if (!output.ok) return;
    // The hook owns the checked scalar-to-snapshot conversion, while retaining
    // the original callable used by the authored capture's render field.
    const code = output.value.output.code;
    const start = code.indexOf('fn authored_hook_0');
    expect(start).toBeGreaterThanOrEqual(0);
    const hook = code.slice(start, code.indexOf('pub struct', start));
    expect(hook).toContain(
      'capture_renderer(Value::Function(callback.clone()),Rc::new(move |arguments:Vec<Value>|'
    );
    expect(hook).toContain('callback(arguments)');
    expect(hook).not.toContain('checked native renderer entry has no scalar callback alternative');
  }
);

it('keeps ordinary hook renderer identity, repeated reads, and public aliases', () => {
  const source = `import {definePrototype,defineAsHook} from '@proto.ui/core';
    const render=()=> 'captured text';
    const asContent=defineAsHook({name:'identity-content',setup(){return render;}});
    export default definePrototype({name:'identity-consumer',setup(def){
      const content=asContent();
      def.expose.value('same',content.render===render);
      def.expose.value('self',content.render===content.render);
      def.expose.value('direct',render());
      def.expose.value('kind',typeof content.render);
      def.expose.value('api',{render:content.render,original:render});
      return content.render;
    }});`;
  const output = compilePrototype(source, { profile: 'gpui-source-v1' });
  expect(output.ok, JSON.stringify(output.ok ? {} : output.diagnostics)).toBe(true);
  if (!output.ok) return;
  expect(output.value.output.code).toContain(
    'capture_renderer(Value::Function(callback.clone()),Rc::new('
  );
  expect(output.value.output.code).toContain(
    'Value::Renderer(adapter) => Value::Renderer(adapter)'
  );
  const owner = output.value.output.supportingFiles?.find((file) =>
    file.path.endsWith('/gpui-native-owner.rs')
  )?.contents;
  expect(owner).toBeDefined();
  // These tests are compiled and executed by the native SDK test-support gate.
  expect(owner).toContain('fn captured_scalar_renderer_keeps_identity_and_direct_invocation()');
  expect(owner).toContain('fn public_renderer_aliases_keep_guards_and_scalar_call_behavior()');
  expect(owner).toContain('fn captured_native_renderer_retains_its_original_callable_identity()');
});

it('retains the explicit rejection for a capture renderer without a statically typed call signature', () => {
  const source = `import {definePrototype,defineAsHook} from '@proto.ui/core';
    const asContent=defineAsHook({name:'called-content',setup(){return()=> 'text';}});
    export default definePrototype({name:'called-consumer',setup(){const content=asContent();return r=>content.render(r);}});`;
  const output = compilePrototype(source, { profile: 'gpui-source-v1' });
  expect(output.ok).toBe(false);
  if (output.ok) return;
  expect(output.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'PUI1006',
        message: 'Call requires a statically typed callable value.',
      }),
    ])
  );
});
