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
  commandRoot,
  commandInput,
  commandInputWrapper,
  commandContent,
  commandItem,
  commandEmpty,
} from '../../packages/prototypes/shadcn/src/command';
import {
  inputShell,
  inputShellControl,
  bindInputShellControl,
} from '../../packages/prototypes/shadcn/src/input-shell';
const protos = {
  scope: styleScope,
  root: commandRoot,
  input: commandInput,
  wrapper: commandInputWrapper,
  content: commandContent,
  item: commandItem,
  empty: commandEmpty,
  shell: inputShell,
  ordinary: inputShellControl,
};
const records = [];
function tree(type, state) {
  const n = (part, props = {}, children = [], ref) => ({
    part,
    props: ref ? { ...props, 'data-demo-ref': ref } : props,
    children,
    ref,
  });
  const shell = n(
    'shell',
    { focusIndicator: type === 'command' ? 'none' : 'ring', ...state.facts },
    [
      n(
        type === 'command' ? 'input' : 'ordinary',
        {
          a11yLabel: `${type} editor`,
          placeholder: 'Find a command',
          ...(type === 'input' ? { disabled: state.disabled, readOnly: state.readOnly } : {}),
        },
        [],
        'control'
      ),
    ],
    'shell'
  );
  return n('scope', { styleProfile: state.style }, [
    type === 'input'
      ? shell
      : n(
          'root',
          {
            disabled: state.disabled,
            readOnly: state.readOnly,
            a11yLabel: 'Actions',
            onExecute: state.execute,
          },
          [
            n('wrapper', {}, [shell]),
            n('content', {}, [
              n('item', { value: 'alpha', textValue: 'Alpha' }, ['Alpha']),
              n('item', { value: 'beta', textValue: 'Beta' }, ['Beta']),
              n('item', { value: 'blocked', textValue: 'Blocked', disabled: true }, ['Blocked']),
              n('empty', {}, ['No matching commands']),
            ]),
          ],
          'root'
        ),
  ]);
}
for (const kind of ['wc', 'react', 'vue', 'vue2'])
  for (const type of ['command', 'input']) {
    const section = document.createElement('section');
    section.dataset.runtime = kind;
    section.dataset.consumer = type;
    const heading = document.createElement('h2');
    heading.textContent = `${kind} · ${type}`;
    const host = document.createElement('div');
    section.append(heading, host);
    document.querySelector('main').append(section);
    const refs = {};
    let current = true,
      cleanup = () => {},
      boundElements,
      render,
      destroy;
    const executions = [];
    let state = {
      execute: (detail) => {
        if (current) executions.push(detail);
      },
      style: 'rhea',
      disabled: false,
      readOnly: false,
      facts: { focusVisible: false, disabled: false },
    };
    if (kind === 'wc') {
      Object.values(protos).forEach((p) => AdaptToWebComponent(p));
      const nodes = [];
      const build = (node) => {
        if (typeof node === 'string') return document.createTextNode(node);
        const e = document.createElement(protos[node.part].name);
        setElementProps(e, node.props);
        if (node.ref) {
          refs[node.ref] = e;
          e.setAttribute('data-demo-ref', node.ref);
        }
        nodes.push([e, node.part, node.ref]);
        node.children.forEach((child) => e.append(build(child)));
        return e;
      };
      host.append(build(tree(type, state)));
      if (type === 'command')
        refs.root.addEventListener('execute', (event) => {
          if (current) executions.push(event.detail);
        });
      render = () => {
        const flatten = (node, list = []) => {
          if (typeof node !== 'string') {
            list.push(node);
            node.children.forEach((child) => flatten(child, list));
          }
          return list;
        };
        flatten(tree(type, state)).forEach((node, index) =>
          setElementProps(nodes[index][0], node.props)
        );
      };
      destroy = () => host.replaceChildren();
    } else if (kind === 'react') {
      const adapt = createReactAdapter(React);
      const components = Object.fromEntries(
        Object.entries(protos).map(([key, p]) => [key, adapt(p)])
      );
      const root = createRoot(host);
      const build = (node) =>
        typeof node === 'string'
          ? node
          : React.createElement(
              components[node.part],
              {
                ...node.props,
                ...(node.ref
                  ? {
                      ref: (value) => {
                        refs[node.ref] = value;
                      },
                    }
                  : {}),
              },
              ...node.children.map(build)
            );
      render = () => root.render(build(tree(type, state)));
      destroy = () => root.unmount();
      render();
    } else if (kind === 'vue') {
      state = Vue.reactive(state);
      const adapt = createVueAdapter(Vue);
      const components = Object.fromEntries(
        Object.entries(protos).map(([key, p]) => [key, adapt(p)])
      );
      const build = (node) =>
        typeof node === 'string'
          ? node
          : Vue.h(
              components[node.part],
              {
                ...node.props,
                ...(node.ref
                  ? {
                      ref: (value) => {
                        refs[node.ref] = value;
                      },
                    }
                  : {}),
              },
              () => node.children.map(build)
            );
      const app = Vue.createApp({ render: () => build(tree(type, state)) });
      app.mount(host);
      render = () => {};
      destroy = () => app.unmount();
    } else {
      state = Vue2.observable(state);
      const runtime = {
        extend: Vue2.extend.bind(Vue2),
        nextTick: Vue2.nextTick.bind(Vue2),
        set: Vue2.set.bind(Vue2),
        delete: Vue2.delete.bind(Vue2),
      };
      const adapt = createVue2Adapter(runtime);
      const components = Object.fromEntries(
        Object.entries(protos).map(([key, p]) => [key, adapt(p)])
      );
      let app;
      const build = (h, node) =>
        typeof node === 'string'
          ? node
          : h(
              components[node.part],
              { attrs: node.props, ...(node.ref ? { ref: node.ref } : {}) },
              node.children.map((child) => build(h, child))
            );
      app = new Vue2({
        render(h) {
          return build(h, tree(type, state));
        },
      });
      app.$mount();
      host.append(app.$el);
      render = () => {};
      destroy = () => app.$destroy();
      Object.defineProperties(
        refs,
        Object.fromEntries(
          ['shell', 'control', 'root'].map((key) => [key, { get: () => app.$refs[key] }])
        )
      );
    }
    const record = {
      kind,
      type,
      host,
      refs,
      state,
      executions,
      set(next) {
        Object.assign(state, next);
        render();
      },
      elements() {
        const fail = (message) => {
          throw new Error(`[command-evidence] ${kind}/${type}: ${message}`);
        };
        if (!current) fail('retired owner');
        if (!host.isConnected) fail('detached host');
        if (!refs.shell || !refs.control) fail('missing public shell/control instance');
        if (
          boundElements &&
          (refs.shell !== boundElements.shellInstance ||
            refs.control !== boundElements.controlInstance)
        )
          fail('replaced public shell/control instance');
        const unique = (selector, part) => {
          const matches = host.querySelectorAll(selector);
          if (matches.length !== 1) fail(`expected one ${part}, found ${matches.length}`);
          return matches[0];
        };
        const shell = unique('[data-demo-ref="shell"]', 'shell'),
          control = unique('[data-demo-ref="control"]', 'control'),
          input = unique('input', 'editor');
        if (!shell.hasAttribute('data-pui-root') || !control.hasAttribute('data-pui-root'))
          fail('shell/control marker is not a Prototype Root');
        if (
          input.closest('[data-pui-root]') !== control ||
          control.parentElement?.closest('[data-pui-root]') !== shell
        )
          fail('incorrect shell/control ownership');
        if (
          boundElements &&
          (shell !== boundElements.shell ||
            control !== boundElements.control ||
            input !== boundElements.input)
        )
          fail('replaced physical shell/control/editor');
        return { shell, control, input };
      },
      editor: () => record.elements().input,
      dispose() {
        if (!current) return;
        current = false;
        cleanup();
        destroy();
      },
    };
    records.push(record);
    record.bind = () => {
      boundElements = {
        ...record.elements(),
        shellInstance: refs.shell,
        controlInstance: refs.control,
      };
      return bindInputShellControl(
        {
          isCurrent: () => current,
          onDispose(fn) {
            cleanup = fn;
            return () => {
              cleanup = () => {};
            };
          },
        },
        {
          instance: refs.shell,
          setFacts(facts) {
            state.facts = facts;
            render();
          },
        },
        refs.control
      );
    };
  }
window.commandEvidence = {
  records,
  set: (next) => records.forEach((r) => r.set(next)),
  dispose: () => records.forEach((r) => r.dispose()),
};
window.addEventListener('pagehide', () => window.commandEvidence.dispose(), { once: true });
const deadline = performance.now() + 3000;
const bindWhenReady = () => {
  if (
    records.every((r) => r.refs.shell && r.refs.control?.getExposes && r.host.querySelector('input'))
  ) {
    records.forEach((r) => (r.binding = r.bind()));
    document.documentElement.dataset.ready = 'true';
    return;
  }
  if (performance.now() > deadline)
    throw new Error('Public adapter instances did not become ready');
  requestAnimationFrame(bindWhenReady);
};
requestAnimationFrame(bindWhenReady);
