import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import * as Vue from 'vue';
import Vue2 from '../../../../../packages/adapters/vue2/node_modules/vue';
import { definePrototype, type RunHandle } from '@proto.ui/core';
import { createDefaultWebMetaGetter } from '@proto.ui/adapter-base';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import Button, { type ShadcnButtonProps } from '@proto.ui/prototypes-shadcn/button';
import {
  shadcnCheckboxRoot as Checkbox,
  shadcnCheckboxIndicator as Indicator,
} from '@proto.ui/prototypes-shadcn';
import {
  shadcnSwitchRoot as Switch,
  shadcnSwitchThumb as Thumb,
} from '@proto.ui/prototypes-shadcn';
import { shadcnTextareaRoot as Textarea } from '@proto.ui/prototypes-shadcn';
import { transition as Transition } from '@proto.ui/prototypes-base/transition';
import {
  shadcnDialogRoot as Dialog,
  shadcnDialogContent as Content,
  shadcnDialogMask as Mask,
} from '@proto.ui/prototypes-shadcn';
import {
  toVue2Runtime,
  toVue2ComponentData,
} from '../../../src/components/PrototypePreviewer/runtimes/vue2-runtime';
import { installColorSchemeResourceProbe, createColorSchemeSurfaceProbe } from './host-probes';

const stylesheet = '/@id/__x00__virtual:color-scheme.css';
await import(/* @vite-ignore */ stylesheet);
const runtime = new URLSearchParams(location.search).get('runtime') ?? 'wc';
document.querySelector('#runtime-name')!.textContent = runtime;
const resourceProbe = installColorSchemeResourceProbe();
function setTheme(theme: 'light' | 'dark' | 'system') {
  document.documentElement.classList.remove('light', 'dark');
  delete document.documentElement.dataset.theme;
  if (theme !== 'system') {
    document.documentElement.classList.add(theme);
    document.documentElement.dataset.theme = theme;
  }
}
if (new URLSearchParams(location.search).get('initial') === 'dark') setTheme('dark');
let flipPortalOnMount = false;
let portalFlipAt: number | null = null;
const diagnosticsFor = (id: string) =>
  id === 'content'
    ? {
        diagnostics: {
          onLifecycleEvent(event: any) {
            if (flipPortalOnMount && event.type === 'mount.phase' && event.phase === 'mounted') {
              flipPortalOnMount = false;
              portalFlipAt = performance.now();
              setTheme('dark');
            }
          },
        },
      }
    : {};

function frame(id: string) {
  const root = document.querySelector<HTMLElement>(`[data-demo-ref="${id}"]`);
  const surface = root?.localName === 'textarea' ? root : (root?.querySelector('textarea') ?? root);
  if (!surface) return null;
  const rect = surface.getBoundingClientRect();
  let visible = surface.isConnected && rect.width > 0 && rect.height > 0;
  for (let element: Element | null = surface; visible && element; element = element.parentElement) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)
      visible = false;
  }
  return {
    visible,
    pending: !!surface.closest('[data-pui-view-pending]'),
    background: getComputedStyle(surface).backgroundColor,
    tokens: surface.getAttribute('data-pui-style'),
  };
}
const firstPaint: Record<string, NonNullable<ReturnType<typeof frame>>> = {};
const initialFrames: Record<string, Array<NonNullable<ReturnType<typeof frame>>>> = {};
let initialFrameCount = 0;
let completeInitialPaint!: () => void;
const initialPaintDone = new Promise<void>((resolve) => {
  completeInitialPaint = resolve;
});
function observeInitialPaint() {
  for (const id of ['button', 'outline', 'checkbox', 'switch', 'textarea', 'probe']) {
    const sample = frame(id);
    if (sample?.visible) {
      if (!firstPaint[id]) firstPaint[id] = sample;
      (initialFrames[id] ??= []).push(sample);
    }
  }
  if (++initialFrameCount < 12) requestAnimationFrame(observeInitialPaint);
  else completeInitialPaint();
}
requestAnimationFrame(observeInitialPaint);

const stats = { probeSetups: 0, probeRenders: 0, probeWatches: 0, probeUpdated: 0 };
// This private consumer delegates the actual Shadcn setup and adds only observation/lifecycle controls.
const Probe = definePrototype<any, any>({
  name: 'color-scheme-retained-button',
  setup(def) {
    stats.probeSetups++;
    let run!: RunHandle<ShadcnButtonProps>;
    const render = Button.setup(def);
    def.lifecycle.onCreated((current) => {
      run = current;
    });
    def.lifecycle.onUpdated(() => {
      stats.probeUpdated++;
    });
    def.props.watch(['disabled'], () => {
      stats.probeWatches++;
    });
    def.expose.method('setPresent', (next: boolean) => run.lifecycle.setPresent(next));
    return (renderer) => {
      stats.probeRenders++;
      return render ? render(renderer) : [renderer.slot()];
    };
  },
});

const definitions = {
  button: Button,
  outline: Button,
  checkbox: Checkbox,
  indicator: Indicator,
  switch: Switch,
  thumb: Thumb,
  textarea: Textarea,
  custom: Button,
  probe: Probe,
  dialog: Dialog,
  content: Content,
  mask: Mask,
  portalButton: Button,
  transition: Transition,
  customTextarea: Textarea,
};
const defaultReaderSample = createDefaultWebMetaGetter();
const lightGetter = (key: string) => (key === 'colorScheme' ? 'light' : undefined);
const darkGetter = (key: string) => (key === 'colorScheme' ? 'dark' : undefined);
const metaOptions = (id: string) =>
  id === 'custom'
    ? { getMeta: lightGetter }
    : id === 'customTextarea'
      ? { getMeta: darkGetter }
      : {};
let disabled = false;
let dialogOpen = false;
let kept = true;
let probeHandle: any;
let transitionHandle: any;
const editorHandles: Record<string, any> = {};
const transitionEvents: Array<{ name: string; at: number }> = [];
const transitionListeners = Object.fromEntries(
  ['beforeEnter', 'afterEnter', 'beforeLeave', 'afterLeave'].map((name) => [
    `on${name[0].toUpperCase()}${name.slice(1)}`,
    () => transitionEvents.push({ name, at: performance.now() }),
  ])
);
let updateApp: () => void;
let disposeApp: () => void;
let moveProbe: () => void = () => {};
let disconnectProbe: () => void = () => {};
let reconnectProbe: () => void = () => {};
const host = document.querySelector<HTMLElement>('#app')!;
const settle = async () => {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
};
function propsFor(id: keyof typeof definitions): Record<string, unknown> {
  const props: Record<string, unknown> = { 'data-demo-ref': id };
  if (['button', 'custom', 'probe', 'portalButton'].includes(id)) props.variant = 'destructive';
  if (id === 'outline') props.variant = 'outline';
  if (id === 'probe') props.disabled = disabled;
  if (id === 'textarea' || id === 'customTextarea')
    Object.assign(props, {
      defaultValue: 'Theme follows the document',
      rows: 2,
      ariaLabel: 'Theme sample',
    });
  if (id === 'dialog') props.open = dialogOpen;
  if (id === 'transition')
    Object.assign(props, { defaultOpen: true, enterDuration: 180, leaveDuration: 180 });
  return props;
}
const labels: Record<string, string> = {
  button: 'Destructive Button',
  outline: 'Outline Button',
  checkbox: 'Checkbox',
  switch: 'Switch',
  textarea: 'Textarea surface',
  custom: 'Custom light reader',
  probe: 'Retained Shadcn consumer',
  transition: 'Transition fallback sample',
  customTextarea: 'Custom dark reader · excluded',
};

if (runtime === 'wc') {
  const types = Object.fromEntries(
    Object.entries(definitions).map(([id, proto]) => [
      id,
      AdaptToWebComponent(proto, {
        registerAs: `theme-fixture-${id.toLowerCase()}`,
        ...metaOptions(id),
        ...diagnosticsFor(id),
      }),
    ])
  );
  const elements: Record<string, any> = {};
  const make = (id: keyof typeof definitions, children: Array<Node | string> = []) => {
    const el = new types[id]();
    el.dataset.demoRef = id;
    if (id === 'transition') {
      for (const [key, listener] of Object.entries(transitionListeners)) {
        el.addEventListener(key[2].toLowerCase() + key.slice(3), listener);
      }
    }
    setElementProps(el, propsFor(id));
    el.append(...children);
    elements[id] = el;
    if (id === 'textarea' || id === 'customTextarea') editorHandles[id] = el;
    return el;
  };
  for (const id of Object.keys(labels) as Array<keyof typeof definitions>) {
    const article = document.createElement('article');
    article.dataset.case = id;
    const label = document.createElement('p');
    label.textContent = labels[id];
    const mount = document.createElement('div');
    mount.append(
      make(
        id,
        id === 'switch'
          ? [make('thumb')]
          : id === 'checkbox'
            ? [make('indicator')]
            : id === 'textarea' || id === 'customTextarea'
              ? []
              : [labels[id]]
      )
    );
    article.append(label, mount);
    host.append(article);
  }
  host.append(
    make('dialog', [make('mask'), make('content', [make('portalButton', ['Portal Button'])])])
  );
  probeHandle = elements.probe;
  transitionHandle = elements.transition;
  updateApp = () => {
    setElementProps(elements.probe, propsFor('probe'));
    setElementProps(elements.dialog, propsFor('dialog'));
    elements.dialog.update();
  };
  moveProbe = () => {
    const parent = elements.probe.parentElement;
    elements.probe.remove();
    parent.append(elements.probe);
  };
  const probeParent = elements.probe.parentElement;
  disconnectProbe = () => elements.probe.remove();
  reconnectProbe = () => probeParent.append(elements.probe);
  disposeApp = () => host.replaceChildren();
} else if (runtime === 'react') {
  const adapt = createReactAdapter({ ...React, createPortal });
  const types = Object.fromEntries(
    Object.entries(definitions).map(([id, proto]) => [
      id,
      adapt(proto, {
        autoUpdateOnPropsChange: id !== 'probe',
        ...metaOptions(id),
        ...diagnosticsFor(id),
      }),
    ])
  );
  const root = createRoot(host);
  const make = (id: keyof typeof definitions, children?: React.ReactNode) =>
    React.createElement(
      types[id],
      {
        key: id,
        ...propsFor(id),
        ...(id === 'probe'
          ? {
              ref: (value: unknown) => {
                probeHandle = value;
              },
            }
          : {}),
        ...(id === 'transition'
          ? {
              ...transitionListeners,
              ref: (value: unknown) => {
                transitionHandle = value;
              },
            }
          : {}),
        ...(id === 'textarea' || id === 'customTextarea'
          ? {
              ref: (value: unknown) => {
                if (value) editorHandles[id] = value;
              },
            }
          : {}),
      },
      children
    );
  updateApp = () =>
    root.render(
      React.createElement(
        React.StrictMode,
        null,
        ...Object.keys(labels).map((id) =>
          React.createElement(
            'article',
            { key: id, 'data-case': id },
            React.createElement('p', null, labels[id]),
            React.createElement(
              'div',
              null,
              make(
                id as keyof typeof definitions,
                id === 'switch'
                  ? make('thumb')
                  : id === 'checkbox'
                    ? make('indicator')
                    : id === 'textarea' || id === 'customTextarea'
                      ? undefined
                      : labels[id]
              )
            )
          )
        ),
        make('dialog', [make('mask'), make('content', make('portalButton', 'Portal Button'))])
      )
    );
  disposeApp = () => root.unmount();
  updateApp();
} else if (runtime === 'vue') {
  const adapt = createVueAdapter(Vue as any);
  const types = Object.fromEntries(
    Object.entries(definitions).map(([id, proto]) => [
      id,
      adapt(proto, {
        autoUpdateOnPropsChange: id !== 'probe',
        ...metaOptions(id),
        ...diagnosticsFor(id),
      }),
    ])
  );
  const revision = Vue.ref(0);
  const make = (id: keyof typeof definitions, children?: any) =>
    Vue.h(
      types[id],
      {
        ...propsFor(id),
        ...(id === 'probe'
          ? {
              ref: (value: unknown) => {
                if (value) probeHandle = value;
              },
            }
          : {}),
        ...(id === 'transition'
          ? {
              ...transitionListeners,
              ref: (value: unknown) => {
                if (value) transitionHandle = value;
              },
            }
          : {}),
        ...(id === 'textarea' || id === 'customTextarea'
          ? {
              ref: (value: unknown) => {
                if (value) editorHandles[id] = value;
              },
            }
          : {}),
      },
      children == null ? undefined : { default: () => children }
    );
  const app = Vue.createApp({
    render() {
      void revision.value;
      return Vue.h('section', [
        ...Object.keys(labels).map((id) =>
          Vue.h('article', { 'data-case': id }, [
            Vue.h('p', labels[id]),
            Vue.h(
              'div',
              id === 'probe'
                ? [
                    Vue.h(Vue.KeepAlive, null, {
                      default: () => (kept ? make('probe', labels[id]) : null),
                    }),
                  ]
                : [
                    make(
                      id as keyof typeof definitions,
                      id === 'switch'
                        ? [make('thumb')]
                        : id === 'checkbox'
                          ? [make('indicator')]
                          : id === 'textarea' || id === 'customTextarea'
                            ? undefined
                            : labels[id]
                    ),
                  ]
            ),
          ])
        ),
        make('dialog', [make('mask'), make('content', [make('portalButton', 'Portal Button')])]),
      ]);
    },
  });
  app.mount(host);
  updateApp = () => {
    revision.value++;
  };
  disposeApp = () => app.unmount();
} else if (runtime === 'vue2') {
  const adapt = createVue2Adapter(toVue2Runtime(Vue2 as any));
  const types = Object.fromEntries(
    Object.entries(definitions).map(([id, proto]) => [
      id,
      adapt(proto, {
        autoUpdateOnPropsChange: id !== 'probe',
        ...metaOptions(id),
        ...diagnosticsFor(id),
      }),
    ])
  );
  const vm = new Vue2({
    render(h: any) {
      const make = (id: keyof typeof definitions, children?: any) =>
        h(
          types[id],
          {
            ...toVue2ComponentData({
              ...propsFor(id),
              ...(id === 'transition' ? transitionListeners : {}),
            }),
            ...(id === 'probe' ? { ref: 'probe' } : {}),
            ...(id === 'transition' ? { ref: 'transition' } : {}),
            ...(id === 'textarea' || id === 'customTextarea' ? { ref: id } : {}),
          },
          children == null ? undefined : Array.isArray(children) ? children : [children]
        );
      return h('section', [
        ...Object.keys(labels).map((id) =>
          h('article', { attrs: { 'data-case': id } }, [
            h('p', labels[id]),
            h(
              'div',
              id === 'probe'
                ? [h('keep-alive', kept ? [make('probe', labels[id])] : [])]
                : [
                    make(
                      id as keyof typeof definitions,
                      id === 'switch'
                        ? [make('thumb')]
                        : id === 'checkbox'
                          ? [make('indicator')]
                          : id === 'textarea' || id === 'customTextarea'
                            ? undefined
                            : labels[id]
                    ),
                  ]
            ),
          ])
        ),
        make('dialog', [make('mask'), make('content', [make('portalButton', 'Portal Button')])]),
      ]);
    },
  });
  host.append(vm.$mount().$el);
  probeHandle = vm.$refs.probe;
  transitionHandle = vm.$refs.transition;
  editorHandles.textarea = vm.$refs.textarea;
  editorHandles.customTextarea = vm.$refs.customTextarea;
  updateApp = () => vm.$forceUpdate();
  disposeApp = () => {
    vm.$destroy();
    vm.$el.remove();
  };
} else throw new Error(`Unsupported runtime ${runtime}`);

await settle();
let surfaceProbe: Awaited<ReturnType<typeof createColorSchemeSurfaceProbe>> | undefined;
if (runtime === 'wc') {
  const container = document.createElement('article');
  container.id = 'physical-surface';
  const label = document.createElement('p');
  label.textContent = 'Runtime / Web Effects target';
  container.append(label);
  document.querySelector('#board')!.append(container);
  surfaceProbe = await createColorSchemeSurfaceProbe(container);
}
const fixture = {
  runtime,
  stats,
  firstPaint,
  initialFrames,
  resources: () => resourceProbe.snapshot(),
  restoreInstrumentation: () => resourceProbe.restore(),
  frame,
  editorValues() {
    return {
      textarea: editorHandles.textarea.getExposes().value.get(),
      customTextarea: editorHandles.customTextarea.getExposes().value.get(),
    };
  },
  readerSamples() {
    return {
      default: defaultReaderSample('colorScheme'),
      customTextarea: darkGetter('colorScheme'),
    };
  },
  setTheme,
  async setPresent(present: boolean) {
    probeHandle.getExposes().setPresent(present);
    await settle();
  },
  async setDisabled(next: boolean) {
    disabled = next;
    updateApp();
    await settle();
  },
  async updateProbe() {
    probeHandle.update();
    await settle();
  },
  async setDialog(next: boolean) {
    dialogOpen = next;
    updateApp();
    await settle();
  },
  async setKept(next: boolean) {
    kept = next;
    updateApp();
    await settle();
  },
  async moveProbe() {
    moveProbe();
    await settle();
  },
  async disconnectProbe() {
    disconnectProbe();
    await settle();
  },
  async reconnectProbe() {
    reconnectProbe();
    await settle();
  },
  async openPortalWithLateTheme() {
    flipPortalOnMount = true;
    dialogOpen = true;
    updateApp();
    await settle();
  },
  portalFlipAt: () => portalFlipAt,
  replaceSurface() {
    surfaceProbe!.replace();
  },
  surfaceState() {
    const state = surfaceProbe!.read();
    return {
      epoch: state.epoch,
      renders: state.renders,
      commits: state.commits,
      retiredTokens: state.retired?.getAttribute('data-pui-style') ?? null,
    };
  },
  transitionPhase() {
    return transitionHandle.getExposes().transitionState.get();
  },
  async observeTransition(direction: 'enter' | 'leave') {
    transitionEvents.length = 0;
    const api = transitionHandle.getExposes();
    const started = performance.now();
    api[direction]();
    const samples = [{ phase: api.transitionState.get(), elapsed: performance.now() - started }];
    const terminal = direction === 'enter' ? 'entered' : 'closed';
    while (api.transitionState.get() !== terminal) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      samples.push({ phase: api.transitionState.get(), elapsed: performance.now() - started });
    }
    return {
      samples,
      elapsed: performance.now() - started,
      present: api.isPresent.get(),
      events: transitionEvents.map((event) => ({ name: event.name, elapsed: event.at - started })),
    };
  },
  async dispose() {
    disposeApp();
    await surfaceProbe?.dispose();
    await settle();
  },
};
(window as any).colorSchemeFixture = fixture;
await initialPaintDone;
document.body.dataset.ready = 'true';
