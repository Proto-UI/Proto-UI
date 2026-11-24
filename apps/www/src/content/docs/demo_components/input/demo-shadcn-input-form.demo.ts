import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-4',
    children: [
      {
        kind: 'box',
        className: 'grid grid-cols-2 gap-4',
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-label-root',
                associations: { controlLabel: 'shadcn-form-first-name' },
                children: ['First Name'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-input-root',
                associations: { controlLabel: 'shadcn-form-first-name' },
                props: {
                  placeholder: 'Jordan',
                  name: 'firstName',
                  autoComplete: 'given-name',
                  required: true,
                },
              },
            ],
          },
          {
            kind: 'box',
            className: 'flex flex-col gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-label-root',
                associations: { controlLabel: 'shadcn-form-last-name' },
                children: ['Last Name'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-input-root',
                associations: { controlLabel: 'shadcn-form-last-name' },
                props: {
                  placeholder: 'Lee',
                  name: 'lastName',
                  autoComplete: 'family-name',
                  required: true,
                },
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-root',
        props: { required: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['Email'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-control',
            props: {
              placeholder: 'name@example.com',
              name: 'email',
              inputMode: 'email',
              autoComplete: 'email',
              required: true,
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-description',
            children: ['We will send updates to this address.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { variant: 'outline' },
            children: ['Cancel'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            children: ['Submit'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
