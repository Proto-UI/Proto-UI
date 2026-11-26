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
          a11yLabel: 'Delete chat confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-trigger',
            props: { variant: 'destructive' },
            children: ['Delete Chat'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-alert-dialog-content',
            props: { size: 'sm' },
            children: [
              {
                kind: 'box',
                className: 'grid place-items-center gap-1.5 text-center',
                children: [
                  {
                    kind: 'box',
                    className:
                      'mb-1 inline-flex size-10 items-center justify-center rounded-full bg-destructive/15 text-base font-semibold text-destructive',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['!'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-title',
                    children: ['Delete chat?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-description',
                    children: [
                      'This will permanently delete this chat conversation and remove any saved memories.',
                    ],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex flex-wrap-reverse items-center justify-center gap-2.5 pt-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-cancel',
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-alert-dialog-action',
                    props: { variant: 'destructive' },
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
