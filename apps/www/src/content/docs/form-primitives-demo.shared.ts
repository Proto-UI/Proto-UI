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
              atom(component, 'submit', {}, ['Validate and submit · 校验并提交']),
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
