/** Copied verbatim to each isolated consumer and executed with its own packages. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Window } from 'happy-dom';

const profile = process.argv[2], families = JSON.parse(readFileSync('release-families.json', 'utf8'));
const window = new Window({ url: 'http://release-family.invalid' });
for (const key of ['window', 'self', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'SVGElement', 'ShadowRoot', 'Text', 'Comment', 'Event', 'CustomEvent', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'FocusEvent', 'MutationObserver', 'DOMParser', 'customElements'])
  Object.defineProperty(globalThis, key, { value: key === 'window' || key === 'self' ? window : window[key], configurable: true });
for (const key of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) globalThis[key] = window[key].bind(window);
const flush = async () => { for (let i = 0; i < 8; ++i) await Promise.resolve(); };
const trace = { profile, surface: 'Programmatic DOM events in Happy DOM', rows: [], errors: [] };
window.addEventListener('error', event => trace.errors.push(String(event.error ?? event.message)));
try {
  for (const family of families) {
    const module = await import('./dist/' + family.componentName + '.js');
    const Component = module[family.componentName] ?? module.default;
    const host = document.createElement('div'); document.body.append(host);
    let disabled = false, clicks = 0, driver;
    const props = () => ({ disabled, styleProfile: 'vega', variant: 'outline' });
    if (profile === 'react-dom-source-v1') {
      const React = await import('react'), { createRoot } = await import('react-dom/client');
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      const ref = React.createRef(), root = createRoot(host);
      const act = async callback => React.act(async () => { callback(); await flush(); });
      const change = () => act(() => root.render(React.createElement(Component, { ...props(), ref, onClick: () => clicks++ }, React.createElement('b', null, 'ordinary child'))));
      await change(); driver = { change, act, handle: () => ref.current, root: () => host.querySelector('[data-pui-root]'), dispose: () => act(() => root.unmount()) };
    } else if (profile === 'vue-source-v1') {
      const Vue = await import('vue'), input = Vue.shallowRef(props()), ref = Vue.shallowRef();
      const app = Vue.createApp({ render: () => Vue.h(Component, { ...input.value, ref, onClick: () => clicks++ }, { default: () => Vue.h('b', 'ordinary child') }) });
      app.config.errorHandler = error => trace.errors.push(String(error));
      const act = async callback => { callback(); await flush(); await Vue.nextTick(); await flush(); };
      app.mount(host); await act(() => {});
      driver = { change: () => act(() => { input.value = props(); }), act, handle: () => ref.value, root: () => host.querySelector('[data-pui-root]'), dispose: () => act(() => app.unmount()) };
    } else if (profile === 'vue2-source-v1') {
      const Vue = (await import('vue')).default; Vue.config.devtools = false; Vue.config.productionTip = false;
      Vue.config.errorHandler = error => trace.errors.push(String(error));
      const vm = new Vue({ data: () => ({ input: props() }), render(h) { return h(Component, { props: this.input, ref: 'button', on: { click: () => clicks++ } }, [h('b', 'ordinary child')]); } });
      const act = async callback => { callback(); await flush(); await Vue.nextTick(); await flush(); await Vue.nextTick(); };
      vm.$mount(); host.append(vm.$el); await act(() => {});
      driver = { change: () => act(() => { vm.input = props(); }), act, handle: () => vm.$refs.button, root: () => host.querySelector('[data-pui-root]'), dispose: () => act(() => { vm.$destroy(); vm.$el.remove(); }) };
    } else {
      const tag = 'release-' + family.family + '-button'; module.register(tag);
      const element = document.createElement(tag), child = document.createElement('b'); child.textContent = 'ordinary child'; element.append(child);
      element.addEventListener('click', event => { if (event instanceof CustomEvent) clicks++; });
      element.setProps(props()); host.append(element); await flush();
      const act = async callback => { callback(); await flush(); };
      driver = { change: () => act(() => element.setProps(props())), act, handle: () => element, root: () => element, dispose: () => act(() => { element.dispose(); element.remove(); }) };
    }
    const root = driver.root(), owner = driver.handle(), api = owner.getExposes();
    assert.ok(root); assert.equal(root.getAttribute('role'), 'button'); assert.ok(root.textContent.includes('ordinary child')); assert.equal(api.disabled.get(), false);
    await driver.act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    assert.equal(clicks, 1, 'Enabled Button must publish its authored click');
    disabled = true; await driver.change();
    assert.equal(driver.root(), root); assert.equal(api.disabled.get(), true); assert.equal(root.getAttribute('aria-disabled'), 'true');
    await driver.act(() => root.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    assert.equal(clicks, 1, 'Disabled Button must refuse activation');
    await driver.dispose(); assert.throws(() => api.disabled.get()); host.remove();
    trace.rows.push({ family: family.family, sourceGraphSha256: family.sourceGraphSha256, children: true, rootIdentity: true, enabledActivation: 1, disabledActivation: 0, disposedHandleRejected: true }); 
    writeFileSync('runtime-trace.json', JSON.stringify(trace, null, 2) + '\n');
  }
  assert.deepEqual(trace.errors, []); trace.ok = true;
} catch (error) {
  trace.ok = false; trace.failure = { message: error.message, stack: error.stack }; throw error;
} finally {
  writeFileSync('runtime-trace.json', JSON.stringify(trace, null, 2) + '\n');
  await window.happyDOM.abort(); window.close();
}
