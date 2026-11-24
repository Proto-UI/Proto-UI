import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 grid gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-autocomplete-root',
        props: {
          disabled: true,
          defaultValue: 'Astro',
          defaultInputValue: 'Astro',
          a11yLabel: 'Disabled autocomplete',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-input',
            props: { placeholder: 'Disabled…', a11yLabel: 'Disabled autocomplete' },
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-trigger',
            children: ['Options'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-item',
                props: { value: 'astro', textValue: 'Astro' },
                children: ['Astro'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-autocomplete-root',
        props: {
          readOnly: true,
          defaultValue: 'Next.js',
          defaultInputValue: 'Next.js',
          a11yLabel: 'Read-only autocomplete',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-input',
            props: { placeholder: 'Read-only…', a11yLabel: 'Read-only autocomplete' },
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-trigger',
            children: ['Options'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-item',
                props: { value: 'next', textValue: 'Next.js' },
                children: ['Next.js'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
