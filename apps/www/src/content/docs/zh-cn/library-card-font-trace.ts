/** Read-only diagnostics for the delayed-font Card journey. Serialized into the
 * page; IDs describe object identity within this document, never a font choice. */
export function recordLibraryFontTrace(label: string) {
  type Trace = {
    record: (label: string) => void;
    stop: () => unknown;
  };
  const target = window as typeof window & { __libraryFontTrace?: Trace };
  if (!target.__libraryFontTrace) {
    const card = document.querySelector('[data-library="brutalist"]');
    if (!card) throw new Error('Brutalist font trace target is absent');
    const ids = new WeakMap<object, number>();
    let nextId = 1;
    const id = (object: object) => {
      if (!ids.has(object)) ids.set(object, nextId++);
      return ids.get(object)!;
    };
    const rows: unknown[] = [];
    const checkpoints: Record<string, unknown> = {};
    const errors: string[] = [];
    let dropped = 0;
    const record = (reason: string) => {
      const automatic =
        reason.startsWith('fonts.') ||
        reason.startsWith('card-mutation:') ||
        reason.startsWith('frame.');
      if (automatic && rows.length >= 96) {
        dropped++;
        return;
      }
      const nodes = [
        ['caption', '.library-card__kind'],
        ['title', 'h2 [data-library-part]'],
        ['action', '[data-library-action] [data-library-part$="text"]'],
      ].map(([name, selector]) => {
        const element = card.querySelector<HTMLElement>(selector);
        if (!element) return { name, missing: true };
        const css = getComputedStyle(element);
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        const textNodes: Array<{ id: number; parentId: number | null; text: string | null }> = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode())
          textNodes.push({
            id: id(node),
            parentId: node.parentNode ? id(node.parentNode) : null,
            text: node.textContent,
          });
        return {
          name,
          id: id(element),
          connected: element.isConnected,
          parentId: element.parentElement ? id(element.parentElement) : null,
          textNodes,
          glyphRect: { width: rect.width, height: rect.height },
          font: css.font,
          fontFamily: css.fontFamily,
          fontSize: css.fontSize,
          fontWeight: css.fontWeight,
          fontStretch: css.fontStretch,
          fontStyle: css.fontStyle,
          fontFeatureSettings: css.fontFeatureSettings,
          fontVariationSettings: css.fontVariationSettings,
          fontSynthesis: css.fontSynthesis,
          letterSpacing: css.letterSpacing,
          wordSpacing: css.wordSpacing,
          whiteSpace: css.whiteSpace,
        };
      });
      const row = {
        reason,
        at: performance.now(),
        readyState: document.readyState,
        fontSetStatus: document.fonts.status,
        faces: [...document.fonts].map((face) => ({
          id: id(face),
          family: face.family,
          status: face.status,
          display: face.display,
          weight: face.weight,
          style: face.style,
          stretch: face.stretch,
        })),
        nodes,
        inheritedTitles: ['base', 'lucide'].map((family) => {
          const leaf = document.querySelector<HTMLElement>(
            `[data-library="${family}"] h2 [data-library-part]`
          );
          const ancestors = [];
          for (let node = leaf; node && ancestors.length < 16; node = node.parentElement) {
            const css = getComputedStyle(node);
            ancestors.push({
              id: id(node),
              tag: node.localName,
              color: css.color,
              className: node.className,
              style: node.getAttribute('style'),
              tokens: node.getAttribute('data-pui-style'),
              typographyOwner: node.getAttribute('data-typography-owner'),
              typographyPrototype: node.getAttribute('data-typography-prototype'),
            });
          }
          return { family, ancestors };
        }),
      };
      if (automatic) rows.push(row);
      else checkpoints[reason] = row;
    };
    const safelyRecord = (reason: string) => {
      try {
        record(reason);
      } catch (issue) {
        if (errors.length < 16) errors.push(`${reason}: ${String(issue)}`);
      }
    };
    const onFonts = (event: Event) => safelyRecord(`fonts.${event.type}`);
    for (const event of ['loading', 'loadingdone', 'loadingerror'])
      document.fonts.addEventListener(event, onFonts);
    const observer = new MutationObserver((mutations) => {
      safelyRecord(`card-mutation:${[...new Set(mutations.map((item) => item.type))].join(',')}`);
    });
    observer.observe(card, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-pui-style'],
    });
    target.__libraryFontTrace = {
      record: safelyRecord,
      stop() {
        safelyRecord('stop');
        observer.disconnect();
        for (const event of ['loading', 'loadingdone', 'loadingerror'])
          document.fonts.removeEventListener(event, onFonts);
        delete target.__libraryFontTrace;
        return { checkpoints, rows, dropped, limit: 96, errors };
      },
    };
  }
  if (label === 'stop') return target.__libraryFontTrace.stop();
  target.__libraryFontTrace.record(label);
  return null;
}
