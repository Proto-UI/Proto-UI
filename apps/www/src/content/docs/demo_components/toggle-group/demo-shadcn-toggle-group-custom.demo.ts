import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-root',
        className: 'w-fit',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['Font Weight'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-root',
            ref: 'weightGroup',
            props: {
              value: ['normal'],
              variant: 'outline',
              spacing: 2,
              size: 'lg',
              a11yLabel: 'Font weight',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-toggle-group-item',
                className: 'flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl',
                props: { value: 'light' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-2xl leading-none font-light',
                    children: ['Aa'],
                  },
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-xs text-muted-foreground',
                    children: ['Light'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-toggle-group-item',
                className: 'flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl',
                props: { value: 'normal' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-2xl leading-none font-normal',
                    children: ['Aa'],
                  },
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-xs text-muted-foreground',
                    children: ['Normal'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-toggle-group-item',
                className: 'flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl',
                props: { value: 'medium' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-2xl leading-none font-medium',
                    children: ['Aa'],
                  },
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-xs text-muted-foreground',
                    children: ['Medium'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-toggle-group-item',
                className: 'flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl',
                props: { value: 'bold' },
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-2xl leading-none font-bold',
                    children: ['Aa'],
                  },
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-xs text-muted-foreground',
                    children: ['Bold'],
                  },
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-description',
            children: [
              'Use ',
              {
                kind: 'box',
                tag: 'span',
                ref: 'weightToken',
                className: 'rounded-md bg-muted px-1 py-0.5 font-mono text-xs text-foreground',
                children: ['font-normal'],
              },
              ' to set the font weight.',
            ],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let selected = 'normal';
    api.setProps('weightGroup', {
      value: [selected],
      onValueChange: (detail: { value: string[] }) => {
        const next = detail.value[0];
        if (!next) return;
        selected = next;
        api.setProps('weightGroup', { value: [selected] });
        if (refs.weightToken) refs.weightToken.textContent = `font-${selected}`;
      },
    });
  },
} satisfies DemoSpec);
