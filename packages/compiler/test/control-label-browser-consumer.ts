import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2, { type ComponentOptions as Vue2Options } from '../../adapters/vue2/node_modules/vue';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import {
  AdaptToWebComponent,
  setElementAssociations,
  setElementProps,
} from '@proto.ui/adapter-web-component';
import { createControlLabelRef, type InstanceAssociations, type Prototype } from '@proto.ui/core';
import button from '../../prototypes/base/src/button';
import toggle from '../../prototypes/base/src/toggle';
import label from '../../prototypes/base/src/label';

type Target = 'react' | 'vue' | 'vue2' | 'wc';
type Kind = 'button' | 'toggle' | 'label';
type Execution = 'compiled' | 'runtime';
type Module = Record<string, unknown>;
type GeneratedComponents = Record<Target, Record<Kind, Module>>;
type Props = Record<string, unknown>;
interface Mounted {
  root: HTMLElement;
  signals: unknown[];
  setProps(props: Props): Promise<void>;
  setAssociations(input: InstanceAssociations): Promise<void>;
  close(): Promise<void>;
}
const prototypes = { button, toggle, label };
const reactAdapter = createReactAdapter(React);
const vueAdapter = createVueAdapter(Vue);
const vue2Adapter = createVue2Adapter({
  // Bridge installed Vue constructor/options declarations to the injected host protocol.
  extend: Vue2.extend.bind(Vue2) as unknown as Parameters<typeof createVue2Adapter>[0]['extend'],
  nextTick: Vue2.nextTick.bind(Vue2),
  set: Vue2.set.bind(Vue2),
  delete: Vue2.delete.bind(Vue2),
});

function invoke(receiver: unknown, name: string, ...args: unknown[]) {
  if (!receiver || (typeof receiver !== 'object' && typeof receiver !== 'function'))
    throw new Error(`Missing consumer receiver for ${name}`);
  const method: unknown = Reflect.get(receiver, name);
  if (typeof method !== 'function') throw new Error(`Missing consumer method ${name}`);
  return Reflect.apply(method, receiver, args) as unknown;
}
async function settled(target: Target) {
  await Promise.resolve();
  if (target === 'vue') await Vue.nextTick();
  if (target === 'vue2') await Vue2.nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await Promise.resolve();
}

/** Ordinary imports supply generated components; no Proto input or IR is evaluated here. */
export function createControlLabelBrowserFixture(generated: GeneratedComponents) {
  const components = new Map<string, unknown>();
  let sequence = 0;
  let current: { control: Mounted; label: Mounted; next: InstanceAssociations } | undefined;

  function component(target: Target, kind: Kind, execution: Execution) {
    const key = `${target}/${kind}/${execution}`;
    if (components.has(key)) return components.get(key);
    let value: unknown;
    if (target === 'wc') {
      const tag = `control-label-browser-${execution}-${kind}-${++sequence}`;
      if (execution === 'compiled') invoke(generated[target][kind], 'register', tag);
      else AdaptToWebComponent(prototypes[kind] as Prototype<any, any>, { registerAs: tag });
      value = tag;
    } else if (execution === 'compiled') {
      value =
        target === 'react'
          ? generated[target][kind].CompiledComponent
          : generated[target][kind].default;
    } else {
      const prototype = prototypes[kind] as Prototype<any, any>;
      value =
        target === 'react'
          ? reactAdapter(prototype)
          : target === 'vue'
            ? vueAdapter(prototype)
            : vue2Adapter(prototype);
    }
    components.set(key, value);
    return value;
  }

  async function mountOne(
    target: Target,
    kind: Kind,
    execution: Execution,
    input: InstanceAssociations
  ): Promise<Mounted> {
    const Component = component(target, kind, execution);
    const host = document.createElement('div');
    host.className = 'consumer-host';
    document.querySelector('#mount')!.append(host);
    const text = kind === 'label' ? 'Visible control name' : '';
    const signals: unknown[] = [];
    let props: Props = {};
    let associations = input;
    const signal = (value?: unknown) => signals.push(kind === 'button' ? 'click' : value);
    const snapshot = () => ({ ...props, instanceAssociations: associations });
    const eventName = kind === 'button' ? 'onClick' : 'onActiveChange';
    let update: () => Promise<void>;
    let unmount: () => void;
    if (target === 'react') {
      const app = createRoot(host);
      update = async () => {
        flushSync(() =>
          app.render(
            React.createElement(
              Component as React.ComponentType<Props>,
              {
                ...snapshot(),
                [eventName]: signal,
              },
              text
            )
          )
        );
        await settled(target);
      };
      unmount = () => flushSync(() => app.unmount());
      await update();
    } else if (target === 'vue') {
      const snapshotRef = Vue.shallowRef(snapshot());
      const app = Vue.createApp({
        render: () =>
          Vue.h(
            Component as Vue.Component,
            {
              ...snapshotRef.value,
              [eventName]: signal,
            },
            () => text
          ),
      });
      app.mount(host);
      update = async () => {
        snapshotRef.value = snapshot();
        await settled(target);
      };
      unmount = () => app.unmount();
    } else if (target === 'vue2') {
      const app = new Vue2({
        render(h) {
          return h(
            Component as Vue2Options<Vue2>,
            {
              props: execution === 'compiled' ? snapshot() : { instanceAssociations: associations },
              ...(execution === 'runtime' ? { attrs: props } : {}),
              on: { click: () => signal(), activeChange: signal },
            },
            [text]
          );
        },
      }).$mount();
      host.append(app.$el);
      update = async () => {
        app.$forceUpdate();
        await settled(target);
      };
      unmount = () => app.$destroy();
    } else {
      const element = document.createElement(Component as string);
      element.textContent = text;
      element.addEventListener(kind === 'button' ? 'click' : 'activeChange', (event) => {
        if (event instanceof CustomEvent) signal(event.detail);
      });
      update = async () => {
        if (execution === 'runtime') {
          setElementAssociations(element, associations);
          setElementProps(element, props);
        } else {
          Reflect.set(element, 'instanceAssociations', associations);
          invoke(element, 'setProps', props);
        }
        await settled(target);
      };
      await update();
      host.append(element);
      unmount = () => {
        element.remove();
        if (execution === 'compiled') invoke(element, 'dispose');
      };
    }
    await settled(target);
    const root = host.querySelector('[data-pui-root]') ?? host.firstElementChild;
    if (!(root instanceof HTMLElement)) throw new Error(`Missing ${target}/${kind} consumer view`);
    root.dataset.controlLabelTest = kind === 'label' ? 'label' : 'target';
    let closed = false;
    return {
      root,
      signals,
      async setProps(next) {
        props = next;
        await update();
      },
      async setAssociations(next) {
        associations = next;
        await update();
      },
      async close() {
        if (closed) return;
        closed = true;
        // Focus reentry deliberately removes a framework-owned view. Restore its
        // physical parent only to let that same framework perform terminal cleanup.
        if (!root.parentNode) host.append(root);
        unmount();
        host.remove();
        await settled(target);
      },
    };
  }

  return {
    async mount(
      target: Target,
      kind: 'button' | 'toggle',
      labelExecution: Execution,
      targetExecution: Execution
    ) {
      if (current) {
        await current.label.close();
        await current.control.close();
      }
      const initial = { controlLabel: createControlLabelRef() };
      // Exercise Vue2's ordinary observed input at its real host boundary; the
      // public Core reference and strict portable association keys stay intact.
      const association = target === 'vue2' ? Vue2.observable(initial) : Object.freeze(initial);
      const control = await mountOne(target, kind, targetExecution, association);
      const label = await mountOne(target, 'label', labelExecution, association);
      const replacement = { controlLabel: createControlLabelRef() };
      current = {
        control,
        label,
        next: target === 'vue2' ? Vue2.observable(replacement) : Object.freeze(replacement),
      };
      await settled(target);
    },
    read() {
      if (!current) throw new Error('No mounted consumer');
      const { control, label } = current;
      return {
        signals: [...control.signals],
        labelledBy: control.root.getAttribute('aria-labelledby'),
        labelId: label.root.id,
        labelText: label.root.textContent,
        labelConnected: label.root.isConnected,
        labelRole: label.root.getAttribute('role'),
        labelTabIndex: label.root.getAttribute('tabindex'),
        explicitName: control.root.getAttribute('aria-label'),
        associationAttribute: control.root.getAttribute('instanceAssociations'),
        pressed: control.root.getAttribute('aria-pressed'),
        focused: document.activeElement === control.root,
      };
    },
    async setTargetProps(props: Props) {
      await current!.control.setProps(props);
    },
    async setLabelProps(props: Props) {
      await current!.label.setProps(props);
    },
    async replaceLabelReference() {
      await current!.label.setAssociations(current!.next);
    },
    async matchTargetReference() {
      await current!.control.setAssociations(current!.next);
    },
    blurTarget() {
      current!.control.root.blur();
    },
    detachLabelOnFocus() {
      const pair = current!;
      pair.control.root.addEventListener('focus', () => pair.label.root.remove(), { once: true });
    },
    async disposeLabel() {
      await current!.label.close();
    },
    async dispose() {
      if (!current) return;
      await current.label.close();
      await current.control.close();
      current = undefined;
    },
  };
}
