import { withShadcnRheaDemo } from './shadcn-demo-style';
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
        props: {
          a11yLabel: 'Framework',
        },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-input',
            props: {
              placeholder: 'Search frameworks…',
              a11yLabel: 'Framework',
            },
            ref: 'input',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-trigger',
            props: {
              size: 'icon',
            },
            children: [
              {
                kind: 'box',
                className: 'sr-only',
                children: ['Toggle framework suggestions'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: { value: 'next', textValue: 'Next.js', keywords: 'react ssr vercel' },
                children: ['Next.js'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: { value: 'astro', textValue: 'Astro', keywords: 'islands static' },
                children: ['Astro'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: { value: 'nuxt', textValue: 'Nuxt', keywords: 'vue nitro' },
                children: ['Nuxt'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: { value: 'sveltekit', textValue: 'SvelteKit', keywords: 'svelte vite' },
                children: ['SvelteKit'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: { value: 'legacy', textValue: 'Legacy v1', disabled: true },
                children: ['Legacy v1'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-empty',
                children: ['No matching frameworks. Press Enter to use custom input.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs text-muted-foreground',
        attrs: {
          'aria-live': 'polite',
        },
        children: ['Pick a framework or press Enter to submit custom text.'],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('root', {
      onValueChange: (detail: { value: string; textValue: string }) => {
        refs.status.textContent = detail.textValue ? `Committed: ${detail.textValue}` : 'Cleared';
      },
    });
  },
} satisfies DemoSpec);
