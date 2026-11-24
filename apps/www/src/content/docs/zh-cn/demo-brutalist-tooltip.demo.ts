const triggerClass =
  'inline-flex items-center justify-center rounded-base border-2 border-foreground bg-main px-4 py-2 font-sans text-sm font-medium text-main-foreground cursor-pointer';

const tooltip = (label: string, content: string) => ({
  kind: 'proto' as const,
  prototypeId: 'brutalist-tooltip-root',
  children: [
    {
      kind: 'proto' as const,
      prototypeId: 'brutalist-tooltip-trigger',
      className: triggerClass,
      children: [label],
    },
    {
      kind: 'proto' as const,
      prototypeId: 'brutalist-tooltip-content',
      props: { side: 'top', align: 'center' },
      children: [content],
    },
  ],
});

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tooltip-group',
        props: { openDelay: 500, closeDelay: 100, skipDelay: 300 },
        className: 'flex flex-wrap items-center justify-center gap-4',
        children: [
          tooltip('Account', 'View account settings'),
          tooltip('Notifications', 'Manage notification preferences'),
        ],
      },
    ],
  },
};
