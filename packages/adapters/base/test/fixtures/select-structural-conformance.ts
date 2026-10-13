import { expect } from 'vitest';

export interface StructuralNode {
  part: string;
  name: string;
  props?: Record<string, unknown>;
  children?: Array<StructuralNode | string>;
}
export interface StructuralHarness {
  render(tree: StructuralNode): Promise<void>;
  event(action: () => void): Promise<void>;
  expose(name: string): any;
}

// Real framework trees and Adapter relationship projection under happy-dom.
// These assertions do not establish browser paint or native AT acceptance.
export async function checkSelectStructuralRelations(h: StructuralHarness) {
  let label = 'First group';
  let show = true;
  let duplicate = false;
  let replacement = 0;
  let moved = false;
  const n = (
    part: string,
    name: string,
    children: Array<StructuralNode | string> = [],
    props: Record<string, unknown> = {}
  ): StructuralNode => ({ part, name, children, props });
  const tree = () =>
    n(
      'selectRoot',
      'root',
      [
        n('selectTrigger', 'trigger', ['Choose']),
        n('selectContent', 'content', [
          n('selectGroup', 'first', [
            ...(show && !moved ? [n('selectLabel', `label${replacement}`, [label])] : []),
            ...(duplicate ? [n('selectLabel', 'duplicate', ['Duplicate'])] : []),
            n('selectItem', 'alpha', ['Alpha'], { value: 'alpha', textValue: 'Alpha' }),
            n('selectGroup', 'inner', [n('selectLabel', 'innerLabel', ['Inner'])]),
            n('selectRoot', 'nestedRoot', [n('selectLabel', 'orphan', ['Orphan'])]),
          ]),
          n('selectSeparator', 'separator', ['MUST NOT RENDER']),
          n('selectGroup', 'second', [
            moved
              ? n('selectLabel', `label${replacement}`, [label])
              : n('selectLabel', 'secondLabel', ['Second group']),
            n('selectItem', 'beta', ['Beta'], { value: 'beta', textValue: 'Beta' }),
          ]),
          n('selectItem', 'plain', ['Plain'], { value: 'plain', textValue: 'Plain' }),
        ]),
      ],
      { defaultOpen: true, defaultValue: 'alpha' }
    );
  const el = (name: string) => {
    const node = document.querySelector<HTMLElement>(`.test-select-${name}`);
    expect(node, name).not.toBeNull();
    return node!;
  };
  const named = (group: string, name: string) => {
    expect(el(group).getAttribute('role')).toBe('group');
    const target = el(name);
    expect(target.id).not.toBe('');
    expect(el(group).getAttribute('aria-labelledby')).toBe(target.id);
    expect(document.getElementById(target.id)).toBe(target);
    return target.id;
  };
  const unnamed = (group: string) => expect(el(group).getAttribute('aria-labelledby')).toBeNull();
  await h.render(tree());
  const firstId = named('first', 'label0');
  const secondId = named('second', 'secondLabel');
  named('inner', 'innerLabel');
  expect(firstId).not.toBe(secondId);
  expect(el('nestedRoot').getAttribute('role')).not.toBe('group');
  unnamed('nestedRoot');
  expect(el('separator').getAttribute('aria-hidden')).toBe('true');
  expect(el('separator').getAttribute('role')).not.toBe('separator');
  expect(el('separator').textContent).not.toContain('MUST NOT RENDER');
  expect([...el('content').querySelectorAll('[role="option"]')].map((e) => e.textContent)).toEqual([
    'Alpha',
    'Beta',
    'Plain',
  ]);

  label = 'Updated group';
  await h.render(tree());
  expect(named('first', 'label0')).toBe(firstId);
  expect(el('label0').textContent).toBe(label);
  duplicate = true;
  await h.render(tree());
  unnamed('first');
  named('second', 'secondLabel');
  duplicate = false;
  show = false;
  await h.render(tree());
  unnamed('first'); // Nested Select's orphan Label cannot name this outer Group.
  named('inner', 'innerLabel');
  show = true;
  replacement++;
  await h.render(tree());
  const replacementId = named('first', 'label1');
  expect(replacementId).not.toBe(firstId);
  expect(document.getElementById(firstId)).toBeNull();
  moved = true;
  await h.render(tree());
  unnamed('first');
  named('second', 'label1');
  expect(document.getElementById(secondId)).toBeNull();
  // Group wrappers and decorative parts must not steal Item selection ownership.
  await h.event(() =>
    el('beta').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  );
  expect(h.expose('root').value.get()).toBe('beta');
  expect(h.expose('root').textValue.get()).toBe('Beta');
}
