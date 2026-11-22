// @vitest-environment happy-dom
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { compileFile, compilePrototype } from '../src/compile';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
});

for (const family of ['base', 'shadcn', 'brutalist'])
  for (const profile of nativeOwnerProfiles)
    it(`${family}/${profile}: consumes the full authored Button without rewriting its definition`, async () => {
      const listeners = new Set<() => void>();
      let reduced = false;
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query) =>
          ({
            media: query,
            get matches() {
              return query === '(prefers-reduced-motion: no-preference)'
                ? !reduced
                : query === '(prefers-reduced-motion: reduce)'
                  ? reduced
                  : false;
            },
            addEventListener(_type: string, callback: () => void) {
              listeners.add(callback);
            },
            removeEventListener(_type: string, callback: () => void) {
              listeners.delete(callback);
            },
          }) as unknown as MediaQueryList
      );
      document.documentElement.dataset.theme = 'light';
      const root = path.resolve(__dirname, '../../..');
      const compiled = await compileFile(
        `packages/prototypes/${family}/src/button/button.proto.ts`,
        { root, profile }
      );
      if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
      const owner = await mountNativeOwner(compiled.value, profile, {
        props: { styleProfile: 'vega', variant: family === 'shadcn' ? 'outline' : 'solid' },
      });
      cleanup.push(owner.dispose);
      await owner.flush();
      const element =
        profile === 'web-component-source-v1'
          ? owner.host.firstElementChild!
          : owner.host.querySelector('[data-pui-root]')!;
      const tokens = () => new Set(element.getAttribute('data-pui-style')?.split(' '));
      expect(
        element.textContent || element.shadowRoot?.textContent || owner.host.textContent
      ).toContain('native-child');
      if (family === 'shadcn') {
        expect(tokens().has('bg-input/30')).toBe(false);
        document.documentElement.dataset.theme = 'dark';
        await window.happyDOM.whenAsyncComplete();
        await owner.flush();
        expect(tokens().has('bg-input/30')).toBe(true);
        document.documentElement.dataset.theme = 'light';
        await window.happyDOM.whenAsyncComplete();
        await owner.flush();
        expect(tokens().has('bg-input/30')).toBe(false);
      }
      if (family === 'brutalist') {
        expect(tokens().has('transition-all')).toBe(true);
        reduced = true;
        for (const listener of listeners) listener();
        await owner.flush();
        await owner.flush();
        expect(tokens().has('transition-none')).toBe(true);
        expect(tokens().has('transition-all')).toBe(false);
      }
      await owner.setProps({
        disabled: true,
        styleProfile: 'vega',
        variant: family === 'shadcn' ? 'outline' : 'solid',
      });
      expect(owner.host.contains(element)).toBe(true);
      expect(element.getAttribute('aria-disabled')).toBe('true');
      await owner.dispose();
      expect(listeners.size).toBe(0);
    }, 45_000);

it('expands only proven static enumeration and rejects container mutation, escape and builtin shadowing', () => {
  const program = (extra = '', prefix = '') => `import {definePrototype,tw} from '@proto.ui/core';
  export default definePrototype({name:'renamed-table',setup(def){
    ${prefix}const tokens={'2':'bg-red','1':'bg-black',last:'bg-white'};${extra}
    Object.keys(tokens).forEach(key=>def.rule({when:w=>w.t(),intent:i=>i.feedback.style.use(tw(tokens[key]))}));
  }});`;
  const compiled = compilePrototype(program(), { profile: 'react-dom-source-v1' });
  expect(compiled.ok).toBe(true);
  if (compiled.ok) {
    const rules = compiled.value.ir.setup.body.filter((statement) => statement.kind === 'effect');
    expect(rules.map((statement) => JSON.stringify(statement)).join('\n')).toMatch(
      /bg-black[\s\S]*bg-red[\s\S]*bg-white/
    );
  }
  for (const invalid of [
    program("tokens.last='bg-green';"),
    program('const escaped=tokens;'),
    program('', "const Object={keys:(x:unknown)=>['last']};"),
    program()
      .replace("const tokens={'2':'bg-red','1':'bg-black',last:'bg-white'};", '')
      .replace('}});', "const tokens={'2':'bg-red','1':'bg-black',last:'bg-white'};}});"),
  ])
    expect(compilePrototype(invalid, { profile: 'react-dom-source-v1' })).toMatchObject({
      ok: false,
    });
});
