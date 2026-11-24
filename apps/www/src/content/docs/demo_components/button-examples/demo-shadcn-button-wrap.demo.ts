import { withShadcnRheaDemo } from '../../shadcn-demo-style';
export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-52 flex-col items-start gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'outline', wrap: true },
        children: ['Confirm and continue with current workspace settings'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { size: 'sm', wrap: true },
        children: ['Save changes and notify reviewers'],
      },
    ],
  },
});
