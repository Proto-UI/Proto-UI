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
          a11yLabel: 'Delete chat confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-alert-dialog-trigger',
            children: ['Delete Chat'],
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
            props: { size: 'sm' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-alert-dialog-header',
                children: [
                  {
                    kind: 'box',
                    className:
                      'mb-1 inline-flex size-10 items-center justify-center rounded-base border-2 border-black bg-destructive/20 text-base font-bold text-destructive',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['!'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-title',
                    children: ['Delete chat?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-description',
                    children: [
                      'This will permanently delete this chat conversation and remove any saved memories.',
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
