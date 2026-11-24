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
        children: ['Show Toast'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toast-viewport',
        ref: 'viewport',
        props: {
          a11yLabel: 'Notifications',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-toast-root',
            ref: 'root',
            props: {
              defaultOpen: false,
              duration: 5000,
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
                children: ['Event has been created'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-description',
                children: ['Sunday, December 03, 2023 at 9:00 AM'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-toast-action',
                ref: 'action',
                props: {
                  a11yLabel: 'Undo event creation',
                },
                children: ['Undo'],
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
} satisfies DemoSpec;
