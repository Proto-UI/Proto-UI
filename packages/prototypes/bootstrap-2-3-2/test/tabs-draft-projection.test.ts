import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { tabsRoot, tabsList, tabsTrigger, tabsContent, tabsIndicator } from '../src/tabs';

const Root = AdaptToWebComponent(tabsRoot);
const List = AdaptToWebComponent(tabsList);
const Trigger = AdaptToWebComponent(tabsTrigger);
const Content = AdaptToWebComponent(tabsContent);
const Indicator = AdaptToWebComponent(tabsIndicator);

async function flush() {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
function make(options: { orientation?: 'horizontal' | 'vertical'; value?: string } = {}) {
  const root = new Root();
  const list = new List();
  const a = new Trigger();
  const b = new Trigger();
  const content = new Content();
  const indicator = new Indicator();
  setElementProps(root, {
    defaultValue: 'a',
    orientation: options.orientation ?? 'horizontal',
    activationMode: 'manual',
    ...(options.value === undefined ? {} : { value: options.value }),
  });
  setElementProps(a, { value: 'a' });
  setElementProps(b, { value: 'b' });
  setElementProps(content, { value: 'a', keepMounted: true });
  a.textContent = 'Account';
  b.textContent = 'Password';
  content.textContent = 'Panel';
  list.append(a, b);
  root.append(list, indicator, content);
  document.body.append(root);
  return { root, list, a, b, content, indicator };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('Bootstrap 2.3.2 Tabs draft projection', () => {
  it('keeps Indicator passive while exposing accepted selection, active focus and orientation', async () => {
    const { root, a, b, indicator } = make({ orientation: 'vertical' });
    await flush();
    const exposes = indicator.getExposes();
    const value = exposes.value;
    expect(value.get()).toBe('a');
    expect(exposes.orientation.get()).toBe('vertical');
    expect(indicator.getAttribute('role')).toBeNull();
    expect(Object.hasOwn(exposes, 'focusSelf')).toBe(false);
    expect(Object.hasOwn(exposes, 'valueChange')).toBe(false);

    a.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();
    expect(document.activeElement).toBe(b);
    expect(root.getExposes().value.get()).toBe('a');
    expect(value.get()).toBe('a');
    expect(exposes.activeValue.get()).toBe('b');
    b.click();
    await flush();
    expect(value.get()).toBe('b');
    setElementProps(root, {
      defaultValue: 'a',
      orientation: 'horizontal',
      activationMode: 'manual',
    });
    await flush();
    expect(indicator.getExposes().value).toBe(value);
    expect(value.get()).toBe('b');
    expect(exposes.orientation.get()).toBe('horizontal');
  });

  it('updates selected semantics and panel presence only after the owner accepts', async () => {
    const { root, a, b, content } = make();
    await flush();
    expect(a.getAttribute('aria-selected')).toBe('true');
    expect(content.getExposes().current.get()).toBe(true);
    b.click();
    await flush();
    expect(root.getExposes().value.get()).toBe('b');
    expect(b.getExposes().selected.get()).toBe(true);
    expect(b.getAttribute('aria-selected')).toBe('true');
    expect(a.getAttribute('aria-selected')).toBe('false');
    expect(content.getExposes().current.get()).toBe(false);
  });

  it('retains controlled refusal and disabled request suppression with the Indicator present', async () => {
    const { root, b, indicator } = make({ value: 'a' });
    await flush();
    const requests: unknown[] = [];
    root.addEventListener('valueChange', (event) => {
      if (event instanceof CustomEvent) requests.push(event.detail);
    });
    b.click();
    await flush();
    expect(requests).toEqual([{ value: 'b' }]);
    expect(root.getExposes().value.get()).toBe('a');
    expect(indicator.getExposes().value.get()).toBe('a');
    expect(indicator.getExposes().activeValue.get()).toBe('b');
    setElementProps(b, { value: 'b', disabled: true });
    b.click();
    await flush();
    expect(requests).toEqual([{ value: 'b' }]);
    expect(b.getAttribute('aria-disabled')).toBe('true');
    expect(indicator.getExposes().value.get()).toBe('a');
  });

  it('changes Proto appearance paint without replacing state, focus or caller nodes', async () => {
    const { root, list, b, content, indicator } = make();
    await flush();
    b.click();
    b.focus();
    await flush();
    const value = root.getExposes().value;
    const selected = b.getExposes().selected;
    const indicatorValue = indicator.getExposes().value;
    const text = b.firstChild;
    const panelText = content.firstChild;
    for (const appearance of ['underline', 'default'] as const) {
      setElementProps(list, { appearance });
      setElementProps(b, { value: 'b', appearance });
      await flush();
      expect(root.getExposes().value).toBe(value);
      expect(value.get()).toBe('b');
      expect(b.getExposes().selected).toBe(selected);
      expect(selected.get()).toBe(true);
      expect(indicator.getExposes().value).toBe(indicatorValue);
      expect(indicatorValue.get()).toBe('b');
      expect(document.activeElement).toBe(b);
      expect(b.firstChild).toBe(text);
      expect(content.firstChild).toBe(panelText);
    }
  });
});
