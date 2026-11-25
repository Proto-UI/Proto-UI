import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-alert-dialog-root',
        props: {
          a11yLabel: 'Delete account confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-trigger',
            children: ['Show Dialog'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-content',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1.5',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-title',
                    children: ['Are you absolutely sure?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-description',
                    children: [
                      'This action cannot be undone. This will permanently delete your account and remove your data from our servers.',
                    ],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-cancel',
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-action',
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
