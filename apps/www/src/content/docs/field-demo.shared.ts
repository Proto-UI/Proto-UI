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
    help = 'Visible name, help and current errors are linked to one editor. 标签、帮助及当前错误关联唯一编辑器。'
  ) =>
    atom('root', `${id}Root`, props, [
      atom('label', `${id}Label`, {}, [label]),
      atom('control', `${id}Control`, controlProps),
      atom('description', `${id}Description`, {}, [help]),
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
          'Try “taken”, then replace it before the reply. 试填 taken，再于返回前修改。'
        ),
        {
          kind: 'box',
          ref: 'asyncStatus',
          attrs: { 'aria-live': 'polite' },
          children: ['No request yet · 暂无请求'],
        },
        button('cancel', 'Cancel pending check · 取消待返回检查'),
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
      ],
    },
    setup({ refs, api }) {
      let alive = true,
        currentRequest = '',
        pendingResult: { invalid: boolean; errors: string[] } | null = null;
      const timers = new Set<ReturnType<typeof setTimeout>>();
      const removals: Array<() => void> = [];
      const listen = (ref: string, eventName: string, callback: (detail: any) => void) => {
        const listener = (event: Event) => {
          if (event instanceof CustomEvent && event.target === refs[ref]) callback(event.detail);
        };
        refs[ref].addEventListener(eventName, listener);
        removals.push(() => refs[ref].removeEventListener(eventName, listener));
      };
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
      listen('asyncRoot', 'validationRequest', check);
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
      listen('controlledRoot', 'validityChange', propose);
      const action = (ref: string, callback: () => void) => {
        api.setProps(ref, { onClick: callback });
        listen(ref, 'click', callback);
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
        for (const remove of removals) remove();
      };
    },
  };
}
