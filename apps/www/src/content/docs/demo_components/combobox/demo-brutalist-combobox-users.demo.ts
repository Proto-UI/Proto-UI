import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4 max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-combobox-root',
        props: {
          defaultValue: 'shadcn',
          a11yLabel: 'Assignee',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-input',
            props: {
              placeholder: 'Select user...',
              a11yLabel: 'Select user',
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
                children: ['shadcn'],
                props: { value: 'shadcn', textValue: 'shadcn', keywords: 'design systems ui' },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['leerob'],
                props: { value: 'leerob', textValue: 'leerob', keywords: 'devrel nextjs' },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['evilrabbit'],
                props: { value: 'evilrabbit', textValue: 'evilrabbit', keywords: 'design brand' },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['maxleiter'],
                props: { value: 'maxleiter', textValue: 'maxleiter', keywords: 'engineering' },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-empty',
                children: ['No user found.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
