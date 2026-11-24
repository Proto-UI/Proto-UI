import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { numberFieldRoot, numberFieldInput } from '../src/number-field';
AdaptToWebComponent(numberFieldRoot);
AdaptToWebComponent(numberFieldInput);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
async function fixture(props: Record<string, unknown>) {
  const root = document.createElement('base-number-field-root') as any;
  const input = document.createElement('base-number-field-input') as any;
  setElementProps(root, props);
  root.append(input);
  document.body.append(root);
  await flush();
  const events: Array<{ name: string; value: number | null }> = [];
  for (const name of ['valueChange', 'valueCommit'])
    root.addEventListener(name, (event: CustomEvent) =>
      events.push({ name, value: event.detail.value })
    );
  const editor = input.shadowRoot?.querySelector('input') ?? input.querySelector('input');
  return { root, input, editor, x: root.getExposes(), events };
}
it('reset during numeric state publication preserves an initially empty owner and retires the old request', async () => {
  const f = await fixture({ defaultValue: null, allowEmpty: true });
  let reset = false;
  const off = f.x.value.subscribe((event: any) => {
    if (event.type !== 'next' || reset) return;
    reset = true;
    f.x.resetValue();
  });
  f.x.requestValue(25);
  await flush();
  expect(reset).toBe(true);
  expect(f.x.getValue()).toBeNull();
  expect(f.x.empty.get()).toBe(true);
  expect(f.x.draft.get()).toBe('');
  expect(f.input.getExposes().getValue()).toBeNull();
  expect(f.editor.value).toBe('');
  expect(f.editor.hasAttribute('aria-valuenow')).toBe(false);
  expect(f.events).toEqual([]);
  off();
});
it('reset during a controlled change request cancels the interrupted commit', async () => {
  const f = await fixture({ value: 20 });
  f.x.requestInput('25', false);
  let reset = false;
  f.root.addEventListener('valueChange', () => {
    if (reset) return;
    reset = true;
    f.x.resetValue();
  });
  f.x.commitValue();
  await flush();
  expect(reset).toBe(true);
  expect(f.x.getValue()).toBe(20);
  expect(f.events.filter((e) => e.name === 'valueCommit')).toEqual([]);
});

it('an explicit reset allows a later request and does not retire the mounted owner', async () => {
  const f = await fixture({ defaultValue: null, allowEmpty: true });
  f.x.requestValue(25);
  f.x.resetValue();
  await flush();
  expect(f.x.getValue()).toBeNull();
  expect(f.editor.value).toBe('');
  f.events.length = 0;
  f.x.requestInput('30', false);
  f.x.commitValue();
  await flush();
  expect(f.x.getValue()).toBe(30);
  expect(f.editor.value).toBe('30');
  expect(f.events).toEqual([
    { name: 'valueChange', value: 30 },
    { name: 'valueCommit', value: 30 },
  ]);
});
