import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4 w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-autocomplete-root',
        props: { a11yLabel: 'Cities and cuisines' },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-autocomplete-input',
            props: {
              placeholder: 'Try "cafe", "brazil", or "dessert"…',
              a11yLabel: 'Cities and cuisines',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-autocomplete-trigger',
            children: ['Browse'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-autocomplete-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-autocomplete-item',
                props: { value: 'cafe', textValue: 'Café', keywords: 'coffee espresso' },
                children: ['Café'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-autocomplete-item',
                props: {
                  value: 'creme-brulee',
                  textValue: 'Crème Brûlée',
                  keywords: 'dessert french',
                },
                children: ['Crème Brûlée'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-autocomplete-item',
                props: { value: 'sao-paulo', textValue: 'São Paulo', keywords: 'brazil city' },
                children: ['São Paulo'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-autocomplete-empty',
                children: ['No matching entries.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs text-muted-foreground',
        attrs: { 'aria-live': 'polite' },
        children: ['Matches ignore case, accents, and include keywords.'],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('root', {
      onValueChange: (detail: { textValue: string }) => {
        refs.status.textContent = `Selected: ${detail.textValue}`;
      },
    });
  },
} satisfies DemoSpec;
