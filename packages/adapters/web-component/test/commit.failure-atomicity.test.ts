import { afterEach, describe, expect, it } from 'vitest';
import { commitChildren } from '../src/commit';
import type { TemplateChild } from '@proto.ui/core';

const slot = () => ({ type: { kind: 'slot' } });
const invalid: [string, unknown, string][] = [
  ['PrototypeRef', { type: { kind: 'prototype', name: 'forbidden' } }, 'PrototypeRef'],
  ['second slot', slot(), 'slot:multiple'],
  ['slot children', { ...slot(), children: 'forbidden' }, 'slot:children'],
  ['slot style', { ...slot(), style: { kind: 'tw', tokens: [] } }, 'slot:style'],
  ['named slot', { type: { kind: 'slot', name: 'forbidden' } }, 'slot:named'],
  [
    'SVG leaf children',
    { kind: 'svg-node', tag: 'path', props: { d: 'M0 0' }, children: 'forbidden' },
    'children unsupported',
  ],
  [
    'throwing type accessor',
    {
      get type() {
        throw new Error('blueprint accessor failed');
      },
    },
    'blueprint accessor failed',
  ],
];

afterEach(() => {
  document.body.replaceChildren();
});

describe('commit failure atomicity before caller slot movement', () => {
  for (const [name, bad, message] of invalid) {
    it(`keeps caller nodes, focus and selection when a later ${name} fails`, () => {
      const host = document.createElement('div');
      const before = document.createElement('span');
      const editor = document.createElement('input');
      editor.value = 'preserve this selection';
      const after = document.createTextNode('tail');
      host.append(before, editor, after);
      document.body.append(host);
      editor.focus();
      editor.setSelectionRange(2, 9, 'backward');
      const original = [...host.childNodes];
      const tree = [slot(), { type: 'section', children: [bad] }] as TemplateChild[];
      const commit = () => commitChildren(host, tree, { slotPool: [editor, after] });
      if (message) expect(commit).toThrow(message);
      else expect(commit).toThrow();
      expect([...host.childNodes]).toEqual(original);
      expect(editor.parentNode).toBe(host);
      expect(document.activeElement).toBe(editor);
      expect(editor.selectionStart).toBe(2);
      expect(editor.selectionEnd).toBe(9);
      expect(editor.selectionDirection).toBe('backward');
      expect(editor.value).toBe('preserve this selection');
    });
  }
  it('still places caller nodes in the intended nested slot on success', () => {
    const host = document.createElement('div');
    const caller = document.createElement('button');
    caller.textContent = 'caller';
    host.append(caller);
    const result = commitChildren(host, { type: 'section', children: [slot()] } as TemplateChild, {
      slotPool: [caller],
    });
    expect(result.hasSlot).toBe(true);
    expect(host.querySelector('section')?.childNodes[1]).toBe(caller);
    expect(caller.previousSibling).toBe(result.slotStart);
    expect(caller.nextSibling).toBe(result.slotEnd);
  });
});
