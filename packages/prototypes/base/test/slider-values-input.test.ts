import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/slider';
import * as shadcn from '../../shadcn/src/slider';
import * as brutalist from '../../brutalist/src/slider';
import * as form from '../src/form';
import * as field from '../src/field';
import { normalizeFieldValue } from '../src/field/shared';

for (const group of [base, shadcn, brutalist, form, field])
  for (const prototype of Object.values(group))
    if (prototype && typeof prototype === 'object' && 'setup' in prototype)
      AdaptToWebComponent(prototype as any);
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const validation = async () => {
  await new Promise((r) => setTimeout(r, 2));
  await flush();
};
const element = (name: string, props: Record<string, unknown> = {}) => {
  const node = document.createElement(name) as any;
  setElementProps(node, props);
  return node;
};
const pointer = (type: string, x: number, y = 0) =>
  new PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerId: 17,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
afterEach(async () => {
  document.body.replaceChildren();
  await validation();
});

describe.each(['base', 'shadcn', 'brutalist'])('%s Slider Values public input', (family) => {
  const fixture = async (
    props: Record<string, unknown> = {},
    fieldProps?: Record<string, unknown>
  ) => {
    const root = element(`${family}-slider-values-root`, { defaultValue: [20, 80], ...props });
    const track = element(`${family}-slider-values-track`);
    const thumbs = [0, 1].map((index) => element(`${family}-slider-values-thumb`, { index }));
    track.append(element(`${family}-slider-values-indicator`), ...thumbs);
    root.append(
      element(`${family}-slider-values-label`),
      track,
      element(`${family}-slider-values-value`)
    );
    const parent = fieldProps ? element('base-form-root') : document.createElement('div');
    const field = fieldProps ? element('base-form-field', { name: 'range', ...fieldProps }) : null;
    const label = field ? element('base-field-label') : null;
    if (field) {
      label.textContent = 'Price range';
      field.append(label, root);
      parent.append(field);
    } else parent.append(root);
    document.body.append(parent);
    await flush();
    track.getBoundingClientRect = () => ({ left: 10, top: 10, width: 200, height: 200 }) as DOMRect;
    const x = root.getExposes();
    const changes: unknown[] = [],
      commits: unknown[] = [];
    root.addEventListener('valueChange', (e: CustomEvent) => changes.push(e.detail));
    root.addEventListener('valueCommit', (e: CustomEvent) => commits.push(e.detail));
    const at = async (target: HTMLElement, type: string, x: number, y = 0) => {
      target.dispatchEvent(pointer(type, x, y));
      await flush();
    };
    return { root, track, thumbs, x, changes, commits, parent: parent as any, field, label, at };
  };

  it('uses one Track capture, retains off-center grab offsets and ends a no-op contact', async () => {
    const f = await fixture();
    const capture: number[] = [];
    f.track.setPointerCapture = (id: number) => capture.push(id);
    await f.at(f.thumbs[0], 'pointerdown', 55);
    expect(f.x.getValue()).toEqual([20, 80]);
    expect(f.x.interacting.get()).toBe(true);
    await f.at(f.track, 'pointerup', 55);
    expect(f.x.interacting.get()).toBe(false);
    expect(f.commits).toEqual([]);
    await f.at(f.thumbs[0], 'pointerdown', 55);
    await f.at(f.track, 'pointermove', 75);
    expect(f.x.getValue()).toEqual([30, 80]);
    await f.at(f.track, 'pointerup', 75);
    expect(f.commits).toEqual([{ value: [30, 80], activeThumbIndex: 0, reason: 'interaction' }]);
    expect(capture).toEqual([17, 17]);
  });

  it('seeks the nearest editable slot but rejects a disabled Thumb origin without retargeting', async () => {
    const f = await fixture();
    await f.at(f.track, 'pointerdown', 150);
    expect(f.x.getValue()).toEqual([20, 70]);
    expect(f.thumbs[1].getExposes().focused.get()).toBe(true);
    await f.at(f.track, 'pointerup', 150);
    setElementProps(f.thumbs[0], { index: 0, disabled: true });
    await flush();
    const changes = f.changes.length;
    await f.at(f.thumbs[0], 'pointerdown', 55);
    await f.at(f.track, 'pointerup', 100);
    expect(f.changes).toHaveLength(changes);
    expect(f.x.getValue()).toEqual([20, 70]);
    expect(f.x.interacting.get()).toBe(false);
  });

  it('transfers logical focus on swap while cancel suppresses completion', async () => {
    const f = await fixture({ thumbCollisionBehavior: 'swap' });
    await f.at(f.thumbs[0], 'pointerdown', 50);
    await f.at(f.track, 'pointermove', 190);
    expect(f.x.getValue()).toEqual([80, 90]);
    expect(f.x.activeIndex.get()).toBe(1);
    expect(f.thumbs[1].getExposes().focused.get()).toBe(true);
    expect(f.thumbs[1].getExposes().dragging.get()).toBe(true);
    await f.at(f.track, 'pointercancel', 190);
    await f.at(f.track, 'pointerup', 190);
    expect(f.x.getValue()).toEqual([80, 90]);
    expect(f.x.interacting.get()).toBe(false);
    expect(f.commits).toEqual([]);
  });

  it.each([{ direction: 'rtl' }, { orientation: 'vertical' }])(
    'uses normalized orientation %j',
    async (props) => {
      const f = await fixture(props);
      await f.at(f.track, 'pointerdown', 50, 50);
      await f.at(f.track, 'pointerup', 70, 70);
      expect(f.x.getValue()).toEqual([20, 70]);
    }
  );

  it('releases an active contact on policy changes, reset and detach without stale completion', async () => {
    const f = await fixture();
    await f.at(f.thumbs[0], 'pointerdown', 50);
    await f.at(f.track, 'pointermove', 70);
    setElementProps(f.root, { readOnly: true });
    await flush();
    await f.at(f.track, 'pointerup', 150);
    expect(f.x.getValue()).toEqual([30, 80]);
    expect(f.commits).toEqual([]);
    f.x.resetValue();
    await flush();
    expect(f.x.getValue()).toEqual([20, 80]);
    setElementProps(f.root, { readOnly: false });
    await flush();
    await f.at(f.thumbs[0], 'pointerdown', 50);
    f.track.remove();
    await flush();
    await f.at(f.track, 'pointerup', 180);
    expect(f.x.interacting.get()).toBe(false);
    expect(f.commits).toEqual([]);
  });

  it('reports the group canonical array, relations, label focus and disabled Form reset', async () => {
    const f = await fixture({}, { validationMode: 'onChange' });
    expect(f.parent.getExposes().getValues()).toEqual({ range: [20, 80] });
    expect(f.root.getAttribute('aria-labelledby')).toContain(f.label.id);
    for (const type of ['pointerdown', 'pointerup']) f.label.dispatchEvent(pointer(type, 0));
    f.label.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, detail: 1, button: 0 })
    );
    await validation();
    expect(f.thumbs[0].getExposes().focused.get()).toBe(true);
    f.x.requestThumbValue(0, 30);
    await validation();
    expect(f.parent.getExposes().getValues()).toEqual({ range: [30, 80] });
    expect(f.field.getExposes().getValidity().dirty).toBe(true);
    const copy = f.parent.getExposes().getValues();
    copy.range[0] = 99;
    expect(f.x.getValue()).toEqual([30, 80]);
    setElementProps(f.field, { name: 'range', disabled: true });
    await flush();
    f.parent.getExposes().requestReset();
    await validation();
    expect(f.x.getValue()).toEqual([20, 80]);
    expect(f.field.getExposes().getValidity().dirty).toBe(false);
  });

  it('keeps readonly groups label-focusable while rejecting edits', async () => {
    const f = await fixture({ readOnly: true }, {});
    for (const type of ['pointerdown', 'pointerup']) f.label.dispatchEvent(pointer(type, 0));
    f.label.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, detail: 1, button: 0 })
    );
    await validation();
    expect(f.thumbs[0].getExposes().focused.get()).toBe(true);
    expect(f.field.getExposes().getValidity().focused).toBe(true);
    f.thumbs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await f.at(f.track, 'pointerdown', 110);
    await f.at(f.track, 'pointerup', 110);
    expect(f.x.getValue()).toEqual([20, 80]);
    expect(f.changes).toEqual([]);
  });

  it('coalesces same-turn Field reports to one current snapshot and cancels reset work', async () => {
    const f = await fixture({}, { validationMode: 'onChange', externalValidation: true });
    const requests: any[] = [];
    f.field.addEventListener('validationRequest', (event: CustomEvent) =>
      requests.push(event.detail)
    );
    f.x.requestThumbValue(0, 30);
    f.x.requestThumbValue(0, 40);
    await validation();
    expect(requests).toHaveLength(1);
    expect(requests[0].value).toEqual([40, 80]);
    const first = requests[0].requestId;
    f.x.requestThumbValue(0, 50);
    f.x.resetValue();
    await validation();
    expect(requests).toHaveLength(1);
    expect(
      f.field.getExposes().resolveValidation(first, { invalid: true, errors: ['stale'] })
    ).toBe(false);
    expect(f.x.getValue()).toEqual([20, 80]);
    expect(f.field.getExposes().getValidity().pending).toBe(false);
  });

  it('controlled refusal keeps canonical Field value and skips onChange validation', async () => {
    const f = await fixture(
      { value: [20, 80] },
      { validationMode: 'onChange', externalValidation: true }
    );
    let validationRequests = 0;
    f.field.addEventListener('validationRequest', () => validationRequests++);
    await f.at(f.thumbs[0], 'pointerdown', 50);
    await f.at(f.track, 'pointermove', 90);
    await f.at(f.track, 'pointerup', 90);
    await validation();
    expect(f.changes.length).toBeGreaterThan(0);
    expect(f.x.getValue()).toEqual([20, 80]);
    expect(f.parent.getExposes().getValues()).toEqual({ range: [20, 80] });
    expect(f.field.getExposes().getValidity().dirty).toBe(false);
    expect(validationRequests).toBe(0);
    expect(f.commits.at(-1)).toEqual({
      value: [40, 80],
      activeThumbIndex: 0,
      reason: 'interaction',
    });
    // Positive control uses the same observation channel: an accepted owner
    // value triggers onChange validation, making zero above meaningful.
    f.root.addEventListener('valueChange', (event: CustomEvent) =>
      setElementProps(f.root, { value: event.detail.value })
    );
    f.x.requestThumbValue(0, 50);
    await validation();
    expect(f.x.getValue()).toEqual([50, 80]);
    expect(f.parent.getExposes().getValues()).toEqual({ range: [50, 80] });
    expect(validationRequests).toBe(1);
  });
});

it('Field admits defensive homogeneous finite numeric arrays and rejects mixed, sparse and nonfinite arrays', () => {
  const value = Object.freeze([1, 2]);
  const result = normalizeFieldValue(value);
  expect(result).toEqual([1, 2]);
  expect(result).not.toBe(value);
  for (const invalid of [[1, '2'], [NaN], [Infinity], [true], new Array(2)])
    expect(normalizeFieldValue(invalid)).toBeUndefined();
});
