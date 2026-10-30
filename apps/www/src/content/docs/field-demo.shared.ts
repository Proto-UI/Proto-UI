import type { DemoChild, DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import type { FieldValidationRequest } from '@proto.ui/prototypes-base/field';
export function createFieldDemo(family: string): DemoSpec {
  const atom = (
    role: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: DemoChild[] = []
  ): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-field-${role}`,
    ref,
    props,
    children,
    ...(family === 'base'
      ? {
          className:
            role === 'control'
              ? 'block w-full min-w-0 rounded border px-3 py-2'
              : role === 'root'
                ? 'grid min-w-0 gap-2'
                : 'block break-words',
        }
      : {}),
  });
  const field = (
    id: string,
    label: string,
    props: Record<string, unknown> = {},
    controlProps: Record<string, unknown> = {},
    help = 'Visible name, help and current errors are linked to one editor. 标签、帮助及当前错误关联唯一编辑器。',
    actions: DemoChild[] = [],
    control?: DemoNode
  ) =>
    atom('root', `${id}Root`, props, [
      atom('label', `${id}Label`, {}, [label]),
      control ?? atom('control', `${id}Control`, controlProps),
      atom('description', `${id}Description`, {}, [help]),
      // Keep commands before feedback that can detach or wrap during a native
      // change on blur, so that feedback does not move a pressed command.
      ...actions,
      atom('error', `${id}Error`),
      atom('validity', `${id}Validity`),
    ]);
  const button = (ref: string, text: string) => ({
    kind: 'proto' as const,
    prototypeId: `${family}-button`,
    ref,
    children: [text],
    className: 'rounded border px-3 py-2',
  });
  const part = (
    role: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: DemoChild[] = []
  ): DemoNode => ({ kind: 'proto', prototypeId: `${family}-${role}`, ref, props, children });
  const additionalControls =
    family === 'shadcn' || family === 'bootstrap-2-3-2' || family === 'liquid-glass'
      ? [
          field(
            'multiline',
            'Project summary · 项目简介',
            { required: true },
            {},
            'A multiline editor shares the same Field validation owner. 多行编辑器沿用同一 Field 校验所有者。',
            [],
            atom('textarea', 'multilineControl', {
              rows: 3,
              defaultValue: 'A portable component system.',
            })
          ),
          field(
            'delivery',
            'Delivery method · 通知方式',
            { required: true },
            {},
            'The Select owner commits the value; Field observes its bound trigger. Select 所有者提交值，Field 观察绑定的触发器。',
            [],
            part('select-root', 'deliverySelect', { defaultValue: 'email' }, [
              atom('select-trigger', 'deliveryControl', {}, [
                part('select-value', 'deliveryValue', {
                  placeholder: 'Choose a method · 选择方式',
                }),
              ]),
              part('select-content', 'deliveryContent', {}, [
                part('select-surface', 'deliverySurface', {}, [
                  part('select-viewport', 'deliveryViewport', {}, [
                    part('select-group', 'deliveryGroup', {}, [
                      part('select-label', 'deliveryGroupLabel', {}, ['Delivery · 通知']),
                      part('select-item', 'deliveryEmail', { value: 'email', textValue: 'Email' }, [
                        part('select-item-text', 'deliveryEmailText', {}, ['Email · 邮件']),
                      ]),
                      part(
                        'select-item',
                        'deliveryPush',
                        { value: 'push', textValue: 'Push notification' },
                        [
                          part('select-item-text', 'deliveryPushText', {}, [
                            'Push notification · 推送',
                          ]),
                        ]
                      ),
                    ]),
                  ]),
                ]),
              ]),
            ])
          ),
          field(
            'notifications',
            'Allow notifications · 允许通知',
            {},
            {},
            'The Switch is the one canonical boolean control. Switch 是唯一的布尔值控件。',
            [],
            atom('switch', 'notificationsControl', { defaultChecked: true }, [
              part('switch-thumb', 'notificationsThumb'),
            ])
          ),
        ]
      : [];
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-8 p-3',
      children: [
        field(
          'required',
          'Account name · 账户名',
          { required: true, minLength: 3, validationMode: 'onBlur' },
          { placeholder: 'At least 3 characters · 至少 3 个字符' }
        ),
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2',
          children: [
            button('validate', 'Validate · 校验'),
            button('reset', 'Reset validation · 清除校验'),
          ],
        },
        field(
          'async',
          'Availability check · 可用性检查',
          { externalValidation: true, validationMode: 'onChange' },
          { defaultValue: 'available' },
          'Try “taken”, then replace it before the reply. 试填 taken，再于返回前修改。',
          [button('cancel', 'Cancel pending check · 取消待返回检查')]
        ),
        {
          kind: 'box',
          ref: 'asyncStatus',
          attrs: { 'aria-live': 'polite' },
          children: ['No request yet · 暂无请求'],
        },
        field(
          'controlled',
          'Owner-rejected validity · 所有者拒绝的校验状态',
          { invalid: false, required: true, validationMode: 'manual' },
          { placeholder: 'Empty remains owner-valid · 空值仍由所有者定为有效' }
        ),
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2',
          children: [
            button('propose', 'Propose invalidity · 请求无效'),
            button('accept', 'Accept proposal · 接受请求'),
          ],
        },
        { kind: 'box', ref: 'controlledStatus', children: ['No validity proposal · 暂无校验提案'] },
        field(
          'readonly',
          'Read-only value · 只读值',
          { readOnly: true },
          { defaultValue: 'Readable and focusable · 可读可聚焦' }
        ),
        field(
          'disabled',
          'Disabled control · 禁用控件',
          { disabled: true },
          { defaultValue: 'Interaction disabled · 交互已禁用' }
        ),
        field(
          'long',
          'A deliberately long label remains readable at narrow widths and enlarged text · 长标签在窄屏与放大字号下保持完整可读',
          {},
          {},
          'Long help text wraps without creating a second editor or an extra tab stop. 长帮助文本自然换行，不创建第二个编辑器或额外 Tab 焦点。'
        ),
        ...additionalControls,
      ],
    },
    setup({ refs, api }) {
      let alive = true,
        currentRequest = '',
        pendingResult: { invalid: boolean; errors: string[] } | null = null;
      const timers = new Set<ReturnType<typeof setTimeout>>();
      const check = (request: FieldValidationRequest) => {
        if (currentRequest === request.requestId) return;
        currentRequest = request.requestId;
        refs.asyncStatus.textContent = 'Checking · 检查中';
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!alive) return;
          const invalid = request.value === 'taken';
          const accepted = api.call('asyncRoot', 'resolveValidation', request.requestId, {
            invalid,
            errors: invalid ? ['This name is taken. 此名称已被使用。'] : [],
          });
          if (currentRequest === request.requestId)
            refs.asyncStatus.textContent = accepted
              ? invalid
                ? 'Unavailable · 已被使用'
                : 'Available · 可用'
              : 'Outdated result ignored · 已忽略过期结果';
        }, 500);
        timers.add(timer);
      };
      api.setProps('asyncRoot', {
        externalValidation: true,
        validationMode: 'onChange',
        onValidationRequest: check,
      });
      const propose = (value: { invalid: boolean; errors: string[] }) => {
        pendingResult = { invalid: value.invalid, errors: [...value.errors] };
        refs.controlledStatus.textContent = `Proposed invalid=${value.invalid}; owner unchanged · 校验提案尚未接受`;
      };
      api.setProps('controlledRoot', {
        invalid: false,
        required: true,
        validationMode: 'manual',
        onValidityChange: propose,
      });
      const action = (ref: string, callback: () => void) => {
        api.setProps(ref, { onClick: callback });
      };
      action('validate', () => api.call('requiredRoot', 'validate'));
      action('reset', () => api.call('requiredRoot', 'resetValidation'));
      action('cancel', () => {
        api.call('asyncRoot', 'cancelValidation');
        currentRequest = '';
        refs.asyncStatus.textContent = 'Canceled · 已取消';
      });
      action('propose', () => api.call('controlledRoot', 'validate'));
      action('accept', () => {
        if (!pendingResult) return;
        api.setProps('controlledRoot', {
          invalid: pendingResult.invalid,
          errors: pendingResult.errors,
          required: true,
          validationMode: 'manual',
          onValidityChange: propose,
        });
        pendingResult = null;
        refs.controlledStatus.textContent = 'Accepted by owner · 所有者已接受';
      });
      return () => {
        alive = false;
        for (const timer of timers) clearTimeout(timer);
      };
    },
  };
}
