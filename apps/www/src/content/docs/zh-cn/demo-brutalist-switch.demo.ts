import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const LABEL_CLASS =
  'absolute left-full top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap font-mono text-sm font-bold text-foreground';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-x-5 gap-y-6',
    children: [
      {
        kind: 'box',
        className: 'inline-flex w-44',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-switch-root',
            className: 'relative',
            ref: 'emailAlertsSwitch',
            props: {},
            children: [
              { kind: 'proto', prototypeId: 'brutalist-switch-thumb' },
              {
                kind: 'box',
                className: LABEL_CLASS,
                children: ['Email alerts'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'inline-flex w-44',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-switch-root',
            className: 'relative',
            ref: 'releaseAlertsSwitch',
            props: { defaultChecked: true },
            children: [
              { kind: 'proto', prototypeId: 'brutalist-switch-thumb' },
              {
                kind: 'box',
                className: LABEL_CLASS,
                children: ['Release alerts'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'inline-flex w-44',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-switch-root',
            className: 'relative',
            ref: 'archivedAlertsSwitch',
            props: { disabled: true },
            children: [
              { kind: 'proto', prototypeId: 'brutalist-switch-thumb' },
              {
                kind: 'box',
                className: LABEL_CLASS,
                children: ['Archived alerts'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
