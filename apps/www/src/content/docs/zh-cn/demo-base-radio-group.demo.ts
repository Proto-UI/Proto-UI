export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-radio-group-root',
        props: { defaultValue: 'option-a' },
        className: 'flex flex-col gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-radio-item',
            props: { value: 'option-a' },
            className:
              'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none',
            children: [
              {
                kind: 'box',
                className:
                  'w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center',
                children: [
                  {
                    kind: 'box',
                    className: 'w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600',
                  },
                ],
              },
              'Option A',
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'base-radio-item',
            props: { value: 'option-b' },
            className:
              'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none',
            children: [
              {
                kind: 'box',
                className:
                  'w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center',
                children: [
                  {
                    kind: 'box',
                    className: 'w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600',
                  },
                ],
              },
              'Option B',
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'base-radio-item',
            props: { value: 'option-c' },
            className:
              'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none',
            children: [
              {
                kind: 'box',
                className:
                  'w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center',
                children: [
                  {
                    kind: 'box',
                    className: 'w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600',
                  },
                ],
              },
              'Option C',
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'base-radio-item',
            props: { value: 'option-d', disabled: true },
            className:
              'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none',
            children: [
              {
                kind: 'box',
                className:
                  'w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center',
                children: [
                  {
                    kind: 'box',
                    className: 'w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600',
                  },
                ],
              },
              'Option D (disabled)',
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'base-radio-group-root',
        props: { disabled: true },
        className: 'flex flex-col gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-radio-item',
            props: { value: 'disabled-a' },
            className:
              'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none',
            children: [
              {
                kind: 'box',
                className:
                  'w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center',
                children: [
                  {
                    kind: 'box',
                    className: 'w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600',
                  },
                ],
              },
              'Disabled Group A',
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'base-radio-item',
            props: { value: 'disabled-b' },
            className:
              'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none',
            children: [
              {
                kind: 'box',
                className:
                  'w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center',
                children: [
                  {
                    kind: 'box',
                    className: 'w-2 h-2 rounded-full hidden data-[checked]:block bg-blue-600',
                  },
                ],
              },
              'Disabled Group B',
            ],
          },
        ],
      },
    ],
  },
};
