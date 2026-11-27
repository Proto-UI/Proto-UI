import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-2 p-4 max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-combobox-root',
        props: {
          a11yLabel: 'Framework',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-combobox-input',
            props: {
              placeholder: 'Select a framework...',
              a11yLabel: 'Select a framework',
              invalid: true,
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-combobox-trigger',
            children: [
              { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 14 } },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-combobox-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['Next.js'],
                props: { value: 'next.js', textValue: 'Next.js' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['SvelteKit'],
                props: { value: 'sveltekit', textValue: 'SvelteKit' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['Nuxt.js'],
                props: { value: 'nuxt.js', textValue: 'Nuxt.js' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['Astro'],
                props: { value: 'astro', textValue: 'Astro' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-empty',
                children: ['No frameworks found.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'text-xs text-destructive',
        children: ['Please choose a framework before continuing.'],
      },
    ],
  },
} satisfies DemoSpec);
