export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      { kind: 'proto', prototypeId: 'shadcn-button', children: ['Default'] },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'secondary' },
        children: ['Secondary'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'outline' },
        children: ['Outline'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'destructive' },
        children: ['Destructive'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'ghost', size: 'icon' },
        children: [{ kind: 'proto', prototypeId: 'lucide-plus-icon', props: { size: 16 } }],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { disabled: true },
        children: ['Disabled'],
      },
    ],
  },
};
