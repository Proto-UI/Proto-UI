import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as number from '../src/number-field';
for (const p of Object.values(number))
  if (typeof p === 'object' && p && 'setup' in p) AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
async function fixture(props: Record<string, unknown> = {}) {
  const part = (s: string) => document.createElement('base-number-field-' + s) as any;
  const root = part('root'),
    input = part('input'),
    plus = part('increment'),
    minus = part('decrement');
  setElementProps(root, { defaultValue: 2, ...props });
  root.append(minus, input, plus);
  document.body.append(root);
  await flush();
  const editor = input.shadowRoot?.querySelector('input') ?? input.querySelector('input');
  const commits: any[] = [];
  root.addEventListener('valueCommit', (e: CustomEvent) => commits.push(e.detail));
  return {
    root,
    input,
    plus,
    minus,
    editor,
    commits,
    x: root.getExposes(),
    type: async (text: string) => {
      editor.value = text;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: text }));
      await flush();
    },
  };
}
for (const props of [{}, { value: 2 }])
  it(`preserves partial draft on unrelated props ${JSON.stringify(props)}`, async () => {
    const f = await fixture(props);
    f.editor.focus();
    await f.type('-');
    setElementProps(f.root, { defaultValue: 2, ...props, ariaLabel: 'Quantity', name: 'quantity' });
    await flush();
    expect(f.x.draft.get()).toBe('-');
    expect(f.editor.value).toBe('-');
    expect(f.x.value.get()).toBe(2);
  });
it('commits once for native change followed by blur', async () => {
  const f = await fixture();
  f.editor.focus();
  await f.type('3.7');
  f.editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  f.editor.blur();
  await flush();
  expect(f.commits).toEqual([{ value: 4 }]);
  expect(f.editor.value).toBe('4');
});
for (const key of ['increment', 'decrement'])
  it(`${key} Space cancels default and steps once on release`, async () => {
    const f = await fixture();
    const button = key === 'increment' ? f.plus : f.minus;
    button.focus();
    await flush();
    const down = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(down);
    await flush();
    expect(down.defaultPrevented).toBe(true);
    button.dispatchEvent(
      new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
    );
    await flush();
    expect(f.x.value.get()).toBe(key === 'increment' ? 3 : 1);
    expect(f.commits).toHaveLength(1);
  });
it('keeps draft for unchanged owner values but reconciles changed owner and bounds', async () => {
  const f = await fixture({ value: 2 });
  await f.type('-');
  setElementProps(f.root, { value: 2, name: 'quantity' });
  await flush();
  expect(f.editor.value).toBe('-');
  setElementProps(f.root, { value: 5 });
  await flush();
  expect(f.editor.value).toBe('5');
  await f.type('-');
  setElementProps(f.root, { value: 5, max: 3 });
  await flush();
  expect(f.editor.value).toBe('3');
  expect(f.commits).toHaveLength(0);
});
it('does not use a changed defaultValue as an uncontrolled owner update', async () => {
  const f = await fixture();
  await f.type('3.');
  setElementProps(f.root, { defaultValue: 90 });
  await flush();
  expect(f.editor.value).toBe('3.');
  expect(f.x.value.get()).toBe(3);
});
it('commits on blur without a change event and on Enter without blurring', async () => {
  const f = await fixture();
  f.editor.focus();
  await f.type('-');
  f.editor.blur();
  await flush();
  expect(f.commits).toEqual([{ value: 2 }]);
  expect(f.editor.value).toBe('2');
  f.editor.focus();
  await f.type('7');
  f.editor.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })
  );
  await flush();
  expect(f.commits).toEqual([{ value: 2 }, { value: 7 }]);
});
it('native change alone is not an extra commit boundary while editing', async () => {
  const f = await fixture();
  f.editor.focus();
  await f.type('3.');
  f.editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  await flush();
  expect(f.commits).toHaveLength(0);
  expect(f.editor.value).toBe('3.');
});
it('does not steal Space from the editor or an unrelated focused control', async () => {
  const f = await fixture();
  const outside = document.createElement('button');
  document.body.append(outside);
  for (const el of [f.editor, outside]) {
    el.focus();
    await flush();
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(f.x.value.get()).toBe(2);
});
for (const props of [{ disabled: true }, { readOnly: true }, { defaultValue: 100 }])
  it(`unavailable increment does not step ${JSON.stringify(props)}`, async () => {
    const f = await fixture(props);
    const old = f.x.value.get();
    f.plus.focus();
    await flush();
    const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    f.plus.dispatchEvent(down);
    f.plus.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
    await flush();
    expect(down.defaultPrevented).toBe(false);
    expect(f.x.value.get()).toBe(old);
    expect(f.commits).toHaveLength(0);
  });
it('increment Enter retains existing semantic activation', async () => {
  const f = await fixture();
  f.plus.focus();
  await flush();
  f.plus.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  );
  f.plus.dispatchEvent(
    new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true })
  );
  await flush();
  expect(f.x.value.get()).toBe(3);
  expect(f.commits).toHaveLength(1);
});
it('synchronous controlled acceptance updates the owner without duplicate blur commits', async () => {
  const f = await fixture({ value: 2 });
  f.root.addEventListener('valueChange', (event: CustomEvent) =>
    setElementProps(f.root, { value: event.detail.value })
  );
  f.editor.focus();
  await f.type('7');
  f.editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  f.editor.blur();
  await flush();
  expect(f.x.value.get()).toBe(7);
  expect(f.editor.value).toBe('7');
  expect(f.commits).toEqual([{ value: 7 }]);
});
it('an unrelated synchronous owner update during change preserves current draft', async () => {
  const f = await fixture();
  f.root.addEventListener('valueChange', () =>
    setElementProps(f.root, { ariaLabel: 'Updated quantity' })
  );
  f.editor.focus();
  await f.type('3.');
  expect(f.editor.value).toBe('3.');
  expect(f.x.draft.get()).toBe('3.');
  expect(f.x.value.get()).toBe(3);
});
it('retains Enter and a later blur as separate explicit commit boundaries', async () => {
  const f = await fixture();
  f.editor.focus();
  await f.type('7');
  f.editor.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })
  );
  await flush();
  expect(f.commits).toEqual([{ value: 7 }]);
  f.editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  f.editor.blur();
  await flush();
  expect(f.commits).toEqual([{ value: 7 }, { value: 7 }]);
});
