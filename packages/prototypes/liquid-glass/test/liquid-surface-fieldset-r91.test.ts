import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterOptions,
} from '@proto.ui/adapter-web-component';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import surfaceRoot from '../src/surface';
import { fieldsetRoot, fieldsetLegend, fieldsetDescription } from '../src/fieldset';
import { fieldRoot, fieldControl } from '../src/field';

// Real public Adapter/Runtime observations. The sink records submitted intent
// and preserves style projection; it is not a material provider or paint oracle.
const frames = new WeakMap<HTMLElement, VisualFeedbackFrame[]>();
const releases = new WeakMap<HTMLElement, number>();
const createVisualSink: NonNullable<WebComponentAdapterOptions['createVisualSink']> = (
  host,
  effects
) => {
  const records: VisualFeedbackFrame[] = [];
  frames.set(host, records);
  return {
    commit(frame) {
      records.push(frame);
      effects.queueStyle({ ...frame.style, tokens: [...frame.style.tokens] });
      effects.requestFlush();
    },
    release() {
      releases.set(host, (releases.get(host) ?? 0) + 1);
    },
  };
};
const options = (part: string) => ({
  registerAs: `liquid-material-boundary-r91-${part}`,
  shadow: false,
  createVisualSink,
});
const Surface = AdaptToWebComponent(surfaceRoot, options('surface'));
const Fieldset = AdaptToWebComponent(fieldsetRoot, options('fieldset'));
const Legend = AdaptToWebComponent(fieldsetLegend, options('legend'));
const Description = AdaptToWebComponent(fieldsetDescription, options('description'));
const Field = AdaptToWebComponent(fieldRoot, options('field'));
const Control = AdaptToWebComponent(fieldControl, options('control'));
const slot = {
  version: 2,
  shape: { kind: 'rounded-rect', geometry: 'style' },
  source: { kind: 'in-app-backdrop' },
  fallback: { fill: 'style', foreground: 'style' },
};
const glass = { intent: 'liquid-glass', variant: 'regular' };
function latest(host: HTMLElement): VisualFeedbackFrame {
  const frame = frames.get(host)?.at(-1);
  if (!frame) throw new Error(`Missing visual frame for ${host.localName}`);
  return frame;
}
function expectNoMaterial(...hosts: HTMLElement[]) {
  for (const host of hosts) expect(latest(host).material).toEqual({ slot: null, candidates: [] });
}
async function flush() {
  for (let index = 0; index < 30; index++) await Promise.resolve();
  await vi.runOnlyPendingTimersAsync();
  for (let index = 0; index < 30; index++) await Promise.resolve();
}
beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

describe('Liquid Surface explicit material request, not blanket content glass', () => {
  it('keeps ordinary defaults and caller content while opt-in, opt-out and removal replace the candidate', async () => {
    const surface = new Surface();
    const content = document.createElement('p');
    content.textContent = 'Ordinary content keeps its own identity';
    surface.append(content);
    document.body.append(surface);
    await flush();

    expect(latest(surface).material).toEqual({ slot, candidates: [] });
    expect(latest(surface).style.tokens).toEqual(
      expect.arrayContaining([
        'rounded-none',
        'border',
        'border-border',
        'bg-background',
        'text-foreground',
      ])
    );
    setElementProps(surface, { material: 'auto', variant: 'secondary', radius: 'md' });
    await flush();
    expect(latest(surface).material).toEqual({ slot, candidates: [glass] });
    expect(latest(surface).style.tokens).toEqual(
      expect.arrayContaining(['rounded-md', 'bg-secondary', 'text-secondary-foreground'])
    );

    setElementProps(surface, { material: 'opaque', variant: 'secondary', radius: 'md' });
    await flush();
    expect(latest(surface).material).toEqual({ slot, candidates: [] });
    expect(latest(surface).style.tokens).toContain('bg-secondary');
    setElementProps(surface, { material: 'auto' });
    await flush();
    expect(latest(surface).material.candidates).toEqual([glass]);
    setElementProps(surface, {});
    await flush();
    expect(latest(surface).material).toEqual({ slot, candidates: [] });
    expect(latest(surface).style.tokens).toContain('bg-background');
    expect(latest(surface).style.tokens).not.toContain('bg-secondary');
    expect(surface.contains(content)).toBe(true);
    expect(content.textContent).toBe('Ordinary content keeps its own identity');
    expect(surface.getExposes()).toEqual({});
    expect(surface.getAttribute('role')).toBeNull();
    expect(surface.getAttribute('tabindex')).toBeNull();
    expect(frames.get(surface)?.every((frame) => frame.material.candidates.length <= 1)).toBe(true);
  });

  it.each([
    ['outline', true],
    ['secondary', true],
    ['muted', true],
    ['transparent', false],
    ['accent', false],
    ['solid', false],
    ['scrim', false],
  ] as const)(
    'keeps %s ordinary until explicitly requested and preserves its eligibility',
    async (variant, eligible) => {
      const surface = new Surface();
      setElementProps(surface, { variant, hovered: true, pressed: true, current: true });
      document.body.append(surface);
      await flush();
      expect(latest(surface).material.candidates).toEqual([]);
      setElementProps(surface, { variant, material: 'auto' });
      await flush();
      expect(latest(surface).material.candidates).toEqual(eligible ? [glass] : []);
      expect(surface.getExposes()).toEqual({});
      expect(surface.getAttribute('role')).toBeNull();
    }
  );

  it('releases an opted-in view and reconnects with the current ordinary request and retained slot content', async () => {
    const surface = new Surface();
    const content = document.createElement('span');
    content.textContent = 'Retained caller content';
    surface.append(content);
    setElementProps(surface, { material: 'auto', variant: 'muted' });
    document.body.append(surface);
    await flush();
    expect(latest(surface).material.candidates).toEqual([glass]);
    surface.remove();
    await flush();
    expect(releases.get(surface)).toBeGreaterThan(0);
    setElementProps(surface, {});
    document.body.append(surface);
    await flush();
    expect(latest(surface).material).toEqual({ slot, candidates: [] });
    expect(surface.contains(content)).toBe(true);
    expect(latest(surface).style.tokens).toContain('bg-background');
  });
});

describe('Liquid Fieldset ordinary content preserves its inherited policy and relations', () => {
  it('keeps nested group names and descriptions scoped without any enclosing material slot', async () => {
    const outer = new Fieldset();
    const inner = new Fieldset();
    const outerLegend = new Legend();
    const innerLegend = new Legend();
    const outerDescription = new Description();
    const innerDescription = new Description();
    outerLegend.textContent = 'Outer group';
    innerLegend.textContent = 'Inner group';
    outerDescription.textContent = 'Outer help';
    innerDescription.textContent = 'Inner help';
    inner.append(innerLegend, innerDescription);
    outer.append(outerLegend, outerDescription, inner);
    document.body.append(outer);
    await flush();

    expect(outer.getAttribute('role')).toBe('group');
    expect(outer.getAttribute('aria-labelledby')).toBe(outerLegend.id);
    expect(outer.getAttribute('aria-describedby')).toBe(outerDescription.id);
    expect(inner.getAttribute('aria-labelledby')).toBe(innerLegend.id);
    expect(inner.getAttribute('aria-describedby')).toBe(innerDescription.id);
    expectNoMaterial(outer, inner, outerLegend, innerLegend, outerDescription, innerDescription);
    expect(latest(outer).style.tokens).toEqual(
      expect.arrayContaining(['rounded-2xl', 'border', 'border-border', 'p-4', 'gap-3'])
    );

    outerLegend.remove();
    outerDescription.remove();
    await flush();
    expect(outer.getAttribute('aria-labelledby')).toBeNull();
    expect(outer.getAttribute('aria-describedby')).toBeNull();
    expect(inner.getAttribute('aria-labelledby')).toBe(innerLegend.id);
    expect(inner.getAttribute('aria-describedby')).toBe(innerDescription.id);
    expect(outer.contains(inner)).toBe(true);
    expectNoMaterial(outer, inner);
  });

  it('propagates local-or-ancestor disabled into the real Field editor without material or value ownership', async () => {
    const outer = new Fieldset();
    const inner = new Fieldset();
    const legend = new Legend();
    const description = new Description();
    const field = new Field();
    const control = new Control();
    legend.textContent = 'Profile';
    description.textContent = 'A governed editor inside ordinary content';
    setElementProps(outer, { disabled: true });
    setElementProps(control, { defaultValue: 'Retained value' });
    field.append(control);
    inner.append(legend, description, field);
    outer.append(inner);
    document.body.append(outer);
    await flush();
    const editor = control.querySelector('input');
    expect(editor).toBeInstanceOf(HTMLInputElement);
    if (!editor) throw new Error('Field Control did not render its inherited input');
    for (const part of [outer, inner, legend, description])
      expect(part.getExposes().disabled.get()).toBe(true);
    expect(editor.disabled).toBe(true);
    expectNoMaterial(outer, inner, legend, description);

    setElementProps(inner, { disabled: true });
    setElementProps(outer, {});
    await flush();
    expect(outer.getExposes().disabled.get()).toBe(false);
    expect(inner.getExposes().disabled.get()).toBe(true);
    expect(editor.disabled).toBe(true);
    setElementProps(inner, {});
    await flush();
    for (const part of [outer, inner, legend, description])
      expect(part.getExposes().disabled.get()).toBe(false);
    expect(editor.disabled).toBe(false);
    expect(control.getExposes().value.get()).toBe('Retained value');
    expect(editor.value).toBe('Retained value');
    expect(control.querySelector('input')).toBe(editor);
    expectNoMaterial(outer, inner, legend, description);
    expect(outer.getExposes()).not.toHaveProperty('value');
    expect(outer.getExposes()).not.toHaveProperty('requestSubmit');
  });
});
