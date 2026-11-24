import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-[10rem] flex-col gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-root',
        className: 'flex flex-row items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-switch',
            props: { size: 'sm', defaultChecked: false },
            children: [{ kind: 'proto', prototypeId: 'shadcn-switch-thumb' }],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['Small'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-root',
        className: 'flex flex-row items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-switch',
            props: { size: 'default', defaultChecked: true },
            children: [{ kind: 'proto', prototypeId: 'shadcn-switch-thumb' }],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['Default'],
          },
        ],
      },
    ],
  },
});
