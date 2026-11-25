import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { setToastCopy } from './toast-copy';

const VARIANTS = [
  ['success', 'Success', 'Deployment succeeded', 'Release 0.3.0 is live in production.'],
  ['info', 'Info', 'New workspace update', 'Two new adapters are ready to install.'],
  ['warning', 'Warning', 'Approaching rate limit', '85% of your hourly quota has been used.'],
  ['error', 'Error', 'Payment failed', 'Card authorization was declined by the issuer.'],
  [
    'loading',
    'Loading',
    'Uploading artifacts...',
    'Persistent until resolved or dismissed programmatically.',
  ],
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: VARIANTS.map(([kind, label]) => ({
          kind: 'proto' as const,
          prototypeId: 'shadcn-button',
          ref: `btn-${kind}`,
          props: { variant: 'outline', size: 'sm' },
          children: [label],
        })),
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toast-viewport',
        ref: 'viewport',
        props: { a11yLabel: 'Rich color notifications', position: 'bottom-right', expand: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-toast-root',
            ref: 'toast',
            props: { defaultOpen: false, type: 'success', richColors: true },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-toast-title',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'title-copy',
                    dynamicChildren: { prototypeIds: [] },
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-toast-description',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    ref: 'description-copy',
                    dynamicChildren: { prototypeIds: [] },
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex items-center gap-2 pt-1',
                children: [
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
    let revision = 0;
    for (const [kind, _label, title, desc] of VARIANTS) {
      api.setProps(`btn-${kind}`, {
        async onClick() {
          const request = ++revision;
          const committed = await setToastCopy(api, title, desc);
          if (!committed || request !== revision) return;
          api.setProps('toast', { type: kind, richColors: true });
          api.call('toast', 'openToast');
        },
      });
    }
    return () => {
      revision++;
    };
  },
} satisfies DemoSpec);
