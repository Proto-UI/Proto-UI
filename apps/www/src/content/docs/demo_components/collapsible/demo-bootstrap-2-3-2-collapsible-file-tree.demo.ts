import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto grid w-full max-w-md gap-2 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-collapsible-root',
        props: { defaultOpen: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-collapsible-trigger',
            children: ['components/'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-collapsible-content',
            children: [
              {
                kind: 'box',
                className: 'grid gap-2',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-collapsible-root',
                    props: { defaultOpen: false },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-collapsible-trigger',
                        children: ['ui/'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-collapsible-content',
                        children: ['button.tsx · collapsible.tsx · dialog.tsx'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'text-xs text-muted-foreground',
                    children: ['login-form.tsx · register-form.tsx'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-collapsible-root',
        props: { defaultOpen: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-collapsible-trigger',
            children: ['lib/'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-collapsible-content',
            children: ['utils.ts · api.ts'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
