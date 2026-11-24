import type { DemoNode, DemoSpec, DemoChild } from '@/components/PrototypePreviewer/demo-types';

type Request = { openItems: string[]; value: string; open: boolean; reason: string };

export function createAccordionDemo(family: string): DemoSpec {
  const atom = (
    role: string,
    ref: string,
    props: Record<string, unknown>,
    children: DemoChild[]
  ): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-accordion-${role}`,
    ref,
    props,
    // The Base demo owns panel layout. Make its open panels block-formatted
    // without overriding the Prototype's retained hidden state.
    ...(family === 'base'
      ? {
          className:
            role === 'trigger'
              ? 'block w-full min-w-0 max-w-full rounded border p-3 text-left whitespace-normal wrap-anywhere'
              : role === 'content'
                ? 'data-[open]:block p-3'
                : 'block min-w-0',
        }
      : role === 'trigger'
        ? { className: 'wrap-anywhere' }
        : {}),
    children,
  });

  const item = (
    scope: string,
    value: string,
    label: string,
    props: Record<string, unknown> = {},
    retained = false,
    children: DemoChild[] = [
      'Manage settings and review details for this section without leaving the page.',
    ]
  ): DemoNode =>
    atom('item', `${scope}-${value}-item`, { value, ...props }, [
      atom('heading', `${scope}-${value}-heading`, { level: 3 }, [
        atom('trigger', `${scope}-${value}-trigger`, {}, [label]),
      ]),
      atom(
        'content',
        `${scope}-${value}-content`,
        { keepMounted: retained, region: true },
        children
      ),
    ]);

  const group = (ref: string, props: Record<string, unknown>, children: DemoNode[]): DemoNode =>
    atom('root', ref, props, children);

  const section = (ref: string, children: DemoNode[]): DemoNode[] =>
    family === 'liquid-glass'
      ? [
          {
            kind: 'box',
            ref,
            className:
              'min-w-0 w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-4',
            // Independent examples own bounded visible sources in the same tree.
            materialStage: { mountRef: `${ref}Flow`, overlayRef: `${ref}Overlay` },
            children: [
              {
                kind: 'box',
                ref: `${ref}Flow`,
                // Keep the inner gutter inside each source's paint footprint.
                className: 'grid grid-cols-1 min-w-0 gap-4 p-2',
                children,
              },
              { kind: 'box', ref: `${ref}Overlay`, children: [] },
            ],
          },
        ]
      : children;

  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid grid-cols-1 w-full max-w-2xl mx-auto min-w-0 gap-6 p-2',
      children: [
        ...section('singleStage', [
          group('single', { defaultOpenItems: ['overview'] }, [
            item('single', 'overview', 'What are your shipping options?', {}, false, [
              {
                kind: 'box',
                className: 'grid grid-cols-1 gap-3 min-w-0',
                children: [
                  'We offer standard (5–7 days), express (2–3 days), and overnight shipping. Free shipping on international orders.',
                  group('nested', {}, [
                    item('nested', 'overview', 'Standard & express delivery', {}, false, [
                      'Standard delivery arrives in 5–7 business days. Express orders ship the same day.',
                    ]),
                    item('nested', 'details', 'International tracking', {}, false, [
                      'Every international shipment includes end-to-end tracking and customs documentation.',
                    ]),
                  ]),
                ],
              },
            ]),
            item('single', 'lifetime', 'What is your return policy?', {}, false, [
              'Returns are accepted within 30 days. Items must be unused and in original packaging. Refunds are processed within 5–7 business days.',
            ]),
            item(
              'single',
              'disabled',
              'Enterprise SLA details (Unavailable)',
              { disabled: true },
              false,
              ['Dedicated SLA terms are available on enterprise plans.']
            ),
            item(
              'single',
              'long',
              'How can I contact customer support for international billing, invoices, and custom enterprise accounts?',
              {},
              false,
              [
                {
                  kind: 'box',
                  className: 'min-w-0 wrap-anywhere',
                  children: [
                    'Reach us anytime via support@example.com, live chat, or phone. We respond within 24 hours during business days.',
                  ],
                },
              ]
            ),
          ]),
        ]),
        ...section('multipleStage', [
          {
            kind: 'box',
            className: 'text-sm font-medium text-muted-foreground',
            children: ['Multiple open (at least one stays open)'],
          },
          group('multiple', { mode: 'multiple', allowEmpty: false, defaultOpenItems: ['a'] }, [
            item('multiple', 'a', 'Notification settings', {}, true, [
              'Choose how you receive updates across email alerts and mobile push notifications.',
            ]),
            item('multiple', 'b', 'Privacy & security', {}, true, [
              'Manage two-factor authentication, connected devices, and active sessions.',
            ]),
          ]),
        ]),
        ...section('rtlStage', [
          {
            kind: 'box',
            className: 'text-sm font-medium text-muted-foreground',
            children: ['Horizontal RTL header navigation'],
          },
          {
            kind: 'box',
            attrs: { dir: 'rtl' },
            className: 'min-w-0 w-full',
            children: [
              group('rtl', { orientation: 'horizontal', direction: 'rtl', loop: false }, [
                item('rtl', 'a', 'كيف يمكنني إعادة تعيين كلمة المرور؟', {}, false, [
                  'انقر على «نسيت كلمة المرور» في صفحة تسجيل الدخول وسنرسل لك رابطًا لإعادة التعيين.',
                ]),
                item('rtl', 'b', 'هل يمكنني تغيير خطة الاشتراك؟', {}, false, [
                  'نعم، يمكنك ترقية خطتك أو تخفيضها في أي وقت من إعدادات الحساب.',
                ]),
              ]),
            ],
          },
        ]),
        ...section('controlledStage', [
          {
            kind: 'box',
            className: 'text-sm font-medium text-muted-foreground',
            children: ['Controlled state approval'],
          },
          group('controlled', { openItems: [] }, [
            item('controlled', 'a', 'Billing & subscription details', {}, false, [
              'View your current plan, payment history, and upcoming invoices.',
            ]),
          ]),
          {
            kind: 'box',
            className: 'flex flex-wrap items-center justify-between gap-3 min-w-0',
            children: [
              {
                kind: 'box',
                ref: 'requestStatus',
                className: 'text-sm text-muted-foreground min-w-0',
                attrs: { 'aria-live': 'polite' },
                children: ['Pending change: none'],
              },
              {
                kind: 'proto',
                prototypeId: `${family}-button`,
                ref: 'accept',
                className:
                  family === 'base'
                    ? 'min-w-0 max-w-full h-auto whitespace-normal wrap-anywhere rounded border px-3 py-2'
                    : 'min-w-0 max-w-full h-auto whitespace-normal wrap-anywhere',
                children: ['Apply change'],
              },
            ],
          },
        ]),
      ],
    },
    setup({ refs, api }) {
      let pending: Request | null = null;
      let openItems: string[] = [];
      const propose = (request: Request) => {
        pending = request;
        refs.requestStatus.textContent = `Pending change: ${request.openItems.join(', ') || 'collapsed'} (${request.reason})`;
      };
      const sync = () => api.setProps('controlled', { openItems, onOpenChange: propose });
      const accept = () => {
        if (!pending) return;
        openItems = [...pending.openItems];
        pending = null;
        sync();
        refs.requestStatus.textContent = `Applied state: ${openItems.join(', ') || 'collapsed'}`;
      };
      sync();
      api.setProps('accept', { onClick: accept });
    },
  };
}
