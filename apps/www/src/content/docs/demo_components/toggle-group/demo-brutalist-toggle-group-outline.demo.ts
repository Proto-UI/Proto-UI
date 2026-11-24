import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-toggle-group-root',
        props: {
          variant: 'outline',
          defaultValue: ['all'],
          a11yLabel: 'Message filter',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'all' },
            children: ['All'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'missed' },
            children: ['Missed'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-toggle-group-item',
            props: { value: 'archived' },
            children: ['Archived'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
