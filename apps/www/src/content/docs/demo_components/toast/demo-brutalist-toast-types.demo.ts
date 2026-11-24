import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const STATUS_ITEMS = [
  {
    key: 'default',
    label: 'Default',
    type: 'default',
    politeness: 'polite',
    title: 'Event has been created',
    description: 'Sunday, December 03, 2023 at 9:00 AM',
  },
  {
    key: 'success',
    label: 'Success',
    type: 'success',
    politeness: 'polite',
    title: 'Saved',
    description: 'Event has been created.',
  },
  {
    key: 'info',
    label: 'Info',
    type: 'info',
    politeness: 'polite',
    title: 'Reminder',
    description: 'Arrive 10 minutes before the session starts.',
  },
  {
    key: 'warning',
    label: 'Warning',
    type: 'warning',
    politeness: 'polite',
    title: 'Schedule check',
    description: 'Event start time cannot be earlier than 8:00 AM.',
  },
  {
    key: 'error',
    label: 'Error',
    type: 'error',
    politeness: 'assertive',
    title: 'Request failed',
    description: 'Event could not be created.',
  },
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex flex-wrap items-center justify-center gap-2 p-4',
    children: [
      ...STATUS_ITEMS.map((item) => ({
        kind: 'proto' as const,
        prototypeId: 'brutalist-button',
        ref: `btn-${item.key}`,
        children: [item.label],
      })),
      {
        kind: 'proto',
        prototypeId: 'brutalist-toast-viewport',
        props: {
          a11yLabel: 'Status notifications',
        },
        children: STATUS_ITEMS.map((item) => ({
          kind: 'proto' as const,
          prototypeId: 'brutalist-toast-root',
          ref: `toast-${item.key}`,
          props: {
            defaultOpen: false,
            duration: 5000,
            type: item.type,
            politeness: item.politeness,
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
                      prototypeId: 'brutalist-toast-title',
                      children: [item.title],
                    },
                    {
                      kind: 'proto',
                      prototypeId: 'brutalist-toast-description',
                      children: [item.description],
                    },
                  ],
                },
                {
                  kind: 'proto',
                  prototypeId: 'brutalist-toast-close',
                  children: ['Dismiss'],
                },
              ],
            },
          ],
        })),
      },
    ],
  },
  setup({ api }) {
    for (const item of STATUS_ITEMS) {
      api.setProps(`btn-${item.key}`, {
        onClick: () => {
          const openToast = api.getExposes(`toast-${item.key}`)?.openToast;
          if (typeof openToast === 'function') openToast();
        },
      });
    }
  },
} satisfies DemoSpec;
