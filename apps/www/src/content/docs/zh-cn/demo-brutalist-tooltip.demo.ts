const tooltip = (label: string, content: string) => ({
  kind: 'proto' as const,
  prototypeId: 'brutalist-tooltip-root',
  children: [
    {
      kind: 'proto' as const,
      prototypeId: 'brutalist-tooltip-trigger',
      children: [label],
    },
    {
      kind: 'proto' as const,
      prototypeId: 'brutalist-tooltip-content',
      children: [content],
    },
  ],
});

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tooltip-group',
        props: { openDelay: 500, closeDelay: 0, skipDelay: 300 },
        children: [
          tooltip('Hover or focus for details', 'Portable Base behavior, Brutalist visual grammar'),
          tooltip('Move to the second trigger', 'Group preserves the shared warm-delay domain'),
        ],
      },
    ],
  },
};
