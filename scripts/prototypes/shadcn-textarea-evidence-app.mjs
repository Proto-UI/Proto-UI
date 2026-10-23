import * as React from '../../packages/adapters/react/node_modules/react';
import { createRoot } from '../../packages/adapters/react/node_modules/react-dom/client';
import * as Vue from '../../packages/adapters/vue/node_modules/vue';
import Vue2 from '../../packages/adapters/vue2/node_modules/vue';
import { createReactAdapter } from '../../packages/adapters/react/src';
import { createVueAdapter } from '../../packages/adapters/vue/src';
import { createVue2Adapter } from '../../packages/adapters/vue2/src';
import { AdaptToWebComponent, setElementProps } from '../../packages/adapters/web-component/src';
import { styleScope } from '../../packages/prototypes/shadcn/src/style-scope';
import {
  fieldRoot,
  fieldTextarea,
  fieldLabel,
  fieldDescription,
  fieldError,
} from '../../packages/prototypes/shadcn/src/field';
const protos = [styleScope, fieldRoot, fieldTextarea, fieldLabel, fieldDescription, fieldError];
const records = [];
for (const kind of ['wc', 'react', 'vue', 'vue2']) {
  const section = document.createElement('section');
  section.dataset.runtime = kind;
  section.innerHTML = `<h2>${kind}</h2>`;
  const host = document.createElement('div');
  section.append(host);
  document.querySelector('main').append(section);
  let set;
  let dispose;
  if (kind === 'wc') {
    protos.forEach((p) => AdaptToWebComponent(p));
    const [scope, field, control, label, description, error] = protos.map((p) =>
      document.createElement(p.name)
    );
    label.textContent = 'Message';
    description.textContent = 'Shared field and style scope';
    setElementProps(control, { placeholder: 'Write a message', rows: 3 });
    field.append(label, description, control, error);
    scope.append(field);
    host.append(scope);
    dispose = () => scope.remove();
    set = (style, invalid, mode = 'normal') => {
      setElementProps(control, {
        placeholder: 'Write a message',
        rows: 3,
        disabled: mode === 'disabled',
        readOnly: mode === 'readonly',
      });
      setElementProps(scope, { styleProfile: style });
      setElementProps(field, { invalid, errors: invalid ? ['Invalid message'] : [] });
    };
  } else if (kind === 'react') {
    // One adapter factory owns the shared logical-parent channel for this tree.
    const adapt = createReactAdapter(React);
    const [Scope, Field, Control, Label, Description, ErrorView] = protos.map((p) => adapt(p));
    const root = createRoot(host);
    dispose = () => root.unmount();
    set = (style, invalid, mode = 'normal') =>
      root.render(
        React.createElement(
          Scope,
          { styleProfile: style },
          React.createElement(
            Field,
            { invalid, errors: invalid ? ['Invalid message'] : [] },
            React.createElement(Label, null, 'Message'),
            React.createElement(Description, null, 'Shared field and style scope'),
            React.createElement(Control, {
              placeholder: 'Write a message',
              rows: 3,
              disabled: mode === 'disabled',
              readOnly: mode === 'readonly',
            }),
            React.createElement(ErrorView)
          )
        )
      );
  } else if (kind === 'vue') {
    // One adapter factory owns the shared logical-parent channel for this tree.
    const adapt = createVueAdapter(Vue);
    const [Scope, Field, Control, Label, Description, ErrorView] = protos.map((p) => adapt(p));
    const state = Vue.reactive({ style: 'rhea', invalid: false, mode: 'normal' });
    const app = Vue.createApp({
      render: () =>
        Vue.h(Scope, { styleProfile: state.style }, () =>
          Vue.h(
            Field,
            { invalid: state.invalid, errors: state.invalid ? ['Invalid message'] : [] },
            () => [
              Vue.h(Label, null, () => 'Message'),
              Vue.h(Description, null, () => 'Shared field and style scope'),
              Vue.h(Control, {
                placeholder: 'Write a message',
                rows: 3,
                disabled: state.mode === 'disabled',
                readOnly: state.mode === 'readonly',
              }),
              Vue.h(ErrorView),
            ]
          )
        ),
    });
    app.mount(host);
    dispose = () => app.unmount();
    set = (style, invalid, mode = 'normal') => {
      state.style = style;
      state.invalid = invalid;
      state.mode = mode;
    };
  } else {
    const runtime = {
      extend: Vue2.extend.bind(Vue2),
      nextTick: Vue2.nextTick.bind(Vue2),
      set: Vue2.set.bind(Vue2),
      delete: Vue2.delete.bind(Vue2),
    };
    // One adapter factory owns the shared logical-parent channel for this tree.
    const adapt = createVue2Adapter(runtime);
    const [Scope, Field, Control, Label, Description, ErrorView] = protos.map((p) => adapt(p));
    const state = Vue2.observable({ style: 'rhea', invalid: false, mode: 'normal' });
    const app = new Vue2({
      render(h) {
        return h(Scope, { attrs: { styleProfile: state.style } }, [
          h(
            Field,
            { attrs: { invalid: state.invalid, errors: state.invalid ? ['Invalid message'] : [] } },
            [
              h(Label, ['Message']),
              h(Description, ['Shared field and style scope']),
              h(Control, {
                attrs: {
                  placeholder: 'Write a message',
                  rows: 3,
                  disabled: state.mode === 'disabled',
                  readOnly: state.mode === 'readonly',
                },
              }),
              h(ErrorView),
            ]
          ),
        ]);
      },
    });
    app.$mount();
    host.append(app.$el);
    dispose = () => {
      app.$destroy();
      app.$el.remove();
    };
    set = (style, invalid, mode = 'normal') => {
      state.style = style;
      state.invalid = invalid;
      state.mode = mode;
    };
  }
  set('rhea', false);
  records.push({ kind, host, set, dispose, editor: () => host.querySelector('textarea') });
}
window.textareaEvidence = {
  records,
  dispose: () => records.forEach((r) => r.dispose()),
  set: (style, invalid = false, mode = 'normal') =>
    records.forEach((r) => r.set(style, invalid, mode)),
};
requestAnimationFrame(() =>
  requestAnimationFrame(() => (document.documentElement.dataset.ready = 'true'))
);
