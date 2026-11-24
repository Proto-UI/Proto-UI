import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        ref: 'italic',
        props: { variant: 'outline' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-italic-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 16 },
          },
          'Italic',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        ref: 'bold',
        props: { variant: 'outline', defaultActive: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-bold-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 16 },
          },
          'Bold',
        ],
      },
    ],
  },
});
