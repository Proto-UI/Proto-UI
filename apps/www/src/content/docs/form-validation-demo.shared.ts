import type { DemoNode, DemoSpec } from '../../components/PrototypePreviewer/demo-types';
import type { FieldValidationRequest } from '@proto.ui/prototypes-base/field';

/** A consumer-owned asynchronous validator. The simulator controls hold real
 * versioned requests so readers can test async approval, rejection, stale
 * responses, reset, and nested fieldset disabling without a backend server. */
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
  const button = (ref: string, text: string) =>
    atom(
      'button',
      '',
      ref,
      family === 'shadcn'
        ? { variant: 'outline', size: 'sm' }
        : family === 'liquid-glass'
          ? { material: 'opaque' }
          : {},
      [text]
    );

  const inner: DemoNode = {
    kind: 'box',
    className:
      family === 'liquid-glass'
        ? 'grid w-full max-w-md min-w-0 gap-4 rounded-2xl border border-border bg-background/85 p-5'
        : 'grid w-full max-w-md min-w-0 gap-4 p-4',
    children: [
      atom('form', 'root', 'form', { ariaLabel: 'Account validation form' }, [
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
            atom('field', 'label', 'accountLabel', {}, ['Username']),
            atom('field', 'control', 'accountControl', { value: 'ada', ariaLabel: 'Username' }),
            atom('field', 'description', 'accountHelp', {}, [
              'Checked asynchronously against the latest validation request.',
            ]),
            atom('field', 'error', 'accountError'),
          ]
        ),
        atom('fieldset', 'root', 'outerGroup', {}, [
          atom('fieldset', 'legend', 'outerLegend', {}, ['Contact preferences']),
          atom('fieldset', 'description', 'outerDescription', {}, [
            'Disabling this section excludes nested fields from submission.',
          ]),
          atom('fieldset', 'root', 'innerGroup', {}, [
            atom('fieldset', 'legend', 'innerLegend', {}, ['Notifications']),
            atom('form', 'field', 'channelsField', { name: 'channels', required: true }, [
              atom('field', 'label', 'channelsLabel', {}, ['Channels']),
              atom(
                'checkbox-group',
                'root',
                'channels',
                { defaultValue: ['email'], ariaLabel: 'Notification channels' },
                [
                  atom('checkbox-group', 'all', 'allChannels', {}, ['All']),
                  atom('checkbox-group', 'item', 'email', { value: 'email' }, ['Email']),
                  atom('checkbox-group', 'item', 'sms', { value: 'sms' }, ['SMS']),
                ]
              ),
              atom('field', 'error', 'channelsError'),
            ]),
          ]),
          atom('form', 'field', 'notesField', { name: 'notes' }, [
            atom('field', 'label', 'notesLabel', {}, ['Notes']),
            atom('field', 'textarea', 'notes', {
              defaultValue: 'Send a summary email after release.',
              rows: 2,
            }),
          ]),
        ]),
        {
          kind: 'box',
          className: 'flex flex-wrap items-center gap-2 pt-1',
          children: [
            atom('form', 'submit', 'submit', {}, ['Submit']),
            atom('form', 'reset', 'reset', family === 'shadcn' ? { variant: 'outline' } : {}, [
              'Reset',
            ]),
          ],
        },
      ]),
      {
        kind: 'box',
        className: 'grid gap-3 rounded-lg border border-border p-3',
        children: [
          {
            kind: 'box',
            className: 'text-xs font-medium text-muted-foreground',
            children: ['Async validator controls'],
          },
          {
            kind: 'box',
            className: 'flex flex-wrap gap-2',
            children: [
              button('acceptResult', 'Approve'),
              button('rejectResult', 'Reject'),
              button('staleResult', 'Deliver stale'),
              button('cancelSubmit', 'Cancel submit'),
            ],
          },
          {
            kind: 'box',
            className: 'flex flex-wrap gap-2',
            children: [
              button('toggleOwner', 'Toggle writes'),
              button('toggleReadOnly', 'Toggle readOnly'),
              button('toggleDisabled', 'Toggle fieldset'),
            ],
          },
          {
            kind: 'box',
            ref: 'policyStatus',
            className: 'text-xs text-muted-foreground',
            children: ['Writes: enabled | readOnly: false | fieldset disabled: false'],
          },
          {
            kind: 'box',
            ref: 'validatorStatus',
            className: 'text-xs text-muted-foreground',
            children: ['Waiting for a validation request.'],
          },
          {
            kind: 'box',
            ref: 'validationResults',
            className: 'whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground',
            children: ['No validator response delivered yet.'],
          },
          {
            kind: 'box',
            ref: 'submissionStatus',
            className: 'text-xs text-muted-foreground',
            children: ['Not submitted yet.'],
          },
        ],
      },
    ],
  };

  return {
    type: 'demo',
    root:
      family === 'liquid-glass'
        ? {
            kind: 'box',
            className:
              'flex w-full justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
            children: [inner],
          }
        : inner,
    setup({ api, refs }) {
      let alive = true,
        accepts = true,
        readOnly = false,
        groupDisabled = false;
      let submitted = 0;
      const requests: FieldValidationRequest[] = [];
      let latestRequest: FieldValidationRequest | undefined;
      const policy = () => {
        refs.policyStatus.textContent = `Writes: ${accepts ? 'enabled' : 'paused'} | readOnly: ${readOnly} | fieldset disabled: ${groupDisabled}`;
      };
      const validationSnapshot = () => ({
        latestRequest: latestRequest
          ? { requestId: latestRequest.requestId, value: latestRequest.value }
          : null,
        validity: api.call('accountField', 'getValidity'),
      });
      const deliver = (
        kind: 'old-results' | 'error' | 'success',
        held: FieldValidationRequest[],
        invalid: boolean,
        errors: string[]
      ) => {
        const before = validationSnapshot();
        const results = held.map((request) => ({
          requestId: request.requestId,
          value: request.value,
          accepted: api.call('accountField', 'resolveValidation', request.requestId, {
            invalid,
            errors,
          }),
        }));
        const after = validationSnapshot();
        const summary =
          kind === 'old-results'
            ? `Stale responses: ${results.map(({ accepted }) => (accepted ? 'accepted' : 'discarded')).join(', ') || 'none'}`
            : `${results[0].accepted ? 'Accepted' : 'Discarded'} ${kind} for ${JSON.stringify(results[0].value)}`;
        refs.validationResults.textContent = JSON.stringify(
          { kind, summary, results, before, after },
          null,
          2
        );
        refs.validatorStatus.textContent = summary;
      };
      const resolve = (invalid: boolean) => {
        const request = requests.pop();
        if (!alive || !request) return;
        deliver(
          invalid ? 'error' : 'success',
          [request],
          invalid,
          invalid ? ['This username is already taken.'] : []
        );
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
          latestRequest = request;
          refs.validatorStatus.textContent = `Pending check for ${JSON.stringify(request.value)} (${requests.length} queued)`;
        },
      });
      api.setProps('form', {
        onSubmit: (event: { values: unknown }) => {
          if (alive)
            refs.submissionStatus.textContent = `Submitted (#${++submitted}): ${JSON.stringify(event.values)}`;
        },
        onInvalid: (event: { names: string[] }) => {
          if (alive)
            refs.submissionStatus.textContent = `Invalid fields: ${event.names.join(', ')}`;
        },
        onReset: () => {
          if (alive) refs.submissionStatus.textContent = 'Form reset.';
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
          deliver('old-results', old, true, ['Stale check result']);
        },
      });
      api.setProps('cancelSubmit', {
        onClick: () => {
          if (alive) {
            api.call('form', 'cancelSubmit');
            refs.submissionStatus.textContent = 'Submission canceled.';
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
        latestRequest = undefined;
      };
    },
  };
}
