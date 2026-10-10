import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as baseProgress from '../src/progress';
import * as baseMeter from '../src/meter';
import * as shadcnProgress from '../../shadcn/src/progress';
import * as shadcnMeter from '../../shadcn/src/meter';
import * as brutalistProgress from '../../brutalist/src/progress';
import * as brutalistMeter from '../../brutalist/src/meter';
import * as bootstrapProgress from '../../bootstrap-2-3-2/src/progress';
import * as bootstrapMeter from '../../bootstrap-2-3-2/src/meter';
import * as liquidProgress from '../../liquid-glass/src/progress';
import * as liquidMeter from '../../liquid-glass/src/meter';
const families = [
  ['base', baseProgress, baseMeter],
  ['shadcn', shadcnProgress, shadcnMeter],
  ['brutalist', brutalistProgress, brutalistMeter],
  ['bootstrap-2-3-2', bootstrapProgress, bootstrapMeter],
  ['liquid-glass', liquidProgress, liquidMeter],
] as const;
for (const [, progress, meter] of families)
  for (const group of [progress, meter])
    for (const [key, p] of Object.entries(group))
      if (/^(progress|meter)(Root|Label|Track|Indicator|Value)$/.test(key))
        AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
for (const [family] of families)
  describe(family + ' numerical readouts', () => {
    function fixture(component: string, props: Record<string, unknown>) {
      const part = (role: string) =>
        document.createElement(`${family}-${component}-${role}`) as any;
      const root = part('root'),
        label = part('label'),
        track = part('track'),
        indicator = part('indicator'),
        value = part('value');
      label.textContent = 'Transfer';
      track.append(indicator);
      root.append(label, track, value);
      setElementProps(root, props);
      document.body.append(root);
      return { root, label, track, indicator, value };
    }
    it('propagates clamped and indeterminate progress, retaining an anatomy label', async () => {
      const f = fixture('progress', { value: 25, min: 0, max: 50 });
      await flush();
      expect(f.root.getExposes().percentage.get()).toBe(50);
      expect(f.indicator.getExposes().percentage.get()).toBe(50);
      expect(f.value.textContent).toBe('25');
      expect(f.root.getAttribute('role')).toBe('progressbar');
      expect(f.root.getAttribute('aria-labelledby')).toBe(f.label.id);
      setElementProps(f.root, { value: 70, min: 0, max: 50 });
      await flush();
      expect(f.root.getExposes().value.get()).toBe(50);
      expect(f.root.getExposes().status.get()).toBe('complete');
      setElementProps(f.root, { indeterminate: true });
      await flush();
      expect(f.indicator.getExposes().indeterminate.get()).toBe(true);
      expect(f.value.textContent).toBe('');
      setElementProps(f.root, { value: 0, min: 0, max: 0 });
      await flush();
      expect(f.root.getExposes().percentage.get()).toBe(0);
    });
    it('derives meter zones without treating the threshold as its value', async () => {
      const f = fixture('meter', { value: 90, low: 20, high: 70, optimum: 10 });
      await flush();
      expect(f.root.getAttribute('role')).toBe('meter');
      expect(f.root.getExposes().status.get()).toBe('critical');
      expect(f.value.textContent).toBe('90');
      setElementProps(f.root, {
        value: 10,
        low: 20,
        high: 70,
        optimum: 10,
        valueText: 'Low pressure',
      });
      await flush();
      expect(f.indicator.getExposes().status.get()).toBe('optimal');
      expect(f.value.textContent).toBe('Low pressure');
      f.root.remove();
      await flush();
      document.body.append(f.root);
      await flush();
      expect(f.root.getExposes().value.get()).toBe(10);
    });
  });
