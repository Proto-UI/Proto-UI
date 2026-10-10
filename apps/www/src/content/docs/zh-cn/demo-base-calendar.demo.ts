import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';
export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'base-calendar-root',
    props: { defaultMonth: '2026-10', defaultValue: '2026-10-10' },
    className: 'grid max-w-sm gap-2 p-3',
    children: [
      {
        kind: 'box',
        tag: 'div',
        className: 'flex items-center justify-between gap-2',
        children: [
          { kind: 'proto', prototypeId: 'base-calendar-previous', children: ['Previous month'] },
          { kind: 'proto', prototypeId: 'base-calendar-heading' },
          { kind: 'proto', prototypeId: 'base-calendar-next', children: ['Next month'] },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'base-calendar-grid',
        children: Array.from({ length: 6 }, (_, row) => ({
          kind: 'proto' as const,
          prototypeId: 'base-calendar-row',
          className: 'grid grid-cols-7 gap-1',
          children: Array.from({ length: 7 }, (_, column) => ({
            kind: 'proto' as const,
            prototypeId: 'base-calendar-day',
            props: { offset: row * 7 + column },
            className: 'flex min-h-9 items-center justify-center',
          })),
        })),
      },
    ],
  },
} satisfies DemoSpec;
