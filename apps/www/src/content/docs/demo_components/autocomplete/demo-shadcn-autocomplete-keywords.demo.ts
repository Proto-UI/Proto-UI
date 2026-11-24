import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4 w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-autocomplete-root',
        props: { a11yLabel: 'Cities and cuisines' },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-input',
            props: {
              placeholder: 'Try "cafe", "brazil", or "dessert"…',
              a11yLabel: 'Cities and cuisines',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-trigger',
            props: { size: 'icon' },
            children: [{ kind: 'box', className: 'sr-only', children: ['Toggle suggestions'] }],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: { value: 'cafe', textValue: 'Café', keywords: 'coffee espresso latte' },
                children: ['Café'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: {
                  value: 'creme-brulee',
                  textValue: 'Crème Brûlée',
                  keywords: 'dessert custard french',
                },
                children: ['Crème Brûlée'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: {
                  value: 'sao-paulo',
                  textValue: 'São Paulo',
                  keywords: 'brazil city south america',
                },
                children: ['São Paulo'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: {
                  value: 'zurich',
                  textValue: 'Zürich',
                  keywords: 'switzerland europe finance',
                },
                children: ['Zürich'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-empty',
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
} satisfies DemoSpec);
