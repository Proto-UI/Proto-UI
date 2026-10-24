import { afterEach, describe, expect, it, vi } from 'vitest';
import { enhanceCodeExampleTabs, revealCodeExampleTab } from './code-example-tabs';

const projections: ReturnType<typeof enhanceCodeExampleTabs>[] = [];
afterEach(() => {
  for (const projection of projections.splice(0).reverse()) projection.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function fixture() {
  document.body.innerHTML = `<section data-code-example>
    <div data-code-toolbar><div role="tablist" aria-label="Host">
      <button id="a" role="tab" aria-selected="true">React</button>
      <button id="b" role="tab" aria-selected="false">Web Components</button>
    </div></div>
    <section role="tabpanel" aria-labelledby="a"><pre>exact react source</pre></section>
    <section role="tabpanel" aria-labelledby="b" hidden><pre>exact wc source</pre></section>
  </section>`;
  const root = document.querySelector<HTMLElement>('[data-code-example]')!;
  const list = root.querySelector<HTMLElement>('[role="tablist"]')!;
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  return { root, list, tabs, panels };
}

describe('CodeExample real legacy Tabs enhancement', () => {
  it('uses real underline Tabs, retains source nodes, and restores native owners on cleanup', async () => {
    const { root, list, tabs, panels } = fixture();
    const source = panels.map((panel) => panel.querySelector('pre'));
    const projection = enhanceCodeExampleTabs({ list, tabs, panels, onSelect() {} });
    projections.push(projection);
    await Promise.resolve();
    const triggers = [...root.querySelectorAll<HTMLElement>('[data-code-example-projected-tab]')];
    for (const trigger of triggers) {
      const panelId = trigger.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      const content = document.getElementById(panelId!);
      expect(content?.getAttribute('role')).toBe('tabpanel');
      expect(content?.getAttribute('aria-labelledby')).toBe(trigger.id);
    }
    expect(root.querySelectorAll('[data-code-example-projected-tab]')).toHaveLength(2);
    expect(root.querySelector('[data-code-example-projected-tab]')?.getAttribute('data-pui-style')).toContain('bg-transparent');
    expect(list.parentElement!.hidden).toBe(true);
    expect(panels.map((panel) => panel.querySelector('pre'))).toEqual(source);
    expect(panels.every((panel) => panel.isConnected)).toBe(true);
    expect(panels.every((panel) => !panel.hasAttribute('role'))).toBe(true);
    projection.destroy();
    expect(root.querySelector('[data-code-example-tabs-projection]')).toBeNull();
    expect(list.parentElement!.hidden).toBe(false);
    expect(panels.map((panel) => panel.parentElement)).toEqual([root, root]);
    expect(panels.map((panel) => panel.getAttribute('aria-labelledby'))).toEqual(['a', 'b']);
  });

  it('normalizes SSR label edges without changing source content', () => {
    const { root, list, tabs, panels } = fixture();
    tabs[0].textContent = '\n  React \n';
    tabs[1].textContent = ' Web Components ';
    const pre = panels[0].querySelector('pre')!;
    pre.textContent = '\n  exact source with indentation  \n';
    projections.push(enhanceCodeExampleTabs({ list, tabs, panels, onSelect() {} }));
    expect([...root.querySelectorAll('[data-code-example-projected-tab]')].map((tab) => tab.textContent))
      .toEqual(['React', 'Web Components']);
    expect(pre.textContent).toBe('\n  exact source with indentation  \n');
  });

  it.each(['list', 'content'])('restores source and fallback if the real %s fails role admission', (part) => {
    const { root, list, tabs, panels } = fixture();
    const source = panels.map((panel) => panel.querySelector('pre'));
    const getAttribute = Element.prototype.getAttribute;
    vi.spyOn(Element.prototype, 'getAttribute').mockImplementation(function (this: Element, name: string) {
      if (name === 'role' && this.localName.endsWith(`tabs-${part}`)) return null;
      return getAttribute.call(this, name);
    });
    expect(() => enhanceCodeExampleTabs({ list, tabs, panels, onSelect() {} })).toThrow('native controls retained');
    expect(root.querySelector('[data-code-example-tabs-projection]')).toBeNull();
    expect(list.parentElement!.hidden).toBe(false);
    expect(panels.map((panel) => panel.parentElement)).toEqual([root, root]);
    expect(panels.map((panel) => panel.querySelector('pre'))).toEqual(source);
    expect(panels.map((panel) => panel.getAttribute('role'))).toEqual(['tabpanel', 'tabpanel']);
    expect(panels.map((panel) => panel.getAttribute('aria-labelledby'))).toEqual(['a', 'b']);
  });

  it('retains an in-progress native keyboard interaction rather than hiding its focused tab', () => {
    const { root, list, tabs, panels } = fixture();
    tabs[0].focus();
    projections.push(enhanceCodeExampleTabs({ list, tabs, panels, onSelect() {} }));
    expect(root.querySelector('[data-code-example-tabs-projection]')).toBeNull();
    expect(document.activeElement).toBe(tabs[0]);
    expect(list.parentElement!.hidden).toBe(false);
  });

  it('does not reparent a panel containing the active source viewport', () => {
    const { root, list, tabs, panels } = fixture();
    const pre = panels[0].querySelector('pre')!;
    pre.tabIndex = 0;
    pre.focus();
    projections.push(enhanceCodeExampleTabs({ list, tabs, panels, onSelect() {} }));
    expect(root.querySelector('[data-code-example-tabs-projection]')).toBeNull();
    expect(document.activeElement).toBe(pre);
    expect(panels[0].parentElement).toBe(root);
  });

  it('does not accept a bubbled nested Tabs valueChange as a host change', () => {
    const { root, list, tabs, panels } = fixture();
    const changes: number[] = [];
    projections.push(enhanceCodeExampleTabs({ list, tabs, panels, onSelect: (index) => changes.push(index) }));
    panels[0].dispatchEvent(new CustomEvent('valueChange', { bubbles: true, detail: { value: '1' } }));
    expect(changes).toEqual([]);
    root.querySelector('[data-code-example-tabs-projection]')!.dispatchEvent(new CustomEvent('valueChange', { detail: { value: '1' } }));
    expect(changes).toEqual([1]);
  });
});

it('retains the host name and explicit availability in the real tab accessible text', () => {
  const { root, list, tabs, panels } = fixture();
  tabs[1].dataset.codeHostName = 'Vue 2';
  tabs[1].dataset.codeHostAvailability = '开发中';
  tabs[1].textContent = ' Vue 2 · 开发中 ';
  projections.push(enhanceCodeExampleTabs({ list, tabs, panels, onSelect() {} }));
  const trigger = root.querySelectorAll<HTMLElement>('[data-code-example-projected-tab]')[1];
  expect(trigger.dataset.codeHostName).toBe('Vue 2');
  expect(trigger.textContent).toBe('Vue 2 · 开发中');
  expect(trigger.querySelector('[data-code-host-status]')?.textContent).toBe(' · 开发中');
});

it('reveals clipped tabs using only the strip horizontal scroll', () => {
  const { list, tabs } = fixture();
  list.getBoundingClientRect = () => ({ left: 20, right: 220, width: 200 }) as DOMRect;
  tabs[1].getBoundingClientRect = () => ({ left: 240, right: 340, width: 100 }) as DOMRect;
  list.scrollTop = 31;
  revealCodeExampleTab(tabs[1], list);
  expect(list.scrollLeft).toBe(120);
  expect(list.scrollTop).toBe(31);
  tabs[0].getBoundingClientRect = () => ({ left: -100, right: 0, width: 100 }) as DOMRect;
  revealCodeExampleTab(tabs[0], list);
  expect(list.scrollLeft).toBe(0);
  expect(list.scrollTop).toBe(31);
});

it('keeps the overflow hint beside the real host list and restores its original position', () => {
  const { root, list, tabs, panels } = fixture();
  list.dataset.codeHostTabs = '';
  const hint = document.createElement('p');
  hint.dataset.codeHostOverflow = '';
  hint.textContent = 'Scroll to see all hosts';
  list.parentElement!.after(hint);
  const originalNext = hint.nextSibling;
  const projection = enhanceCodeExampleTabs({ list, tabs, panels, onSelect() {} });
  projections.push(projection);
  const projectedList = root.querySelector('[data-code-example-tablist="host"]')!;
  expect(projectedList.nextSibling).toBe(hint);
  expect(hint.hidden).toBe(true); // zero-width unit fixture has no measured overflow
  projection.destroy();
  expect(hint.parentElement).toBe(root);
  expect(hint.nextSibling).toBe(originalNext);
  expect(hint.hidden).toBe(false);
});
