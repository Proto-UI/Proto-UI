import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal, flushSync } from 'react-dom';
import * as Vue from 'vue';
import Vue2 from 'vue2-runtime';
import { createControlLabelRef, definePrototype, type Prototype } from '@proto.ui/core';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter, type Vue2Runtime } from '@proto.ui/adapter-vue2';
import { registerWebPortalDestination } from '../../../../packages/adapters/base/src';
import {
  AdaptToWebComponent,
  setElementProps,
  setElementAssociations,
} from '@proto.ui/adapter-web-component';
import baseButton from '@proto.ui/prototypes-base/button';
import baseToggle from '@proto.ui/prototypes-base/toggle';
import baseLabel from '@proto.ui/prototypes-base/label';
import * as baseGroup from '@proto.ui/prototypes-base/toggle-group';
import * as baseTooltip from '@proto.ui/prototypes-base/tooltip';
import * as baseDrawer from '@proto.ui/prototypes-base/drawer';
import shadcnButton from '@proto.ui/prototypes-shadcn/button';
import shadcnToggle from '@proto.ui/prototypes-shadcn/toggle';
import shadcnLabel from '@proto.ui/prototypes-shadcn/label';
import * as shadcnGroup from '@proto.ui/prototypes-shadcn/toggle-group';
import * as shadcnTooltip from '@proto.ui/prototypes-shadcn/tooltip';
import * as shadcnDrawer from '@proto.ui/prototypes-shadcn/drawer';
import brutalistButton from '@proto.ui/prototypes-brutalist/button';
import brutalistToggle from '@proto.ui/prototypes-brutalist/toggle';
import brutalistLabel from '@proto.ui/prototypes-brutalist/label';
import * as brutalistGroup from '@proto.ui/prototypes-brutalist/toggle-group';
import * as brutalistTooltip from '@proto.ui/prototypes-brutalist/tooltip';
import * as brutalistDrawer from '@proto.ui/prototypes-brutalist/drawer';

const families = {
  base: {
    button: baseButton,
    toggle: baseToggle,
    label: baseLabel,
    ...baseGroup,
    ...baseTooltip,
    ...baseDrawer,
  },
  shadcn: {
    button: shadcnButton,
    toggle: shadcnToggle,
    label: shadcnLabel,
    ...shadcnGroup,
    tooltipRoot: shadcnTooltip.ShadcnTooltipRoot,
    tooltipTrigger: shadcnTooltip.ShadcnTooltipTrigger,
    tooltipContent: shadcnTooltip.ShadcnTooltipContent,
    ...shadcnDrawer,
  },
  brutalist: {
    button: brutalistButton,
    toggle: brutalistToggle,
    label: brutalistLabel,
    ...brutalistGroup,
    tooltipRoot: brutalistTooltip.BrutalistTooltipRoot,
    tooltipTrigger: brutalistTooltip.BrutalistTooltipTrigger,
    tooltipContent: brutalistTooltip.BrutalistTooltipContent,
    ...brutalistDrawer,
  },
};
type Node = {
  key: string;
  proto?: Prototype<any, any>;
  tag?: string;
  props?: Record<string, any>;
  associations?: { controlLabel: ReturnType<typeof createControlLabelRef> };
  events?: Record<string, (value: any) => void>;
  children?: Array<Node | string>;
};
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function settle() {
  for (let i = 0; i < 3; i++) await frame();
}

export type ConsumerRuntime = 'react' | 'wc' | 'vue' | 'vue2';
export type ConsumerOptions = {
  /** A real outer tree boundary, independent of a WC's internal render root. */
  shadow?: boolean;
  /** Use the existing host policy to keep an overlay in the same shadow tree. */
  portalDestination?: 'scene' | 'default';
  styleText?: string;
};

/** Real source prototypes and real framework owners; no simulated focus or geometry. */
export async function mount(
  scenario:
    | 'labels'
    | 'tooltip'
    | 'drawer'
    | 'tooltip-lifecycle'
    | 'tooltip-standalone'
    | 'tooltip-wrapped',
  familyName: keyof typeof families,
  runtime: ConsumerRuntime,
  options: ConsumerOptions = {}
) {
  const family = families[familyName];
  const counts = { click: 0, active: [] as unknown[], value: [] as unknown[] };
  let buttonPresent = true;
  let buttonMount = 0;
  let nodes: Node[];
  if (scenario === 'labels') {
    const pairs = Array.from({ length: 3 }, () => ({ controlLabel: createControlLabelRef() }));
    nodes = [
      {
        key: 'button',
        proto: family.button,
        associations: pairs[0],
        events: { click: () => counts.click++ },
        children: ['★'],
      },
      {
        key: 'button-label',
        proto: family.label,
        associations: pairs[0],
        children: ['Save document'],
      },
      {
        key: 'toggle',
        proto: family.toggle,
        associations: pairs[1],
        props: { active: false },
        events: { activeChange: (e) => counts.active.push(e) },
        children: ['★'],
      },
      {
        key: 'toggle-label',
        proto: family.label,
        associations: pairs[1],
        children: ['Pin document'],
      },
      {
        key: 'group',
        proto: family.toggleGroupRoot,
        props: { multiple: true, value: [] },
        events: { valueChange: (e) => counts.value.push(e) },
        children: [
          {
            key: 'item',
            proto: family.toggleGroupItem,
            props: { value: 'bold' },
            associations: pairs[2],
            children: ['B'],
          },
        ],
      },
      { key: 'item-label', proto: family.label, associations: pairs[2], children: ['Bold text'] },
    ];
  } else if (scenario.startsWith('tooltip')) {
    const command: Prototype<any, any> = family.button;
    const tooltipButton = definePrototype({
      ...command,
      name: `consumer-${familyName}-tooltip-button`,
      setup(def) {
        const render = command.setup(def);
        baseTooltip.useTooltipTrigger();
        return render;
      },
    });
    const trigger: Node =
      scenario === 'tooltip-standalone'
        ? { key: 'trigger', proto: family.tooltipTrigger, children: ['Save'] }
        : scenario === 'tooltip-wrapped'
          ? {
              key: 'trigger',
              proto: family.tooltipTrigger,
              children: [
                {
                  key: 'button',
                  proto: family.button,
                  events: { click: () => counts.click++ },
                  children: ['Save'],
                },
              ],
            }
          : {
              key: 'button',
              proto: tooltipButton,
              events: { click: () => counts.click++ },
              children: ['Save'],
            };
    nodes = [
      { key: 'before', tag: 'button', children: ['Before'] },
      {
        key: 'root',
        proto: family.tooltipRoot,
        props: { openDelay: 0, closeDelay: 0 },
        children: [
          trigger,
          {
            key: 'content',
            proto: family.tooltipContent,
            props: { enterDuration: 0, leaveDuration: 0 },
            children: ['Save this document'],
          },
        ],
      },
      { key: 'after', tag: 'button', children: ['After'] },
    ];
  } else {
    nodes = [
      {
        key: 'grid',
        tag: 'section',
        props: { style: { display: 'grid', gridTemplateRows: '40px 1fr', minHeight: '300px' } },
        children: [
          { key: 'header', tag: 'header', children: ['Application header'] },
          {
            key: 'root',
            proto: family.drawerRoot,
            props: {
              defaultOpen: true,
              a11yLabel: 'Preferences',
              hostStyle: { display: 'contents' },
            },
            children: [
              {
                key: 'content',
                proto: family.drawerContent,
                props: {
                  side: 'right',
                  maxExtent: { unit: 'logical', value: 480 },
                  enterDuration: 0,
                  leaveDuration: 0,
                },
                children: [
                  { key: 'handle', proto: family.drawerHandle },
                  {
                    key: 'body',
                    tag: 'p',
                    children: ['Drawer content with an explicit neutral extent.'],
                  },
                  { key: 'close', proto: family.drawerClose, children: ['Close drawer'] },
                ],
              },
            ],
          },
          { key: 'main', tag: 'main', children: ['Application content'] },
        ],
      },
    ];
  }
  const definitions = new Map<string, Node>();
  const hosts = new Map<string, HTMLElement>();
  const refs = new Map<string, React.RefObject<any>>();
  const handles = new Map<string, any>();
  const components = new Map<Prototype<any, any>, any>();
  const outer = document.createElement('div');
  outer.dataset.repairFixture = '';
  const tree = options.shadow ? outer.attachShadow({ mode: 'open' }) : outer;
  const scene = document.createElement('div');
  const host = document.createElement('div');
  const overlayMount = document.createElement('div');
  overlayMount.dataset.repairOverlayMount = '';
  scene.append(host, overlayMount);
  tree.append(scene);
  if (options.styleText) {
    const style = document.createElement('style');
    style.textContent = options.styleText;
    tree.prepend(style);
  }
  if (scenario !== 'tooltip-lifecycle') document.body.append(outer);
  const releaseDestination =
    options.portalDestination === 'scene'
      ? registerWebPortalDestination(scene, overlayMount)
      : () => {};
  const adapt =
    runtime === 'react'
      ? createReactAdapter({ ...React, createPortal })
      : runtime === 'vue'
        ? createVueAdapter(Vue)
        : runtime === 'vue2'
          ? createVue2Adapter({
              extend: Vue2.extend.bind(Vue2),
              nextTick: Vue2.nextTick.bind(Vue2),
              set: Vue2.set.bind(Vue2),
              delete: Vue2.delete.bind(Vue2),
            } as unknown as Vue2Runtime)
          : null;
  const componentFor = (node: Node): any => {
    if (!node.proto) return node.tag;
    if (!components.has(node.proto)) components.set(node.proto, adapt!(node.proto));
    return components.get(node.proto);
  };
  let redraw = () => {};
  let disposeOwner = () => {};
  let vue2App: InstanceType<typeof Vue2> | null = null;
  const settleOwner = async () => {
    if (runtime === 'vue') await Vue.nextTick();
    if (runtime === 'vue2') await Vue2.nextTick();
    await settle();
  };
  const elementFor = (key: string) =>
    scene.querySelector<HTMLElement>(`[data-demo-ref="${key}"]`) ??
    document.querySelector<HTMLElement>(`[data-demo-ref="${key}"]`);
  const wireWcEvents = (element: HTMLElement, node: Node) => {
    for (const [event, listener] of Object.entries(node.events ?? {}))
      element.addEventListener(event, (e) => {
        if (e instanceof CustomEvent) listener(e.detail);
      });
  };
  const renderNode = (node: Node | string, h?: any): any => {
    if (typeof node === 'string') return node;
    definitions.set(node.key, node);
    if (runtime !== 'wc') {
      if (node.key === 'button' && !buttonPresent) return null;
      const props: Record<string, any> = {
        ...node.props,
        key: node.key === 'button' ? `button-${buttonMount}` : node.key,
        'data-demo-ref': node.key,
      };
      if (node.associations) props.instanceAssociations = node.associations;
      for (const [event, listener] of Object.entries(node.events ?? {}))
        props[`on${event[0].toUpperCase()}${event.slice(1)}`] = listener;
      const component = componentFor(node);
      if (runtime === 'react') {
        if (node.proto) {
          if (!refs.has(node.key)) refs.set(node.key, React.createRef());
          props.ref = refs.get(node.key);
        }
        return React.createElement(
          component,
          props,
          ...(node.children ?? []).map((n) => renderNode(n))
        );
      }
      if (runtime === 'vue') {
        if (node.proto)
          props.ref = (handle: unknown) =>
            handle ? handles.set(node.key, handle) : handles.delete(node.key);
        const children = () => (node.children ?? []).map((child) => renderNode(child));
        return Vue.h(component, props, node.proto ? children : children());
      }
      return h(
        component,
        {
          key: props.key,
          ref: node.proto ? node.key : undefined,
          attrs: { ...node.props, 'data-demo-ref': node.key },
          props: { instanceAssociations: node.associations },
          on: node.events,
          style: node.props?.style,
        },
        (node.children ?? []).map((child) => renderNode(child, h))
      );
    }
    if (node.proto && !customElements.get(node.proto.name)) AdaptToWebComponent(node.proto);
    const element = document.createElement(node.proto?.name ?? node.tag!);
    element.setAttribute('data-demo-ref', node.key);
    hosts.set(node.key, element);
    if (node.proto) {
      const { hostStyle, ...props } = node.props ?? {};
      setElementProps(element, props);
      if (hostStyle) Object.assign(element.style, hostStyle);
      if (node.associations) setElementAssociations(element, node.associations);
      wireWcEvents(element, node);
    } else if (node.props?.style) Object.assign(element.style, node.props.style);
    element.append(...(node.children ?? []).map((child) => renderNode(child)));
    return element;
  };
  if (runtime === 'react') {
    const root = createRoot(host);
    redraw = () => flushSync(() => root.render(nodes.map((node) => renderNode(node))));
    disposeOwner = () => flushSync(() => root.unmount());
    redraw();
  } else if (runtime === 'vue') {
    const revision = Vue.ref(0);
    const app = Vue.createApp({
      render() {
        revision.value;
        return Vue.h(
          'div',
          nodes.map((node) => renderNode(node))
        );
      },
    });
    redraw = () => {
      revision.value++;
    };
    disposeOwner = () => app.unmount();
    app.mount(host);
  } else if (runtime === 'vue2') {
    vue2App = new Vue2({
      render: (h: any) =>
        h(
          'div',
          nodes.map((node) => renderNode(node, h))
        ),
    });
    vue2App.$mount();
    host.append(vue2App.$el);
    redraw = () => vue2App!.$forceUpdate();
    disposeOwner = () => vue2App!.$destroy();
  } else {
    host.append(...nodes.map((node) => renderNode(node)));
  }
  await settleOwner();
  return {
    counts,
    element: elementFor,
    boundary() {
      const trigger = elementFor(scenario === 'tooltip-standalone' ? 'trigger' : 'button');
      const content = elementFor('content');
      return {
        shadow: trigger?.getRootNode() instanceof ShadowRoot,
        sameTree: trigger?.getRootNode() === content?.getRootNode(),
        contentInDestination: Boolean(content && overlayMount.contains(content)),
        outerConnected: outer.isConnected,
      };
    },
    async set(key: string, props: Record<string, unknown>) {
      definitions.get(key)!.props = props;
      if (runtime === 'wc') setElementProps(hosts.get(key)!, props);
      else redraw();
      await settleOwner();
    },
    exposes(key: string) {
      const handle =
        runtime === 'react'
          ? refs.get(key)!.current
          : runtime === 'vue'
            ? handles.get(key)
            : runtime === 'vue2'
              ? vue2App!.$refs[key]
              : hosts.get(key);
      return (handle as any).getExposes();
    },
    // #1455 lifecycle acceptance: the mounted host stays detached until attach(),
    // and the wrapped control can be removed, re-inserted, remounted (element
    // replacement), given a negative tabindex or hidden while the wiring lives.
    lifecycle:
      scenario === 'tooltip-lifecycle'
        ? {
            async attach() {
              document.body.append(outer);
              // The React adapter re-advertises its focus target only on a
              // committed render, so inserting the detached host needs one
              // re-render for the focusable projection (tabindex) to land.
              redraw();
              await settleOwner();
            },
            async remove() {
              if (runtime !== 'wc') {
                buttonPresent = false;
                redraw();
              } else {
                hosts.get('button')?.remove();
              }
              await settleOwner();
            },
            async insert() {
              if (runtime !== 'wc') {
                buttonPresent = true;
                redraw();
              } else {
                const button = hosts.get('button');
                const rootElement = hosts.get('root');
                if (button && rootElement) rootElement.insertBefore(button, rootElement.firstChild);
              }
              await settleOwner();
            },
            async remount() {
              buttonMount += 1;
              if (runtime !== 'wc') {
                redraw();
              } else {
                const buttonNode = definitions.get('button');
                const previous = hosts.get('button');
                if (buttonNode?.proto && previous) {
                  const replacement = renderNode(buttonNode);
                  previous.replaceWith(replacement);
                }
              }
              await settleOwner();
            },
            async setTabindex(value: number) {
              elementFor('button')?.setAttribute('tabindex', String(value));
              await settle();
            },
            async setHidden(hidden: boolean) {
              const button = elementFor('button');
              if (!button) return;
              // Author display rules outrank the UA [hidden] rule, so pair the
              // semantic hidden attribute with an inline display to actually
              // remove the control from layout and the tab order.
              if (hidden) {
                button.setAttribute('hidden', '');
                button.style.display = 'none';
              } else {
                button.removeAttribute('hidden');
                button.style.display = '';
              }
              await settle();
            },
          }
        : null,
    async dispose() {
      disposeOwner();
      outer.remove();
      await settleOwner();
      releaseDestination();
    },
  };
}
