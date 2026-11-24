import { withShadcnRheaDemo } from '../../shadcn-demo-style';
export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'outline' },
        children: ['Button'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'outline', size: 'icon' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-arrow-right-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 16 },
          },
          { kind: 'box', tag: 'span', className: 'sr-only', children: ['Submit'] },
        ],
      },
      { kind: 'proto', prototypeId: 'shadcn-button', children: ['Primary'] },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'destructive' },
        children: ['Destructive'],
      },
    ],
  },
});
