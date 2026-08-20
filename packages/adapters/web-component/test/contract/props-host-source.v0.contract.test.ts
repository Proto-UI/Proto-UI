import { describeAdapterPropsHostSourceConformance } from '../../../base/test-utils/props-host-source';
import { AdaptToWebComponent } from '../../src/adapt';

async function flushWebComponentAdapter() {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describeAdapterPropsHostSourceConformance({
  adapterName: 'adapter-web-component',
  async mount(proto, props) {
    const tagName = proto.name;
    const Ctor = AdaptToWebComponent(proto, {
      register: false,
      registerAs: tagName,
      schedule: (task) => task(),
      getProps(el) {
        const value = el.getAttribute('data-value');
        return value == null ? {} : { value: Number(value) };
      },
    });

    if (!customElements.get(tagName)) customElements.define(tagName, Ctor);

    const el = document.createElement(tagName) as HTMLElement & { update(): void };
    el.setAttribute('data-value', String(props.value));
    document.body.appendChild(el);
    await flushWebComponentAdapter();

    return {
      async updateHostProps(nextProps) {
        el.setAttribute('data-value', String(nextProps.value));
        await flushWebComponentAdapter();
      },
      async syncRuntime() {
        el.update();
        await flushWebComponentAdapter();
      },
      readRenderedValue() {
        return el.textContent;
      },
      async unmount() {
        el.remove();
        await flushWebComponentAdapter();
      },
    };
  },
});
