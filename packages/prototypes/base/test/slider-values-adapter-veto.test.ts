import { afterEach, expect, it } from 'vitest';
import { sliderValuesRoot } from '../src/slider';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { createMountedReactAdapter } from '../../../adapters/react/test/utils/fake-react';
import { createMountedVueAdapter, flushVue } from '../../../adapters/vue/test/utils/vue';
import { createMountedVue2Adapter, flushVue2 } from '../../../adapters/vue2/test/utils/vue2';
AdaptToWebComponent(sliderValuesRoot);
const cleanup: Array<() => void> = [];
const micro = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  await micro();
  document.body.replaceChildren();
});
async function mount(host: string, controlled = false) {
  let onChange: (payload: any) => unknown = () => {},
    onCommit: (payload: any) => unknown = () => {};
  const props = {
    ...(controlled ? { value: [20, 80] } : { defaultValue: [20, 80] }),
    onValueChange: (p: any) => onChange(p),
    onValueCommit: (p: any) => onCommit(p),
  };
  let x: any, dispose: () => void;
  if (host === 'react') {
    const f = createMountedReactAdapter(sliderValuesRoot, props);
    x = f.ref.current.getExposes();
    dispose = () => f.unmount();
  } else if (host === 'vue') {
    const f = createMountedVueAdapter(sliderValuesRoot, props);
    await flushVue();
    x = f.vm.getExposes();
    dispose = () => f.unmount();
  } else if (host === 'vue2') {
    const f = createMountedVue2Adapter(sliderValuesRoot, props);
    await flushVue2();
    x = f.vm.getExposes();
    dispose = () => f.unmount();
  } else {
    const root = document.createElement(sliderValuesRoot.name) as any;
    setElementProps(root, controlled ? { value: [20, 80] } : { defaultValue: [20, 80] });
    root.addEventListener('valueChange', (e: CustomEvent) => onChange(e.detail));
    root.addEventListener('valueCommit', (e: CustomEvent) => onCommit(e.detail));
    document.body.append(root);
    await micro();
    x = root.getExposes();
    dispose = () => root.remove();
  }
  cleanup.push(dispose);
  return {
    x,
    change: (fn: typeof onChange) => {
      onChange = fn;
    },
    commit: (fn: typeof onCommit) => {
      onCommit = fn;
    },
    dispose,
  };
}
for (const host of ['react', 'vue', 'vue2', 'wc']) {
  it(`${host}: proposal notification observes old owner, synchronous method veto leaves it unchanged`, async () => {
    const f = await mount(host);
    let calls = 0;
    f.change((p) => {
      calls++;
      expect(p.value).toEqual([30, 70]);
      expect(f.x.getValue()).toEqual([20, 80]);
      expect(f.x.phase.get()).toBe('notifying');
      expect(f.x.cancelValueChange()).toBe(true);
    });
    expect(f.x.requestValues([30, 70])).toBe(false);
    expect(calls).toBe(1);
    expect(f.x.getValue()).toEqual([20, 80]);
    expect(f.x.phase.get()).toBe('idle');
  });
  it(`${host}: late veto and nested edit cannot cancel a future request`, async () => {
    const f = await mount(host);
    expect(f.x.cancelValueChange()).toBe(false);
    f.change(() => {
      expect(f.x.requestValues([1, 2])).toBe(false);
    });
    expect(f.x.requestValues([30, 70])).toBe(true);
    expect(f.x.getValue()).toEqual([30, 70]);
    expect(f.x.cancelValueChange()).toBe(false);
    expect(f.x.requestValues([40, 60])).toBe(true);
  });
  it(`${host}: callback false and event payload mutation are not owner mutation or veto`, async () => {
    const f = await mount(host);
    f.change((p) => {
      p.value[0] = 999;
      return false;
    });
    expect(f.x.requestValues([30, 70])).toBe(true);
    expect(f.x.getValue()).toEqual([30, 70]);
  });
  it(`${host}: a later canceled proposal preserves the previous uncanceled completion`, async () => {
    const f = await mount(host),
      commits: any[] = [];
    f.commit((p) => commits.push(p.value));
    f.x.beginInteraction();
    expect(f.x.requestValues([30, 70])).toBe(true);
    f.change(() => f.x.cancelValueChange());
    expect(f.x.requestValues([40, 60])).toBe(false);
    expect(f.x.commitValue()).toBe(true);
    expect(commits).toEqual([[30, 70]]);
    expect(f.x.commitValue()).toBe(false);
  });
  it(`${host}: controlled ignored proposal may commit without any owner echo`, async () => {
    const f = await mount(host, true),
      commits: any[] = [];
    f.commit((p) => commits.push(p.value));
    expect(f.x.requestValues([30, 70])).toBe(true);
    expect(f.x.getValue()).toEqual([20, 80]);
    expect(f.x.requestValues([20, 80])).toBe(false);
    expect(f.x.commitValue()).toBe(true);
    expect(commits).toEqual([[30, 70]]);
  });
  it(`${host}: nested receiver-scoped veto affects only the named active Root`, async () => {
    const a = await mount(host),
      b = await mount(host);
    a.change(() => {
      expect(b.x.requestValues([40, 60])).toBe(true);
    });
    b.change(() => {
      expect(a.x.cancelValueChange()).toBe(true);
    });
    expect(a.x.requestValues([30, 70])).toBe(false);
    expect(a.x.getValue()).toEqual([20, 80]);
    expect(b.x.getValue()).toEqual([40, 60]);
    expect(a.x.cancelValueChange()).toBe(false);
    expect(b.x.cancelValueChange()).toBe(false);
  });
}
it('fake React synchronous throwing callback is not a veto signal', async () => {
  const f = await mount('react');
  f.change(() => {
    throw new Error('authored callback rejection is not cancellation');
  });
  expect(f.x.requestValues([30, 70])).toBe(true);
  expect(f.x.getValue()).toEqual([30, 70]);
});
