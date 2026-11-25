import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 w-full flex items-center justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        ref: 'trigger',
        children: ['Schedule Meeting'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-toast-viewport',
        previewTheme: 'portal',
        ref: 'viewport',
        props: {
          a11yLabel: 'Action notifications',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toast-root',
            ref: 'scheduled',
            props: {
              defaultOpen: false,
              duration: 6000,
              prominence: 'prominent',
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
                        prototypeId: 'liquid-glass-toast-title',
                        children: ['Meeting scheduled'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-toast-description',
                        children: ['Design review set for Tuesday at 2:00 PM.'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-toast-action',
                    ref: 'undo',
                    props: {
                      a11yLabel: 'Undo meeting schedule',
                    },
                    children: ['Undo'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toast-root',
            ref: 'cancelled',
            props: {
              defaultOpen: false,
              duration: 3500,
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
                        prototypeId: 'liquid-glass-toast-title',
                        children: ['Schedule cancelled'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-toast-description',
                        children: ['The calendar invite was not sent.'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-toast-close',
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
  setup({ api }) {
    api.setProps('trigger', {
      onClick: () => {
        const closeCancelled = api.getExposes('cancelled')?.close;
        if (typeof closeCancelled === 'function') closeCancelled('programmatic');
        const openScheduled = api.getExposes('scheduled')?.openToast;
        if (typeof openScheduled === 'function') openScheduled();
      },
    });
    api.setProps('undo', {
      onAction: () => {
        const openCancelled = api.getExposes('cancelled')?.openToast;
        if (typeof openCancelled === 'function') openCancelled();
      },
    });
  },
} satisfies DemoSpec;
