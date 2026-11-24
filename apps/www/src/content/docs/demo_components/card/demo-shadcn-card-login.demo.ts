import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-card-root',
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-header',
        children: [
          {
            kind: 'box',
            className: 'flex items-start justify-between gap-2',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-text-root',
                    props: { size: 'base', weight: 'medium', tone: 'inherit' },
                    children: ['Login to your account'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-text-root',
                    props: { size: 'sm', tone: 'muted' },
                    children: ['Enter your email below to login to your account'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                props: { variant: 'link', size: 'sm' },
                children: ['Sign Up'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-content',
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-5',
            children: [
              {
                kind: 'box',
                className: 'grid gap-2',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-label-root',
                    ref: 'emailLabel',
                    associations: { controlLabel: 'shadcn-card-login-email' },
                    children: ['Email'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-input-root',
                    ref: 'emailInput',
                    associations: { controlLabel: 'shadcn-card-login-email' },
                    props: {
                      placeholder: 'm@example.com',
                      inputMode: 'email',
                      required: true,
                    },
                  },
                ],
              },
              {
                kind: 'box',
                className: 'grid gap-2',
                children: [
                  {
                    kind: 'box',
                    className: 'flex items-center',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-label-root',
                        ref: 'passwordLabel',
                        associations: { controlLabel: 'shadcn-card-login-password' },
                        children: ['Password'],
                      },
                      {
                        kind: 'box',
                        tag: 'a',
                        className:
                          'ms-auto inline-block text-sm underline-offset-4 hover:underline',
                        attrs: { href: '#card-contract' },
                        children: ['Forgot your password?'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-input-root',
                    ref: 'passwordInput',
                    associations: { controlLabel: 'shadcn-card-login-password' },
                    props: {
                      placeholder: 'Enter your password',
                      autoComplete: 'current-password',
                      required: true,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-footer',
        className: 'flex-col gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            className: 'w-full',
            children: ['Login'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { variant: 'outline' },
            className: 'w-full',
            children: ['Login with Google'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
