import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';
export function createFormPrimitivesDemo(
  family: string,
  component: 'fieldset' | 'form' | 'checkbox-group'
): DemoSpec {
  const atom = (
    name: string,
    part: string,
    props: Record<string, unknown> = {},
    children: DemoNode['children'] = [],
    ref?: string
  ): DemoNode => ({
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
  const field = (name: string, form = false) =>
    atom(
      form ? 'form' : 'field',
      form ? 'field' : 'root',
      form ? { name, required: true } : { required: true },
      [
        atom('field', 'label', {}, [name]),
        atom('field', 'control', { placeholder: 'Type here · 在此输入' }),
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
              field('Display name · 显示名'),
            ],
            'group'
          )
        : atom(
            component,
            'root',
            { ariaLabel: 'Profile form · 资料表单' },
            [
              field('displayName', true),
              atom('form', 'field', { name: 'quantity' }, [
                atom('field', 'label', {}, ['Quantity · 数量']),
                atom('number-field', 'root', { defaultValue: 2 }, [
                  atom('number-field', 'decrement', {}, ['−']),
                  atom('number-field', 'control'),
                  atom('number-field', 'increment', {}, ['+']),
                ]),
              ]),
              atom('form', 'field', { name: 'code' }, [
                atom('field', 'label', {}, ['Code · 验证码']),
                atom('input-otp', 'root', { defaultValue: '12' }, [atom('input-otp', 'control')]),
              ]),
              atom('form', 'field', { name: 'level' }, [
                atom('field', 'label', {}, ['Level · 等级']),
                atom('slider', 'root', { defaultValue: 25 }, [
                  atom('slider', 'track', {}, [
                    atom('slider', 'indicator'),
                    atom('slider', 'field-thumb'),
                  ]),
                  atom('slider', 'value'),
                ]),
              ]),
              atom('form', 'field', { name: 'channels' }, [
                atom('field', 'label', {}, ['Channels · 通知方式']),
                atom('checkbox-group', 'root', { defaultValue: ['email'] }, [
                  atom('checkbox-group', 'item', { value: 'email' }, ['Email · 邮件']),
                  atom('checkbox-group', 'item', { value: 'sms' }, ['SMS · 短信']),
                ]),
              ]),
              atom(component, 'submit', {}, ['Validate and submit · 校验并提交']),
              atom(component, 'reset', {}, ['Reset values · 复位值']),
            ],
            'form'
          );
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-4 p-4',
      children: [
        root,
        {
          kind: 'box',
          ref: 'status',
          children: ['Use the real controls above · 操作上方真实控件'],
        },
      ],
    },
    setup({ api, refs }) {
      if (component !== 'form') return;
      const report = (detail: { values: unknown }) => {
        refs.status.textContent = JSON.stringify(detail.values);
      };
      api.setProps('form', { ariaLabel: 'Profile form · 资料表单', onSubmit: report });
      const listener = (event: Event) => {
        if (event instanceof CustomEvent && event.target === refs.form) report(event.detail);
      };
      refs.form.addEventListener('submit', listener);
      return () => refs.form.removeEventListener('submit', listener);
    },
  };
}
