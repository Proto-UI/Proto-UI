import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindNativeLinkFacts } from './site-native-link-facts';

const cleanups: Array<() => void> = [];
function fixture(isActive: () => boolean = () => true) {
  document.body.innerHTML =
    '<a href="/docs/" target="_blank" rel="noreferrer" aria-label="Docs"><span>Docs</span></a>';
  const link = document.querySelector('a')!;
  const project = vi.fn();
  const cleanup = bindNativeLinkFacts(link, project, { isActive });
  cleanups.push(cleanup);
  return { link, project, cleanup };
}
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('native anchor visual facts', () => {
  it('leaves link identity and default actions entirely browser-owned', () => {
    const { link } = fixture();
    // The test harness cancels only after observing the bridge result, so
    // happy-dom does not perform a real network navigation.
    let preventedByBridge: boolean | undefined;
    const stopTestNavigation = (event: Event) => {
      preventedByBridge = event.defaultPrevented;
      event.preventDefault();
    };
    for (const type of ['click', 'auxclick', 'contextmenu'])
      link.addEventListener(type, stopTestNavigation);
    for (const type of ['click', 'auxclick', 'contextmenu']) {
      for (const button of [0, 1, 2]) {
        const event = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button,
          ctrlKey: true,
          metaKey: true,
          shiftKey: true,
        });
        link.dispatchEvent(event);
        expect(preventedByBridge).toBe(false);
      }
    }
    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      expect(link.dispatchEvent(event)).toBe(true);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(link.getAttribute('href')).toBe('/docs/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer');
    expect(link.getAttribute('aria-label')).toBe('Docs');
    expect(link.hasAttribute('role')).toBe(false);
    expect(link.querySelector('[tabindex],button')).toBeNull();
  });
  it('projects hover and primary press facts, clearing a release outside the link', () => {
    const { link, project } = fixture();
    link.dispatchEvent(new Event('pointerenter'));
    expect(project).toHaveBeenLastCalledWith(
      expect.objectContaining({ hovered: true, pressed: false })
    );
    link.dispatchEvent(new MouseEvent('pointerdown', { button: 1 }));
    expect(project).toHaveBeenLastCalledWith(expect.objectContaining({ pressed: false }));
    link.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
    expect(project).toHaveBeenLastCalledWith(expect.objectContaining({ pressed: true }));
    window.dispatchEvent(new Event('pointerup'));
    expect(project).toHaveBeenLastCalledWith(expect.objectContaining({ pressed: false }));
    link.dispatchEvent(new Event('pointerleave'));
    expect(project).toHaveBeenLastCalledWith(
      expect.objectContaining({ hovered: false, pressed: false })
    );
  });
  it('projects the native focus-visible fact without a second focus target', () => {
    const { link, project } = fixture();
    const original = link.matches.bind(link);
    vi.spyOn(link, 'matches').mockImplementation((selector) =>
      selector === ':focus-visible' ? true : original(selector)
    );
    link.focus();
    expect(document.activeElement).toBe(link);
    expect(project).toHaveBeenLastCalledWith(expect.objectContaining({ focusVisible: true }));
    link.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(project).toHaveBeenLastCalledWith(expect.objectContaining({ pressed: false }));
    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(project).toHaveBeenLastCalledWith(expect.objectContaining({ pressed: true }));
    link.blur();
    expect(project).toHaveBeenLastCalledWith(
      expect.objectContaining({ focusVisible: false, pressed: false })
    );
  });
  it('does not write visual facts into an inactive generation and clears listeners on disposal', () => {
    let active = true;
    const { link, project, cleanup } = fixture(() => active);
    active = false;
    const count = project.mock.calls.length;
    link.dispatchEvent(new Event('pointerenter'));
    expect(project).toHaveBeenCalledTimes(count);
    cleanup();
    expect(project).toHaveBeenLastCalledWith({
      hovered: false,
      pressed: false,
      focusVisible: false,
      current: false,
    });
    const disposedCount = project.mock.calls.length;
    link.dispatchEvent(new Event('pointerenter'));
    window.dispatchEvent(new Event('pointerup'));
    cleanup();
    expect(project).toHaveBeenCalledTimes(disposedCount);
  });
});
