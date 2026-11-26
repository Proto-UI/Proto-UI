import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const VARIANTS = [
  {
    key: 'default',
    label: 'Warning',
    variant: 'default',
    politeness: 'polite',
    title: 'Warning!',
    description: 'Best check your settings before publishing.',
  },
  {
    key: 'info',
    label: 'Info',
    variant: 'info',
    politeness: 'polite',
    title: 'Heads up!',
    description: 'Arrive 10 minutes before the session starts.',
  },
  {
    key: 'success',
    label: 'Success',
    variant: 'success',
    politeness: 'polite',
    title: 'Well done!',
    description: 'Your changes have been saved successfully.',
  },
  {
    key: 'error',
    label: 'Error',
    variant: 'error',
    politeness: 'assertive',
    title: 'Oh snap!',
    description: 'Unable to publish changes. Please try again.',
  },
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 flex flex-wrap items-center justify-center gap-2 p-4',
    children: [
      ...VARIANTS.map((item) => ({
        kind: 'proto' as const,
        prototypeId: 'bootstrap-2-3-2-button',
        ref: `btn-${item.key}`,
        children: [item.label],
      })),
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toast-viewport',
        previewTheme: 'portal',
        ref: 'viewport',
        props: {
          a11yLabel: 'Alert notifications',
        },
        children: VARIANTS.map((item) => ({
          kind: 'proto' as const,
          prototypeId: 'bootstrap-2-3-2-toast-root',
          ref: `toast-${item.key}`,
          props: {
            defaultOpen: false,
            duration: 5000,
            variant: item.variant,
            politeness: item.politeness,
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
              children: [item.title],
            },
            {
              kind: 'proto',
              prototypeId: 'bootstrap-2-3-2-toast-description',
              children: [item.description],
            },
          ],
        })),
      },
    ],
  },
  setup({ api }) {
    for (const item of VARIANTS) {
      api.setProps(`btn-${item.key}`, {
        onClick: () => {
          const openToast = api.getExposes(`toast-${item.key}`)?.openToast;
          if (typeof openToast === 'function') openToast();
        },
      });
    }
  },
} satisfies DemoSpec;
