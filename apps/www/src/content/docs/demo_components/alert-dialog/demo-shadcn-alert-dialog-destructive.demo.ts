import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-alert-dialog-root',
        props: {
          a11yLabel: 'Delete chat confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-trigger',
            props: { variant: 'destructive' },
            children: ['Delete Chat'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-content',
            props: { size: 'sm' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-alert-dialog-header',
                props: { align: 'center' },
                children: [
                  {
                    kind: 'box',
                    className:
                      'mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-base font-semibold text-destructive',
                    attrs: { 'aria-hidden': 'true' },
                    children: ['!'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-title',
                    children: ['Delete chat?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-description',
                    children: [
                      'This will permanently delete this chat conversation and remove any memories saved during this chat.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-alert-dialog-footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-cancel',
                    props: { variant: 'outline' },
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-action',
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
} satisfies DemoSpec);
