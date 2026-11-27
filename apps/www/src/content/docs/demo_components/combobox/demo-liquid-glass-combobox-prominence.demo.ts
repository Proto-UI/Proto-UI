import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-5',
    children: [
      {
        kind: 'box',
        className: 'grid gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-medium text-muted-foreground',
            children: ['Prominent trigger with Liquid Glass popup'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-root',
            props: { a11yLabel: 'Prominent framework picker' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-input',
                props: {
                  placeholder: 'Select a framework...',
                  a11yLabel: 'Select a framework',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-trigger',
                props: { prominence: 'prominent' },
                children: [
                  { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 14 } },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-content',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-combobox-item',
                    children: ['Next.js'],
                    props: { value: 'next.js', textValue: 'Next.js' },
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-combobox-item',
                    children: ['Astro'],
                    props: { value: 'astro', textValue: 'Astro' },
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-combobox-empty',
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
            children: ['Opaque surface opt-out (material="opaque")'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-root',
            props: { a11yLabel: 'Opaque framework picker' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-input',
                props: {
                  placeholder: 'Select a framework...',
                  a11yLabel: 'Select a framework',
                },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-trigger',
                children: [
                  { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 14 } },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-content',
                props: { material: 'opaque' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-combobox-item',
                    children: ['Next.js'],
                    props: { value: 'next.js', textValue: 'Next.js' },
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-combobox-item',
                    children: ['Astro'],
                    props: { value: 'astro', textValue: 'Astro' },
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-combobox-empty',
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
} satisfies DemoSpec;
