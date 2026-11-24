import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col items-start gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle-group-root',
        props: {
          size: 'sm',
          variant: 'outline',
          defaultValue: ['top'],
          a11yLabel: 'Small position selector',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'top' },
            children: ['Top'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'bottom' },
            children: ['Bottom'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'left' },
            children: ['Left'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'right' },
            children: ['Right'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle-group-root',
        props: {
          size: 'default',
          variant: 'outline',
          defaultValue: ['top'],
          a11yLabel: 'Default position selector',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'top' },
            children: ['Top'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'bottom' },
            children: ['Bottom'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'left' },
            children: ['Left'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'right' },
            children: ['Right'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle-group-root',
        props: {
          size: 'lg',
          variant: 'outline',
          defaultValue: ['top'],
          a11yLabel: 'Large position selector',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'top' },
            children: ['Top'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'bottom' },
            children: ['Bottom'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'left' },
            children: ['Left'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'right' },
            children: ['Right'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
