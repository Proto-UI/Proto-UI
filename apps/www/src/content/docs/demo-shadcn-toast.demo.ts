import { withShadcnRheaDemo } from './shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        ref: 'trigger',
        props: {
          variant: 'outline',
        },
        children: ['Show Toast'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toast-viewport',
        ref: 'viewport',
        props: {
          a11yLabel: 'Notifications',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-toast-root',
            ref: 'root',
            props: {
              defaultOpen: false,
              duration: 5000,
            },
            children: [
              {
                kind: 'box',
                className: 'flex items-start justify-between gap-4 min-w-0',
                children: [
                  {
                    kind: 'box',
                    className: 'grid gap-1 min-w-0',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-toast-title',
                        children: ['Event has been created'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-toast-description',
                        children: ['Sunday, December 03, 2023 at 9:00 AM'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'flex items-center gap-2 shrink-0',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-toast-action',
                        ref: 'action',
                        props: {
                          a11yLabel: 'Undo event creation',
                        },
                        children: ['Undo'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-toast-close',
                        children: ['Dismiss'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ api }) {
    api.setProps('trigger', {
      onClick: () => {
        const openToast = api.getExposes('root')?.openToast;
        if (typeof openToast === 'function') openToast();
      },
    });
    api.setProps('action', {
      onAction: () => {
        const close = api.getExposes('root')?.close;
        if (typeof close === 'function') close('action');
      },
    });
  },
} satisfies DemoSpec);
