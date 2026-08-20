export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col items-center gap-6 p-8',
    children: [
      {
        kind: 'text',
        text: 'Base Transition - 状态机驱动的进入/离开动画',
      },
      {
        kind: 'box',
        className: 'text-sm text-gray-600 max-w-md text-center',
        children: [
          'Transition 组件管理感知生命周期：closed → entering → entered → leaving → closed',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'base-transition',
        props: {
          open: true,
          appear: true,
        },
        className: 'transition-wrapper',
        children: [
          {
            kind: 'box',
            className:
              'w-64 h-40 rounded-xl flex flex-col items-center justify-center text-background shadow-xl transition-box',
            children: [
              {
                kind: 'box',
                className: 'text-lg font-semibold',
                children: ['Animated Box'],
              },
              {
                kind: 'box',
                className: 'text-sm opacity-80 mt-2',
                children: ['data-transition-state 驱动样式'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex gap-4 text-xs',
        children: [
          {
            kind: 'box',
            className: 'px-3 py-1 bg-muted text-muted-foreground rounded',
            children: ['closed'],
          },
          {
            kind: 'box',
            className: 'px-3 py-1 bg-muted text-muted-foreground rounded',
            children: ['entering'],
          },
          {
            kind: 'box',
            className: 'px-3 py-1 bg-muted text-muted-foreground rounded',
            children: ['entered'],
          },
          {
            kind: 'box',
            className: 'px-3 py-1 bg-muted text-muted-foreground rounded',
            children: ['leaving'],
          },
        ],
      },
    ],
  },
};
