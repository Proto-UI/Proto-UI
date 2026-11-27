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
          a11yLabel: 'Share project confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-alert-dialog-trigger',
            children: ['Share Project'],
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
                    kind: 'box',
                    className:
                      'mb-1 inline-flex size-10 items-center justify-center rounded-base border-2 border-black bg-secondary-background text-base font-bold text-foreground',
                    attrs: { 'aria-hidden': 'true' },
                    children: [
                      { kind: 'proto', prototypeId: 'lucide-plus-icon', props: { size: 20 } },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-title',
                    children: ['Share this project?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-alert-dialog-description',
                    children: ['Anyone with the link will be able to view and edit this project.'],
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
} satisfies DemoSpec;
