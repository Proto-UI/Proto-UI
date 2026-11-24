import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl', lang: 'ar' },
    className:
      'mx-auto w-full max-w-sm rounded-xl border border-border bg-card p-4 text-start shadow-xs',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-collapsible-root',
        props: { defaultOpen: false },
        children: [
          {
            kind: 'box',
            className: 'flex items-center justify-between gap-4 px-1',
            children: [
              {
                kind: 'box',
                className: 'text-sm font-semibold text-foreground',
                children: ['الطلب #4189'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-collapsible-trigger',
                props: { variant: 'ghost', size: 'icon' },
                children: ['↕'],
              },
            ],
          },
          {
            kind: 'box',
            className:
              'flex items-center justify-between rounded-lg border border-border bg-background px-3.5 py-2 text-sm',
            children: [
              {
                kind: 'box',
                className: 'text-muted-foreground',
                children: ['الحالة'],
              },
              {
                kind: 'box',
                className: 'font-medium text-foreground',
                children: ['تم الشحن'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-collapsible-content',
            props: { variant: 'plain' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-2 text-start',
                children: [
                  {
                    kind: 'box',
                    className: 'rounded-lg border border-border bg-background px-3.5 py-2 text-sm',
                    children: [
                      {
                        kind: 'box',
                        className: 'font-medium text-foreground',
                        children: ['عنوان الشحن'],
                      },
                      {
                        kind: 'box',
                        className: 'text-muted-foreground',
                        children: ['100 Market St, San Francisco'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'rounded-lg border border-border bg-background px-3.5 py-2 text-sm',
                    children: [
                      {
                        kind: 'box',
                        className: 'font-medium text-foreground',
                        children: ['العناصر'],
                      },
                      {
                        kind: 'box',
                        className: 'text-muted-foreground',
                        children: ['2x سماعات الاستوديو'],
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
} satisfies DemoSpec);
