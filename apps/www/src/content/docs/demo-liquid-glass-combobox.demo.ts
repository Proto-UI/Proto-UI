import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-combobox-root',
        props: {
          a11yLabel: 'Framework',
        },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-input',
            props: {
              placeholder: 'Select a framework...',
              a11yLabel: 'Select a framework',
            },
            ref: 'input',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-trigger',
            children: ['▾'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-combobox-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-item',
                children: ['Next.js'],
                props: { value: 'next.js', textValue: 'Next.js', keywords: 'react ssr' },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-item',
                children: ['SvelteKit'],
                props: { value: 'sveltekit', textValue: 'SvelteKit', keywords: 'svelte' },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-item',
                children: ['Nuxt.js'],
                props: { value: 'nuxt.js', textValue: 'Nuxt.js', keywords: 'vue' },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-item',
                children: ['Remix'],
                props: { value: 'remix', textValue: 'Remix', keywords: 'react' },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-item',
                children: ['Astro'],
                props: { value: 'astro', textValue: 'Astro', keywords: 'static' },
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-combobox-empty',
                children: ['No frameworks found.'],
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
