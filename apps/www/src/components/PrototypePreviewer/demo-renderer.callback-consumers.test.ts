import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDemo } from './demo-renderer';
import { loadPrototypes } from './prototype-modules';
import { collectPrototypeIds, type DemoRuntimeApi, type DemoSpec } from './demo-types';
import { createAccordionDemo } from '../../content/docs/accordion-demo.shared';
import { createFormPrimitivesDemo } from '../../content/docs/form-primitives-demo.shared';
import { createFieldDemo } from '../../content/docs/field-demo.shared';
import { createRangeReadoutDemo } from '../../content/docs/range-readout-demo.shared';
import baseCollapsible from '../../content/docs/demo-base-collapsible.demo';
import shadcnCollapsible from '../../content/docs/demo-shadcn-collapsible.demo';
import brutalistCollapsible from '../../content/docs/demo-brutalist-collapsible.demo';
import bootstrapCollapsible from '../../content/docs/demo-bootstrap-2-3-2-collapsible.demo';
import liquidCollapsible from '../../content/docs/demo-liquid-glass-collapsible.demo';
import bootstrapSelect from '../../content/docs/demo-bootstrap-2-3-2-select.demo';
import liquidSelect from '../../content/docs/demo-liquid-glass-select.demo';
import bootstrapButton from '../../content/docs/demo_components/bootstrap-2-3-2/demo-bootstrap-2-3-2-button.demo';
import liquidButton from '../../content/docs/demo_components/liquid-glass/demo-liquid-glass-button.demo';
import imageDemo from '../../content/docs/zh-cn/demo-base-image.demo';
import textareaDemo from '../../content/docs/zh-cn/demo-base-textarea.demo';
import inputDemo from '../../content/docs/zh-cn/demo-base-input.demo';
import { createCalendarDemo } from '../../content/docs/zh-cn/calendar-demo.shared';

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
async function mount(demo: DemoSpec) {
  const ids = new Set<string>();
  collectPrototypeIds(demo.root, ids);
  await loadPrototypes([...ids]);
  const host = document.createElement('div');
  document.body.append(host);
  let refs!: Record<string, HTMLElement>;
  let api!: DemoRuntimeApi;
  const calls = vi.fn();
  const props = vi.fn();
  const rendered = await renderDemo({
    runtime: 'wc',
    host,
    demo: {
      ...demo,
      setup(context) {
        refs = context.refs;
        api = {
          ...context.api,
          call(...args) {
            calls(...args);
            return context.api.call(...args);
          },
          setProps(...args) {
            props(...args);
            context.api.setProps(...args);
          },
        };
        return demo.setup?.({ ...context, api });
      },
    },
  });
  cleanups.push(() => rendered.destroy());
  await flush();
  calls.mockClear();
  props.mockClear();
  return { host, refs, api, calls, props };
}
const signal = (element: HTMLElement, type: string, detail: unknown) =>
  element.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
function statusWrites(element: HTMLElement) {
  let owner: object | null = element;
  while (owner && !Object.getOwnPropertyDescriptor(owner, 'textContent'))
    owner = Object.getPrototypeOf(owner);
  const descriptor = Object.getOwnPropertyDescriptor(owner!, 'textContent')!;
  const writes = vi.fn((value: string) => descriptor.set!.call(element, value));
  Object.defineProperty(element, 'textContent', {
    configurable: true,
    get: () => descriptor.get!.call(element),
    set: writes,
  });
  cleanups.push(() => {
    delete (element as unknown as Record<string, unknown>).textContent;
  });
  return writes;
}

// Real docs trees + renderer + WC adapters. Explicit CustomEvents below are
// synthetic carrier controls for duplicate consumer subscriptions; physical
// button .click() controls also execute the actual Button outward path.
describe('one owner for migrated demo callbacks', () => {
  for (const [family, demo] of Object.entries({
    base: baseCollapsible,
    shadcn: shadcnCollapsible,
    brutalist: brutalistCollapsible,
    bootstrap: bootstrapCollapsible,
    liquid: liquidCollapsible,
  })) {
    it(`${family} Collapsible applies one proposal and one owner acceptance`, async () => {
      const f = await mount(demo);
      const writes = statusWrites(f.refs.requestStatus!);
      signal(f.refs.controlled!, 'openChange', { open: true, reason: 'trigger' });
      expect(writes).toHaveBeenCalledTimes(1);
      expect(f.refs.requestStatus!.textContent).toContain('owner has not accepted');
      f.refs.accept!.click();
      expect(f.props.mock.calls.filter(([ref]) => ref === 'controlled')).toHaveLength(1);
      expect(f.refs.requestStatus!.textContent).toBe('Owner accepted: open.');
    });
  }
  for (const [family, demo] of Object.entries({
    bootstrap: bootstrapSelect,
    liquid: liquidSelect,
  })) {
    it(`${family} Select applies one proposal and preserves its label observer`, async () => {
      const f = await mount(demo);
      const writes = statusWrites(f.refs.requestStatus!);
      signal(f.refs.controlled!, 'valueChange', {
        value: 'beta',
        textValue: 'Beta',
        reason: 'selection',
      });
      expect(writes).toHaveBeenCalledTimes(1);
      f.refs.accept!.click();
      expect(f.props.mock.calls.filter(([ref]) => ref === 'controlled')).toHaveLength(1);
      expect(f.refs.requestStatus!.textContent).toBe('Owner accepted: beta.');
      f.refs.controlledTrigger!.setAttribute('aria-label', 'changed');
      await vi.waitFor(() =>
        expect(f.refs.controlledTrigger!.getAttribute('aria-label')).toBe('controlled selection')
      );
    });
  }
  for (const [family, demo] of Object.entries({
    bootstrap: bootstrapButton,
    liquid: liquidButton,
  })) {
    it(`${family} Button increments its displayed count exactly once per activation`, async () => {
      const f = await mount(demo);
      f.refs.action!.click();
      expect(f.refs.count!.textContent).toBe('1 activations');
      f.refs.action!.click();
      expect(f.refs.count!.textContent).toBe('2 activations');
    });
  }
  it('Accordion writes the controlled request status once', async () => {
    const f = await mount(createAccordionDemo('base'));
    const writes = statusWrites(f.refs.requestStatus!);
    signal(f.refs.controlled!, 'openChange', {
      openItems: ['b'],
      value: 'b',
      open: true,
      reason: 'trigger',
    });
    expect(writes).toHaveBeenCalledTimes(1);
  });
  it('Field calls each validation command once and retains its validity callback', async () => {
    const f = await mount(createFieldDemo('base'));
    f.refs.validate!.click();
    expect(
      f.calls.mock.calls.filter(([ref, method]) => ref === 'requiredRoot' && method === 'validate')
    ).toHaveLength(1);
    const writes = statusWrites(f.refs.controlledStatus!);
    signal(f.refs.controlledRoot!, 'validityChange', { invalid: true, errors: ['Required'] });
    expect(writes).toHaveBeenCalledTimes(1);
  });
  it('Form reports one submitted value record', async () => {
    const f = await mount(createFormPrimitivesDemo('base', 'form'));
    const writes = statusWrites(f.refs.status!);
    signal(f.refs.form!, 'submit', { values: { name: 'Ada' } });
    expect(writes).toHaveBeenCalledTimes(1);
    expect(f.refs.status!.textContent).toBe('{"name":"Ada"}');
  });
  it('Range advances by one step rather than two', async () => {
    const f = await mount(createRangeReadoutDemo('base', 'progress'));
    f.refs.advance!.click();
    expect(f.props.mock.calls.filter(([ref]) => ref === 'range')).toEqual([
      ['range', { value: 59, min: 0, max: 100, low: 25, high: 75, optimum: 50 }],
    ]);
  });
  it('Image records one transition and installs one source update per action', async () => {
    const f = await mount(imageDemo as DemoSpec);
    const writes = statusWrites(f.refs.transitions!);
    signal(f.refs.resource!, 'loadingStatusChange', {
      status: 'loading',
      previousStatus: 'idle',
      source: '',
    });
    expect(writes).toHaveBeenCalledTimes(1);
    f.refs.clearImage!.click();
    expect(f.props.mock.calls.filter(([ref]) => ref === 'resource')).toHaveLength(1);
  });
  it('Textarea logs its normalized callback once and does not overwrite it with native input', async () => {
    const f = await mount(textareaDemo as DemoSpec);
    const writes = statusWrites(f.refs.eventLog!);
    signal(f.refs.textarea!, 'change', { value: 'Projected' });
    expect(writes).toHaveBeenCalledTimes(1);
    expect(f.refs.eventLog!.textContent).toBe('uncontrolled.change: {"value":"Projected"}');
    f.refs.textarea!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(writes).toHaveBeenCalledTimes(1);
  });
  it('Input accepts its controlled proposal through the common callback channel', async () => {
    const f = await mount(inputDemo as DemoSpec);
    signal(f.refs.controlled!, 'valueChange', { value: 'Accepted' });
    expect(f.props.mock.calls.filter(([ref]) => ref === 'controlled')).toHaveLength(1);
    expect(f.api.getExposes('controlled')?.value).toBeDefined();
  });
  it('Calendar accepts one month proposal and retains caption synchronization', async () => {
    const f = await mount(createCalendarDemo('base'));
    signal(f.refs.calendar!, 'monthChange', { month: '2033-05' });
    await flush();
    expect(f.props.mock.calls.filter(([ref]) => ref === 'calendar')).toHaveLength(1);
    expect((f.api.getExposes('calendar')?.month as { get(): string }).get()).toBe('2033-05');
  }, 20000);
});
