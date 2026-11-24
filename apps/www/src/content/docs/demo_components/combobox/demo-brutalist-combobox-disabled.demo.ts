import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-4 p-4 max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-combobox-root',
        props: {
          disabled: true,
          a11yLabel: 'Disabled framework picker',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-input',
            props: {
              placeholder: 'Disabled combobox...',
              a11yLabel: 'Disabled combobox',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-trigger',
            children: ['▾'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['Next.js'],
                props: { value: 'next.js', textValue: 'Next.js' },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-empty',
                children: ['No framework found.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-combobox-root',
        props: {
          readOnly: true,
          defaultValue: 'astro',
          a11yLabel: 'Read-only framework picker',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-input',
            props: {
              placeholder: 'Read-only combobox...',
              a11yLabel: 'Read-only combobox',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-trigger',
            children: ['▾'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['Astro'],
                props: { value: 'astro', textValue: 'Astro' },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-empty',
                children: ['No framework found.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
