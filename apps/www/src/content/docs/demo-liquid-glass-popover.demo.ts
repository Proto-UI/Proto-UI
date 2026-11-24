import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const inputClass =
  'col-span-2 h-8 w-full rounded-xl border border-border bg-background/80 flex items-center px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClass = 'text-sm font-medium text-secondary-foreground';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex min-w-0 flex-wrap items-center justify-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-popover-root',
        ref: 'root',
        props: {
          a11yLabel: 'Dimensions',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-trigger',
            children: ['Open popover'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-content',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-title',
                    children: ['Dimensions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-description',
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
                        attrs: { id: 'lg-popover-width', type: 'text', value: '100%' },
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
                        attrs: { id: 'lg-popover-max-width', type: 'text', value: '300px' },
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
                        attrs: { id: 'lg-popover-height', type: 'text', value: '25px' },
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
                    prototypeId: 'liquid-glass-popover-close',
                    props: { prominence: 'prominent' },
                    children: ['Done'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-button',
        ref: 'reset',
        children: ['Reset layer'],
      },
    ],
  },
  setup({ refs }) {
    const defaults: Record<string, string> = {
      width: '100%',
      maxWidth: '300px',
      height: '25px',
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
} satisfies DemoSpec;
