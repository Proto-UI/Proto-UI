import { withShadcnRheaDemo } from '../../shadcn-demo-style';
export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'outline', disabled: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-loader-circle-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none animate-spin',
            props: { size: 16 },
          },
          'Generating',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'secondary', disabled: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-loader-circle-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none animate-spin',
            props: { size: 16 },
          },
          'Downloading',
        ],
      },
    ],
  },
});
