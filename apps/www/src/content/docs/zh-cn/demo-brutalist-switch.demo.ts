import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const LABEL_CLASS = 'text-sm font-medium leading-none text-foreground select-none';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-x-6 gap-y-4',
    children: [
      {
        kind: 'box',
        className: 'inline-flex items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-switch-root',
            ref: 'emailAlertsSwitch',
            props: {},
            children: [
              { kind: 'proto', prototypeId: 'brutalist-switch-thumb' },
              { kind: 'box', className: 'sr-only', children: ['Airplane Mode'] },
            ],
          },
          {
            kind: 'box',
            tag: 'span',
            className: LABEL_CLASS,
            children: ['Airplane Mode'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'inline-flex items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-switch-root',
            ref: 'releaseAlertsSwitch',
            props: { defaultChecked: true },
            children: [
              { kind: 'proto', prototypeId: 'brutalist-switch-thumb' },
              { kind: 'box', className: 'sr-only', children: ['Release alerts'] },
            ],
          },
          {
            kind: 'box',
            tag: 'span',
            className: LABEL_CLASS,
            children: ['Release alerts'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'inline-flex items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-switch-root',
            ref: 'archivedAlertsSwitch',
            props: { disabled: true },
            children: [
              { kind: 'proto', prototypeId: 'brutalist-switch-thumb' },
              { kind: 'box', className: 'sr-only', children: ['Archived alerts'] },
            ],
          },
          {
            kind: 'box',
            tag: 'span',
            className: 'text-sm font-medium leading-none text-muted-foreground select-none',
            children: ['Archived alerts'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
