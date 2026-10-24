import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { selectRoot } from '../src/select';
import { fieldRoot, asFieldSelectTrigger } from '../src/field';
const events: string[] = [];
const probe = definePrototype({
  name: 'test-select-field-report-order',
  setup() {
    const h = asFieldSelectTrigger();
    const b = h.getAsHookHandle!('as-optional-field-control')!;
    const report = b.report;
    b.report = (v) => {
      events.push('report:' + v.reason);
      return report(v);
    };
  },
});
for (const p of [fieldRoot, selectRoot, probe]) AdaptToWebComponent(p as any);
it('records actual binding call order separately from queued web event delivery', async () => {
  const field = document.createElement(fieldRoot.name),
    root = document.createElement(selectRoot.name) as any,
    trigger = document.createElement(probe.name);
  root.append(trigger);
  field.append(root);
  setElementProps(field, { validationMode: 'onChange', externalValidation: true });
  document.body.append(field);
  await new Promise((r) => setTimeout(r, 0));
  events.length = 0;
  root.addEventListener('valueChange', () => {
    events.push('outward');
    root.remove();
  });
  field.addEventListener('validationRequest', () => events.push('validation-event'));
  root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' });
  await new Promise((r) => setTimeout(r, 0));
  expect(events).toContain('outward');
  expect(events).not.toContain('report:change');
  expect(events).not.toContain('validation-event');
  field.remove();
});
