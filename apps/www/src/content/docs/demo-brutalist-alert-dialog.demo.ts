import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-alert-dialog-root',
        props: {
          a11yLabel: 'Delete account confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-alert-dialog-trigger',
            children: ['Open'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-alert-dialog-mask',
            ref: 'mask',
            previewTheme: 'portal',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-alert-dialog-content',
            ref: 'content',
            previewTheme: 'portal',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-alert-dialog-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-title',
                    children: ['Are you absolutely sure?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-description',
                    children: [
                      'This action cannot be undone. This will permanently delete your account and remove your data from our servers.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-alert-dialog-footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-cancel',
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-action',
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
