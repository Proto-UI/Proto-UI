import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { progressRoot, progressValue } from '../src/progress';
import { meterRoot, meterValue } from '../src/meter';
for (const prototype of [progressRoot, progressValue, meterRoot, meterValue])
  AdaptToWebComponent(prototype);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
for (const kind of ['progress', 'meter'])
  for (const observer of ['root', 'value'])
    it(`${kind} keeps the latest owner after synchronous ${observer} publication`, async () => {
      const root = document.createElement(`base-${kind}-root`) as any;
      const value = document.createElement(`base-${kind}-value`) as any;
      setElementProps(root, { value: 10 });
      root.append(value);
      document.body.append(root);
      await flush();
      let replaced = false;
      const off = (observer === 'root' ? root : value)
        .getExposes()
        .value.subscribe((event: any) => {
          if (event.type !== 'next' || replaced) return;
          replaced = true;
          setElementProps(root, { value: 80, min: 0, max: 200, valueText: 'Latest owner' });
        });
      setElementProps(root, { value: 25 });
      await flush();
      expect(replaced).toBe(true);
      expect(root.getExposes().value.get()).toBe(80);
      expect(root.getExposes().percentage.get()).toBe(40);
      expect(root.getAttribute('aria-valuenow')).toBe('80');
      expect(root.getAttribute('aria-valuemax')).toBe('200');
      expect(value.textContent).toBe('Latest owner');
      off();
    });
