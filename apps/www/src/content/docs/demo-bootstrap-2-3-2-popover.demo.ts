import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const inputClass =
  'col-span-2 h-7 w-full rounded-[4px] border border-[#ccc] bg-white px-2 text-sm text-[#333] outline-none';
const labelClass = 'text-xs font-medium text-foreground';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-popover-root',
        ref: 'root',
        props: {
          a11yLabel: 'Dimensions',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-popover-trigger',
            children: ['Click to toggle popover'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-popover-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-popover-title',
                children: ['Dimensions'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-popover-description',
                children: ['Set the dimensions for the layer.'],
              },
              {
                kind: 'box',
                className: 'grid gap-2 px-[14px] pb-[10px]',
                children: [
                  {
                    kind: 'box',
                    className: 'grid grid-cols-3 items-center gap-2',
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
                        attrs: { id: 'bs2-popover-width', type: 'text', value: '100%' },
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'grid grid-cols-3 items-center gap-2',
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
                        attrs: { id: 'bs2-popover-height', type: 'text', value: '25px' },
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'flex items-center justify-end gap-2 pt-2',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-button',
                        ref: 'reset',
                        children: ['Reset'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-popover-close',
                        children: ['Close'],
                      },
                    ],
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
    const onReset = () => {
      if (refs.width instanceof HTMLInputElement) refs.width.value = '100%';
      if (refs.height instanceof HTMLInputElement) refs.height.value = '25px';
    };
    refs.reset?.addEventListener('click', onReset);
    return () => {
      refs.reset?.removeEventListener('click', onReset);
    };
  },
} satisfies DemoSpec;
