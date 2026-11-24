import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl' },
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-root',
        className: 'w-full',
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
                        children: ['تسجيل الدخول إلى حسابك'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-text-root',
                        props: { size: 'sm', tone: 'muted' },
                        children: ['أدخل بريدك الإلكتروني أدناه لتسجيل الدخول إلى حسابك'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-button',
                    props: { variant: 'link', size: 'sm' },
                    children: ['إنشاء حساب'],
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
                        ref: 'rtlEmailLabel',
                        associations: { controlLabel: 'shadcn-card-rtl-email' },
                        children: ['البريد الإلكتروني'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-input-root',
                        ref: 'rtlEmailInput',
                        associations: { controlLabel: 'shadcn-card-rtl-email' },
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
                            ref: 'rtlPasswordLabel',
                            associations: { controlLabel: 'shadcn-card-rtl-password' },
                            children: ['كلمة المرور'],
                          },
                          {
                            kind: 'box',
                            tag: 'a',
                            className:
                              'ms-auto inline-block text-sm underline-offset-4 hover:underline',
                            attrs: { href: '#card-contract' },
                            children: ['نسيت كلمة المرور؟'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-input-root',
                        ref: 'rtlPasswordInput',
                        associations: { controlLabel: 'shadcn-card-rtl-password' },
                        props: {
                          placeholder: 'أدخل كلمة المرور',
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
                children: ['تسجيل الدخول'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                props: { variant: 'outline' },
                className: 'w-full',
                children: ['تسجيل الدخول باستخدام Google'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
