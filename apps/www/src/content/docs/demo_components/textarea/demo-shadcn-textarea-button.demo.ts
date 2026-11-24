import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-md gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-textarea-root',
        props: {
          placeholder: 'Type your message here.',
          ariaLabel: 'Message',
          rows: 3,
        },
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        children: ['Send message'],
      },
    ],
  },
});
