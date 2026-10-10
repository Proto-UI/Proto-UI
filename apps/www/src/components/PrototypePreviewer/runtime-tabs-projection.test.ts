import { afterEach, expect, it, vi } from 'vitest';
import { createProjectionComposition } from './projection-composition';
import { renderDemo } from './demo-renderer';
import { loadPrototypes } from './prototype-modules';
import { collectPrototypeIds } from './demo-types';
const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});
for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const)
  it(`${family}: real projected controlled Tabs reject, lock, resume and ignore nested events`, async () => {
    const request = vi.fn();
    const composition = createProjectionComposition({
      ownerId: `gated-tabs-${family}`,
      runtimeId: 'wc',
      projectionFamilyId: family,
      generation: 1,
      componentId: 'button',
      controlIds: ['runtime'],
      childDemo: {
        type: 'demo',
        root: { kind: 'proto', prototypeId: `${family}-button`, children: ['Child'] },
      },
      controls: {
        runtime: {
          label: 'Runtime',
          presentation: 'tabs',
          options: [
            { value: 'wc', label: 'Web Components' },
            { value: 'react', label: 'React' },
            { value: 'vue', label: 'Vue' },
            { value: 'vue2', label: 'Vue 2', disabled: true },
          ],
          onValueChange: request,
        },
        family: {
          label: 'Family',
          options: [{ value: family, label: family }],
          onValueChange() {},
        },
        component: {
          label: 'Component',
          options: [{ value: 'button', label: 'Button' }],
          onValueChange() {},
        },
      },
    });
    const host = document.createElement('div');
    document.body.append(host);
    const ids = new Set<string>();
    collectPrototypeIds(composition.demo.root, ids);
    await loadPrototypes([...ids]);
    const rendered = await renderDemo({ runtime: 'wc', demo: composition.demo, host });
    cleanups.push(rendered.destroy);
    const tabs = [...host.querySelectorAll<HTMLElement>('[role=tab]')];
    await vi.waitFor(() => expect(tabs[0]!.getAttribute('aria-selected')).toBe('true'));
    tabs[1]!.click();
    await vi.waitFor(() => expect(request.mock.calls).toEqual([['react']]));
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('false');
    composition.setLocked(true);
    tabs[2]!.click();
    composition.setLocked(false);
    composition.setEventGateOpen(false);
    tabs[1]!.click();
    expect(request).toHaveBeenCalledTimes(1);
    composition.setEventGateOpen(true);
    host
      .querySelector('[role=button]')!
      .dispatchEvent(new CustomEvent('valueChange', { bubbles: true, detail: { value: 'vue' } }));
    tabs[3]!.click();
    expect(request).toHaveBeenCalledTimes(1);
    tabs[1]!.click();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await rendered.destroy();
    tabs[2]!.click();
    expect(request).toHaveBeenCalledTimes(2);
  });
