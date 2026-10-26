import { describe, expect, it } from 'vitest';
import { createHomepageCompositionParts } from './homepage-composition-parts';
import type { DemoChild, DemoNode } from '../PrototypePreviewer/demo-types';

const families = ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const;
function fixture(family: (typeof families)[number], locale = 'en') {
  const ids = new Set<string>();
  const p = (id: string, children: DemoChild[] = [], props = {}, ref?: string): DemoNode => {
    ids.add(id);
    return {
      kind: 'proto',
      prototypeId: id,
      children,
      props,
      ...(ref ? { ref } : {}),
    };
  };
  const box = (
    className: string,
    children: DemoChild[],
    ref?: string,
    attrs?: Record<string, string>
  ): DemoNode => ({
    kind: 'box',
    className,
    children,
    ...(ref ? { ref } : {}),
    ...(attrs ? { attrs } : {}),
  });
  const result = createHomepageCompositionParts(family, locale, {
    p,
    box,
    card: (title, caption, children, id) => box('card', [title, caption, ...children], id),
    button: (label, ref) => p(`${family}-button`, [label], { wrap: true }, ref),
    status: (value, ref) => box('status', [value], ref, { role: 'status' }),
  });
  const callbacks = new Map<string, (detail: Record<string, unknown>) => void>();
  const props = new Map<string, Record<string, unknown>>();
  const feedback = new Map<string, string>();
  result.setup({
    bind: (ref, event, callback) => {
      callbacks.set(`${ref}:${event}`, callback);
    },
    write: (ref, next) => {
      props.set(ref, { ...props.get(ref), ...next });
    },
    feedback: (ref, value) => {
      feedback.set(ref, value);
    },
  });
  const fire = (ref: string, event: string, detail = {}) =>
    callbacks.get(`${ref}:${event}`)!(detail);
  const nodes: Exclude<DemoNode, { kind: 'text' }>[] = [];
  const visit = (node: DemoChild) => {
    if (typeof node === 'string' || node.kind === 'text') return;
    nodes.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  [result.command, result.progress, result.help].forEach(visit);
  return { result, ids, nodes, props, feedback, fire };
}

describe('homepage workspace compositions', () => {
  for (const family of families) {
    it(`${family} keeps real parts, one ref owner and family paint outside page code`, () => {
      const { nodes, ids } = fixture(family);
      expect([...ids].every((id) => id.startsWith(`${family}-`))).toBe(true);
      for (const suffix of [
        'command-root',
        'command-input',
        'command-content',
        'command-item',
        'command-empty',
        'slider-root',
        'slider-track',
        'slider-thumb',
        'slider-indicator',
        'progress-root',
        'progress-track',
        'progress-indicator',
        'progress-label',
        'progress-value',
        'accordion-root',
        'accordion-item',
        'accordion-heading',
        'accordion-trigger',
        'accordion-content',
      ]) {
        expect(ids.has(`${family}-${suffix}`)).toBe(true);
      }
      const wrapper = nodes.filter(
        (node) => node.kind === 'proto' && node.prototypeId === 'shadcn-command-input-wrapper'
      );
      const shell = nodes.filter(
        (node) => node.kind === 'proto' && node.prototypeId === 'shadcn-input-shell'
      );
      expect(wrapper).toHaveLength(family === 'shadcn' ? 1 : 0);
      expect(shell).toHaveLength(family === 'shadcn' ? 1 : 0);
      if (family === 'shadcn') {
        expect(wrapper[0]!.children).toEqual([shell[0]]);
        expect(shell[0]!.kind === 'proto' && shell[0]!.props).toEqual({ focusIndicator: 'none' });
        expect(shell[0]!.children).toHaveLength(1);
        expect(shell[0]!.children?.[0]).toMatchObject({
          kind: 'proto',
          prototypeId: 'shadcn-command-input',
          ref: 'composition-command-input',
        });
      }
      const refs = nodes.flatMap((node) => (node.ref ? [node.ref] : []));
      expect(new Set(refs).size).toBe(refs.length);
      for (const node of nodes.filter((node) => node.kind === 'proto')) {
        expect(node.className).toBeUndefined();
        expect(node.surfaceStyle).toBeUndefined();
        expect(node.props).not.toHaveProperty('styleProfile');
        expect(() => JSON.stringify(node.props)).not.toThrow();
      }
    });
    it(`${family} links command and slider to the same plan and supports repeated reset`, () => {
      const { fire, props, feedback } = fixture(family);
      fire('composition-command', 'execute', { value: 'prototype' });
      expect(props.get('composition-progress')).toEqual({ value: 60 });
      expect(props.get('composition-slider')).toEqual({ value: 60 });
      expect(feedback.get('composition-command-status')).toBe('Selected: Build a prototype');
      fire('composition-slider', 'valueChange', { value: 75 });
      expect(props.get('composition-progress')).toEqual({ value: 75 });
      expect(feedback.get('composition-progress-status')).toBe('Plan progress: 75%');
      for (let i = 0; i < 3; i++) {
        fire('composition-reset', 'click');
        expect(props.get('composition-progress')).toEqual({ value: 40 });
        expect(props.get('composition-slider')).toEqual({ value: 40 });
      }
      fire('composition-command', 'execute', { value: 'publish' });
      fire('composition-command', 'execute', { value: 'unknown' });
      for (const value of [-1, 101, NaN, Infinity, '80'])
        fire('composition-slider', 'valueChange', { value });
      expect(props.get('composition-progress')).toEqual({ value: 40 });
    });
  }
  it('localizes user-facing feedback and retains real disclosure headings', () => {
    const { nodes, fire, feedback } = fixture('shadcn', 'zh-cn');
    fire('composition-command', 'execute', { value: 'outline' });
    expect(feedback.get('composition-command-status')).toBe('已选择：整理提纲');
    expect(feedback.get('composition-progress-status')).toBe('计划进度 25%');
    const headings = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'shadcn-accordion-heading'
    );
    expect(headings).toHaveLength(3);
    expect(headings.every((node) => node.kind === 'proto' && node.props?.level === 3)).toBe(true);
  });
});
