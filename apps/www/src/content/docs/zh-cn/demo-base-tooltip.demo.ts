export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center p-12',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-tooltip-root',
        className: 'relative inline-flex',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-tooltip-trigger',
            className:
              'inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium cursor-pointer select-none',
            children: ['Hover me'],
          },
          {
            kind: 'proto',
            prototypeId: 'base-tooltip-content',
            className:
              'absolute left-0 top-full z-50 mt-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg',
            children: ['Tooltip text'],
          },
        ],
      },
    ],
  },
};
