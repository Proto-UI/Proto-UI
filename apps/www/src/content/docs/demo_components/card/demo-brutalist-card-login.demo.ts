import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-card-root',
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-header',
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1',
            children: [
              {
                kind: 'box',
                className: 'font-heading text-base font-bold leading-snug',
                children: ['Login to your account'],
              },
              {
                kind: 'box',
                className: 'text-sm text-muted-foreground',
                children: ['Enter your email below to login to your account'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-card-content',
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
                    prototypeId: 'brutalist-label-root',
                    ref: 'emailLabel',
                    associations: { controlLabel: 'brutalist-card-login-email' },
                    children: ['Email'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-input-root',
                    ref: 'emailInput',
                    associations: { controlLabel: 'brutalist-card-login-email' },
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
                        prototypeId: 'brutalist-label-root',
                        ref: 'passwordLabel',
                        associations: { controlLabel: 'brutalist-card-login-password' },
                        children: ['Password'],
                      },
                      {
                        kind: 'box',
                        tag: 'a',
                        className:
                          'ms-auto inline-block text-sm underline-offset-4 hover:underline',
                        attrs: { href: '#usage' },
                        children: ['Forgot your password?'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-input-root',
                    ref: 'passwordInput',
                    associations: { controlLabel: 'brutalist-card-login-password' },
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
        prototypeId: 'brutalist-card-footer',
        className: 'flex-col items-stretch gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'solid' },
            className: 'w-full',
            children: ['Login'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-button',
            props: { variant: 'surface' },
            className: 'w-full',
            children: ['Login with Google'],
          },
          {
            kind: 'box',
            className: 'mt-2 text-center text-sm',
            children: [
              "Don't have an account? ",
              {
                kind: 'box',
                tag: 'a',
                className: 'underline underline-offset-4',
                attrs: { href: '#usage' },
                children: ['Sign up'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
