// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { siteContentsNavigation } from './site-header-disclosure';
let handle: ReturnType<typeof siteContentsNavigation>;
afterEach(() => {
  handle?.destroy();
  document.body.replaceChildren();
  document.body.removeAttribute('data-mobile-menu-expanded');
  vi.restoreAllMocks();
});
function fixture() {
  vi.spyOn(window, 'matchMedia').mockReturnValue(
    Object.assign(new EventTarget(), { matches: false }) as MediaQueryList
  );
  document.body.innerHTML = `<div data-site-contents-command aria-expanded="false"><button data-site-contents-fallback>Contents</button></div><aside id="starlight__sidebar"><button role="combobox" aria-controls="owned-locale-popup" aria-expanded="true">Language</button><button data-inside>Inside</button></aside><div role="listbox" id="owned-locale-popup"><button role="option" data-value="zh-cn">Chinese</button></div><button data-outside>Outside</button>`;
  handle = siteContentsNavigation(document)!;
  handle.toggle();
  expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(true);
}
it('keeps an actual DOM-descendant pointer inside the sidebar', () => {
  fixture();
  document
    .querySelector('[data-inside]')!
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(true);
});
it('closes for an unrelated outside pointer', () => {
  fixture();
  document
    .querySelector('[data-outside]')!
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(false);
});
it('should keep its aria-controls-owned escaped Select popup inside the sidebar interaction', () => {
  fixture();
  document
    .querySelector('[role="option"]')!
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(true);
});

it('rejects an escaped popup controlled only by a different disclosure root', () => {
  fixture();
  const trigger = document.querySelector('[role="combobox"]')!;
  document.body.append(trigger);
  document
    .querySelector('[role="option"]')!
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(false);
});
it('rejects a stale popup id after the sidebar trigger points at its replacement', () => {
  fixture();
  document.querySelector('[role="combobox"]')!.setAttribute('aria-controls', 'replacement-popup');
  document
    .querySelector('[role="option"]')!
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(false);
});
it('rejects a retired closed trigger even if its old popup remains present', () => {
  fixture();
  document.querySelector('[role="combobox"]')!.setAttribute('aria-expanded', 'false');
  document
    .querySelector('[role="option"]')!
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(false);
});
it('still closes on a subsequent unrelated pointer after an owned popup interaction', () => {
  fixture();
  document
    .querySelector('[role="option"]')!
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(true);
  document
    .querySelector('[data-outside]')!
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  expect(document.body.hasAttribute('data-mobile-menu-expanded')).toBe(false);
});
