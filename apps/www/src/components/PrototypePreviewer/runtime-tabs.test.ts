import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntimeTabs } from './runtime-tabs';
import type { ProjectionFamilyId } from './projection-families';
import { styleContains } from '../../../../../packages/prototypes/test-utils/style';

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((dispose) => dispose());
  document.body.replaceChildren();
});
function mount(family: ProjectionFamilyId) {
  const shell = document.createElement('section');
  const mount = document.createElement('div');
  const panel = document.createElement('div');
  panel.textContent = 'One real runtime host';
  shell.append(mount, panel);
  document.body.append(shell);
  const onValueChange = vi.fn();
  const tabs = createRuntimeTabs({
    mount,
    panel,
    family,
    runtimes: ['wc', 'react', 'vue', 'vue2'],
    value: 'wc',
    onValueChange,
  });
  cleanups.push(tabs.dispose);
  return { shell, panel, tabs, onValueChange };
}
for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const) {
  describe(`${family} Runtime Tabs`, () => {
    it('uses four real tabs and reciprocal panels, while controlled rejection preserves the active runtime', async () => {
      const p = mount(family);
      await vi.waitFor(() => expect(p.shell.querySelectorAll('[role=tab]')).toHaveLength(4));
      const triggers = [...p.shell.querySelectorAll<HTMLElement>('[role=tab]')];
      expect(p.shell.querySelector('[role=tablist]')?.getAttribute('aria-label')).toBe('Runtime');
      expect(triggers.map((t) => t.textContent)).toEqual([
        'Web Components',
        'React',
        'Vue',
        'Vue 2',
      ]);
      for (const trigger of triggers) {
        const content = document.getElementById(trigger.getAttribute('aria-controls')!);
        expect(content?.getAttribute('role')).toBe('tabpanel');
        expect(content?.getAttribute('aria-labelledby')).toBe(trigger.id);
      }
      triggers[1]!.click();
      await vi.waitFor(() => expect(p.onValueChange.mock.calls).toEqual([['react']]));
      expect(triggers[0]!.getAttribute('aria-selected')).toBe('true');
      expect(p.panel.closest('[role=tabpanel]')?.getAttribute('aria-labelledby')).toBe(
        triggers[0]!.id
      );
      // The owner accepts only after its prior runtime has completed teardown.
      p.tabs.select('react');
      await vi.waitFor(() => expect(triggers[1]!.getAttribute('aria-selected')).toBe('true'));
      expect(p.panel.closest('[role=tabpanel]')?.getAttribute('aria-labelledby')).toBe(
        triggers[1]!.id
      );
      expect(p.shell.textContent?.match(/One real runtime host/g)).toHaveLength(1);
      expect(p.shell.querySelectorAll('[role=tabpanel]:not([hidden])')).toHaveLength(1);
      expect(styleContains(triggers[1]!, 'border-b-2')).toBe(true);
      expect(styleContains(triggers[1]!, 'bg-transparent')).toBe(true);
      expect(styleContains(p.shell.querySelector('[role=tablist]')!, 'overflow-x-auto')).toBe(true);
      p.tabs.dispose();
      triggers[2]!.click();
      expect(p.onValueChange).toHaveBeenCalledTimes(1);
      expect(p.shell.querySelector('[role=tablist]')).toBeNull();
      expect(p.panel.isConnected).toBe(true);
    });
    it('has manual arrow/Home/End keyboard selection, skips locked activations and isolates nested value changes', async () => {
      const p = mount(family);
      await vi.waitFor(() => expect(p.shell.querySelectorAll('[role=tab]')).toHaveLength(4));
      const triggers = [...p.shell.querySelectorAll<HTMLElement>('[role=tab]')];
      triggers[0]!.focus();
      const key = (target: HTMLElement, key: string) =>
        target.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        );
      key(triggers[0]!, 'ArrowRight');
      await vi.waitFor(() => expect(document.activeElement).toBe(triggers[1]));
      expect(p.onValueChange).not.toHaveBeenCalled();
      key(triggers[1]!, 'End');
      await vi.waitFor(() => expect(document.activeElement).toBe(triggers[3]));
      key(triggers[3]!, 'Home');
      await vi.waitFor(() => expect(document.activeElement).toBe(triggers[0]));
      key(triggers[0]!, 'ArrowRight');
      key(triggers[1]!, 'Enter');
      await vi.waitFor(() => expect(p.onValueChange.mock.calls).toEqual([['react']]));
      p.tabs.setDisabled(true);
      triggers[2]!.click();
      p.panel.dispatchEvent(
        new CustomEvent('valueChange', { detail: { value: 'vue2' }, bubbles: true })
      );
      expect(p.onValueChange).toHaveBeenCalledTimes(1);
      p.tabs.setDisabled(false);
      triggers[2]!.click();
      await vi.waitFor(() => expect(p.onValueChange).toHaveBeenLastCalledWith('vue'));
    });
  });
}
