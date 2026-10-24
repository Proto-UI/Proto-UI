import { afterEach, expect, it } from 'vitest';
import {
  mount,
  expanded,
  disabled,
  dispose,
  sample,
} from '../../../scripts/analysis/fixtures/self-hit-region.mjs';
afterEach(() => {
  document.body.replaceChildren();
  document.head.querySelectorAll('style').forEach((x) => x.remove());
});
it.each(['wc', 'react', 'vue', 'vue2'])(
  'mounts the actual %s native fixture and retains its root through lease changes',
  async (runtime) => {
    await mount(runtime);
    const root = document.querySelector<HTMLElement>('[role=switch]')!;
    root.focus();
    expect(sample().same).toBe(true);
    expect(sample().focused).toBe(true);
    expanded(true);
    expect(sample().marked).toBe(true);
    expect(sample().same).toBe(true);
    expect(sample().focused).toBe(true);
    disabled(true);
    await expect.poll(() => sample().disabled).toBe('true');
    expect(sample().same).toBe(true);
    expect(sample().marked).toBe(true);
    disabled(false);
    await expect.poll(() => sample().disabled).toBe('false');
    expect(sample().same).toBe(true);
    expect(sample().marked).toBe(true);
    root.focus();
    expanded(false);
    expect(sample().marked).toBe(false);
    expect(sample().same).toBe(true);
    expect(sample().focused).toBe(true);
    expanded(true);
    dispose();
    await expect.poll(() => sample().connected).toBe(false);
    expect(sample().marked).toBe(false);
  }
);
