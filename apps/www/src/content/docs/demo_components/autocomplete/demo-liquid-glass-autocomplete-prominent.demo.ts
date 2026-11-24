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
        props: { a11yLabel: 'Prominent glass trigger' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-input',
            props: {
              placeholder: 'Prominent glass trigger…',
              a11yLabel: 'Prominent glass trigger',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-trigger',
            props: { variant: 'prominent', material: 'auto' },
            children: ['Browse'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-content',
            props: { material: 'auto' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-item',
                props: { value: 'swift', textValue: 'Swift' },
                children: ['Swift'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-item',
                props: { value: 'typescript', textValue: 'TypeScript' },
                children: ['TypeScript'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-empty',
                children: ['No matches.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-autocomplete-root',
        props: { a11yLabel: 'Opaque fallback' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-input',
            props: {
              placeholder: 'Opaque fallback (material="opaque")…',
              a11yLabel: 'Opaque fallback',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-trigger',
            props: { variant: 'regular', material: 'opaque' },
            children: ['Opaque'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-content',
            props: { material: 'opaque' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-item',
                props: { value: 'swift', textValue: 'Swift' },
                children: ['Swift'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-item',
                props: { value: 'typescript', textValue: 'TypeScript' },
                children: ['TypeScript'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-empty',
                children: ['No matches.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
