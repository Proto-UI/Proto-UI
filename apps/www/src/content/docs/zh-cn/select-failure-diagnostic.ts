import type { Page } from 'playwright-core';

/** Bounded, read-only failure evidence. It supplies no replacement input or verdict. */
export async function selectFailureDiagnostic(
  page: Page,
  request: { control: string; popupId: string | null; option: string }
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const snapshot = await Promise.race([
      page.evaluate((request) => {
        const describe = (element: Element) => {
          const style = getComputedStyle(element);
          return {
            tag: element.tagName,
            attributes: Object.fromEntries(
              [...element.attributes]
                .filter(({ name }) => name === 'id' || /^(aria-|data-)/.test(name))
                .slice(0, 40)
                .map(({ name, value }) => [name, value.slice(0, 256)])
            ),
            text: element.textContent?.slice(0, 200),
            connected: element.isConnected,
            rect: element.getBoundingClientRect().toJSON(),
            display: style.display,
            visibility: style.visibility,
            position: style.position,
            opacity: style.opacity,
            direction: style.direction,
          };
        };
        const controlled = request.popupId ? document.getElementById(request.popupId) : null;
        return {
          observedAt: performance.now(),
          request,
          scope: 'Bounded document-root snapshot after the original native click failed',
          viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
          root: {
            direction: getComputedStyle(document.documentElement).direction,
            fontSize: getComputedStyle(document.documentElement).fontSize,
          },
          active: document.activeElement ? describe(document.activeElement) : null,
          generations: [...document.querySelectorAll('[data-projection-generation-state]')]
            .slice(0, 16)
            .map(describe),
          comboboxes: [...document.querySelectorAll('[role="combobox"]')]
            .slice(0, 24)
            .map(describe),
          controlled: controlled ? describe(controlled) : null,
          controlledOptions: controlled
            ? [...controlled.querySelectorAll('[role="option"]')].slice(0, 24).map(describe)
            : [],
          listboxes: [...document.querySelectorAll('[role="listbox"]')].slice(0, 24).map(describe),
        };
      }, request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Failure snapshot exceeded 1500ms')), 1500);
      }),
    ]);
    return { state: 'captured', snapshot };
  } catch (error) {
    return { state: 'unavailable', request, error: String(error) };
  } finally {
    clearTimeout(timer);
  }
}
