import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

function fileRow(name: string): DemoNode {
  return {
    kind: 'box',
    className: 'rounded-md px-2.5 py-1 text-sm text-muted-foreground',
    children: [`• ${name}`],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto grid w-full max-w-xs gap-1.5 rounded-xl border border-border bg-card p-3 shadow-xs',
    children: [
      {
        kind: 'box',
        className: 'px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        children: ['Explorer'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-collapsible-root',
        props: { defaultOpen: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-collapsible-trigger',
            props: { variant: 'ghost', size: 'sm' },
            children: ['▸ components'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-collapsible-content',
            props: { variant: 'plain' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1 pl-4',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-collapsible-root',
                    props: { defaultOpen: true },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-collapsible-trigger',
                        props: { variant: 'ghost', size: 'sm' },
                        children: ['▸ ui'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-collapsible-content',
                        props: { variant: 'plain' },
                        children: [
                          {
                            kind: 'box',
                            className: 'grid gap-0.5 pl-4',
                            children: [
                              fileRow('button.tsx'),
                              fileRow('collapsible.tsx'),
                              fileRow('dialog.tsx'),
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  fileRow('login-form.tsx'),
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-collapsible-root',
        props: { defaultOpen: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-collapsible-trigger',
            props: { variant: 'ghost', size: 'sm' },
            children: ['▸ lib'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-collapsible-content',
            props: { variant: 'plain' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-0.5 pl-4',
                children: [fileRow('utils.ts'), fileRow('api.ts')],
              },
            ],
          },
        ],
      },
      fileRow('package.json'),
    ],
  },
} satisfies DemoSpec);
