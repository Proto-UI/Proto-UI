import type { DemoSetupContext } from '../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  setup({ refs, api }: DemoSetupContext) {
    const label = refs.stateLabel;
    if (!label) return;

    const openHandle = api.getExposes('overlay')?.open as
      | {
          get?: () => boolean;
          subscribe?: (cb: () => void) => (() => void) | undefined;
          unsubscribe?: (off: () => void) => void;
        }
      | undefined;

    const readOpen = () => {
      const open = !!openHandle?.get?.();
      label.textContent = open ? 'open' : 'closed';
      label.dataset.open = String(open);
    };

    readOpen();
    const off = openHandle?.subscribe?.(readOpen);

    return () => {
      if (typeof off !== 'function') return;
      if (typeof openHandle?.unsubscribe === 'function') {
        openHandle.unsubscribe(off);
      } else {
        off();
      }
    };
  },
  root: {
    kind: 'box',
    className: 'flex flex-col items-center justify-center gap-4 p-12',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-tooltip-root',
        ref: 'root',
        props: {
          delay: 150,
        },
        className: 'relative inline-flex',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-tooltip-trigger',
            ref: 'trigger',
            className:
              'inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium cursor-pointer select-none',
            children: ['Hover me'],
          },
          {
            kind: 'proto',
            prototypeId: 'base-tooltip-overlay',
            ref: 'overlay',
            children: [
              {
                kind: 'proto',
                prototypeId: 'base-tooltip-content',
                ref: 'content',
                children: ['Tooltip text'],
              },
              {
                kind: 'proto',
                prototypeId: 'base-tooltip-arrow',
                ref: 'arrow',
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'text-sm text-slate-500',
        children: [
          'Open: ',
          {
            kind: 'box',
            ref: 'stateLabel',
            className: 'inline font-semibold text-slate-800 data-[open=true]:text-emerald-700',
            children: ['closed'],
          },
        ],
      },
    ],
  },
};
