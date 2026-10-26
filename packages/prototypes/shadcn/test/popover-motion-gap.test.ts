import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as popover from '../src/popover';
// Diagnostic only; independent expectation C-AS-TRANSITION-0001-C/D.
// Agent: dot
for (const proto of [popover.popoverRoot, popover.popoverContent, popover.popoverTrigger]) {
  AdaptToWebComponent(proto);
}
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const root of roots) root.remove();
  roots.length = 0;
  await flush();
});
describe('Popover initial context open retains inherited appear contract', () => {
  for (const source of ['defaultOpen', 'open'] as const)
    for (const initialOpen of [false, true])
      for (const appear of [false, true]) {
        it(`Root.${source}=${initialOpen} with Content.appear=${appear}`, async () => {
          const root = document.createElement(popover.popoverRoot.name);
          const trigger = document.createElement(popover.popoverTrigger.name);
          const content = document.createElement(popover.popoverContent.name) as HTMLElement & {
            getExposes(): any;
          };
          setElementProps(root, { [source]: initialOpen, a11yLabel: 'Motion gap probe' });
          setElementProps(content, { appear, enterDuration: 1000, leaveDuration: 1000 });
          const events: string[] = [];
          for (const event of ['beforeEnter', 'afterEnter', 'beforeLeave', 'afterLeave'])
            content.addEventListener(event, () => events.push(event));
          root.append(trigger, content);
          roots.push(root);
          document.body.append(root);
          await flush();
          expect(trigger.getAttribute('aria-expanded')).toBe(String(initialOpen));
          expect(content.getExposes().transitionState.get()).toBe(
            initialOpen ? (appear ? 'entering' : 'entered') : 'closed'
          );
          expect(events).toEqual(initialOpen && appear ? ['beforeEnter'] : []);
        });
      }
});

describe('Popover initial presence keeps later transition ownership', () => {
  function mount(initial: Record<string, unknown> = { defaultOpen: true }) {
    const root = document.createElement(popover.popoverRoot.name) as HTMLElement & {
      getExposes(): any;
    };
    const trigger = document.createElement(popover.popoverTrigger.name);
    const content = document.createElement(popover.popoverContent.name) as HTMLElement & {
      getExposes(): any;
    };
    setElementProps(root, { ...initial, a11yLabel: 'Presence regression' });
    setElementProps(content, { appear: false, enterDuration: 45, leaveDuration: 25 });
    const events: string[] = [];
    for (const event of ['beforeEnter', 'afterEnter', 'beforeLeave', 'afterLeave'])
      content.addEventListener(event, () => events.push(event));
    root.append(trigger, content);
    roots.push(root);
    document.body.append(root);
    const phase = () => content.getExposes().transitionState.get();
    return { root, trigger, content, events, phase };
  }
  it('starts entered without startup events, retains leaving view, and enters normally on reopen', async () => {
    const f = mount();
    await flush();
    expect(f.phase()).toBe('entered');
    expect(f.events).toEqual([]);
    const phaseHandle = f.content.getExposes().transitionState;
    f.root.getExposes().close();
    await flush();
    expect(f.phase()).toBe('leaving');
    expect(f.content.isConnected).toBe(true);
    expect(f.events).toEqual(['beforeLeave']);
    await expect.poll(f.phase).toBe('closed');
    expect(f.events).toEqual(['beforeLeave', 'afterLeave']);
    f.trigger.click();
    await flush();
    expect(f.phase()).toBe('entering');
    await expect.poll(f.phase).toBe('entered');
    expect(f.content.getExposes().transitionState).toBe(phaseHandle);
    expect(f.events).toEqual(['beforeLeave', 'afterLeave', 'beforeEnter', 'afterEnter']);
  });
  it('reverses a leave without stale afterLeave or detaching the reopened view', async () => {
    const f = mount();
    await flush();
    f.root.getExposes().close();
    await flush();
    expect(f.phase()).toBe('leaving');
    f.trigger.click();
    await flush();
    expect(f.phase()).toBe('entering');
    await expect.poll(f.phase).toBe('entered');
    expect(f.events).toEqual(['beforeLeave', 'beforeEnter', 'afterEnter']);
    expect(f.content.isConnected).toBe(true);
    expect(f.trigger.getAttribute('aria-expanded')).toBe('true');
  });
  it('does not move presence for a rejected controlled close and honors later owner input', async () => {
    const f = mount({ open: true });
    await flush();
    f.root.getExposes().close();
    await flush();
    expect(f.phase()).toBe('entered');
    expect(f.events).toEqual([]);
    setElementProps(f.root, { open: false });
    await flush();
    expect(f.phase()).toBe('leaving');
    await expect.poll(f.phase).toBe('closed');
    expect(f.events).toEqual(['beforeLeave', 'afterLeave']);
  });
});
