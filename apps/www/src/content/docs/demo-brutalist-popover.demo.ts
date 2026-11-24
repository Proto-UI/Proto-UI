import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const inputClass =
  'col-span-2 h-8 w-full rounded-[5px] border-2 border-black bg-white px-2 text-sm text-black outline-none';
const labelClass = 'text-sm font-medium';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-popover-root',
        ref: 'root',
        props: {
          a11yLabel: 'Dimensions',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-popover-trigger',
            children: ['Open popover'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-popover-content',
            ref: 'content',
            previewTheme: 'portal',
            className: 'w-80',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1.5',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-popover-title',
                    children: ['Dimensions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-popover-description',
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
                        attrs: { id: 'brutalist-popover-width', type: 'text', value: '100%' },
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
                        attrs: { id: 'brutalist-popover-max-width', type: 'text', value: '300px' },
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
                        attrs: { id: 'brutalist-popover-height', type: 'text', value: '25px' },
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
                        attrs: { id: 'brutalist-popover-max-height', type: 'text', value: 'none' },
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
                    prototypeId: 'brutalist-button',
                    ref: 'reset',
                    children: ['Reset'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-popover-close',
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
} satisfies DemoSpec;
