import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-4 p-4 w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-autocomplete-root',
        props: {
          disabled: true,
          defaultValue: 'Astro',
          defaultInputValue: 'Astro',
          a11yLabel: 'Disabled autocomplete',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-autocomplete-input',
            props: { placeholder: 'Disabled…', a11yLabel: 'Disabled autocomplete' },
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-autocomplete-trigger',
            children: ['Options'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-autocomplete-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-autocomplete-item',
                props: { value: 'astro', textValue: 'Astro' },
                children: ['Astro'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-autocomplete-root',
        props: {
          readOnly: true,
          defaultValue: 'Next.js',
          defaultInputValue: 'Next.js',
          a11yLabel: 'Read-only autocomplete',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-autocomplete-input',
            props: { placeholder: 'Read-only…', a11yLabel: 'Read-only autocomplete' },
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-autocomplete-trigger',
            children: ['Options'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-autocomplete-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-autocomplete-item',
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
