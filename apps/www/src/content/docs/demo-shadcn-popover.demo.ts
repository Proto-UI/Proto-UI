import { withShadcnRheaDemo } from './shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const inputClass =
  'col-span-2 h-8 w-full rounded-md border border-input bg-transparent flex items-center px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClass = 'text-sm font-medium text-foreground';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-popover-root',
        ref: 'root',
        props: {
          a11yLabel: 'Dimensions',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-trigger',
            children: ['Open popover'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-content',
            className: 'w-80',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1.5',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-popover-title',
                    children: ['Dimensions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-popover-description',
                    children: ['Set the dimensions for the layer.'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'grid gap-2',
                children: [
                  {
                    kind: 'box',
                    className: 'grid grid-cols-3 items-center gap-3',
                    children: [
                      {
                        kind: 'box',
                        tag: 'span',
                        className: labelClass,
                        children: ['Width'],
                      },
                      {
                        kind: 'box',
                        tag: 'div',
                        ref: 'width',
                        className: inputClass,
                        attrs: { id: 'shadcn-popover-width', type: 'text', value: '100%' },
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'grid grid-cols-3 items-center gap-3',
                    children: [
                      {
                        kind: 'box',
                        tag: 'span',
                        className: labelClass,
                        children: ['Max. width'],
                      },
                      {
                        kind: 'box',
                        tag: 'div',
                        ref: 'maxWidth',
                        className: inputClass,
                        attrs: { id: 'shadcn-popover-max-width', type: 'text', value: '300px' },
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'grid grid-cols-3 items-center gap-3',
                    children: [
                      {
                        kind: 'box',
                        tag: 'span',
                        className: labelClass,
                        children: ['Height'],
                      },
                      {
                        kind: 'box',
                        tag: 'div',
                        ref: 'height',
                        className: inputClass,
                        attrs: { id: 'shadcn-popover-height', type: 'text', value: '25px' },
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'grid grid-cols-3 items-center gap-3',
                    children: [
                      {
                        kind: 'box',
                        tag: 'span',
                        className: labelClass,
                        children: ['Max. height'],
                      },
                      {
                        kind: 'box',
                        tag: 'div',
                        ref: 'maxHeight',
                        className: inputClass,
                        attrs: { id: 'shadcn-popover-max-height', type: 'text', value: 'none' },
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex items-center justify-end gap-2 pt-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-button',
                    ref: 'reset',
                    props: { variant: 'ghost', size: 'sm' },
                    children: ['Reset'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-popover-close',
                    children: ['Done'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ refs }) {
    const defaults: Record<string, string> = {
      width: '100%',
      maxWidth: '300px',
      height: '25px',
      maxHeight: 'none',
    };
    const onReset = () => {
      for (const [key, value] of Object.entries(defaults)) {
        const node = refs[key];
        if (node instanceof HTMLInputElement) node.value = value;
      }
    };
    refs.reset?.addEventListener('click', onReset);
    return () => {
      refs.reset?.removeEventListener('click', onReset);
    };
  },
} satisfies DemoSpec);
