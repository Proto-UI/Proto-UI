import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDemo } from './demo-renderer';
import { loadDemo } from './demo-modules';
import { loadPrototypes } from './prototype-modules';
import { collectPrototypeIds } from './demo-types';

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup();
  }
  document.body.replaceChildren();
});

const POPOVER_DEMOS = [
  { demoId: 'demo-shadcn-popover', defaults: ['100%', '300px', '25px', 'none'] },
  { demoId: 'demo-brutalist-popover', defaults: ['100%', '300px', '25px', 'none'] },
  { demoId: 'demo-bootstrap-2-3-2-popover', defaults: ['100%', '25px'] },
  { demoId: 'demo-liquid-glass-popover', defaults: ['100%', '300px', '25px'] },
] as const;

describe('Popover interactive inputs across all four families', () => {
  for (const { demoId, defaults } of POPOVER_DEMOS) {
    it(`${demoId} mounts real interactive input prototypes and resets their values`, async () => {
      const demo = await loadDemo(demoId);
      const ids = new Set<string>();
      collectPrototypeIds(demo.root, ids);
      await loadPrototypes([...ids]);

      const host = document.createElement('div');
      document.body.append(host);
      const rendered = await renderDemo({ runtime: 'wc', demo, host });
      cleanups.push(rendered.destroy);

      const trigger = host.querySelector<HTMLElement>('[role="button"]');
      expect(trigger).not.toBeNull();
      trigger!.click();

      const inputs = await vi.waitFor(() => {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
        expect(dialog).not.toBeNull();
        const found = [...dialog!.querySelectorAll<HTMLInputElement>('input')];
        expect(found).toHaveLength(defaults.length);
        return found;
      });

      expect(inputs.map((input) => input.value)).toEqual([...defaults]);
      expect(inputs.every((input) => !input.disabled && !input.readOnly)).toBe(true);

      const edited = defaults.map((_, index) => `${200 + index * 40}px`);
      for (const [index, input] of inputs.entries()) {
        input.value = edited[index]!;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      expect(inputs.map((input) => input.value)).toEqual(edited);

      const resetButton = document.querySelector<HTMLElement>('[data-demo-ref="reset"]');
      expect(resetButton).not.toBeNull();
      expect(resetButton!.textContent?.trim()).toMatch(/^Reset/);
      resetButton!.click();

      await vi.waitFor(() => {
        expect(inputs.map((input) => input.value)).toEqual([...defaults]);
      });
    }, 20000);
  }
});
