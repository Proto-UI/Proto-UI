import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-4 p-4 max-w-sm',
    children: [
      {
        kind: 'box',
        className: 'grid gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-medium text-muted-foreground',
            children: ['Disabled'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-combobox-root',
            props: {
              disabled: true,
              a11yLabel: 'Disabled framework picker',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-input',
                props: {
                  placeholder: 'Select a framework...',
                  a11yLabel: 'Select a framework',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-trigger',
                children: ['▾'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-content',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-combobox-item',
                    children: ['Next.js'],
                    props: { value: 'next.js', textValue: 'Next.js' },
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-combobox-empty',
                    children: ['No frameworks found.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-medium text-muted-foreground',
            children: ['Read-only with pre-selected value'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-combobox-root',
            props: {
              readOnly: true,
              defaultValue: 'astro',
              a11yLabel: 'Read-only framework picker',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-input',
                props: {
                  placeholder: 'Select a framework...',
                  a11yLabel: 'Select a framework',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-trigger',
                children: ['▾'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-content',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-combobox-item',
                    children: ['Astro'],
                    props: { value: 'astro', textValue: 'Astro' },
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-combobox-item',
                    children: ['Remix (Legacy)'],
                    props: { value: 'remix', textValue: 'Remix (Legacy)', disabled: true },
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-combobox-empty',
                    children: ['No frameworks found.'],
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
