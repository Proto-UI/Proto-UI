// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { compileFile, compilePrototype } from '../src/compile';
import { validateIR } from '../src/ir-validation';
import { emitVue2Source } from '../src/vue2-source';
import { mountNativeOwner } from './native-owner-consumer';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
  document.body.replaceChildren();
});

function source(operator: '??' | '||' | '&&', enabled: boolean) {
  return `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'ordinary-logical-renderer',setup(def){
      def.props.define({label:{type:'string',default:'first'}});
      const label=def.state.string('label','first');
      def.expose.state('label',label);
      def.props.watch(['label'],(run,next)=>{label.set(next.label);run.update();});
      const primary=()=>['primary:',label.get()];
      const fallback=()=>['fallback:',label.get()];
      const selected=${enabled} ? primary : undefined;
      return selected ${operator} fallback;
    }});`;
}

describe('Vue2 setup renderer logical-expression provenance', () => {
  it.each([
    ['??', true, 'primary:'],
    ['??', false, 'fallback:'],
    ['||', true, 'primary:'],
    ['||', false, 'fallback:'],
    ['&&', true, 'fallback:'],
    ['&&', false, undefined],
  ] as const)(
    'retains %s branch selection (primary=%s), updates and cleanup',
    async (operator, primary, prefix) => {
      const compiled = compilePrototype(source(operator, primary), { profile: 'vue2-source-v1' });
      if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
      const cold = validateIR(JSON.parse(JSON.stringify(compiled.value.ir)));
      expect(cold.ok).toBe(true);
      if (!cold.ok) return;
      expect(emitVue2Source(cold.value).ok).toBe(true);
      const owner = await mountNativeOwner(compiled.value, 'vue2-source-v1', {
        props: { label: 'first' },
      });
      cleanups.push(owner.dispose);
      const physical = owner.host.firstChild;
      expect(owner.host.textContent).toBe(prefix ? `${prefix}first` : 'native-child');
      await owner.setProps({ label: 'second' });
      expect(owner.handle.getExposes().label.get()).toBe('second');
      expect(owner.host.textContent).toBe(prefix ? `${prefix}second` : 'native-child');
      expect(owner.host.firstChild).toBe(physical);
      await owner.dispose();
      expect(owner.host.isConnected).toBe(false);
    }
  );

  it('emits the unchanged authored Shadcn Select Value and its cold IR', async () => {
    const result = await compileFile('packages/prototypes/shadcn/src/select/value.proto.ts', {
      root: process.cwd(),
      profile: 'vue2-source-v1',
    });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.output.profile).toBe('vue2-source-v1');
    const cold = validateIR(JSON.parse(JSON.stringify(result.value.ir)));
    expect(cold.ok).toBe(true);
    if (cold.ok) expect(emitVue2Source(cold.value).ok).toBe(true);
  }, 30_000);
});
