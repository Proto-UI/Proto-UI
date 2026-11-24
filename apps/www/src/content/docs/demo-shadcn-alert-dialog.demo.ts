import { withShadcnRheaDemo } from './shadcn-demo-style';
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
          a11yLabel: 'Delete account confirmation',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-trigger',
            props: { variant: 'outline' },
            children: ['Show Dialog'],
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
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-title',
                    children: ['Are you absolutely sure?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-description',
                    children: [
                      'This action cannot be undone. This will permanently delete your account and remove your data from our servers.',
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
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-action',
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
} satisfies DemoSpec);
