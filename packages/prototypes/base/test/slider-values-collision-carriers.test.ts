import { afterEach, expect, it } from 'vitest';
import { sliderValuesRoot, sliderValuesThumb } from '../src/slider';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  createMountedReactAdapter,
  createMountedReactAdapterInto,
} from '../../../adapters/react/test/utils/fake-react';
import { createVueAdapter } from '../../../adapters/vue/src/adapt';
import { VueAny, flushVue } from '../../../adapters/vue/test/utils/vue';
import { createVue2Adapter } from '../../../adapters/vue2/src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from '../../../adapters/vue2/test/utils/vue2';
for (const proto of [sliderValuesRoot, sliderValuesThumb]) AdaptToWebComponent(proto);
const cleanup: Array<() => void> = [];
const micro = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  await micro();
  document.body.replaceChildren();
});
async function fixture(carrier: string, controlled = false) {
  let onChange: (p: any) => void = () => {};
  const commits: any[] = [];
  const props = {
    ...(controlled ? { value: [20, 40, 60] } : { defaultValue: [20, 40, 60] }),
    minStepsBetweenValues: 10,
    thumbCollisionBehavior: 'swap',
    onValueChange: (p: any) => onChange(p),
    onValueCommit: (p: any) => commits.push(p),
  };
  let x: any;
  if (carrier === 'react') {
    const root = createMountedReactAdapter(sliderValuesRoot, props);
    cleanup.push(() => root.unmount());
    for (let index = 0; index < 3; index++) {
      const host = document.createElement('span');
      root.root!.append(host);
      const thumb = createMountedReactAdapterInto(sliderValuesThumb, host, { index });
      cleanup.push(() => thumb.unmount());
    }
    x = root.ref.current.getExposes();
  } else if (carrier === 'vue') {
    const host = document.createElement('div');
    document.body.append(host);
    const adapt = createVueAdapter(VueAny),
      Root = adapt(sliderValuesRoot),
      Thumb = adapt(sliderValuesThumb);
    let root: any;
    const app = VueAny.createApp({
      render: () =>
        VueAny.h(
          Root,
          {
            ...props,
            ref: (vm: any) => {
              root = vm;
            },
          },
          () => [0, 1, 2].map((index) => VueAny.h(Thumb, { key: index, index }))
        ),
    });
    app.mount(host);
    cleanup.push(() => {
      app.unmount();
      host.remove();
    });
    await flushVue();
    await flushVue();
    x = root.getExposes();
  } else if (carrier === 'vue2') {
    const host = document.createElement('div');
    document.body.append(host);
    const adapt = createVue2Adapter(Vue2RuntimeAny),
      Root = adapt(sliderValuesRoot),
      Thumb = adapt(sliderValuesThumb);
    const App = Vue2Any.extend({
      render(h: any) {
        return h(
          Root,
          { ref: 'root', attrs: props },
          [0, 1, 2].map((index) => h(Thumb, { key: index, attrs: { index } }))
        );
      },
    });
    const app = new App().$mount();
    host.append(app.$el);
    cleanup.push(() => {
      app.$destroy();
      host.remove();
    });
    await flushVue2();
    await flushVue2();
    x = app.$refs.root.getExposes();
  } else {
    const root = document.createElement(sliderValuesRoot.name) as any;
    setElementProps(root, props);
    for (let index = 0; index < 3; index++) {
      const thumb = document.createElement(sliderValuesThumb.name);
      setElementProps(thumb, { index });
      root.append(thumb);
    }
    root.addEventListener('valueChange', (e: CustomEvent) => onChange(e.detail));
    root.addEventListener('valueCommit', (e: CustomEvent) => commits.push(e.detail));
    document.body.append(root);
    cleanup.push(() => root.remove());
    await micro();
    x = root.getExposes();
  }
  await micro();
  return {
    x,
    commits,
    onChange(fn: typeof onChange) {
      onChange = fn;
    },
  };
}
for (const carrier of ['react', 'vue', 'vue2', 'wc']) {
  it(`${carrier}: real mapped collision proposal veto preserves owner, selection and prior commit`, async () => {
    const f = await fixture(carrier);
    expect(f.x.beginInteraction(0)).toBe(true);
    expect(f.x.requestInteractionValue(25)).toBe(true);
    let calls = 0;
    f.onChange((p) => {
      calls++;
      expect(p).toEqual({ value: [30, 80, 90], activeThumbIndex: 1, reason: 'interaction' });
      expect(f.x.getValue()).toEqual([25, 40, 60]);
      expect(f.x.activeIndex.get()).toBe(0);
      expect(f.x.cancelValueChange()).toBe(true);
    });
    expect(f.x.requestInteractionValue(80)).toBe(false);
    expect(calls).toBe(1);
    expect(f.x.activeIndex.get()).toBe(0);
    expect(f.x.commitValue()).toBe(true);
    expect(f.commits[0].value).toEqual([25, 40, 60]);
  });
  it(`${carrier}: controlled accepted swap history advances without Props echo`, async () => {
    const f = await fixture(carrier, true);
    expect(f.x.beginInteraction(0)).toBe(true);
    expect(f.x.requestInteractionValue(80)).toBe(true);
    expect(f.x.activeIndex.get()).toBe(1);
    expect(f.x.getValue()).toEqual([20, 40, 60]);
    expect(f.x.requestInteractionValue(50)).toBe(true);
    expect(f.x.commitValue()).toBe(true);
    expect(f.commits[0]).toEqual({
      value: [30, 50, 90],
      activeThumbIndex: 1,
      reason: 'interaction',
    });
    expect(f.x.getValue()).toEqual([20, 40, 60]);
  });
  it(`${carrier}: synchronous notification blocks nested begin, input and cancellation`, async () => {
    const f = await fixture(carrier);
    expect(f.x.beginInteraction(0)).toBe(true);
    f.onChange(() => {
      expect(f.x.beginInteraction(1)).toBe(false);
      expect(f.x.requestInteractionValue(10)).toBe(false);
      expect(f.x.cancelInteraction()).toBe(false);
      expect(f.x.commitValue()).toBe(false);
    });
    expect(f.x.requestInteractionValue(80)).toBe(true);
    expect(f.x.activeIndex.get()).toBe(1);
    expect(f.x.commitValue()).toBe(true);
    expect(f.commits).toHaveLength(1);
  });
}
