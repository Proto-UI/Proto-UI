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
          a11yLabel: 'Share project confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-trigger',
            props: { variant: 'outline' },
            children: ['Share Project'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-alert-dialog-header',
                props: { align: 'center' },
                children: [
                  {
                    kind: 'box',
                    className:
                      'mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-base font-semibold text-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: [
                      { kind: 'proto', prototypeId: 'lucide-plus-icon', props: { size: 20 } },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-title',
                    children: ['Share this project?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-description',
                    children: ['Anyone with the link will be able to view and edit this project.'],
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
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-action',
                    children: ['Share'],
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
