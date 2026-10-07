import { describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import {
  createRootStyleEffect,
  lowerRootStyleTokens,
  resolveRootStyleEntry,
} from '@proto.ui/core/internal';
import { createReactEffectsPort } from '../../react/src/runtime/effects-port';
import { createVueEffectsPort } from '../../vue/src/runtime/effects-port';
import { createVue2EffectsPort } from '../../vue2/src/runtime/effects-port';
import { createWebEffectsPort } from '../src/runtime/effects-port';
import { AdaptToWebComponent } from '../src/adapt';

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 E/F: collapsed targets ignore routing roles.
describe('collapsed Root role compatibility', () => {
  it.each([
    ['react', createReactEffectsPort],
    ['vue', createVueEffectsPort],
    ['vue2', createVue2EffectsPort],
    [
      'wc',
      (apply: (tokens: string[]) => void) =>
        createWebEffectsPort({ apply, clear() {}, getOwned: () => new Set<string>() }),
    ],
  ] as const)('%s emits exactly the existing ordered token projection', (_name, createPort) => {
    const projected: string[][] = [];
    const port = createPort((tokens) => projected.push(tokens));
    const effect = createRootStyleEffect([
      ...['w-2', 'bg-white', 'w-full', 'flex', 'translate-x-2', 'theme-extension'].map((t) =>
        resolveRootStyleEntry(t, 'setup')
      ),
      ...lowerRootStyleTokens(['w-8'], 'data-[checked]').entries,
    ]);
    port.queueStyle(effect);
    port.requestFlush();
    expect(projected.at(-1)).toEqual([
      'w-full',
      'bg-white',
      'flex',
      'translate-x-2',
      'theme-extension',
      'data-[checked]:w-8',
    ]);
    port.queueStyle(createRootStyleEffect([resolveRootStyleEntry('bg-black', 'runtime')]));
    port.requestFlush();
    expect(projected.at(-1)).toEqual(['bg-black']);
    port.queueStyle(createRootStyleEffect([]));
    port.requestFlush();
    expect(projected.at(-1)).toEqual([]);
  });

  it.each([undefined, false, true])(
    'keeps WC shadow=%s Root on the host without activating Template style',
    async (shadow) => {
      const proto = definePrototype({
        name: `root-role-compat-${String(shadow)}`,
        setup(def) {
          def.feedback.style.use(tw('w-full bg-white flex translate-x-2'));
          return (r) => r.el('span', { style: tw('w-4') }, 'content');
        },
      });
      const Element = AdaptToWebComponent(proto, { shadow });
      const el = new Element();
      el.setAttribute('data-pui-style', 'consumer-token');
      document.body.append(el);
      await Promise.resolve();
      await Promise.resolve();
      expect(el.getAttribute('data-pui-style')).toBe(
        'consumer-token w-full bg-white flex translate-x-2'
      );
      const child = (el.shadowRoot ?? el).querySelector('span')!;
      // Existing WC Template behavior: without a resolver, tw style is ignored.
      // Root provenance must not accidentally enroll this child in Root delivery.
      expect(child.getAttribute('data-pui-style')).toBeNull();
      expect(child.getAttribute('style')).toBeNull();
      expect(child.hasAttribute('entries')).toBe(false);
      el.remove();
      await Promise.resolve();
      await Promise.resolve();
      expect(el.getAttribute('data-pui-style')).toBe('consumer-token');
    }
  );
});
