import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal, flushSync } from 'react-dom';
import { createControlLabelRef, definePrototype, type Prototype } from '@proto.ui/core';
import { createReactAdapter } from '@proto.ui/adapter-react';
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
    tooltipContent: shadcnTooltip.ShadcnTooltipContent,
    ...shadcnDrawer,
  },
  brutalist: {
    button: brutalistButton,
    toggle: brutalistToggle,
    label: brutalistLabel,
    ...brutalistGroup,
    tooltipRoot: brutalistTooltip.BrutalistTooltipRoot,
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

/** Real source prototypes and real React/WC adapters; no simulated focus or geometry. */
export async function mount(
  scenario: 'labels' | 'tooltip' | 'drawer',
  familyName: keyof typeof families,
  runtime: 'react' | 'wc'
) {
  const family = families[familyName];
  const counts = { click: 0, active: [] as unknown[], value: [] as unknown[] };
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
  } else if (scenario === 'tooltip') {
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
    nodes = [
      { key: 'before', tag: 'button', children: ['Before'] },
      {
        key: 'root',
        proto: family.tooltipRoot,
        props: { openDelay: 0, closeDelay: 0 },
        children: [
          {
            key: 'button',
            proto: tooltipButton,
            events: { click: () => counts.click++ },
            children: ['Save'],
          },
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
  const adapt = createReactAdapter({ ...React, createPortal });
  const components = new Map<Prototype<any, any>, any>();
  const host = document.createElement('div');
  document.body.append(host);
  const root = runtime === 'react' ? createRoot(host) : null;
  const renderNode = (node: Node | string): any => {
    if (typeof node === 'string') return node;
    definitions.set(node.key, node);
    if (runtime === 'react') {
      const props: Record<string, any> = {
        ...node.props,
        key: node.key,
        'data-demo-ref': node.key,
      };
      if (node.associations) props.instanceAssociations = node.associations;
      for (const [event, listener] of Object.entries(node.events ?? {}))
        props[`on${event[0].toUpperCase()}${event.slice(1)}`] = listener;
      let component: any = node.tag;
      if (node.proto) {
        if (!components.has(node.proto)) components.set(node.proto, adapt(node.proto));
        component = components.get(node.proto);
        if (!refs.has(node.key)) refs.set(node.key, React.createRef());
        props.ref = refs.get(node.key);
      }
      return React.createElement(component, props, ...(node.children ?? []).map(renderNode));
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
      for (const [event, listener] of Object.entries(node.events ?? {}))
        element.addEventListener(event, (e) => {
          if (e instanceof CustomEvent) listener(e.detail);
        });
    } else if (node.props?.style) Object.assign(element.style, node.props.style);
    element.append(...(node.children ?? []).map(renderNode));
    return element;
  };
  if (root) flushSync(() => root.render(nodes.map(renderNode)));
  else host.append(...nodes.map(renderNode));
  await settle();
  return {
    counts,
    async set(key: string, props: Record<string, unknown>) {
      definitions.get(key)!.props = props;
      if (root) flushSync(() => root.render(nodes.map(renderNode)));
      else setElementProps(hosts.get(key)!, props);
      await settle();
    },
    exposes(key: string) {
      return runtime === 'react'
        ? refs.get(key)!.current.getExposes()
        : (hosts.get(key) as any).getExposes();
    },
    async dispose() {
      if (root) flushSync(() => root.unmount());
      host.remove();
      await settle();
    },
  };
}
