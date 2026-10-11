import { expect, it } from 'vitest';
import { AdaptToWebComponent } from '../src/adapt';

it('web-component: exposes immutable list snapshots without scalar projection or implicit rendering', async () => {
  const name = `x-number-list-${Math.random().toString(16).slice(2)}`;
  AdaptToWebComponent({
    name,
    setup(def) {
      const state = def.state.numberList('coordinates', [1, 9]);
      def.expose.state('coordinates', state);
      def.expose.value('controls', { change: (input: readonly number[]) => state.set(input) });
      return (run) => run.el('div', state.get().join(','));
    },
  });
  const element = document.createElement(name) as any;
  document.body.appendChild(element);
  await Promise.resolve();
  await Promise.resolve();
  const external = element.getExposes().coordinates;
  expect(external.spec.kind).toBe('number.list');
  expect(Object.isFrozen(external.get())).toBe(true);
  expect(external.set).toBeUndefined();
  const events: any[] = [];
  external.subscribe((event: any) => events.push(event));
  const before = external.get();
  element.getExposes().controls.change([1, 9]);
  expect(external.get()).toBe(before);
  expect(events).toHaveLength(0);
  const input = [2, 8];
  element.getExposes().controls.change(input);
  input.push(99);
  expect(external.get()).toEqual([2, 8]);
  expect(events).toHaveLength(1);
  expect(Object.isFrozen(events[0].prev)).toBe(true);
  expect(element.textContent).toBe('1,9');
  element.update();
  await Promise.resolve();
  expect(element.textContent).toBe('2,8');
  expect(element.hasAttribute('data-coordinates')).toBe(false);
  expect(element.style.getPropertyValue('--pui-coordinates')).toBe('');
  element.remove();
  await Promise.resolve();
  await Promise.resolve();
  expect(() => external.get()).toThrow();
});
