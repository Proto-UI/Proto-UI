import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import type { FieldValidationRequest } from '@proto.ui/prototypes-base/field';

/** A consumer-owned asynchronous validator. The result controls deliberately
 * hold real versioned requests so a reader can try refusal, stale results,
 * reset and nested policy changes without depending on a remote service. */
export function createFormValidationDemo(family: string): DemoSpec {
  type Proto = Extract<DemoNode, { kind: 'proto' }>;
  const atom = (
    name: string,
    part: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: Proto['children'] = []
  ): Proto => ({
    kind: 'proto',
    prototypeId: `${family}-${name}${part ? `-${part}` : ''}`,
    ref,
    props,
    children,
    ...(family === 'base'
      ? {
          className: ['root', 'field'].includes(part)
            ? 'grid min-w-0 gap-3'
            : ['control', 'textarea'].includes(part)
              ? 'block w-full rounded border px-3 py-2'
              : name === 'button' || ['submit', 'reset', 'item', 'all'].includes(part)
                ? 'inline-flex items-center rounded border px-3 py-2'
                : 'block',
        }
      : {}),
  });
  const button = (ref: string, text: string) => atom('button', '', ref, {}, [text]);
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-4 p-4',
      children: [
        {
          kind: 'box',
          className: 'text-sm text-muted-foreground',
          children: [
            'Submit or edit the account name to hold a validator request. Return a success or an error below, then edit or reset before delivering an older result. · 提交或修改账号以保留校验请求；下方返回成功或错误，也可在返回旧结果前编辑或复位。',
          ],
        },
        atom('form', 'root', 'form', { ariaLabel: 'Versioned account form · 版本化账号表单' }, [
          atom(
            'form',
            'field',
            'accountField',
            {
              name: 'account',
              required: true,
              externalValidation: true,
              validationMode: 'onChange',
            },
            [
              atom('field', 'label', 'accountLabel', {}, ['Account · 账号']),
              atom('field', 'control', 'accountControl', { value: 'ada', ariaLabel: 'Account' }),
              atom('field', 'description', 'accountHelp', {}, [
                'The application owns the value; pause its writes to try a rejected edit. · 值由应用所有，可暂停写回以尝试受控拒绝。',
              ]),
              atom('field', 'error', 'accountError'),
            ]
          ),
          atom('fieldset', 'root', 'outerGroup', {}, [
            atom('fieldset', 'legend', 'outerLegend', {}, ['Contact preferences · 联系偏好']),
            atom('fieldset', 'description', 'outerDescription', {}, [
              'The parent group can disable both nested fields. · 父组策略同时作用于嵌套字段。',
            ]),
            atom('fieldset', 'root', 'innerGroup', {}, [
              atom('fieldset', 'legend', 'innerLegend', {}, ['Notifications · 通知']),
              atom('form', 'field', 'channelsField', { name: 'channels', required: true }, [
                atom('field', 'label', 'channelsLabel', {}, ['Channels · 通知方式']),
                atom(
                  'checkbox-group',
                  'root',
                  'channels',
                  { defaultValue: ['email'], ariaLabel: 'Notification channels' },
                  [
                    atom('checkbox-group', 'all', 'allChannels', {}, ['All · 全选']),
                    atom('checkbox-group', 'item', 'email', { value: 'email' }, ['Email · 邮件']),
                    atom('checkbox-group', 'item', 'sms', { value: 'sms' }, ['SMS · 短信']),
                  ]
                ),
                atom('field', 'error', 'channelsError'),
              ]),
            ]),
            atom('form', 'field', 'notesField', { name: 'notes' }, [
              atom('field', 'label', 'notesLabel', {}, ['Notes · 备注']),
              atom('field', 'textarea', 'notes', {
                defaultValue: 'Keep this multiline note.',
                rows: 2,
              }),
            ]),
          ]),
          atom('form', 'submit', 'submit', {}, ['Validate and submit · 校验并提交']),
          atom('form', 'reset', 'reset', {}, ['Reset values and validation · 复位值与校验']),
        ]),
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2',
          children: [
            button('acceptResult', 'Return success · 返回成功'),
            button('rejectResult', 'Return error · 返回错误'),
            button('staleResult', 'Deliver old results · 返回旧结果'),
            button('cancelSubmit', 'Cancel submit · 取消提交'),
          ],
        },
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2',
          children: [
            button('toggleOwner', 'Toggle owner acceptance · 切换接受写回'),
            button('toggleReadOnly', 'Toggle readOnly · 切换只读'),
            button('toggleDisabled', 'Toggle parent disabled · 切换父组禁用'),
          ],
        },
        {
          kind: 'box',
          ref: 'policyStatus',
          className: 'font-mono text-xs',
          children: ['owner=accept readOnly=false groupDisabled=false'],
        },
        {
          kind: 'box',
          ref: 'validatorStatus',
          className: 'font-mono text-xs',
          children: ['No validator request · 尚无校验请求'],
        },
        {
          kind: 'box',
          ref: 'submissionStatus',
          className: 'font-mono text-xs',
          children: ['No submission · 尚未提交'],
        },
      ],
    },
    setup({ api, refs }) {
      let alive = true,
        accepts = true,
        readOnly = false,
        groupDisabled = false;
      let submitted = 0;
      const requests: FieldValidationRequest[] = [];
      const policy = () => {
        refs.policyStatus.textContent = `owner=${accepts ? 'accept' : 'reject'} readOnly=${readOnly} groupDisabled=${groupDisabled}`;
      };
      const resolve = (invalid: boolean) => {
        const request = requests.pop();
        if (!alive || !request) return;
        const accepted = api.call('accountField', 'resolveValidation', request.requestId, {
          invalid,
          errors: invalid ? ['Choose another account · 请更换账号'] : [],
        });
        refs.validatorStatus.textContent = `${accepted ? 'accepted' : 'stale'} ${invalid ? 'error' : 'success'} value=${JSON.stringify(request.value)}`;
      };
      api.setProps('accountControl', {
        onValueChange: (event: { value: string }) => {
          if (alive && accepts) api.setProps('accountControl', { value: event.value });
        },
      });
      api.setProps('accountField', {
        onValidationRequest: (request: FieldValidationRequest) => {
          if (!alive) return;
          requests.push(request);
          refs.validatorStatus.textContent = `pending value=${JSON.stringify(request.value)} held=${requests.length}`;
        },
      });
      api.setProps('form', {
        onSubmit: (event: { values: unknown }) => {
          if (alive)
            refs.submissionStatus.textContent = `submitted=${++submitted} ${JSON.stringify(event.values)}`;
        },
        onInvalid: (event: { names: string[] }) => {
          if (alive) refs.submissionStatus.textContent = `invalid=${event.names.join(',')}`;
        },
        onReset: () => {
          if (alive) refs.submissionStatus.textContent = 'reset';
        },
      });
      api.setProps('acceptResult', { onClick: () => resolve(false) });
      api.setProps('rejectResult', { onClick: () => resolve(true) });
      api.setProps('staleResult', {
        onClick: () => {
          if (!alive) return;
          const pending = (api.call('accountField', 'getValidity') as { pending: boolean }).pending;
          const old = requests.splice(
            0,
            pending ? Math.max(0, requests.length - 1) : requests.length
          );
          const outcomes = old.map((request) =>
            api.call('accountField', 'resolveValidation', request.requestId, {
              invalid: true,
              errors: ['Old result · 旧结果'],
            })
          );
          refs.validatorStatus.textContent = `old-results ${outcomes.map((accepted) => (accepted ? 'accepted' : 'stale')).join(',')}`;
        },
      });
      api.setProps('cancelSubmit', {
        onClick: () => {
          if (alive) {
            api.call('form', 'cancelSubmit');
            refs.submissionStatus.textContent = 'canceled';
          }
        },
      });
      api.setProps('toggleOwner', {
        onClick: () => {
          if (alive) {
            accepts = !accepts;
            policy();
          }
        },
      });
      api.setProps('toggleReadOnly', {
        onClick: () => {
          if (alive) {
            readOnly = !readOnly;
            api.setProps('accountField', { readOnly });
            api.setProps('notesField', { readOnly });
            policy();
          }
        },
      });
      api.setProps('toggleDisabled', {
        onClick: () => {
          if (alive) {
            groupDisabled = !groupDisabled;
            api.setProps('outerGroup', { disabled: groupDisabled });
            policy();
          }
        },
      });
      return () => {
        alive = false;
        requests.length = 0;
      };
    },
  };
}
