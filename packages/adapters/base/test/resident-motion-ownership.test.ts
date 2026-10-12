import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractResidentMotionTarget } from '../../../modules/feedback/src/motion/targets';
import { createWebResidentMotionSink } from '../src/motion/web-resident-motion';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
it('rejects supported selector-scoped concurrent timing writer', () => {
  const tokens = ['bg-input', 'hover:transition-all'];
  expect(renderProtoStyleTokenCss(tokens)).toContain('transition-property: all');
  expect(extractResidentMotionTarget(tokens, 'background-color').supported).toBe(false);
});
function harness() {
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  const el = document.createElement('div');
  document.body.append(el);
  let flush = () => {};
  const sink = createWebResidentMotionSink(el, {
    queueStyle() {},
    requestFlush() {
      flush();
    },
  });
  let revision = 0;
  const commit = (tokens: string[]) =>
    sink.commit({
      view: 1,
      revision: ++revision,
      style: { kind: 'tw', tokens },
      declarations: [{ properties: ['translate'], durationMs: 100, easing: [0, 0, 1, 1] }],
    });
  return {
    el,
    sink,
    commit,
    setFlush(fn: () => void) {
      flush = fn;
    },
  };
}
it('release during effect flush must not resurrect inline presentation', () => {
  const h = harness();
  h.commit(['translate-x-[1px]']);
  h.setFlush(() => h.sink.release(1));
  h.commit(['translate-x-[2px]']);
  expect(h.el.style.getPropertyValue('translate')).toBe('');
});
it('reacquires current inline value after unsupported channel releases lease', () => {
  const h = harness();
  h.el.style.setProperty('translate', '3px 0px');
  h.commit(['translate-x-[1px]']);
  h.commit([]);
  expect(h.el.style.getPropertyValue('translate')).toBe('3px 0px');
  h.el.style.setProperty('translate', '8px 0px');
  h.commit(['translate-x-[2px]']);
  h.sink.release(1);
  expect(h.el.style.getPropertyValue('translate')).toBe('8px 0px');
});

it.each(['[&:hover]:transition-all', 'data-[phase=enter]:!transition-all', 'hover:animate-in'])(
  'rejects scoped timing %s',
  (token) => {
    expect(extractResidentMotionTarget(['bg-input', token], 'background-color').supported).toBe(
      false
    );
  }
);
it.each(['hover:-rotate-45', '[&:active]:scale-95'])(
  'rejects scoped transform composition %s',
  (token) => {
    expect(extractResidentMotionTarget(['translate-x-0', token], 'translate')).toEqual({
      supported: false,
      reason: 'transform-composition-unavailable',
    });
  }
);
it('a newer commit during flush remains the sole final writer', () => {
  const h = harness();
  h.commit(['translate-x-[1px]']);
  h.setFlush(() => {
    h.setFlush(() => {});
    h.commit(['translate-x-[3px]']);
  });
  h.commit(['translate-x-[2px]']);
  expect(h.el.style.getPropertyValue('translate')).toBe('3px 0px');
  h.sink.release(1);
});
it('reacquisition snapshots external priority and preserves a later external writer', () => {
  const h = harness();
  h.el.style.setProperty('translate', '3px 0px');
  h.commit(['translate-x-[1px]']);
  h.commit([]);
  h.el.style.setProperty('translate', '8px 0px', 'important');
  h.commit(['translate-x-[2px]']);
  h.commit([]);
  expect(h.el.style.getPropertyValue('translate')).toBe('8px 0px');
  expect(h.el.style.getPropertyPriority('translate')).toBe('important');
  h.commit(['translate-x-[2px]']);
  h.el.style.setProperty('translate', '9px 0px');
  h.sink.release(1);
  expect(h.el.style.getPropertyValue('translate')).toBe('9px 0px');
});

it.each(['value', 'priority'] as const)(
  'external inline %s takeover suspends only the leased channel until a fresh view',
  (kind) => {
    const h = harness();
    h.commit(['translate-x-[1px]']);
    const old = h.el.style.getPropertyValue('translate');
    h.el.style.setProperty('translate', kind === 'value' ? '9px 0px' : old, 'important');
    h.commit(['translate-x-[2px]']);
    expect(h.el.style.getPropertyValue('translate')).toBe(kind === 'value' ? '9px 0px' : old);
    expect(h.el.style.getPropertyPriority('translate')).toBe('important');
    expect(h.sink.diagnostics?.()).toContain('translate:external-inline-owner');
    h.commit(['translate-x-[3px]']);
    expect(h.el.style.getPropertyPriority('translate')).toBe('important');
    h.sink.release(1);
    expect(h.el.style.getPropertyValue('translate')).toBe(kind === 'value' ? '9px 0px' : old);
  }
);
it('takeover during effects flush rejects the attempted sample without overwriting external value', () => {
  const h = harness();
  h.commit(['translate-x-[1px]']);
  h.setFlush(() => {
    h.el.style.setProperty('translate', '9px 0px', 'important');
  });
  h.commit(['translate-x-[2px]']);
  expect(h.el.style.getPropertyValue('translate')).toBe('9px 0px');
  expect(h.sink.diagnostics?.()).toContain('translate:projection-rejected');
  h.sink.release(1);
  expect(h.el.style.getPropertyPriority('translate')).toBe('important');
});
