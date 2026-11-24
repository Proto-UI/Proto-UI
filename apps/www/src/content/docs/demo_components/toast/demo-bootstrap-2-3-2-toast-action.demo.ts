import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        ref: 'trigger',
        children: ['Schedule Meeting'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toast-viewport',
        props: {
          a11yLabel: 'Action notifications',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toast-root',
            ref: 'scheduled',
            props: {
              defaultOpen: false,
              duration: 6000,
              variant: 'info',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-close',
                children: ['×'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-title',
                children: ['Meeting scheduled'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-description',
                children: ['Design review set for Tuesday at 2:00 PM.'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-action',
                ref: 'undo',
                props: {
                  a11yLabel: 'Undo meeting schedule',
                },
                children: ['Undo'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toast-root',
            ref: 'cancelled',
            props: {
              defaultOpen: false,
              duration: 3500,
              variant: 'default',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-close',
                children: ['×'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-title',
                children: ['Schedule cancelled'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-description',
                children: ['The calendar invite was not sent.'],
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
