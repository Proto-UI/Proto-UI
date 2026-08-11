import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTextareaDemoSetup } from './demo-base-textarea.demo';

afterEach(() => {
  document.body.replaceChildren();
});

describe('Textarea documentation demo events', () => {
  it('keeps a normalized callback result when a native change event bubbles afterward', () => {
    const host = document.createElement('div');
    const textarea = document.createElement('textarea');
    textarea.dataset.demoRef = 'textarea';
    host.appendChild(textarea);
    document.body.appendChild(host);

    const refs: Record<string, HTMLElement> = {
      textarea,
      stateLabel: document.createElement('div'),
      eventLog: document.createElement('div'),
      externalLabel: document.createElement('label'),
      help: document.createElement('div'),
    };
    const setProps = vi.fn();
    const setup = createTextareaDemoSetup({ defaultValue: 'Initial' });
    const cleanup = setup({
      host,
      refs,
      api: {
        call: vi.fn(),
        getExposes: vi.fn(() => undefined),
        setProps,
      },
    });
    const props = setProps.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
    const onChange = props?.onChange as ((detail: unknown) => void) | undefined;

    expect(onChange).toBeTypeOf('function');
    onChange?.({ value: 'Normalized' });
    expect(refs.eventLog?.textContent).toBe('uncontrolled.change: {"value":"Normalized"}');

    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    expect(refs.eventLog?.textContent).toBe('uncontrolled.change: {"value":"Normalized"}');

    textarea.dispatchEvent(
      new CustomEvent('change', { detail: { value: 'Projected' }, bubbles: true })
    );
    expect(refs.eventLog?.textContent).toBe('textarea.change: {"value":"Projected"}');

    if (cleanup) cleanup();
  });
});
