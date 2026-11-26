import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type DemoProtoNode = Extract<DemoNode, { kind: 'proto' }>;

export function createFormPrimitivesDemo(
  family: string,
  component: 'fieldset' | 'form' | 'checkbox-group'
): DemoSpec {
  const atom = (
    name: string,
    part: string,
    props: Record<string, unknown> = {},
    children: DemoProtoNode['children'] = [],
    ref?: string
  ): DemoProtoNode => ({
    kind: 'proto',
    prototypeId: `${family}-${name}-${part}`,
    props,
    children,
    ref,
    ...(family === 'base'
      ? {
          className:
            name === 'slider' && part === 'track'
              ? 'relative block h-3 w-full rounded bg-slate-200'
              : name === 'slider' && part === 'indicator'
                ? 'absolute left-0 top-0 h-full w-[calc(var(--pui-percentage)*1%)] bg-slate-700'
                : name === 'slider' && part === 'field-thumb'
                  ? 'absolute left-[calc(var(--pui-percentage)*1%)] top-1/2 block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-white'
                  : part === 'control'
                    ? 'block w-full rounded border px-3 py-2'
                    : ['submit', 'reset', 'increment', 'decrement', 'item', 'all'].includes(part)
                      ? 'inline-flex rounded border px-3 py-2'
                      : ['root', 'field'].includes(part)
                        ? 'grid w-full min-w-0 gap-3'
                        : 'block',
        }
      : {}),
  });
  const field = (name: string, label: string, placeholder: string, form = false) =>
    atom(
      form ? 'form' : 'field',
      form ? 'field' : 'root',
      form ? { name, required: true } : { required: true },
      [
        atom('field', 'label', {}, [label]),
        atom('field', 'control', { placeholder }),
        atom('field', 'error'),
      ]
    );
  const root: DemoNode =
    component === 'checkbox-group'
      ? atom(
          component,
          'root',
          { defaultValue: ['email'], ariaLabel: 'Notification channels · 通知方式' },
          [
            atom(component, 'all', {}, ['All channels · 全选']),
            atom(component, 'item', { value: 'email' }, ['Email · 邮件']),
            atom(component, 'item', { value: 'sms' }, ['SMS · 短信']),
            atom(component, 'item', { value: 'push', disabled: true }, [
              'Push disabled · 推送已禁用',
            ]),
          ]
        )
      : component === 'fieldset'
        ? atom(
            component,
            'root',
            {},
            [
              atom(component, 'legend', {}, ['Profile · 资料']),
              atom(component, 'description', {}, [
                'Related fields share one policy · 相关字段共享策略',
              ]),
              field(
                'Display name · 显示名',
                'Display name · 显示名',
                'Type here · 在此输入',
                false
              ),
            ],
            'group'
          )
        : atom(
            component,
            'root',
            { ariaLabel: 'Account preferences form' },
            [
              field('displayName', 'Display name', 'Ada Lovelace', true),
              atom('form', 'field', { name: 'quantity' }, [
                atom('field', 'label', {}, ['Team seats']),
                atom('number-field', 'root', { defaultValue: 2 }, [
                  atom('number-field', 'decrement', {}, ['−']),
                  atom('number-field', 'control'),
                  atom('number-field', 'increment', {}, ['+']),
                ]),
              ]),
              atom('form', 'field', { name: 'code' }, [
                atom('field', 'label', {}, ['Verification code']),
                atom('input-otp', 'root', { defaultValue: '12' }, [atom('input-otp', 'control')]),
              ]),
              atom('form', 'field', { name: 'level' }, [
                atom('field', 'label', {}, ['Alert threshold']),
                atom('slider', 'root', { defaultValue: 25 }, [
                  atom('slider', 'track', {}, [
                    atom('slider', 'indicator'),
                    atom('slider', 'field-thumb'),
                  ]),
                  atom('slider', 'value'),
                ]),
              ]),
              atom('form', 'field', { name: 'channels' }, [
                atom('field', 'label', {}, ['Notification channels']),
                atom('checkbox-group', 'root', { defaultValue: ['email'] }, [
                  atom('checkbox-group', 'item', { value: 'email' }, ['Email']),
                  atom('checkbox-group', 'item', { value: 'sms' }, ['SMS']),
                ]),
              ]),
              {
                kind: 'box',
                className:
                  family === 'bootstrap-2-3-2'
                    ? 'flex flex-wrap items-center gap-2 border-t border-border pt-3 mt-2'
                    : 'flex flex-wrap items-center gap-2 pt-1',
                children: [
                  atom(component, 'submit', {}, ['Save changes']),
                  atom(component, 'reset', family === 'shadcn' ? { variant: 'outline' } : {}, [
                    'Reset',
                  ]),
                ],
              },
            ],
            'form'
          );

  const formContent: DemoNode = {
    kind: 'box',
    className:
      component === 'form' && family === 'liquid-glass'
        ? 'grid w-full max-w-md min-w-0 gap-4'
        : component === 'form'
          ? 'grid w-full max-w-md min-w-0 gap-4 p-4'
          : 'grid w-full min-w-0 gap-4 p-4',
    children: [
      root,
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs text-muted-foreground',
        children: [
          component === 'form'
            ? 'Fill in the required fields and submit to inspect the serialized payload.'
            : 'Use the real controls above · 操作上方真实控件',
        ],
      },
    ],
  };

  return {
    type: 'demo',
    root:
      component === 'form' && family === 'liquid-glass'
        ? {
            kind: 'box',
            className: 'flex w-full justify-center',
            children: [formContent],
          }
        : formContent,
    setup({ api, refs }) {
      if (component !== 'form') return;
      api.setProps('form', {
        ariaLabel: 'Account preferences form',
        onSubmit: (detail: { values: unknown }) => {
          refs.status.textContent = `Submitted: ${JSON.stringify(detail.values)}`;
        },
        onInvalid: (detail: { names: string[] }) => {
          refs.status.textContent = `Please review required fields: ${detail.names.join(', ')}`;
        },
        onReset: () => {
          refs.status.textContent = 'Form reset to initial values.';
        },
      });
    },
  };
}
