import { withShadcnRheaDemo } from '../shadcn-demo-style';
import type { DemoChild, DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type SwitchExample = {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  card?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  controlled?: boolean;
  direction?: 'rtl';
  draggable?: boolean;
};

// App composition only: Base remains the sole activation/value owner.
export const SWITCH_COMPOSITION_CASES: readonly SwitchExample[] = [
  {
    id: 'description',
    title: 'Share across devices',
    description: 'Focus is shared across devices, and turns off when you leave the app.',
    checked: false,
  },
  {
    id: 'choice',
    title: 'Enable notifications',
    description: 'Receive notifications when focus mode is enabled or disabled.',
    checked: false,
    card: true,
  },
  {
    id: 'selected',
    title: 'Sync notifications',
    description: 'Keep notification preferences synced across your signed-in devices.',
    checked: true,
    card: true,
  },
  {
    id: 'disabled',
    title: 'Archived notifications',
    description: 'This preference is currently unavailable for archived projects.',
    checked: true,
    disabled: true,
    card: true,
  },
  {
    id: 'controlled',
    title: 'Managed sync policy',
    description: 'Controlled by workspace policy; toggle requests are handled by the parent state.',
    checked: false,
    controlled: true,
    card: true,
  },
  {
    id: 'readonly',
    title: 'Read-only notifications',
    description: 'Visible for reference; changes are locked while review mode is active.',
    checked: false,
    readOnly: true,
    card: true,
  },
  {
    id: 'rtl',
    title: 'المشاركة عبر الأجهزة',
    description: 'يتم مشاركة التركيز عبر الأجهزة، ويتم إيقاف تشغيله عند مغادرة التطبيق.',
    checked: true,
    direction: 'rtl',
  },
  {
    id: 'drag',
    title: 'Draggable switch',
    description: 'Hold and drag the thumb across the track, then release to toggle.',
    checked: false,
    draggable: true,
  },
  {
    id: 'drag-rtl',
    title: 'السحب الاختياري',
    description: 'اضغط مع الاستمرار واسحب المقبض لتبديل الحالة.',
    checked: false,
    draggable: true,
    direction: 'rtl',
  },
];

const atom = (
  part: string,
  ref: string,
  props: Record<string, unknown> = {},
  children: DemoChild[] = [],
  className?: string
): DemoNode => ({
  kind: 'proto',
  prototypeId: `shadcn-${part}`,
  ref,
  props,
  children,
  ...(className ? { className } : {}),
});

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-lg gap-4',
    children: SWITCH_COMPOSITION_CASES.map(
      (entry): DemoNode => ({
        kind: 'box',
        ref: `${entry.id}-section`,
        attrs: { dir: entry.direction ?? 'ltr' },
        children: [
          atom(
            'field-root',
            `${entry.id}-card`,
            { disabled: entry.disabled ?? false, readOnly: entry.readOnly ?? false },
            [
              {
                kind: 'box',
                className: 'flex min-w-0 flex-1 flex-col gap-1',
                children: [
                  atom(
                    'field-label',
                    `${entry.id}-label`,
                    {},
                    [entry.title],
                    // The title owns activation and naming. The pseudo-element
                    // enlarges its hit region, not its accessible name.
                    entry.card ? "after:absolute after:inset-0 after:content-['']" : undefined
                  ),
                  atom('field-description', `${entry.id}-description`, {}, [
                    entry.description,
                    ...(entry.id === 'choice'
                      ? [
                          ' ',
                          {
                            kind: 'box' as const,
                            tag: 'a' as const,
                            ref: 'choice-link',
                            className: 'relative z-20 underline',
                            attrs: { href: '#switch-composition-details' },
                            children: ['Learn more'],
                          },
                        ]
                      : []),
                  ]),
                ],
              },
              atom(
                'field-switch',
                `${entry.id}-control`,
                {
                  ...(entry.controlled ? { checked: false } : { defaultChecked: entry.checked }),
                  draggable: entry.draggable ?? false,
                  direction: entry.direction ?? 'ltr',
                },
                [atom('switch-thumb', `${entry.id}-thumb`)],
                'relative z-10 shrink-0'
              ),
            ],
            'relative flex-row items-center gap-4 rounded-lg border p-4 ' +
              (entry.card
                ? 'has-[[role=switch][aria-checked=true]]:border-primary has-[[role=switch][aria-checked=true]]:bg-accent'
                : 'border-transparent')
          ),
          {
            kind: 'box',
            tag: 'span',
            ref: `${entry.id}-requests`,
            attrs: { 'aria-hidden': 'true', 'data-request-count': '0' },
            className: 'sr-only',
            children: ['Requests: 0'],
          },
        ],
      })
    ),
  },
  setup({ refs, api }) {
    for (const entry of SWITCH_COMPOSITION_CASES) {
      let count = 0;
      api.setProps(`${entry.id}-control`, {
        onCheckedChange: () => {
          count++;
          const output = refs[`${entry.id}-requests`];
          output.textContent = `Requests: ${count}`;
          output.dataset.requestCount = String(count);
        },
      });
    }
    // No click forwarding, synthetic activation, second checked owner or timers.
  },
};
export default withShadcnRheaDemo(demo);
