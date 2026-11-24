import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-alert-dialog-root',
        props: {
          a11yLabel: 'Delete chat confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-trigger',
            props: { variant: 'danger' },
            children: ['Delete Chat'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-content',
            props: { size: 'sm' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-alert-dialog-title',
                children: ['Delete chat?'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-alert-dialog-description',
                children: [
                  'This will permanently delete this chat conversation and remove any saved memories.',
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-alert-dialog-footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-alert-dialog-cancel',
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-alert-dialog-action',
                    props: { variant: 'danger' },
                    children: ['Delete'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
