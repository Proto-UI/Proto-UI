import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'min-w-0 grid gap-3 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-autocomplete-root',
        props: { a11yLabel: 'Cities and cuisines' },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-input',
            props: {
              placeholder: 'Try "cafe", "brazil", or "dessert"…',
              a11yLabel: 'Cities and cuisines',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-trigger',
            children: ['Browse'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-autocomplete-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-item',
                props: { value: 'cafe', textValue: 'Café', keywords: 'coffee espresso' },
                children: ['Café'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-item',
                props: {
                  value: 'creme-brulee',
                  textValue: 'Crème Brûlée',
                  keywords: 'dessert french',
                },
                children: ['Crème Brûlée'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-item',
                props: { value: 'sao-paulo', textValue: 'São Paulo', keywords: 'brazil city' },
                children: ['São Paulo'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-autocomplete-empty',
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
