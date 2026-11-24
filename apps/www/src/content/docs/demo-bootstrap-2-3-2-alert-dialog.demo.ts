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
          a11yLabel: 'Delete account confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-trigger',
            children: ['Show Dialog'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-alert-dialog-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-alert-dialog-title',
                children: ['Are you absolutely sure?'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-alert-dialog-description',
                children: [
                  'This action cannot be undone. This will permanently delete your account and remove your data from our servers.',
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
                    children: ['Continue'],
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
