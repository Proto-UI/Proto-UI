import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-4 p-4 w-full max-w-md',
    children: [
      {
        kind: 'box',
        className: 'grid gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-medium text-muted-foreground',
            children: ['Disabled'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-root',
            props: {
              disabled: true,
              defaultValue: 'Astro',
              defaultInputValue: 'Astro',
              a11yLabel: 'Disabled framework input',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-input',
                props: { placeholder: 'Disabled…', a11yLabel: 'Disabled framework input' },
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
                    props: { value: 'astro', textValue: 'Astro' },
                    children: ['Astro'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-medium text-muted-foreground',
            children: ['Read-only'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-root',
            props: {
              readOnly: true,
              defaultValue: 'Next.js',
              defaultInputValue: 'Next.js',
              a11yLabel: 'Read-only framework input',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-input',
                props: { placeholder: 'Read-only…', a11yLabel: 'Read-only framework input' },
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
                    props: { value: 'next', textValue: 'Next.js' },
                    children: ['Next.js'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
