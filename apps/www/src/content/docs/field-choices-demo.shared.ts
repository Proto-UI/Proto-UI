import type { DemoNode, DemoSpec } from '../../components/PrototypePreviewer/demo-types';

/** Ordinary consumer-owned controlled values and stale responses. Field and
 * Form supply validation/serialization; the recipe only chooses owner policy. */
export function createFieldChoicesDemo(family: string): DemoSpec {
  type Proto = Extract<DemoNode, { kind: 'proto' }>;
  const p = (
    part: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: Proto['children'] = []
  ): Proto => ({ kind: 'proto', prototypeId: `${family}-${part}`, ref, props, children });
  const button = (ref: string, text: string) => ({
    ...p('button', ref, {}, [text]),
    ...(family === 'base' ? { className: 'rounded border px-3 py-2 text-sm' } : {}),
  });
  const option = (value: string, text: string, disabled = false): DemoNode => ({
    kind: 'box',
    className: 'flex items-center gap-3',
    children: [
      {
        ...p('radio-group-item', `plan-${value}`, { value, disabled }, [
          p('radio-group-indicator', `plan-${value}-indicator`),
        ]),
        associations: { controlLabel: `choice-plan-${value}` },
        ...(family === 'base'
          ? {
              className:
                'size-5 rounded-full border outline-none data-[checked]:bg-primary focus-visible:ring-2',
            }
          : {}),
      },
      {
        ...p('label-root', `plan-${value}-label`, {}, [text]),
        associations: { controlLabel: `choice-plan-${value}` },
      },
    ],
  });
  const fields = (): DemoNode => ({
    kind: 'box',
    className: 'grid gap-5',
    children: [
      p(
        'form-field',
        'agreeField',
        { name: 'agreement', required: true, validationMode: 'onChange' },
        [
          p('field-label', 'agreeLabel', {}, ['Accept updates · 接收更新']),
          p('field-description', 'agreeHelp', {}, [
            'Required boolean. Mixed display is not consent. · 必选布尔值，混合显示不代表已同意。',
          ]),
          {
            ...p('field-checkbox', 'agreement', { checked: false, defaultIndeterminate: true }, [
              p('checkbox-indicator', 'agreementIndicator'),
            ]),
            ...(family === 'base'
              ? {
                  className:
                    'size-5 rounded border outline-none data-[checked]:bg-primary focus-visible:ring-2',
                }
              : {}),
          },
          p('field-error', 'agreeError'),
        ]
      ),
      p('form-field', 'planField', { name: 'plan', required: true, validationMode: 'onChange' }, [
        p('field-label', 'planLabel', {}, ['Plan · 计划']),
        p('field-description', 'planHelp', {}, [
          'Read-only keeps arrow navigation, with no value request. · 只读时仍可漫游焦点，不改变选择。',
        ]),
        p('field-radio-group', 'plan', { value: '' }, [
          option('basic', 'Basic · 基础'),
          option('pro', 'Pro · 专业'),
          option('unavailable', 'Unavailable · 不可用', true),
        ]),
        p('field-error', 'planError'),
      ]),
      p('form-field', 'alertsField', { name: 'alerts' }, [
        p('field-label', 'alertsLabel', {}, ['Alerts · 提醒']),
        {
          ...p('field-switch', 'alerts', { defaultChecked: false }, [
            p('switch-thumb', 'alertsThumb'),
          ]),
          ...(family === 'base'
            ? {
                className:
                  'h-6 w-12 rounded-full border outline-none data-[checked]:bg-primary focus-visible:ring-2',
              }
            : {}),
        },
      ]),
    ],
  });
  const entries = [
    'form-field',
    'field-label',
    'field-description',
    'field-error',
    'field-checkbox',
    'checkbox-indicator',
    'field-radio-group',
    'radio-group-item',
    'radio-group-indicator',
    'label-root',
    'field-switch',
    'switch-thumb',
  ];
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid gap-4 p-4',
      children: [
        p('form-root', 'choiceForm', {}, [
          p('fieldset-root', 'choiceGroup', {}, [
            p('fieldset-legend', 'choiceLegend', {}, ['Subscription · 订阅']),
            {
              kind: 'box',
              ref: 'choiceFields',
              dynamicChildren: { prototypeIds: entries.map((entry) => `${family}-${entry}`) },
            },
          ]),
          {
            kind: 'box',
            className: 'flex flex-wrap gap-2',
            children: [
              p('form-submit', 'choiceSubmit', {}, ['Submit · 提交']),
              p('form-reset', 'choiceReset', {}, ['Reset · 复位']),
            ],
          },
        ]),
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2',
          children: [
            button('choiceToggleOwner', 'Accept / refuse requests · 接受／拒绝'),
            button('choiceReadOnly', 'Toggle read-only · 切换只读'),
            button('choiceDisabled', 'Toggle disabled · 切换禁用'),
            button('choiceHold', 'Hold next owner reply · 暂存下一次回复'),
            button('choiceDeliver', 'Deliver held reply · 送达暂存回复'),
            button('choiceReplace', 'Replace controls · 更换控件实例'),
            button('choiceReplaceOnRequest', 'Replace on next request · 在下一次提案中更换'),
          ],
        },
        {
          kind: 'box',
          ref: 'choiceStatus',
          className: 'font-mono text-xs',
          children: ['Preparing controls · 正在准备控件'],
        },
        {
          kind: 'box',
          ref: 'choiceHeld',
          className: 'font-mono text-xs',
          children: ['No held response · 无暂存回复'],
        },
        {
          kind: 'box',
          ref: 'choiceSubmission',
          className: 'font-mono text-xs',
          children: ['No submit · 尚未提交'],
        },
      ],
    },
    setup({ api, refs }) {
      let alive = true,
        revision = 0,
        accepts = true,
        readonly = false,
        disabled = false,
        proposals = 0,
        submits = 0;
      let holdNext = false,
        replaceOnRequest = false;
      let held:
        | { revision: number; ref: string; key: 'checked' | 'value'; value: unknown }
        | undefined;
      const status = () => {
        if (alive)
          refs.choiceStatus.textContent = `revision=${revision} proposals=${proposals} owner=${accepts ? 'accept' : 'refuse'} readonly=${readonly} disabled=${disabled}`;
      };
      const submitValues = () =>
        (api.getExposes('choiceForm') as { getValues?(): unknown } | undefined)?.getValues?.();
      const install = async () => {
        const current = ++revision;
        const result = await api.setChildren?.('choiceFields', [
          { key: `choice-owner-${current}`, node: fields() },
        ]);
        if (!alive || current !== revision || result !== 'committed') return;
        const propose = (ref: string, key: 'checked' | 'value', next: unknown) => {
          if (!alive || current !== revision) return;
          proposals++;
          if (replaceOnRequest) {
            replaceOnRequest = false;
            void install();
            status();
            return;
          }
          if (holdNext) {
            holdNext = false;
            held = { revision: current, ref, key, value: next };
            refs.choiceHeld.textContent = `held revision=${current}`;
          } else if (accepts)
            queueMicrotask(() => {
              if (alive && current === revision) api.setProps(ref, { [key]: next });
            });
          status();
        };
        for (const field of ['agreeField', 'planField', 'alertsField'])
          api.setProps(field, { readOnly: readonly });
        api.setProps('agreement', {
          onCheckedChange: (detail: { checked: boolean }) =>
            propose('agreement', 'checked', detail.checked),
        });
        api.setProps('plan', {
          onValueChange: (detail: { value: string }) => propose('plan', 'value', detail.value),
        });
        status();
      };
      api.setProps('choiceForm', {
        onSubmit: () => {
          if (alive)
            refs.choiceSubmission.textContent = `submitted=${++submits} ${JSON.stringify(submitValues())}`;
        },
        onInvalid: () => {
          if (alive) refs.choiceSubmission.textContent = 'required values missing';
        },
        onReset: () => {
          if (alive) refs.choiceSubmission.textContent = 'reset requested';
        },
      });
      api.setProps('choiceToggleOwner', {
        onClick: () => {
          accepts = !accepts;
          status();
        },
      });
      api.setProps('choiceReadOnly', {
        onClick: () => {
          readonly = !readonly;
          for (const field of ['agreeField', 'planField', 'alertsField'])
            api.setProps(field, { readOnly: readonly });
          status();
        },
      });
      api.setProps('choiceDisabled', {
        onClick: () => {
          disabled = !disabled;
          api.setProps('choiceGroup', { disabled });
          status();
        },
      });
      api.setProps('choiceHold', {
        onClick: () => {
          holdNext = true;
          refs.choiceHeld.textContent = 'next response will be held';
        },
      });
      api.setProps('choiceDeliver', {
        onClick: () => {
          if (!alive || !held) return;
          const response = held;
          held = undefined;
          if (response.revision !== revision) {
            refs.choiceHeld.textContent = `stale revision=${response.revision} current=${revision}`;
            return;
          }
          api.setProps(response.ref, { [response.key]: response.value });
          refs.choiceHeld.textContent = `accepted revision=${revision}`;
        },
      });
      api.setProps('choiceReplace', {
        onClick: () => {
          if (alive) void install();
        },
      });
      api.setProps('choiceReplaceOnRequest', {
        onClick: () => {
          replaceOnRequest = true;
          refs.choiceHeld.textContent = 'next request replaces controls';
        },
      });
      void install();
      return () => {
        alive = false;
        revision++;
        held = undefined;
      };
    },
  };
}
