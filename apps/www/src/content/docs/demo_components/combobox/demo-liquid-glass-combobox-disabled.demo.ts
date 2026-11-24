import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 grid gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-combobox-root',
        props: {
          disabled: true,
          a11yLabel: 'Disabled framework picker',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-input',
            props: {
              placeholder: 'Disabled combobox...',
              a11yLabel: 'Disabled combobox',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-trigger',
            children: ['▾'],
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
                prototypeId: 'liquid-glass-combobox-empty',
                children: ['No frameworks found.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-combobox-root',
        props: {
          readOnly: true,
          defaultValue: 'astro',
          a11yLabel: 'Read-only framework picker',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-input',
            props: {
              placeholder: 'Read-only combobox...',
              a11yLabel: 'Read-only combobox',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-trigger',
            children: ['▾'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-content',
            children: [
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
} satisfies DemoSpec;
