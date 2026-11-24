import { withShadcnRheaDemo } from '../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-5',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['API Key'] },
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-root',
            props: {
              defaultValue: 'sk-live-9f8e7d6c',
              placeholder: 'sk-...',
              ariaLabel: 'API Key',
              autoComplete: 'off',
            },
          },
          {
            kind: 'box',
            className: 'text-xs text-muted-foreground',
            children: ['Your API key is encrypted and stored securely.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Email'] },
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-root',
            props: {
              defaultValue: 'jordan@example.com',
              disabled: true,
              inputMode: 'email',
              ariaLabel: 'Email',
            },
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          { kind: 'box', className: 'text-sm font-medium', children: ['Workspace URL'] },
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-root',
            props: {
              defaultValue: 'https://app.example.com/acme',
              readOnly: true,
              inputMode: 'url',
              ariaLabel: 'Workspace URL',
            },
          },
        ],
      },
    ],
  },
});
