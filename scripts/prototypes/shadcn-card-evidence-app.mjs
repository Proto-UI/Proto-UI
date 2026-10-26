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
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '../../packages/prototypes/shadcn/src/card';
import text from '../../packages/prototypes/shadcn/src/text';
import textarea from '../../packages/prototypes/shadcn/src/textarea';
const protos = [
  styleScope,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
  text,
  textarea,
];
const records = [];
const titleProps = { size: 'base', weight: 'medium', tone: 'inherit', leading: 'normal' },
  descriptionProps = { size: 'sm', tone: 'muted', leading: 'normal' };
for (const kind of ['wc', 'react', 'vue', 'vue2']) {
  const section = document.createElement('section');
  section.dataset.runtime = kind;
  const label = document.createElement('h2');
  label.textContent = kind;
  const host = document.createElement('div');
  section.append(label, host);
  document.querySelector('main').append(section);
  let set;
  let dispose;
  if (kind === 'wc') {
    protos.forEach((p) => AdaptToWebComponent(p));
    const [scope, card, header, content, footer] = protos
      .slice(0, 5)
      .map((p) => document.createElement(p.name));
    const title = document.createElement('h3'),
      titleText = document.createElement(text.name),
      description = document.createElement(text.name),
      editor = document.createElement(textarea.name),
      anchor = document.createElement('a');
    titleText.textContent = 'Project details';
    setElementProps(titleText, titleProps);
    title.append(titleText);
    description.textContent = 'A passive Card with a shared family scope.';
    setElementProps(description, descriptionProps);
    anchor.href = '#native-action';
    anchor.textContent = 'Native action';
    header.append(title, description);
    content.append(editor);
    footer.append(anchor);
    card.append(header, content, footer);
    scope.append(card);
    host.append(scope);
    dispose = () => scope.remove();
    set = (outerStyle, rootStyle, size, divider) => {
      setElementProps(scope, { styleProfile: outerStyle });
      setElementProps(card, { styleProfile: rootStyle, size });
      setElementProps(header, { divider });
      setElementProps(footer, { divider });
    };
  } else if (kind === 'react') {
    const adapt = createReactAdapter(React);
    const [Scope, Card, Header, Content, Footer, Text, Textarea] = protos.map((p) => adapt(p));
    const root = createRoot(host),
      h = React.createElement;
    dispose = () => root.unmount();
    set = (outerStyle, rootStyle, size, divider) =>
      root.render(
        h(
          Scope,
          { styleProfile: outerStyle },
          h(
            Card,
            { styleProfile: rootStyle, size },
            h(
              Header,
              { divider },
              h('h3', null, h(Text, titleProps, 'Project details')),
              h(Text, descriptionProps, 'A passive Card with a shared family scope.')
            ),
            h(Content, null, h(Textarea)),
            h(Footer, { divider }, h('a', { href: '#native-action' }, 'Native action'))
          )
        )
      );
  } else if (kind === 'vue') {
    const adapt = createVueAdapter(Vue);
    const [Scope, Card, Header, Content, Footer, Text, Textarea] = protos.map((p) => adapt(p));
    const state = Vue.reactive({ outer: 'rhea', own: undefined, size: 'default', divider: false }),
      h = Vue.h;
    const app = Vue.createApp({
      render: () =>
        h(Scope, { styleProfile: state.outer }, () =>
          h(Card, { styleProfile: state.own, size: state.size }, () => [
            h(Header, { divider: state.divider }, () => [
              h('h3', null, [h(Text, titleProps, () => 'Project details')]),
              h(Text, descriptionProps, () => 'A passive Card with a shared family scope.'),
            ]),
            h(Content, null, () => h(Textarea)),
            h(Footer, { divider: state.divider }, () =>
              h('a', { href: '#native-action' }, 'Native action')
            ),
          ])
        ),
    });
    app.mount(host);
    dispose = () => app.unmount();
    set = (outerStyle, rootStyle, size, divider) =>
      Object.assign(state, { outer: outerStyle, own: rootStyle, size, divider });
  } else {
    const runtime = {
      extend: Vue2.extend.bind(Vue2),
      nextTick: Vue2.nextTick.bind(Vue2),
      set: Vue2.set.bind(Vue2),
      delete: Vue2.delete.bind(Vue2),
    };
    const adapt = createVue2Adapter(runtime);
    const [Scope, Card, Header, Content, Footer, Text, Textarea] = protos.map((p) => adapt(p));
    const state = Vue2.observable({
      outer: 'rhea',
      own: undefined,
      size: 'default',
      divider: false,
    });
    const app = new Vue2({
      render(h) {
        return h(Scope, { attrs: { styleProfile: state.outer } }, [
          h(Card, { attrs: { styleProfile: state.own, size: state.size } }, [
            h(Header, { attrs: { divider: state.divider } }, [
              h('h3', [h(Text, { attrs: titleProps }, ['Project details'])]),
              h(Text, { attrs: descriptionProps }, ['A passive Card with a shared family scope.']),
            ]),
            h(Content, [h(Textarea)]),
            h(Footer, { attrs: { divider: state.divider } }, [
              h('a', { attrs: { href: '#native-action' } }, ['Native action']),
            ]),
          ]),
        ]);
      },
    });
    app.$mount();
    host.append(app.$el);
    dispose = () => {
      app.$destroy();
      app.$el.remove();
    };
    set = (outerStyle, rootStyle, size, divider) =>
      Object.assign(state, { outer: outerStyle, own: rootStyle, size, divider });
  }
  set('rhea', undefined, 'default', false);
  records.push({ kind, host, set, dispose, editor: () => host.querySelector('textarea') });
}
window.cardEvidence = {
  records,
  dispose: () => records.forEach((r) => r.dispose()),
  set: (outer, own, size = 'default', divider = false) =>
    records.forEach((r) => r.set(outer, own, size, divider)),
};
requestAnimationFrame(() =>
  requestAnimationFrame(() => (document.documentElement.dataset.ready = 'true'))
);
