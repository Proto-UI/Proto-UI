import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { fieldRoot, asFieldSwitch } from '../src/field';
const events: string[] = [];
const probe = definePrototype({
  name: 'test-switch-field-report-order',
  setup() {
    const h = asFieldSwitch(),
      binding = h.getAsHookHandle!('as-optional-field-control')!,
      report = binding.report;
    binding.report = (value) => {
      events.push('report:' + value.reason);
      return report(value);
    };
  },
});
for (const p of [fieldRoot, probe]) AdaptToWebComponent(p as any);
it('does not call the Field binding after a synchronous checkedChange listener retires the control', async () => {
  const field = document.createElement(fieldRoot.name),
    root = document.createElement(probe.name);
  setElementProps(field, { validationMode: 'onChange', externalValidation: true });
  field.append(root);
  document.body.append(field);
  await new Promise((r) => setTimeout(r, 0));
  events.length = 0;
  root.addEventListener('checkedChange', () => {
    events.push('outward');
    root.remove();
  });
  field.addEventListener('validationRequest', () => events.push('validation-event'));
  root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  expect(events).toContain('outward');
  expect(events).not.toContain('report:change');
  expect(events).not.toContain('validation-event');
  field.remove();
});
