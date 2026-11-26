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
          variant: 'regular',
          defaultValue: ['week'],
          a11yLabel: 'Calendar range regular',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'day' },
            children: ['Day'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'week' },
            children: ['Week'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'month' },
            children: ['Month'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toggle-group-root',
        props: {
          variant: 'prominent',
          defaultValue: ['week'],
          a11yLabel: 'Calendar range prominent',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'day' },
            children: ['Day'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'week' },
            children: ['Week'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle-group-item',
            props: { value: 'month' },
            children: ['Month'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
