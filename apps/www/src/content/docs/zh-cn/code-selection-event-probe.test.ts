import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sourcePath = './code-surfaces.browser.test.ts';
const source = ts.createSourceFile(
  'code-surfaces.browser.test.ts',
  readFileSync(new URL(sourcePath, import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true
);
const declaration = source.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'installNativeSelectionEventProbe'
)!;

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

function fixture() {
  const pre = document.createElement('pre');
  pre.innerHTML =
    '<code><span class="line"><span>&lt;</span><span>wc-base-transition</span><span> open</span></span></code>';
  document.body.append(pre);
  const line = pre.querySelector('.line')!;
  const token = line.children[1] as HTMLElement;
  const selection = window.getSelection()!;
  const chosen = document.createRange();
  chosen.selectNodeContents(token);
  selection.addRange(chosen);
  const before = {
    html: pre.innerHTML,
    text: selection.toString(),
    range: selection.getRangeAt(0),
  };
  const caret = document.createRange();
  caret.setStart(line.firstChild!.firstChild!, 0);
  caret.collapse(true);
  const listeners = new Map<string, EventListener>();
  const host = {
    // Injected hit/caret/style facts test recorder fidelity, not Chromium layout.
    elementFromPoint: vi.fn(() => line),
    caretRangeFromPoint: vi.fn(() => caret),
    addEventListener: vi.fn((type: string, listener: EventListener, _options: object) => {
      listeners.set(type, listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener, _capture: boolean) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    }),
  };
  const install = vm.runInNewContext(
    transformSync(`${declaration.getText(source)}\ninstallNativeSelectionEventProbe;`, {
      loader: 'ts',
      target: 'es2022',
    }).code,
    {
      document: host,
      Node,
      Element,
      MouseEvent,
      getSelection: () => selection,
      getComputedStyle: () => ({ position: 'sticky', width: '64px', pointerEvents: 'auto' }),
    }
  );
  const probe = install(token, { x: 89.8125, y: 531.5, width: 140.4375, height: 15 });
  return { pre, line, token, selection, before, host, listeners, probe };
}

describe('source-bound passive native selection recorder (no browser or network)', () => {
  it('records exact hit/caret, same-token and Selection facts without modifying them', () => {
    const { pre, selection, before, host, probe } = fixture();
    const facts = probe.finish();
    expect(facts.initial.start).toMatchObject({
      point: { x: 90.8125, y: 539 },
      hit: { relation: 'line', className: 'line' },
      caret: { node: { text: '<', relation: 'other' }, offset: 0 },
    });
    expect(facts.initial.token).toMatchObject({ connected: true, sameToken: true });
    expect(facts.initial.gutter).toMatchObject({ position: 'sticky', width: '64px' });
    expect(facts.initial.selection.text).toBe('wc-base-transition');
    expect(facts.final.selection.text).toBe(before.text);
    expect(pre.innerHTML).toBe(before.html);
    expect(selection.getRangeAt(0)).toBe(before.range);
    for (const [, , options] of host.addEventListener.mock.calls)
      expect(options).toEqual({ capture: true, passive: true });
  });

  it('labels synthetic unit input honestly and observes later cancellation without causing it', () => {
    const { line, listeners, probe } = fixture();
    const event = new MouseEvent('mousedown', {
      clientX: 90.8125,
      clientY: 539,
      buttons: 1,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', { value: line });
    listeners.get('mousedown')!(event);
    expect(event.defaultPrevented).toBe(false);
    event.preventDefault();
    const facts = probe.finish();
    expect(facts.events).toHaveLength(1);
    expect(facts.events[0]).toMatchObject({
      type: 'mousedown',
      phase: 'capture-before-default',
      // Happy DOM leaves this undefined; record the host fact without inventing trust.
      isTrusted: event.isTrusted,
      target: { relation: 'line' },
      buttons: 1,
      defaultPreventedAfterDispatch: true,
    });
  });

  it('bounds event collection and removes every passive listener at finish', () => {
    const { listeners, host, probe } = fixture();
    for (let index = 0; index < 70; index++)
      listeners.get('mousemove')!(new MouseEvent('mousemove', { buttons: 1 }));
    const facts = probe.finish();
    expect(facts.events).toHaveLength(64);
    expect(facts.dropped).toBe(6);
    expect(listeners.size).toBe(0);
    expect(host.removeEventListener).toHaveBeenCalledTimes(7);
  });

  it('detects a replaced original token and preserves an observation failure as diagnostics', () => {
    const { token, host, listeners, probe } = fixture();
    token.replaceWith(token.cloneNode(true));
    host.elementFromPoint.mockImplementationOnce(() => {
      throw new Error('controlled hit read failure');
    });
    listeners.get('mousedown')!(new MouseEvent('mousedown'));
    const facts = probe.finish();
    expect(facts.final.token).toMatchObject({ connected: false, sameToken: false });
    expect(facts.errors).toEqual(['Error: controlled hit read failure']);
    expect(facts.events).toHaveLength(0);
  });
});
