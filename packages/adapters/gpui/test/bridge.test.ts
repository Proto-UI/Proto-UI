import { describe, expect, it } from 'vitest';
import { FakeGpuiBridge } from '../src/fake-bridge';

/**
 * Feasibility-spike harness checks (issue #466). These validate the fake
 * bridge contract the adapter would rely on: retained tree identity, scripted
 * input routing into EventTarget shims, and disposal semantics. No DOM.
 */
describe('adapter-gpui spike: fake bridge harness', () => {
  it('retains committed element identity across commits', () => {
    const bridge = new FakeGpuiBridge();
    const label = { id: 'btn-label', kind: 'text' as const, text: 'OK', children: [] };
    bridge.commit({ id: 'btn', kind: 'div', children: [label] });
    expect(bridge.find('btn-label')?.text).toBe('OK');
    expect(bridge.commitCalls).toBe(1);

    bridge.commit({ id: 'btn', kind: 'div', children: [{ id: 'btn-label', kind: 'text', text: 'OK!', children: [] }] });
    expect(bridge.find('btn-label')?.text).toBe('OK!');
  });

  it('routes pointer messages to root target and key/focus to global target', () => {
    const bridge = new FakeGpuiBridge();
    bridge.commit({ id: 'btn', kind: 'div', children: [] });

    const pointerEvents: string[] = [];
    bridge.rootTarget.addEventListener('pointerdown', () => pointerEvents.push('down'));
    bridge.rootTarget.addEventListener('pointerup', () => pointerEvents.push('up'));

    const globalEvents: string[] = [];
    bridge.globalTarget.addEventListener('keydown', () => globalEvents.push('key'));
    bridge.globalTarget.addEventListener('focus', () => globalEvents.push('focus'));

    bridge.receive({ type: 'pointer.down', x: 1, y: 2, targetId: 'btn' });
    bridge.receive({ type: 'pointer.up', x: 1, y: 2, targetId: 'btn' });
    bridge.receive({ type: 'key.down', key: 'Tab', code: 'Tab' });
    bridge.receive({ type: 'focus.changed', focusedId: 'btn' });

    expect(pointerEvents).toEqual(['down', 'up']);
    expect(globalEvents).toEqual(['key', 'focus']);
  });

  it('refuses input and commits after terminal dispose', () => {
    const bridge = new FakeGpuiBridge();
    bridge.dispose();
    expect(bridge.isDisposed).toBe(true);
    expect(() =>
      bridge.receive({ type: 'pointer.down', x: 0, y: 0, targetId: 'gpui-root' })
    ).toThrow(/disposed/);
    expect(() => bridge.commit({ id: 'x', kind: 'div', children: [] })).toThrow(/disposed/);
  });
});
