import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createContextKey, definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  asTabsTrigger,
  type TabsTriggerProps,
  type TabsTriggerExposes,
} from '@proto.ui/prototypes-base/tabs';
import { tabsRoot, tabsList } from '../src/tabs';
import { styleContains } from '../../test-utils/style';
import {
  SHADCN_STYLE_SCOPE,
  SHADCN_STYLE_IDS,
  normalizeShadcnStyle,
  styleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleProps,
} from '../src/style-scope';

// Test-only real Base Tabs consumer. Two source-bound radius declarations are
// transport canaries, not complete Nova/Rhea Tabs projections.
let contextNotifications = 0;
const canary = definePrototype<TabsTriggerProps & ShadcnStyleProps, TabsTriggerExposes>({
  name: 'shadcn-style-tabs-canary',
  setup(def) {
    asTabsTrigger();
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, () => {
      contextNotifications++;
    });
    const style = setupShadcnStyleSelection(def, 'new-york-v4');
    for (const [id, radius] of [
      ['nova', 'rounded-md'],
      ['rhea', 'rounded-2xl'],
      ['new-york-v4', 'rounded-sm'],
    ] as const) {
      def.rule({
        when: (w) => w.state(style).eq(id),
        intent: (i) => i.feedback.style.use(tw(radius)),
      });
    }
  },
});
[styleScope, tabsRoot, tabsList, canary].forEach((p) => AdaptToWebComponent(p as any));
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const element = (name: string, props: Record<string, unknown> = {}) => {
  const el = document.createElement(name) as any;
  setElementProps(el, props);
  return el;
};
function tree(nested = false) {
  const scope = element('shadcn-style-scope', { styleProfile: 'nova' });
  const inner = element('shadcn-style-scope');
  const root = element('shadcn-tabs-root', { defaultValue: 'a', activationMode: 'manual' });
  const list = element('shadcn-tabs-list');
  const a = element(canary.name, { value: 'a' });
  const b = element(canary.name, { value: 'b' });
  list.append(a, b);
  root.append(list);
  if (nested) {
    inner.append(root);
    scope.append(inner);
  } else scope.append(root);
  document.body.append(scope);
  return { scope, inner, root, a, b };
}
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('draft shared Shadcn style scope', () => {
  it('keeps canonical membership, legacy alias and reference identity distinct', () => {
    expect(SHADCN_STYLE_IDS).toHaveLength(9);
    expect(normalizeShadcnStyle('new-york')).toBe('new-york-v4');
    expect(normalizeShadcnStyle('inherit')).toBeNull();
    expect(() => normalizeShadcnStyle('future')).toThrow('Unknown style');
    expect(createContextKey('shadcn-style-scope')).not.toBe(SHADCN_STYLE_SCOPE);
  });
  it('withdraws old paint while keeping actual Tabs value, handles, focus and nodes', async () => {
    const { scope, root, a, b } = tree();
    await flush();
    b.click();
    await flush();
    b.focus();
    await flush();
    const value = root.getExposes().value;
    const selected = b.getExposes().selected;
    let valueSignals = 0;
    const off = value.subscribe(() => {
      valueSignals++;
    });
    expect(value.get()).toBe('b');
    expect(styleContains(b, 'rounded-md')).toBe(true);
    setElementProps(scope, { styleProfile: 'rhea' });
    await flush();
    expect(styleContains(b, 'rounded-2xl')).toBe(true);
    expect(styleContains(b, 'rounded-md')).toBe(false);
    expect(root.getExposes().value).toBe(value);
    expect(b.getExposes().selected).toBe(selected);
    expect(value.get()).toBe('b');
    expect(selected.get()).toBe(true);
    expect(document.activeElement).toBe(b);
    expect(root.contains(a)).toBe(true);
    expect(root.contains(b)).toBe(true);
    setElementProps(scope, { styleProfile: 'nova' });
    await flush();
    expect(styleContains(b, 'rounded-md')).toBe(true);
    expect(styleContains(b, 'rounded-2xl')).toBe(false);
    expect(value.get()).toBe('b');
    expect(document.activeElement).toBe(b);
    expect(valueSignals).toBe(0);
    value.unsubscribe(off);
  });
  it('uses explicit choice before nearest scope and lets inherit resume live updates', async () => {
    const { scope, inner, a, b } = tree(true);
    await flush();
    setElementProps(inner, { styleProfile: 'rhea' });
    setElementProps(a, { value: 'a', styleProfile: 'new-york' });
    await flush();
    expect(styleContains(a, 'rounded-sm')).toBe(true);
    expect(styleContains(b, 'rounded-2xl')).toBe(true);
    setElementProps(scope, { styleProfile: 'new-york-v4' });
    await flush();
    expect(styleContains(b, 'rounded-2xl')).toBe(true);
    setElementProps(a, { value: 'a', styleProfile: 'inherit' });
    await flush();
    expect(styleContains(a, 'rounded-2xl')).toBe(true);
    setElementProps(inner, { styleProfile: 'inherit' });
    await flush();
    expect(styleContains(a, 'rounded-sm')).toBe(true);
    expect(styleContains(b, 'rounded-sm')).toBe(true);
  });
  it('preserves leaf compatibility when an inherited scope has no concrete choice', async () => {
    const { scope, a } = tree(true);
    setElementProps(scope, { styleProfile: 'inherit' });
    await flush();
    expect(styleContains(a, 'rounded-sm')).toBe(true);
    expect(styleContains(a, 'rounded-md')).toBe(false);
  });
  it('binds membership and bounded radius evidence to the prerequisite source manifest', () => {
    const source = resolve(process.cwd(), 'internal/fixtures/shadcn-style-source');
    const manifest = JSON.parse(readFileSync(resolve(source, 'manifest.json'), 'utf8'));
    expect(SHADCN_STYLE_IDS).toEqual([...manifest.styles, manifest.legacy.id]);
    expect(manifest.revision).toBe('3d98900e9b73c45f035f8109e9d41ba6a51685e7');
    for (const [style, token] of [
      ['nova', 'rounded-md'],
      ['rhea', 'rounded-2xl'],
    ]) {
      const css = readFileSync(
        resolve(source, `upstream/apps/v4/registry/styles/style-${style}.css`),
        'utf8'
      );
      expect(css.match(/\.cn-tabs-trigger \{([^}]+)\}/)?.[1].split(/\s+/)).toContain(token);
    }
  });
  it('removes Context callbacks on terminal adapter disposal', async () => {
    const { scope, root } = tree();
    await flush();
    root.remove();
    await flush();
    const before = contextNotifications;
    setElementProps(scope, { styleProfile: 'rhea' });
    await flush();
    expect(contextNotifications).toBe(before);
  });
});
