import * as React from '../../packages/adapters/react/node_modules/react';
import { createRoot } from '../../packages/adapters/react/node_modules/react-dom/client';
import { createPortal } from '../../packages/adapters/react/node_modules/react-dom';
import * as Vue from '../../packages/adapters/vue/node_modules/vue';
import Vue2 from '../../packages/adapters/vue2/node_modules/vue';
import { createReactAdapter } from '../../packages/adapters/react/src';
import { createVueAdapter } from '../../packages/adapters/vue/src';
import { createVue2Adapter } from '../../packages/adapters/vue2/src';
import { AdaptToWebComponent, setElementProps } from '../../packages/adapters/web-component/src';
import { styleScope } from '../../packages/prototypes/shadcn/src/style-scope';
import {
  fieldRoot,
  fieldLabel,
  fieldDescription,
  fieldError,
  fieldSelectTrigger,
} from '../../packages/prototypes/shadcn/src/field';
import {
  selectRoot,
  selectValue,
  selectContent,
  selectSurface,
  selectViewport,
  selectGroup,
  selectItem,
  selectItemText,
  selectLabel,
  selectSeparator,
} from '../../packages/prototypes/shadcn/src/select';
const protos = [
  styleScope,
  fieldRoot,
  fieldLabel,
  fieldDescription,
  fieldError,
  fieldSelectTrigger,
  selectRoot,
  selectValue,
  selectContent,
  selectSurface,
  selectViewport,
  selectGroup,
  selectItem,
  selectItemText,
  selectLabel,
  selectSeparator,
];
const records = [];
for (const kind of ['wc', 'react', 'vue', 'vue2']) {
  const section = document.createElement('section');
  section.dataset.runtime = kind;
  section.innerHTML = `<h2>${kind}</h2>`;
  const host = document.createElement('div');
  section.append(host);
  document.querySelector('main').append(section);
  const state = {
    style: 'rhea',
    invalid: false,
    mode: 'normal',
    size: 'default',
    surfaceStyle: 'inherit',
  };
  const tree = (h, s) =>
    h(styleScope, { styleProfile: s.style }, [
      h(fieldRoot, { invalid: s.invalid, errors: s.invalid ? ['Choose another option'] : [] }, [
        h(fieldLabel, {}, ['Framework']),
        h(fieldDescription, {}, ['Shared Field and style scope']),
        h(selectRoot, { defaultValue: 'alpha' }, [
          h(
            fieldSelectTrigger,
            { size: s.size, disabled: s.mode === 'disabled', readOnly: s.mode === 'readonly' },
            [h(selectValue, { placeholder: 'Choose framework' }, [])]
          ),
          h(selectContent, {}, [
            h(selectSurface, { styleProfile: s.surfaceStyle }, [
              h(selectViewport, {}, [
                h(selectGroup, {}, [
                  h(selectLabel, {}, ['Frameworks']),
                  ...['alpha', 'beta', 'gamma'].map((value) =>
                    h(selectItem, { value, textValue: value, disabled: value === 'gamma' }, [
                      h(selectItemText, {}, [value]),
                    ])
                  ),
                  h(selectSeparator, {}, []),
                ]),
              ]),
            ]),
          ]),
        ]),
        h(fieldError, {}, []),
      ]),
    ]);
  let set, setSurfaceStyle, dispose, inspect;
  if (kind === 'wc') {
    protos.forEach((p) => AdaptToWebComponent(p));
    const refs = new Map();
    const h = (p, props, children) => {
      const el = document.createElement(p.name);
      setElementProps(el, props);
      if (!refs.has(p)) refs.set(p, el);
      el.append(...children);
      return el;
    };
    const root = tree(h, state);
    host.append(root);
    setSurfaceStyle = (style) => setElementProps(refs.get(selectSurface), { styleProfile: style });
    dispose = () => root.remove();
    set = (style, invalid = false, mode = 'normal', size = 'default') => {
      setElementProps(refs.get(styleScope), { styleProfile: style });
      setElementProps(refs.get(fieldRoot), {
        invalid,
        errors: invalid ? ['Choose another option'] : [],
      });
      setElementProps(refs.get(fieldSelectTrigger), {
        size,
        disabled: mode === 'disabled',
        readOnly: mode === 'readonly',
      });
    };
  } else if (kind === 'react') {
    const adapt = createReactAdapter({ ...React, createPortal });
    const components = new Map(protos.map((p) => [p, adapt(p)]));
    const root = createRoot(host);
    const rootRef = React.createRef(),
      triggerRef = React.createRef();
    inspect = () => ({
      root: rootRef.current?.getExposes(),
      trigger: triggerRef.current?.getExposes(),
    });
    const h = (p, props, children) =>
      React.createElement(
        components.get(p),
        {
          ...props,
          ...(p === selectRoot
            ? { ref: rootRef }
            : p === fieldSelectTrigger
              ? { ref: triggerRef }
              : {}),
        },
        ...children
      );
    set = (style, invalid = false, mode = 'normal', size = 'default') => {
      Object.assign(state, { style, invalid, mode, size });
      root.render(tree(h, state));
    };
    setSurfaceStyle = (style) => {
      state.surfaceStyle = style;
      root.render(tree(h, state));
    };
    dispose = () => root.unmount();
  } else if (kind === 'vue') {
    const adapt = createVueAdapter(Vue);
    const components = new Map(protos.map((p) => [p, adapt(p)]));
    const s = Vue.reactive(state);
    const h = (p, props, children) => Vue.h(components.get(p), props, () => children);
    const app = Vue.createApp({ render: () => tree(h, s) });
    app.mount(host);
    set = (style, invalid = false, mode = 'normal', size = 'default') =>
      Object.assign(s, { style, invalid, mode, size });
    setSurfaceStyle = (style) => {
      s.surfaceStyle = style;
    };
    dispose = () => app.unmount();
  } else {
    const runtime = {
      extend: Vue2.extend.bind(Vue2),
      nextTick: Vue2.nextTick.bind(Vue2),
      set: Vue2.set.bind(Vue2),
      delete: Vue2.delete.bind(Vue2),
    };
    const adapt = createVue2Adapter(runtime);
    const components = new Map(protos.map((p) => [p, adapt(p)]));
    const s = Vue2.observable(state);
    const app = new Vue2({
      render(h) {
        return tree((p, props, children) => h(components.get(p), { attrs: props }, children), s);
      },
    });
    app.$mount();
    host.append(app.$el);
    set = (style, invalid = false, mode = 'normal', size = 'default') =>
      Object.assign(s, { style, invalid, mode, size });
    setSurfaceStyle = (style) => {
      s.surfaceStyle = style;
    };
    dispose = () => {
      app.$destroy();
      app.$el.remove();
    };
  }
  set('rhea');
  records.push({
    kind,
    host,
    set,
    setSurfaceStyle,
    dispose,
    inspect,
    trigger: () => host.querySelector('[role=combobox]'),
  });
}
window.selectEvidence = {
  records,
  set: (...args) => records.forEach((r) => r.set(...args)),
  dispose: () => records.forEach((r) => r.dispose()),
};
requestAnimationFrame(() =>
  requestAnimationFrame(() => (document.documentElement.dataset.ready = 'true'))
);
