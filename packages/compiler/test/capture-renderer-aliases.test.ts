// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { emitGpuiSource } from '../src/gpui-source';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';
import { childRendererAliasSource } from './fixtures/capture-renderer-alias';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

const emitters = [
  ['gpui-source-v1', emitGpuiSource],
  ['react-dom-source-v1', emitReactSource],
  ['vue-source-v1', emitVueSource],
  ['vue2-source-v1', emitVue2Source],
  ['web-component-source-v1', emitWebComponentSource],
] as const;

for (const mode of ['direct', 'copied', 'forwarded'] as const)
  describe(`${mode} child renderer getter`, () => {
    it('preserves actual parsed callable provenance across portable IR and all native emitters', () => {
      const parsed = parsePrototype(childRendererAliasSource(mode));
      expect(parsed.ok, JSON.stringify(parsed.ok ? null : parsed.diagnostics)).toBe(true);
      if (!parsed.ok) throw new Error('authored child getter must parse');
      const portable = JSON.parse(JSON.stringify(parsed.value));
      expect(validateIR(portable)).toMatchObject({ ok: true });
      for (const [profile, emit] of emitters) {
        const output = emit(portable);
        expect(
          output.ok,
          `${profile}: ${JSON.stringify(output.ok ? null : output.diagnostics)}`
        ).toBe(true);
        if (output.ok && profile === 'gpui-source-v1')
          expect(output.value.code).not.toContain(
            'checked native renderer entry has no scalar callback alternative'
          );
      }
    });

    for (const profile of nativeOwnerProfiles)
      it(`${profile} actually renders the selected child and retains getter identity`, async () => {
        const owner = await mountNativeOwner(childRendererAliasSource(mode), profile);
        cleanup.push(owner.dispose);
        if (profile === 'web-component-source-v1') {
          // The WC port retains consumer light-DOM children even without a
          // slot. Check the generated text separately from that native child.
          const element = owner.host.firstElementChild!;
          const child = element.querySelector('b');
          const renderedText = () =>
            Array.from(element.childNodes)
              .filter((node) => node.nodeType === Node.TEXT_NODE)
              .map((node) => node.textContent);
          expect(renderedText()).toEqual(['text']);
          expect(child?.textContent).toBe('native-child');
          await owner.act(() => owner.handle.update());
          expect(renderedText()).toEqual(['text']);
          expect(element.querySelector('b')).toBe(child);
          expect(child?.parentNode).toBe(element);
        } else expect(owner.host.textContent).toBe('text');
        expect(owner.handle.getExposes().sameGetter).toBe(true);
      });
  });
