import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4 w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-autocomplete-root',
        props: {
          a11yLabel: 'Framework',
        },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-autocomplete-input',
            props: {
              placeholder: 'Search frameworks…',
              a11yLabel: 'Framework',
            },
            ref: 'input',
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
                props: { value: 'next', textValue: 'Next.js', keywords: 'react ssr' },
                children: ['Next.js'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-autocomplete-item',
                props: { value: 'astro', textValue: 'Astro', keywords: 'islands static' },
                children: ['Astro'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-autocomplete-item',
                props: { value: 'nuxt', textValue: 'Nuxt', keywords: 'vue' },
                children: ['Nuxt'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-autocomplete-item',
                props: { value: 'sveltekit', textValue: 'SvelteKit', keywords: 'svelte' },
                children: ['SvelteKit'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-autocomplete-item',
                props: { value: 'legacy', textValue: 'Legacy v1', disabled: true },
                children: ['Legacy v1'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-autocomplete-empty',
                children: ['No matching frameworks.'],
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
} satisfies DemoSpec;
