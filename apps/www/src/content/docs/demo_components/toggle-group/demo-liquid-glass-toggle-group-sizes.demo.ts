import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toggle-group-root',
        props: {
          size: 'sm',
          defaultValue: ['top'],
          a11yLabel: 'Small position selector',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'top' },
            children: ['Top'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'bottom' },
            children: ['Bottom'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'left' },
            children: ['Left'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'right' },
            children: ['Right'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toggle-group-root',
        props: {
          size: 'default',
          defaultValue: ['top'],
          a11yLabel: 'Default position selector',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'top' },
            children: ['Top'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'bottom' },
            children: ['Bottom'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'left' },
            children: ['Left'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'right' },
            children: ['Right'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toggle-group-root',
        props: {
          size: 'lg',
          defaultValue: ['top'],
          a11yLabel: 'Large position selector',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'top' },
            children: ['Top'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'bottom' },
            children: ['Bottom'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'left' },
            children: ['Left'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'right' },
            children: ['Right'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
