/**
 * Real Adapter consumer fixture for the component-capabilities browser journey.
 * The runner supplies the repository-generated style sheets. These consumers
 * specify dimensions and labels only; no measurements, input or layout behavior
 * are mocked. One component tree is mounted at a time under #fixture.
 */
import type * as ReactDeclarations from '../../../apps/www/node_modules/@types/react';
import type * as ReactDOMDeclarations from '../../../apps/www/node_modules/@types/react-dom';
import type * as ReactDOMClientDeclarations from '../../../apps/www/node_modules/@types/react-dom/client';
// React 18's JS entries have no adjacent declarations. Keep the app's exact
// runtime paths, with its installed @types packages as the typed bridge below.
// @ts-expect-error TS7016: pinned React JS entry is typed by ReactDeclarations.
import * as ReactRuntime from '../../../apps/www/node_modules/react/index.js';
// @ts-expect-error TS7016: pinned ReactDOM JS entry is typed by ReactDOMDeclarations.
import * as ReactDOMRuntime from '../../../apps/www/node_modules/react-dom/index.js';
// @ts-expect-error TS7016: pinned client JS entry is typed by ReactDOMClientDeclarations.
import * as ReactDOMClientRuntime from '../../../apps/www/node_modules/react-dom/client.js';
// Package entries preserve the app's pinned Vue runtimes and resolve their
// package-owned declarations alongside the browser ESM entry selected by esbuild.
import * as VueRuntime from '../../../apps/www/node_modules/vue';
import Vue2 from '../../../apps/www/node_modules/vue2-runtime';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter, type VueRuntime as AdapterVueRuntime } from '@proto.ui/adapter-vue';
import { createVue2Adapter, type Vue2Runtime as AdapterVue2Runtime } from '@proto.ui/adapter-vue2';
import * as baseNumber from '../../../packages/prototypes/base/src/number-field';
import * as baseCarousel from '../../../packages/prototypes/base/src/carousel';
import * as baseResizable from '../../../packages/prototypes/base/src/resizable';
import * as baseCalendar from '../../../packages/prototypes/base/src/calendar';
import * as basePicker from '../../../packages/prototypes/base/src/date-picker';
import * as shadcnNumber from '../../../packages/prototypes/shadcn/src/number-field';
import * as shadcnCarousel from '../../../packages/prototypes/shadcn/src/carousel';
import * as shadcnResizable from '../../../packages/prototypes/shadcn/src/resizable';
import * as shadcnCalendar from '../../../packages/prototypes/shadcn/src/calendar';
import * as shadcnPicker from '../../../packages/prototypes/shadcn/src/date-picker';
import * as brutalistNumber from '../../../packages/prototypes/brutalist/src/number-field';
import * as brutalistCarousel from '../../../packages/prototypes/brutalist/src/carousel';
import * as brutalistResizable from '../../../packages/prototypes/brutalist/src/resizable';
import * as brutalistCalendar from '../../../packages/prototypes/brutalist/src/calendar';
import * as brutalistPicker from '../../../packages/prototypes/brutalist/src/date-picker';
import * as bootstrapNumber from '../../../packages/prototypes/bootstrap-2-3-2/src/number-field';
import * as bootstrapCarousel from '../../../packages/prototypes/bootstrap-2-3-2/src/carousel';
import * as bootstrapResizable from '../../../packages/prototypes/bootstrap-2-3-2/src/resizable';
import * as bootstrapCalendar from '../../../packages/prototypes/bootstrap-2-3-2/src/calendar';
import * as bootstrapPicker from '../../../packages/prototypes/bootstrap-2-3-2/src/date-picker';
import * as liquidNumber from '../../../packages/prototypes/liquid-glass/src/number-field';
import * as liquidCarousel from '../../../packages/prototypes/liquid-glass/src/carousel';
import * as liquidResizable from '../../../packages/prototypes/liquid-glass/src/resizable';
import * as liquidCalendar from '../../../packages/prototypes/liquid-glass/src/calendar';
import * as liquidPicker from '../../../packages/prototypes/liquid-glass/src/date-picker';

const React = ReactRuntime as typeof ReactDeclarations;
const { createPortal, flushSync } = ReactDOMRuntime as typeof ReactDOMDeclarations;
const { createRoot } = ReactDOMClientRuntime as typeof ReactDOMClientDeclarations;
// Use the public Adapter runtime shape, as the website's Vue runtime loader
// does: direct package-directory imports do not resolve pnpm's transitive Vue
// declarations consistently, while the browser still receives the pinned ESM.
const Vue = VueRuntime as unknown as AdapterVueRuntime & {
  createApp(component: { render(): unknown }): {
    mount(host: HTMLElement): unknown;
    unmount(): void;
  };
};

export type Runtime = 'wc' | 'react' | 'vue' | 'vue2' | 'vue3';
export type Family = 'base' | 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
export type Kind = 'number-field' | 'carousel' | 'resizable' | 'calendar' | 'date-picker';
type Props = Record<string, unknown>;
type Style = Record<string, string>;
type Node = {
  id: string;
  proto: any;
  props: Props;
  style: Style;
  children: Array<Node | string>;
};
type Handle = { getExposes(): Record<string, any> };
export type EventRecord = { id: string; type: string; detail: unknown };

const families = {
  base: { ...baseNumber, ...baseCarousel, ...baseResizable, ...baseCalendar, ...basePicker },
  shadcn: {
    ...shadcnNumber,
    ...shadcnCarousel,
    ...shadcnResizable,
    ...shadcnCalendar,
    ...shadcnPicker,
  },
  brutalist: {
    ...brutalistNumber,
    ...brutalistCarousel,
    ...brutalistResizable,
    ...brutalistCalendar,
    ...brutalistPicker,
  },
  'bootstrap-2-3-2': {
    ...bootstrapNumber,
    ...bootstrapCarousel,
    ...bootstrapResizable,
    ...bootstrapCalendar,
    ...bootstrapPicker,
  },
  'liquid-glass': {
    ...liquidNumber,
    ...liquidCarousel,
    ...liquidResizable,
    ...liquidCalendar,
    ...liquidPicker,
  },
};
const eventNames = [
  'valueChange',
  'valueCommit',
  'valuesChange',
  'rangeChange',
  'monthChange',
  'openChange',
  'indexChange',
  'sizesChange',
  'sizesCommit',
];
let nodes = new Map<string, Node>();
let handles = new Map<string, Handle>();
let records: EventRecord[] = [];
let dispose: (() => void | Promise<void>) | undefined;
let redraw: (() => void) | undefined;
let frameworkHandle: ((id: string) => Handle | undefined) | undefined;
let activeRuntime: Runtime | undefined;
let fixture: HTMLElement | undefined;

const node = (
  id: string,
  proto: any,
  props: Props = {},
  children: Array<Node | string> = [],
  style: Style = {}
): Node => ({ id, proto, props, children, style });
const copy = <T>(value: T): T => structuredClone(value);
const record = (id: string, type: string, detail: unknown) => {
  records.push({ id, type, detail: copy(detail) });
};
const callbacks = (id: string) =>
  id === 'root' || id === 'inner'
    ? Object.fromEntries(
        eventNames.map((type) => [
          `on${type[0].toUpperCase()}${type.slice(1)}`,
          (detail: unknown) => record(id, type, detail),
        ])
      )
    : {};

function tree(family: Family, kind: Kind, options: Props): Node {
  const p = families[family];
  if (kind === 'number-field') {
    return node(
      'root',
      p.numberFieldRoot,
      {
        defaultValue: 20.5,
        min: 0,
        max: 10000,
        step: 0.5,
        locale: 'de-DE',
        scrub: true,
        scrubSteps: 20,
        allowEmpty: true,
        ariaLabel: 'Amount',
        ...options,
      },
      [
        node('label', p.numberFieldLabel, {}, ['Amount — drag label'], {
          display: 'inline-block',
          width: '180px',
        }),
        node('input', p.numberFieldInput, {}, [], { width: '180px' }),
        node('decrement', p.numberFieldDecrement, {}, ['−']),
        node('increment', p.numberFieldIncrement, {}, ['+']),
      ],
      { width: '100%' }
    );
  }
  if (kind === 'carousel') {
    return node(
      'root',
      p.carouselRoot,
      { defaultIndex: 0, slidesPerView: 2, minSlideSize: 180, ...options },
      [
        node('prev', p.carouselPrevious, {}, ['Previous']),
        node(
          'viewport',
          p.carouselViewport,
          {},
          Array.from({ length: 6 }, (_, index) =>
            node(`slide${index}`, p.carouselSlide, { index }, [`Slide ${index + 1}`], {
              background: index % 2 ? '#e6edf7' : '#d9e4f2',
            })
          ),
          { width: '100%', height: options.orientation === 'vertical' ? '300px' : '220px' }
        ),
        node('next', p.carouselNext, {}, ['Next']),
      ],
      { width: '100%' }
    );
  }
  if (kind === 'resizable') {
    // Base deliberately leaves handle dimensions to its consumer. Family
    // recipes keep their own dimensions; no flex, basis or overflow is added.
    const handleStyle = (vertical: boolean): Style =>
      family !== 'base'
        ? {}
        : vertical
          ? { height: '8px', minHeight: '8px', width: '100%', background: '#64748b' }
          : { width: '8px', minWidth: '8px', height: '100%', background: '#64748b' };
    const inner = node(
      'inner',
      p.resizableRoot,
      { defaultSizes: [40, 60], orientation: 'vertical' },
      [
        node('inner-panel0', p.resizablePanel, { index: 0 }, ['Inner top'], {
          background: '#e5eef4',
        }),
        node('inner-handle0', p.resizableHandle, { index: 0 }, [], handleStyle(true)),
        node('inner-panel1', p.resizablePanel, { index: 1 }, ['Inner bottom'], {
          background: '#d8e8ef',
        }),
      ],
      { width: '100%', height: '100%' }
    );
    return node(
      'root',
      p.resizableRoot,
      { defaultSizes: [25, 35, 40], ...options },
      [
        node('panel0', p.resizablePanel, { index: 0 }, ['Panel 1'], { background: '#e6edf7' }),
        node(
          'handle0',
          p.resizableHandle,
          { index: 0 },
          [],
          handleStyle(options.orientation === 'vertical')
        ),
        node('panel1', p.resizablePanel, { index: 1 }, [inner]),
        node(
          'handle1',
          p.resizableHandle,
          { index: 1 },
          [],
          handleStyle(options.orientation === 'vertical')
        ),
        node('panel2', p.resizablePanel, { index: 2 }, ['Panel 3'], { background: '#d9e4f2' }),
      ],
      { width: '100%', height: '280px' }
    );
  }
  const picker = kind === 'date-picker';
  const mode = options.mode ?? 'range';
  const props: Props = {
    mode,
    defaultMonth: '2026-10',
    ...(mode === 'multiple' ? { defaultValues: [] } : { defaultRange: {} }),
    maxSelected: 3,
    minNights: 0,
    maxNights: 14,
    a11yLabel: 'Choose dates',
    ...(picker ? { defaultOpen: false } : {}),
    ...options,
  };
  const first = new Date(`${props.month ?? props.defaultMonth}-01T00:00:00Z`);
  const weekStartsOn = Number(props.weekStartsOn ?? 0);
  first.setUTCDate(1 - ((first.getUTCDay() - weekStartsOn + 7) % 7));
  // Base Calendar is headless: arrange its real row/weekday atoms as the
  // public Base consumer does. Selection, hidden days and keyboard behavior
  // still come exclusively from the prototypes.
  const calendarRowStyle: Style =
    family === 'base'
      ? { display: 'grid', gridTemplateColumns: 'repeat(7, 40px)', width: '280px' }
      : {};
  const body = [
    node('caption', p.calendarCaption, {}, [
      node('prev', p.calendarPrevious, { a11yLabel: 'Previous month' }, ['Previous month']),
      node('heading', p.calendarHeading),
      node('next', p.calendarNext, { a11yLabel: 'Next month' }, ['Next month']),
    ]),
    node('grid', p.calendarGrid, {}, [
      node(
        'weekdays',
        p.calendarWeekdays,
        {},
        Array.from({ length: 7 }, (_, offset) =>
          node(`weekday${offset}`, p.calendarWeekday, { offset })
        ),
        calendarRowStyle
      ),
      ...Array.from({ length: 6 }, (_, row) =>
        node(
          `row${row}`,
          p.calendarRow,
          { index: row },
          Array.from({ length: 7 }, (_, column) => {
            const offset = row * 7 + column;
            const date = new Date(first);
            date.setUTCDate(date.getUTCDate() + offset);
            return node(
              `date-${date.toISOString().slice(0, 10)}`,
              picker ? p.datePickerDay : p.calendarDay,
              { offset },
              [],
              family === 'base' ? { width: '40px', height: '40px' } : {}
            );
          }),
          calendarRowStyle
        )
      ),
    ]),
  ];
  return node(
    'root',
    picker ? p.datePickerRoot : p.calendarRoot,
    props,
    picker
      ? [
          node('trigger', p.datePickerTrigger, {}, [
            node('value', p.datePickerValue, { placeholder: 'Choose dates' }),
          ]),
          node(
            'content',
            p.datePickerContent,
            { side: 'bottom', align: 'start', sideOffset: 4 },
            body,
            family === 'base' ? { background: 'white' } : {}
          ),
        ]
      : body
  );
}

/** Flush actual framework commits and browser layout without fake timers. */
export async function settle() {
  for (let i = 0; i < 3; i++) {
    if (activeRuntime === 'vue' || activeRuntime === 'vue3') await Vue.nextTick();
    if (activeRuntime === 'vue2') await Vue2.nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

export async function cleanup() {
  const previous = dispose;
  dispose = undefined;
  redraw = undefined;
  await previous?.();
  await settle();
  fixture?.replaceChildren();
  nodes.clear();
  handles.clear();
  frameworkHandle = undefined;
  activeRuntime = undefined;
}

/** Options are merged into the Root props; control props are never invented. */
export async function mount(runtime: Runtime, family: Family, kind: Kind, options: Props = {}) {
  await cleanup();
  if (!(family in families)) throw new Error(`Unknown fixture family: ${family}`);
  if (!['wc', 'react', 'vue', 'vue2', 'vue3'].includes(runtime))
    throw new Error(`Unknown fixture runtime: ${runtime}`);
  if (!['number-field', 'carousel', 'resizable', 'calendar', 'date-picker'].includes(kind))
    throw new Error(`Unknown fixture kind: ${kind}`);
  activeRuntime = runtime;
  records = [];
  fixture = document.getElementById('fixture') ?? document.createElement('div');
  if (!fixture.isConnected) {
    fixture.id = 'fixture';
    document.body.append(fixture);
  }
  const host = document.createElement('div');
  host.className = 'cap-fixture';
  host.style.width = '760px';
  host.style.maxWidth = '100%';
  fixture.append(host);
  const root = tree(family, kind, options);
  const visit = (current: Node) => {
    if (nodes.has(current.id)) throw new Error(`Duplicate fixture id: ${current.id}`);
    nodes.set(current.id, current);
    for (const child of current.children) if (typeof child !== 'string') visit(child);
  };
  visit(root);

  if (runtime === 'wc') {
    const render = (current: Node): HTMLElement => {
      if (!customElements.get(current.proto.name)) AdaptToWebComponent(current.proto);
      const element = document.createElement(current.proto.name) as HTMLElement & Handle;
      element.className = `cap-${current.id}`;
      Object.assign(element.style, current.style);
      setElementProps(element, current.props);
      handles.set(current.id, element);
      if (current.id === 'root' || current.id === 'inner')
        for (const type of eventNames)
          element.addEventListener(type, (event) => {
            // Nested roots emit bubbling events; each event has exactly one owner.
            if (event.target === element) record(current.id, type, (event as CustomEvent).detail);
          });
      element.append(
        ...current.children.map((child) => (typeof child === 'string' ? child : render(child)))
      );
      return element;
    };
    host.append(render(root));
    dispose = () => host.remove();
  } else if (runtime === 'react') {
    const adapt = createReactAdapter({ ...React, createPortal } as any);
    const components = new Map(
      [...nodes.values()].map((current) => [current.proto, adapt(current.proto)])
    );
    const refs = new Map(
      [...nodes.keys()].map((id) => [
        id,
        (handle: Handle | null) => (handle ? handles.set(id, handle) : handles.delete(id)),
      ])
    );
    const render = (current: Node): any =>
      React.createElement(
        components.get(current.proto) as any,
        {
          key: current.id,
          ...current.props,
          ...callbacks(current.id),
          className: `cap-${current.id}`,
          style: current.style,
          ref: refs.get(current.id),
        },
        ...current.children.map((child) => (typeof child === 'string' ? child : render(child)))
      );
    const app = createRoot(host);
    redraw = () => flushSync(() => app.render(render(root)));
    dispose = () => flushSync(() => app.unmount());
    redraw();
  } else if (runtime === 'vue' || runtime === 'vue3') {
    const adapt = createVueAdapter(Vue);
    const components = new Map(
      [...nodes.values()].map((current) => [current.proto, adapt(current.proto)])
    );
    const revision = Vue.ref(0);
    const refs = new Map(
      [...nodes.keys()].map((id) => [
        id,
        (handle: Handle | null) => (handle ? handles.set(id, handle) : handles.delete(id)),
      ])
    );
    const render = (current: Node): any =>
      Vue.h(
        components.get(current.proto) as any,
        {
          key: current.id,
          ...current.props,
          ...callbacks(current.id),
          class: `cap-${current.id}`,
          style: current.style,
          ref: refs.get(current.id),
        },
        () => current.children.map((child) => (typeof child === 'string' ? child : render(child)))
      );
    const app = Vue.createApp({
      render() {
        revision.value;
        return render(root);
      },
    });
    redraw = () => {
      revision.value++;
    };
    dispose = () => app.unmount();
    app.mount(host);
  } else {
    // Vue 2's generic extend overloads and the Adapter's structural component
    // options describe the same runtime call through different type surfaces.
    const adapt = createVue2Adapter({
      extend: Vue2.extend.bind(Vue2),
      nextTick: Vue2.nextTick.bind(Vue2),
      set: Vue2.set.bind(Vue2),
      delete: Vue2.delete.bind(Vue2),
    } as unknown as AdapterVue2Runtime);
    const components = new Map(
      [...nodes.values()].map((current) => [current.proto, adapt(current.proto)])
    );
    const App = Vue2.extend({
      render(h: any) {
        const render = (current: Node): any =>
          h(
            components.get(current.proto),
            {
              key: current.id,
              ref: current.id,
              attrs: current.props,
              on: Object.fromEntries(
                Object.entries(callbacks(current.id)).map(([key, callback]) => [
                  key[2].toLowerCase() + key.slice(3),
                  callback,
                ])
              ),
              class: `cap-${current.id}`,
              style: current.style,
            },
            current.children.map((child) => (typeof child === 'string' ? child : render(child)))
          );
        return render(root);
      },
    });
    const app = new App().$mount();
    host.append(app.$el);
    // Popup descendants can be created after the initial mount and replaced
    // on reopen. Read Vue 2's live refs instead of keeping a retired instance.
    frameworkHandle = (id) => app.$refs[id] as unknown as Handle | undefined;
    redraw = () => {
      app.$forceUpdate();
    };
    dispose = () => app.$destroy();
    await Vue2.nextTick();
  }
  await settle();
  return { runtime, family, kind, ids: [...nodes.keys()] };
}

/** States and zero-argument public getters share one serializable read API. */
export function read(id: string, key: string): unknown {
  const handle = frameworkHandle ? frameworkHandle(id) : handles.get(id);
  if (!handle) throw new Error(`Missing mounted fixture handle: ${id}`);
  const exposed = handle.getExposes()[key];
  if (exposed && typeof exposed.get === 'function') return copy(exposed.get());
  if (typeof exposed === 'function') return copy(exposed());
  return copy(exposed);
}

/** Merge into this consumer's existing props, preserving an explicit owner. */
export async function update(id: string, patch: Props) {
  const current = nodes.get(id);
  if (!current) throw new Error(`Missing mounted fixture node: ${id}`);
  current.props = { ...current.props, ...patch };
  if (activeRuntime === 'wc') setElementProps(handles.get(id) as any, current.props);
  else redraw?.();
  await settle();
}

export async function call(id: string, key: string, ...args: unknown[]) {
  const exposed = (frameworkHandle ? frameworkHandle(id) : handles.get(id))?.getExposes()[key];
  if (typeof exposed !== 'function') throw new Error(`Missing public method: ${id}.${key}`);
  const result = exposed(...args);
  await settle();
  return copy(result);
}

export function events(): EventRecord[] {
  return copy(records);
}
