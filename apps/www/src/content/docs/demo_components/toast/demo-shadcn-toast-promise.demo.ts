import { withShadcnRheaDemo } from '../../shadcn-demo-style';
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
        children: ['Create Event'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toast-viewport',
        previewTheme: 'portal',
        ref: 'viewport',
        props: {
          a11yLabel: 'Async notifications',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-toast-root',
            ref: 'loading',
            props: {
              defaultOpen: false,
              duration: 0,
              type: 'loading',
            },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1 min-w-0',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-toast-title',
                    children: ['Creating event…'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-toast-description',
                    children: ['Syncing calendar details with participants.'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toast-root',
            ref: 'done',
            props: {
              defaultOpen: false,
              duration: 4000,
              type: 'success',
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
                        children: ['Event created'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-toast-description',
                        children: ['Invitations have been sent to all attendees.'],
                      },
                    ],
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
  setup({ api }) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    api.setProps('trigger', {
      onClick: () => {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        const closeDone = api.getExposes('done')?.close;
        if (typeof closeDone === 'function') closeDone('programmatic');
        const openLoading = api.getExposes('loading')?.openToast;
        if (typeof openLoading === 'function') openLoading();
        timer = setTimeout(() => {
          timer = null;
          const closeLoading = api.getExposes('loading')?.close;
          if (typeof closeLoading === 'function') closeLoading('programmatic');
          const openDone = api.getExposes('done')?.openToast;
          if (typeof openDone === 'function') openDone();
        }, 1500);
      },
    });
    return () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
  },
} satisfies DemoSpec);
