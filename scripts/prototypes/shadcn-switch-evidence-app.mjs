import * as React from '../../packages/adapters/react/node_modules/react';
import { createRoot } from '../../packages/adapters/react/node_modules/react-dom/client';
import * as Vue from '../../packages/adapters/vue/node_modules/vue';
import Vue2 from '../../packages/adapters/vue2/node_modules/vue';
import { createReactAdapter } from '../../packages/adapters/react/src';
import { createVueAdapter } from '../../packages/adapters/vue/src';
import { createVue2Adapter } from '../../packages/adapters/vue2/src';
import {
  AdaptToWebComponent,
  setElementProps,
  getElementProps,
} from '../../packages/adapters/web-component/src';
import { styleScope } from '../../packages/prototypes/shadcn/src/style-scope';
import { switchRoot, switchThumb } from '../../packages/prototypes/shadcn/src/switch';
import { fieldRoot, fieldLabel, fieldSwitch } from '../../packages/prototypes/shadcn/src/field';
const protos = [styleScope, fieldRoot, fieldLabel, fieldSwitch, switchRoot, switchThumb];
const records = [];
for (const kind of ['wc', 'react', 'vue', 'vue2']) {
  const section = document.createElement('section');
  section.dataset.runtime = kind;
  const heading = document.createElement('h2');
  heading.textContent = kind;
  const host = document.createElement('div');
  section.append(heading, host);
  document.querySelector('main').append(section);
  let update, dispose;
  const events = [];
  const onCheckedChange = (payload) =>
    events.push({ checked: payload?.checked, source: 'framework-expose-callback' });
  const initial = {
    profile: 'new-york-v4',
    own: 'inherit',
    size: 'default',
    invalid: false,
    disabled: false,
    readOnly: false,
    draggable: false,
    direction: 'ltr',
  };
  const fieldProps = (s) => ({ invalid: s.invalid });
  const switchProps = (s) => ({
    styleProfile: s.own,
    size: s.size,
    disabled: s.disabled,
    readOnly: s.readOnly,
    draggable: s.draggable,
    direction: s.direction,
    ...(kind === 'wc' ? {} : { onCheckedChange }),
  });
  if (kind === 'wc') {
    protos.forEach((p) => AdaptToWebComponent(p));
    const [scope, field, label, control, plain, thumb] = protos.map((p) =>
      document.createElement(p.name)
    );
    const plainThumb = document.createElement(switchThumb.name);
    label.textContent = 'Notifications';
    control.append(thumb);
    plain.append(plainThumb);
    field.append(label, control);
    scope.append(field, plain);
    host.append(scope);
    update = (s) => {
      setElementProps(scope, { styleProfile: s.profile });
      setElementProps(field, fieldProps(s));
      setElementProps(control, switchProps(s));
      setElementProps(plain, switchProps(s));
    };
    dispose = () => scope.remove();
  } else if (kind === 'react') {
    const adapt = createReactAdapter(React),
      [Scope, Field, Label, Control, Plain, Thumb] = protos.map((p) => adapt(p));
    const root = createRoot(host),
      h = React.createElement;
    update = (s) =>
      root.render(
        h(
          Scope,
          { styleProfile: s.profile },
          h(
            Field,
            fieldProps(s),
            h(Label, null, 'Notifications'),
            h(Control, switchProps(s), h(Thumb))
          ),
          h(Plain, switchProps(s), h(Thumb))
        )
      );
    dispose = () => root.unmount();
  } else if (kind === 'vue') {
    const adapt = createVueAdapter(Vue),
      [Scope, Field, Label, Control, Plain, Thumb] = protos.map((p) => adapt(p));
    const s = Vue.reactive({ ...initial }),
      h = Vue.h;
    const app = Vue.createApp({
      render: () =>
        h(Scope, { styleProfile: s.profile }, () => [
          h(Field, fieldProps(s), () => [
            h(Label, null, () => 'Notifications'),
            h(Control, switchProps(s), () => h(Thumb)),
          ]),
          h(Plain, switchProps(s), () => h(Thumb)),
        ]),
    });
    app.mount(host);
    update = (next) => Object.assign(s, next);
    dispose = () => app.unmount();
  } else {
    const runtime = {
      extend: Vue2.extend.bind(Vue2),
      nextTick: Vue2.nextTick.bind(Vue2),
      set: Vue2.set.bind(Vue2),
      delete: Vue2.delete.bind(Vue2),
    };
    const adapt = createVue2Adapter(runtime),
      [Scope, Field, Label, Control, Plain, Thumb] = protos.map((p) => adapt(p));
    const s = Vue2.observable({ ...initial });
    const app = new Vue2({
      render(h) {
        return h(Scope, { attrs: { styleProfile: s.profile } }, [
          h(Field, { attrs: fieldProps(s) }, [
            h(Label, ['Notifications']),
            h(Control, { attrs: switchProps(s) }, [h(Thumb)]),
          ]),
          h(Plain, { attrs: switchProps(s) }, [h(Thumb)]),
        ]);
      },
    });
    app.$mount();
    host.append(app.$el);
    update = (next) => Object.assign(s, next);
    dispose = () => {
      app.$destroy();
      app.$el.remove();
    };
  }
  let state = { ...initial };
  const set = (patch) => {
    state = { ...state, ...patch };
    update(state);
  };
  set({});
  if (kind === 'wc')
    host.addEventListener('checkedChange', (e) =>
      events.push({ checked: e.detail?.checked, trusted: e.isTrusted, source: 'dom-expose-event' })
    );
  records.push({
    kind,
    host,
    set,
    dispose,
    events,
    requestedProps: () => switchProps(state),
    rawProps: (root) => (kind === 'wc' ? getElementProps(root) : null),
    controls: () => [...host.querySelectorAll('[role=switch]')],
  });
}
window.switchEvidence = {
  records,
  set: (patch) => records.forEach((r) => r.set(patch)),
  dispose: () => records.forEach((r) => r.dispose()),
};
requestAnimationFrame(() =>
  requestAnimationFrame(() => (document.documentElement.dataset.ready = 'true'))
);
