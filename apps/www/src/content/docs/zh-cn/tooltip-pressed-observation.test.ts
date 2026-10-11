import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeTooltipPress } from './tooltip-pressed-observation';

const active: ReturnType<typeof observeTooltipPress>[] = [];
afterEach(() => {
  for (const observer of active.splice(0)) observer.stop();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function fixture() {
  document.body.innerHTML =
    '<div data-previewer-id="test"><div data-demo-ref="accountTrigger">Account</div><div id="other">Other</div></div>';
  const target = document.querySelector<HTMLElement>('[data-demo-ref]')!;
  const other = document.getElementById('other')!;
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(other);
  const observer = observeTooltipPress(target);
  active.push(observer);
  return { target, other, observer, records: () => observer.read().records as any[] };
}

describe('Tooltip pressed public DOM diagnostics', () => {
  it('records exact style, geometry and off-target event evidence without rewriting input', () => {
    const { target, other, observer, records } = fixture();
    target.setAttribute('data-pui-style', 'inline-flex scale-[0.98]');
    target.style.transform = 'scale(0.98)';
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 80, 40));
    observer.sample('before-move', { x: 50, y: 40 });
    const event = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY: 40,
      buttons: 1,
    });
    other.dispatchEvent(event);
    const result = records().at(-1);
    expect(result.original).toMatchObject({
      tokens: 'inline-flex scale-[0.98]',
      transform: 'scale(0.98)',
      rect: { x: 10, y: 20, width: 80, height: 40 },
    });
    expect(result.hitWithinCurrent).toBe(false);
    expect(result.event).toMatchObject({
      type: 'pointerdown',
      // Happy-dom has no native trust provenance; preserve unknown explicitly.
      trusted: null,
      target: { id: 'other' },
      clientX: 50,
      clientY: 40,
      buttons: 1,
    });
    expect(result.event.path[0].id).toBe('other');
    expect(event.defaultPrevented).toBe(false);
    expect(target.getAttribute('data-pui-style')).toBe('inline-flex scale-[0.98]');
  });

  it('distinguishes a replaced current DOM node from the original locator subject', () => {
    const { target, observer, records } = fixture();
    const replacement = target.cloneNode(true) as HTMLElement;
    target.replaceWith(replacement);
    observer.sample('after-replacement');
    const result = records().at(-1);
    expect(result.sameIdentity).toBe(false);
    expect(result.original.connected).toBe(false);
    expect(result.current.connected).toBe(true);
    expect(result.original.identity).not.toBe(result.current.identity);
  });

  it('resolves the same public previewer identity after whole-previewer replacement', () => {
    const { target, observer, records } = fixture();
    const previewer = target.closest('[data-previewer-id]')!;
    previewer.replaceWith(previewer.cloneNode(true));
    observer.sample('after-previewer-replacement');
    const result = records().at(-1);
    expect(result.sameIdentity).toBe(false);
    expect(result.original.connected).toBe(false);
    expect(result.current.connected).toBe(true);
    expect(result.currentCount).toBe(1);
  });

  it('freezes failure facts atomically against pending microtasks and later events', async () => {
    const { target, other, observer } = fixture();
    other.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    const frozen = observer.freeze();
    target.setAttribute('data-pui-style', 'changed-after-failure');
    other.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    for (let index = 0; index < 150; index++) observer.sample(`late-${index}`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((frozen.records.at(-1) as any).phase).toBe('failure-before-mouseup');
    expect(observer.read()).toEqual(frozen);
  });

  it('observes attribute transitions and releases listeners and observer on stop', async () => {
    const { target, other, observer, records } = fixture();
    target.setAttribute('data-pui-style', 'scale-[0.98]');
    await vi.waitFor(() =>
      expect(records().some((entry) => entry.phase === 'attribute-change')).toBe(true)
    );
    observer.stop();
    const before = records().length;
    target.removeAttribute('data-pui-style');
    other.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer.sample('after-stop');
    expect(records()).toHaveLength(before);
  });

  it('bounds output while retaining installation identity and latest failure facts', () => {
    const { observer, records } = fixture();
    for (let index = 0; index < 150; index++) observer.sample(`sample-${index}`);
    observer.sample('failure-before-mouseup');
    expect(records()).toHaveLength(128);
    expect(records()[0].phase).toBe('installed');
    expect(records().at(-1).phase).toBe('failure-before-mouseup');
    expect(observer.read().dropped).toBe(24);
  });

  it('is self-contained for execution in the browser realm', () => {
    const { target } = fixture();
    const serialized = new Function(
      `return (${observeTooltipPress.toString()})`
    )() as typeof observeTooltipPress;
    const observer = serialized(target);
    active.push(observer);
    expect((observer.read().records[0] as any).original.ref).toBe('accountTrigger');
  });
});
