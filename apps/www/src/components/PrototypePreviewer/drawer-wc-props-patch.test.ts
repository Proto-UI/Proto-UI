import { afterEach, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { renderDemo } from './demo-renderer';
import { registerPrototype } from './registry';
const prototype = definePrototype({
  name: 'test-wc-demo-props-patch',
  setup(def) {
    def.props.define({
      side: { type: 'string', empty: 'fallback' },
      snapPoints: { type: 'object', empty: 'fallback' },
      enterDuration: { type: 'number', empty: 'fallback' },
    });
    def.props.setDefaults({ side: 'bottom', snapPoints: [1], enterDuration: 200 });
    let current: any;
    let raw: any;
    const read = (run: any) => {
      current = run.props.get();
      raw = run.props.getRaw();
    };
    def.lifecycle.onCreated(read);
    def.props.watchAll(read);
    def.expose.method('snapshot', () => current);
    def.expose.method('raw', () => raw);
  },
});
registerPrototype('wc-demo-props-patch', prototype);
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});
it('WC surface-only updates and patches retain authored props and explicit clear values', async () => {
  let api: any;
  const host = document.createElement('div');
  document.body.append(host);
  const view = await renderDemo({
    runtime: 'wc',
    host,
    demo: {
      type: 'demo',
      root: {
        kind: 'proto',
        prototypeId: 'wc-demo-props-patch',
        ref: 'subject',
        props: { side: 'top', snapPoints: [0.5, 1], enterDuration: 0 },
        surfaceStyle: { '--test-color': 'red' },
      },
      setup(context) {
        api = context.api;
      },
    },
  });
  cleanups.push(() => view.destroy());
  const read = () => api.call('subject', 'snapshot');
  expect(read()).toMatchObject({ side: 'top', snapPoints: [0.5, 1], enterDuration: 0 });
  api.setSurfaceStyle('subject', { '--test-color': 'blue' });
  expect(read()).toMatchObject({ side: 'top', snapPoints: [0.5, 1], enterDuration: 0 });
  api.setProps('subject', { enterDuration: 50 });
  expect(read()).toMatchObject({ side: 'top', snapPoints: [0.5, 1], enterDuration: 50 });
  api.setProps('subject', { snapPoints: [], side: undefined });
  expect(read()).toMatchObject({ side: 'top', snapPoints: [], enterDuration: 50 });
  expect(Object.hasOwn(api.call('subject', 'raw'), 'side')).toBe(true);
  expect(api.call('subject', 'raw').side).toBeNull();
  api.setSurfaceStyle('subject', {});
  expect(read()).toMatchObject({ side: 'top', snapPoints: [], enterDuration: 50 });
});

it('WC owned surface props retain priority over component prop patches', async () => {
  let api: any;
  const host = document.createElement('div');
  document.body.append(host);
  const view = await renderDemo({
    runtime: 'wc',
    host,
    demo: {
      type: 'demo',
      root: {
        kind: 'proto',
        prototypeId: 'wc-demo-props-patch',
        ref: 'subject',
        props: { side: 'top', surfaceStyle: { '--test-color': 'component-initial' } },
        surfaceStyle: { '--test-color': 'owned-initial' },
      },
      setup(context) {
        api = context.api;
      },
    },
  });
  cleanups.push(() => view.destroy());
  const el = host.querySelector<HTMLElement>('[data-demo-ref="subject"]')!;
  expect(el.style.getPropertyValue('--test-color')).toBe('owned-initial');
  api.setProps('subject', {
    surfaceStyle: { '--test-color': 'component-update' },
    enterDuration: 50,
  });
  expect(el.style.getPropertyValue('--test-color')).toBe('owned-initial');
  api.setSurfaceStyle('subject', { '--test-color': 'owned-update' });
  expect(el.style.getPropertyValue('--test-color')).toBe('owned-update');
  expect(api.call('subject', 'snapshot')).toMatchObject({ side: 'top', enterDuration: 50 });
});

it('WC remount with the same ref starts from its own authored prop snapshot', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  async function mount(props: Record<string, unknown>) {
    let api: any;
    const view = await renderDemo({
      runtime: 'wc',
      host,
      demo: {
        type: 'demo',
        root: { kind: 'proto', prototypeId: 'wc-demo-props-patch', ref: 'subject', props },
        setup(context) {
          api = context.api;
        },
      },
    });
    return { view, api, element: host.querySelector('[data-demo-ref="subject"]') };
  }
  const first = await mount({ side: 'top', snapPoints: [0.5, 1], enterDuration: 0 });
  first.api.setProps('subject', { enterDuration: 77 });
  await first.view.destroy();
  const second = await mount({ side: 'left' });
  cleanups.push(() => second.view.destroy());
  expect(second.element).not.toBe(first.element);
  second.api.setSurfaceStyle('subject', { '--test-color': 'second' });
  expect(second.api.call('subject', 'snapshot')).toMatchObject({
    side: 'left',
    snapPoints: [1],
    enterDuration: 200,
  });
  expect(Object.hasOwn(second.api.call('subject', 'raw'), 'enterDuration')).toBe(false);
  second.api.setProps('subject', { snapPoints: [] });
  expect(second.api.call('subject', 'snapshot')).toMatchObject({
    side: 'left',
    snapPoints: [],
    enterDuration: 200,
  });
});
