import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-2',
    attrs: { dir: 'rtl' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        ref: 'rtl-bold',
        props: { variant: 'outline', size: 'sm' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-bold-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 16 },
          },
          'غامق',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        ref: 'rtl-italic',
        props: { variant: 'outline', size: 'sm', defaultActive: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-italic-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 16 },
          },
          'مائل',
        ],
      },
    ],
  },
});
