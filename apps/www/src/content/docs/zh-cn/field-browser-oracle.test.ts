import { afterEach, describe, expect, it } from 'vitest';
import {
  fieldControlSelector,
  fieldEditorOwnerRef,
  fieldEditorSelector,
} from './field-browser-oracle';

afterEach(() => document.body.replaceChildren());
function inspect(markup: string) {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.append(host);
  const owners = host.querySelectorAll(fieldControlSelector('required'));
  const editors = host.querySelectorAll(fieldEditorSelector('required'));
  return (
    owners.length === 1 &&
    editors.length === 1 &&
    fieldEditorOwnerRef(editors[0]) === 'requiredControl'
  );
}
describe('Field native oracle exact authored Control ownership', () => {
  it.each(['react', 'vue', 'vue2'])('%s direct input host is its own editor', () => {
    expect(
      inspect('<input data-demo-ref="requiredControl"><input data-demo-ref="asyncControl">')
    ).toBe(true);
  });
  it('accepts the WC descendant editor', () => {
    expect(inspect('<test-control data-demo-ref="requiredControl"><input></test-control>')).toBe(
      true
    );
  });
  it.each([
    '<input data-demo-ref="asyncControl">',
    '<div data-demo-ref="requiredControl"></div><input data-demo-ref="asyncControl">',
    '<div data-demo-ref="requiredControl"><input><input></div>',
    '<input data-demo-ref="requiredControl"><input data-demo-ref="requiredControl">',
    '<div data-demo-ref="requiredControl"></div><input data-demo-ref="requiredControl">',
    '<div data-demo-ref="requiredControl"><input data-demo-ref="asyncControl"></div>',
    '<div data-demo-ref="requiredControl"><div data-demo-ref="asyncControl"><input></div></div>',
  ])('rejects missing, ambiguous and foreign editors: %s', (markup) => {
    expect(inspect(markup)).toBe(false);
  });
  it('walks a WC shadow boundary while preserving a nearer foreign owner', () => {
    const owner = document.createElement('test-control');
    owner.dataset.demoRef = 'requiredControl';
    const shadow = owner.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    shadow.append(input);
    document.body.append(owner);
    expect(fieldEditorOwnerRef(input)).toBe('requiredControl');
    input.dataset.demoRef = 'foreignControl';
    expect(fieldEditorOwnerRef(input)).toBe('foreignControl');
  });
});
