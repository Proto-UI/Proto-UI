import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  accordionRoot,
  accordionItem,
  accordionHeading,
  accordionTrigger,
  accordionContent,
} from '../src/accordion';
for (const proto of [
  accordionRoot,
  accordionItem,
  accordionHeading,
  accordionTrigger,
  accordionContent,
])
  AdaptToWebComponent(proto);
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
async function until(test: () => boolean) {
  for (let i = 0; i < 25; i++) {
    await flush();
    if (test()) return;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  throw Error('Accordion did not settle.');
}
function part(role: string, props: Record<string, unknown> = {}) {
  const el = document.createElement(`base-accordion-${role}`) as any;
  setElementProps(el, props);
  return el;
}
function item(
  value: string,
  props: Record<string, unknown> = {},
  contentProps: Record<string, unknown> = {}
) {
  const root = part('item', { value, ...props }),
    heading = part('heading'),
    trigger = part('trigger'),
    content = part('content', contentProps);
  trigger.textContent = value;
  content.textContent = `Panel ${value}`;
  heading.append(trigger);
  root.append(heading, content);
  return { root, heading, trigger, content };
}
function fixture(props: Record<string, unknown> = {}, values = ['a', 'b', 'c']) {
  const root = part('root', props),
    items = values.map((value) => item(value)),
    requests: any[] = [];
  root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
  root.append(...items.map((item) => item.root));
  return { root, items, requests };
}
const click = (el: HTMLElement) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
describe('Base Accordion full ownership boundaries', () => {
  it('single toggles, default is initialization-only, and every heading remains in the Tab sequence', async () => {
    const f = fixture({ defaultOpenItems: ['a'] });
    document.body.append(f.root);
    await until(() => f.items[0].trigger.getExposes?.().expanded.get());
    expect(f.root.getExposes().getOpenItems()).toEqual(['a']);
    expect(f.requests).toEqual([]);
    expect(f.items.map((i) => i.trigger.tabIndex)).toEqual([0, 0, 0]);
    click(f.items[1].trigger);
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['b']);
    expect(f.items[0].trigger.getAttribute('aria-expanded')).toBe('false');
    click(f.items[1].trigger);
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual([]);
    setElementProps(f.root, { defaultOpenItems: ['c'] });
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual([]);
    expect(f.requests).toHaveLength(2);
  });
  it('multiple accepts a set and allowEmpty=false locks only the final open header without removing its focus', async () => {
    const f = fixture({ mode: 'multiple', allowEmpty: false });
    document.body.append(f.root);
    await until(() => f.root.getExposes?.().openCount.get() === 1);
    expect(f.root.getExposes().getOpenItems()).toEqual(['a']);
    expect(f.items[0].trigger.getAttribute('aria-disabled')).toBe('true');
    expect(f.items[0].trigger.tabIndex).toBe(0);
    click(f.items[0].trigger);
    await flush();
    expect(f.requests).toEqual([]);
    click(f.items[1].trigger);
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['a', 'b']);
    expect(f.items[0].trigger.getAttribute('aria-disabled')).toBe('false');
    click(f.items[0].trigger);
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['b']);
  });
  it('controlled requests do not mutate facts; synchronous acceptance and rejection remain canonical', async () => {
    const f = fixture({ openItems: [] });
    document.body.append(f.root);
    await until(() => f.items[0].trigger.tabIndex === 0);
    click(f.items[0].trigger);
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual([]);
    expect(f.requests[0]).toEqual({ openItems: ['a'], value: 'a', open: true, reason: 'pointer' });
    f.root.addEventListener('openChange', (event: CustomEvent) =>
      setElementProps(f.root, { openItems: event.detail.openItems })
    );
    click(f.items[1].trigger);
    await until(() => f.items[1].trigger.getAttribute('aria-expanded') === 'true');
    expect(f.root.getExposes().getOpenItems()).toEqual(['b']);
    f.root.getExposes().requestOpen('b', false);
    await flush();
    expect(f.items[1].content.getExposes().hidden.get()).toBe(true);
    expect(f.root.getExposes().getOpenItems()).toEqual([]);
  });
  it('controlled unknown keys do not target other items and empty groups stay empty', async () => {
    const empty = fixture({ allowEmpty: false }, []);
    document.body.append(empty.root);
    await flush();
    expect(empty.root.getExposes().getOpenItems()).toEqual([]);
    expect(empty.root.getExposes().requestOpen('missing', true)).toBe(false);
    const f = fixture({ mode: 'multiple', openItems: ['unknown', 'a', 'a'] });
    document.body.append(f.root);
    await until(() => f.items[0].trigger.getAttribute('aria-expanded') === 'true');
    expect(f.root.getExposes().getOpenItems()).toEqual(['unknown', 'a']);
    expect(f.root.getExposes().requestOpen('unknown', false)).toBe(false);
    setElementProps(f.root, { openItems: [] });
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual([]);
    expect(f.requests).toEqual([]);
  });
  it('root and item disabled suppress requests; disabled changes do not move focus or close content', async () => {
    const f = fixture({ defaultOpenItems: ['a'] });
    document.body.append(f.root);
    await until(() => f.items[0].trigger.tabIndex === 0);
    f.items[0].trigger.focus();
    setElementProps(f.items[0].root, { value: 'a', disabled: true });
    await flush();
    expect(f.items[0].trigger.tabIndex).toBe(-1);
    click(f.items[0].trigger);
    expect(f.root.getExposes().getOpenItems()).toEqual(['a']);
    setElementProps(f.root, { disabled: true });
    await flush();
    expect(f.items.map((i) => i.trigger.tabIndex)).toEqual([-1, -1, -1]);
    expect(f.root.getExposes().requestOpen('b', true)).toBe(false);
    expect(f.requests).toEqual([]);
  });
  it('arrow and Home/End move focus only, skip disabled, and honor horizontal RTL and no-loop', async () => {
    const f = fixture();
    setElementProps(f.items[1].root, { value: 'b', disabled: true });
    document.body.append(f.root);
    await until(() => f.items[2].trigger.tabIndex === 0);
    f.items[0].trigger.focus();
    const key = (key: string) =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
    key('ArrowDown');
    await flush();
    expect(document.activeElement).toBe(f.items[2].trigger);
    key('Home');
    await flush();
    expect(document.activeElement).toBe(f.items[0].trigger);
    key('End');
    await flush();
    expect(document.activeElement).toBe(f.items[2].trigger);
    setElementProps(f.root, { orientation: 'horizontal', direction: 'rtl', loop: false });
    await flush();
    key('ArrowLeft');
    await flush();
    expect(document.activeElement).toBe(f.items[2].trigger);
    key('ArrowRight');
    await flush();
    expect(document.activeElement).toBe(f.items[0].trigger);
    expect(f.requests).toEqual([]);
    expect(f.root.getExposes().getOpenItems()).toEqual([]);
  });
  it('heading levels, exact item relations and L1/retained content are independent', async () => {
    const f = fixture();
    setElementProps(f.items[1].content, { keepMounted: true, region: true });
    setElementProps(f.items[0].heading, { level: 2 });
    document.body.append(f.root);
    await until(() => f.items[0].trigger.tabIndex === 0);
    expect(f.items[0].heading.getAttribute('role')).toBe('heading');
    expect(f.items[0].heading.getAttribute('aria-level')).toBe('2');
    expect(f.items[0].trigger.hasAttribute('aria-controls')).toBe(false);
    await until(() => !!f.items[1].trigger.getAttribute('aria-controls'));
    expect(f.items[1].content.getAttribute('role')).toBe('region');
    expect(f.items[1].content.getAttribute('aria-labelledby')).toBe(f.items[1].trigger.id);
    click(f.items[0].trigger);
    await until(() => !!f.items[0].trigger.getAttribute('aria-controls'));
    const id = f.items[0].content.id;
    expect(f.items[0].trigger.getAttribute('aria-controls')).toBe(id);
    click(f.items[0].trigger);
    await until(() => !f.items[0].trigger.hasAttribute('aria-controls'));
    click(f.items[0].trigger);
    await until(() => f.items[0].trigger.getAttribute('aria-controls') === id);
  });
  it('dynamic removal chooses a deterministic required fallback and reorder preserves stable values', async () => {
    const f = fixture({ allowEmpty: false });
    document.body.append(f.root);
    await until(() => f.root.getExposes?.().openCount.get() === 1);
    f.items[0].root.remove();
    await until(() => f.root.getExposes().getOpenItems()[0] === 'b');
    expect(f.requests).toEqual([]);
    f.root.prepend(f.items[2].root);
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['b']);
    setElementProps(f.items[1].root, { value: 'renamed' });
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['c']);
  });
  it('nested groups with repeated values never leak requests, relationships or keyboard navigation', async () => {
    const outer = fixture({ defaultOpenItems: ['a'] }),
      inner = fixture({ defaultOpenItems: ['b'] });
    outer.items[0].content.append(inner.root);
    document.body.append(outer.root);
    await until(() => inner.items[0].trigger.tabIndex === 0);
    click(inner.items[0].trigger);
    await flush();
    expect(outer.root.getExposes().getOpenItems()).toEqual(['a']);
    expect(inner.root.getExposes().getOpenItems()).toEqual(['a']);
    expect(inner.items[0].trigger.getAttribute('aria-controls')).not.toBe(
      outer.items[0].trigger.getAttribute('aria-controls')
    );
    inner.items[0].trigger.focus();
    inner.items[0].trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })
    );
    await flush();
    expect(document.activeElement).toBe(inner.items[2].trigger);
  });
  it('deleting an item during request and reentrant newer acceptance cannot revive old selection', async () => {
    const f = fixture({ openItems: [] });
    document.body.append(f.root);
    await until(() => f.items[0].trigger.tabIndex === 0);
    f.root.addEventListener('openChange', (event: CustomEvent) => {
      if (event.detail.value === 'a') {
        f.items[0].root.remove();
        setElementProps(f.root, { openItems: ['b'] });
      }
    });
    click(f.items[0].trigger);
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['b']);
    expect(f.items[1].trigger.getAttribute('aria-expanded')).toBe('true');
  });
  it('reparents live Items to the destination owner and rejects duplicate stable identity', async () => {
    const source = fixture({ defaultOpenItems: ['a'] }, ['a']);
    const target = fixture({ openItems: [], disabled: true }, ['b']);
    document.body.append(source.root, target.root);
    await until(() => source.items[0].trigger.getAttribute('aria-expanded') === 'true');
    target.root.append(source.items[0].root);
    await until(() => source.items[0].trigger.getAttribute('aria-expanded') === 'false');
    expect(source.items[0].trigger.tabIndex).toBe(-1);
    expect(source.root.getExposes().getOpenItems()).toEqual([]);
    expect(target.root.getExposes().getOpenItems()).toEqual([]);
    setElementProps(target.root, { openItems: ['a'], disabled: false });
    await until(() => source.items[0].trigger.getAttribute('aria-expanded') === 'true');
    const duplicate = item('a');
    expect(() => target.root.append(duplicate.root)).toThrowError(
      expect.objectContaining({ code: 'ACCORDION_DUPLICATE_VALUE' })
    );
    duplicate.root.remove();
  });
  it('keeps newer owner disabled input when a canonical open observer reenters', async () => {
    const f = fixture();
    document.body.append(f.root);
    await until(() => f.items[0].trigger.tabIndex === 0);
    const off = f.items[0].root.getExposes().open.subscribe((event: any) => {
      if (event.type === 'next' && event.next) setElementProps(f.root, { disabled: true });
    });
    click(f.items[0].trigger);
    await flush();
    expect(f.items[0].root.getExposes().disabled.get()).toBe(true);
    expect(f.items[0].trigger.getExposes().disabled.get()).toBe(true);
    expect(f.items[0].trigger.tabIndex).toBe(-1);
    expect(f.root.getExposes().getOpenItems()).toEqual(['a']);
    expect(f.requests).toHaveLength(1);
    off();
  });

  it('Enter and Space commit once, while incomplete/cancelled pointer presses never toggle', async () => {
    const f = fixture();
    document.body.append(f.root);
    await until(() => f.items[0].trigger.tabIndex === 0);
    const trigger = f.items[0].trigger;
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    trigger.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['a']);
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0].reason).toBe('keyboard');
    const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    trigger.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    trigger.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual([]);
    expect(f.requests).toHaveLength(2);
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    trigger.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
    await flush();
    expect(f.requests).toHaveLength(2);
    expect(trigger.getExposes().pressed.get()).toBe(false);
  });
  it('exposes defensive selection copies and does not revive a renamed or removed selected identity', async () => {
    const f = fixture({ mode: 'multiple', defaultOpenItems: ['a', 'b'] });
    document.body.append(f.root);
    await until(() => f.root.getExposes?.().openCount.get() === 2);
    const copy = f.root.getExposes().getOpenItems();
    copy.push('c');
    expect(f.root.getExposes().getOpenItems()).toEqual(['a', 'b']);
    f.items[0].root.remove();
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['b']);
    f.root.append(f.items[0].root);
    await flush();
    expect(f.items[0].trigger.getAttribute('aria-expanded')).toBe('false');
    setElementProps(f.items[1].root, { value: 'renamed' });
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual([]);
  });
  it('modifier navigation stays untouched and re-enabling an empty required group chooses a locally enabled Item', async () => {
    const f = fixture({ allowEmpty: false, disabled: true });
    setElementProps(f.items[0].root, { value: 'a', disabled: true });
    document.body.append(f.root);
    await until(() => f.items[2].trigger.getExposes?.().disabled.get());
    expect(f.root.getExposes().getOpenItems()).toEqual([]);
    setElementProps(f.root, { allowEmpty: false, disabled: false });
    await until(() => f.root.getExposes().getOpenItems()[0] === 'b');
    f.items[1].trigger.focus();
    const modified = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    f.items[1].trigger.dispatchEvent(modified);
    await flush();
    expect(document.activeElement).toBe(f.items[1].trigger);
    expect(modified.defaultPrevented).toBe(false);
    expect(f.requests).toEqual([]);
  });
});

// Independent bounded-review regressions retained as executable coverage.
describe('independent probes', () => {
  it('reentrant item value observer keeps latest identity', async () => {
    const f = fixture({ openItems: ['b'] }, ['a']);
    document.body.append(f.root);
    await until(() => f.items[0].trigger.tabIndex === 0);
    const off = f.items[0].root.getExposes().value.subscribe((event: any) => {
      if (event.type === 'next' && event.next === 'b')
        setElementProps(f.items[0].root, { value: 'c' });
    });
    setElementProps(f.items[0].root, { value: 'b' });
    await flush();
    expect(f.items[0].root.getExposes().value.get()).toBe('c');
    expect(f.items[0].root.getExposes().open.get()).toBe(false);
    expect(f.items[0].trigger.getExposes().expanded.get()).toBe(false);
    off();
  });
  it('modifier navigation is untouched', async () => {
    const f = fixture();
    document.body.append(f.root);
    await until(() => f.items[0].trigger.tabIndex === 0);
    f.items[0].trigger.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    f.items[0].trigger.dispatchEvent(event);
    await flush();
    expect(document.activeElement).toBe(f.items[0].trigger);
    expect(event.defaultPrevented).toBe(false);
  });
  it('nested content keyboard does not change an outer trigger', async () => {
    const f = fixture({ defaultOpenItems: ['a'] });
    document.body.append(f.root);
    await until(() => f.items[0].trigger.tabIndex === 0);
    const input = document.createElement('input');
    f.items[0].content.append(input);
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['a']);
    expect(f.requests).toHaveLength(0);
  });
});

describe('structural probes', () => {
  it('same-root reorder keeps selected identity', async () => {
    const f = fixture({ defaultOpenItems: ['a'] });
    document.body.append(f.root);
    await until(() => f.items[0].trigger.getExposes?.().expanded.get());
    f.root.append(f.items[0].root);
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['a']);
    expect(f.items[0].trigger.getExposes().expanded.get()).toBe(true);
  });
  it('initial minimum skips first disabled item', async () => {
    const f = fixture({ allowEmpty: false });
    setElementProps(f.items[0].root, { value: 'a', disabled: true });
    document.body.append(f.root);
    await until(() => f.items[2].trigger.getExposes?.());
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['b']);
  });
  it('initial all-disabled minimum stays empty', async () => {
    const f = fixture({ allowEmpty: false, disabled: true });
    document.body.append(f.root);
    await until(() => f.items[2].trigger.getExposes?.());
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual([]);
  });
  it('simultaneous minimum and disable stays empty', async () => {
    const f = fixture();
    document.body.append(f.root);
    await until(() => f.items[2].trigger.tabIndex === 0);
    setElementProps(f.root, { allowEmpty: false, disabled: true });
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual([]);
  });
});

describe('terminal and publication probes', () => {
  it('new controlled owner update from openCount observer wins', async () => {
    const f = fixture();
    document.body.append(f.root);
    await until(() => f.items[2].trigger.tabIndex === 0);
    const off = f.root.getExposes().openCount.subscribe((ev: any) => {
      if (ev.type === 'next' && ev.next === 1)
        setElementProps(f.root, { mode: 'multiple', openItems: ['b', 'c'] });
    });
    expect(f.root.getExposes().requestOpen('a', true)).toBe(true);
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['b', 'c']);
    expect(f.root.getExposes().openCount.get()).toBe(2);
    expect(f.items.map((x) => x.trigger.getExposes().expanded.get())).toEqual([false, true, true]);
    off();
  });
  it('new owner selection from Content open observer wins', async () => {
    const f = fixture();
    document.body.append(f.root);
    await until(() => f.items[2].trigger.tabIndex === 0);
    const off = f.items[0].content.getExposes().open.subscribe((ev: any) => {
      if (ev.type === 'next' && ev.next) setElementProps(f.root, { openItems: ['b'] });
    });
    f.root.getExposes().requestOpen('a', true);
    await flush();
    expect(f.root.getExposes().getOpenItems()).toEqual(['b']);
    expect(f.items.map((x) => x.content.getExposes().open.get())).toEqual([false, true, false]);
    expect(f.items.map((x) => x.content.getExposes().hidden.get())).toEqual([true, false, true]);
    off();
  });
  it('disposed root method no longer opens or emits', async () => {
    const f = fixture();
    document.body.append(f.root);
    await until(() => f.items[2].trigger.tabIndex === 0);
    const exposed = f.root.getExposes();
    f.root.remove();
    await flush();
    expect(() => exposed.requestOpen('a', true)).toThrow(
      'cannot invoke an exposed callable after terminal disposal'
    );
    expect(f.requests).toEqual([]);
  });
});
