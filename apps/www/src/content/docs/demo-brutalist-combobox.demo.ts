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
          a11yLabel: 'Framework',
        },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-input',
            props: {
              placeholder: 'Select framework...',
              a11yLabel: 'Select framework',
            },
            ref: 'input',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-trigger',
            children: [
              { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 14 } },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-combobox-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['Next.js'],
                props: { value: 'next.js', textValue: 'Next.js', keywords: 'react ssr' },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['SvelteKit'],
                props: { value: 'sveltekit', textValue: 'SvelteKit', keywords: 'svelte' },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['Nuxt.js'],
                props: { value: 'nuxt.js', textValue: 'Nuxt.js', keywords: 'vue' },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['Remix'],
                props: { value: 'remix', textValue: 'Remix', keywords: 'react' },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-item',
                children: ['Astro'],
                props: { value: 'astro', textValue: 'Astro', keywords: 'static' },
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-combobox-empty',
                children: ['No framework found.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs font-sans font-medium text-muted-foreground',
        attrs: { 'aria-live': 'polite' },
        children: ['Selected: None'],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('root', {
      onValueChange: (detail: { value: string; textValue: string }) => {
        refs.status.textContent = detail.textValue
          ? `Selected: ${detail.textValue}`
          : 'Selected: None';
      },
    });
  },
} satisfies DemoSpec;
