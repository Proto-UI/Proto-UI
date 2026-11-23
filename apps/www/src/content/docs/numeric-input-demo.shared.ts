import type { DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';

type DemoProtoNode = Extract<DemoNode, { kind: 'proto' }>;

export function createNumericInputDemo(
  family: string,
  component: 'slider' | 'number-field' | 'input-otp'
): DemoSpec {
  const atom = (
    part: string,
    props: Record<string, unknown> = {},
    children: DemoProtoNode['children'] = []
  ): DemoProtoNode => ({
    kind: 'proto',
    prototypeId: `${family}-${component}-${part}`,
    props,
    children,
    ...(family === 'base'
      ? {
          className: (
            {
              root: 'flex w-full min-w-0 flex-wrap items-center gap-3',
              label: 'block w-full',
              track: 'relative block h-3 w-full rounded bg-slate-200',
              indicator:
                'absolute left-0 top-0 h-full w-[calc(var(--pui-percentage)*1%)] bg-slate-700',
              thumb:
                'absolute left-[calc(var(--pui-percentage)*1%)] top-1/2 block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-white',
              value: 'block tabular-nums',
              input: 'block min-w-0 flex-1 rounded border px-3 py-2',
              increment: 'block rounded border p-2',
              decrement: 'block rounded border p-2',
              slot: 'inline-flex size-10 items-center justify-center rounded border',
              separator: 'block px-1',
            } as Record<string, string>
          )[part],
        }
      : {}),
  });
  const children =
    component === 'slider'
      ? [
          atom('label', {}, ['Volume · 音量']),
          atom('track', {}, [atom('indicator'), atom('thumb')]),
          atom('value'),
        ]
      : component === 'number-field'
        ? [
            atom('label', {}, ['Amount · 金额 — 拖动标签 / Drag label']),
            atom('decrement', {}, ['−']),
            atom('input'),
            atom('increment', {}, ['+']),
          ]
        : [
            atom('input', { placeholder: '123456' }),
            ...Array.from({ length: 6 }, (_, index) => atom('slot', { index })),
          ];
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-4 p-4',
      children: [
        {
          ...atom(
            'root',
            component === 'input-otp'
              ? { length: 6, ariaLabel: 'Verification code · 验证码' }
              : component === 'number-field'
                ? {
                    defaultValue: 1234.5,
                    min: 0,
                    max: 10000,
                    step: 0.5,
                    locale: 'de-DE',
                    formatOptions: { minimumFractionDigits: 2 },
                    scrub: true,
                    scrubSteps: 20,
                    allowEmpty: true,
                    ariaLabel: 'Amount · 金额',
                  }
                : { defaultValue: 25, min: 0, max: 100, step: 5, ariaLabel: 'Value · 数值' },
            children
          ),
          ref: 'control',
        },
        ...(component === 'input-otp'
          ? [
              {
                kind: 'box' as const,
                className: 'text-sm text-muted-foreground',
                children: [
                  'Type a code, then move the caret or select a middle range in the real editor; the matching slots follow that selection. · 输入验证码后，在真实编辑器内移动光标或选中中间文本，活动槽随实际选区变化。',
                ],
              },
            ]
          : []),
        ...(component === 'number-field'
          ? [
              atom(
                'root',
                {
                  defaultValue: null,
                  allowEmpty: true,
                  locale: 'en-US',
                  ariaLabel: 'Optional quantity · 可选数量',
                },
                [
                  atom('label', {}, ['Optional quantity · 可选数量（可以留空 / may be empty）']),
                  atom('decrement', {}, ['−']),
                  atom('input'),
                  atom('increment', {}, ['+']),
                ]
              ),
            ]
          : []),
      ],
    },
  };
}
