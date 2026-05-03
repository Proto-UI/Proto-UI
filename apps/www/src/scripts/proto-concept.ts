import { getConcept, type ConceptLocale } from '../data/concepts';

function detectLocale(): ConceptLocale {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  return path.startsWith('/en/') ? 'en' : 'zh-cn';
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

class ProtoConceptElement extends HTMLElement {
  #instanceId = `proto-concept-${Math.random().toString(36).slice(2, 10)}`;
  #cleanup: (() => void) | null = null;

  connectedCallback() {
    const locale = detectLocale();

    const slug = (this.getAttribute('slug') || '').trim();
    const overrideSummary = (this.getAttribute('summary') || '').trim();
    const overrideHref = (this.getAttribute('href') || '').trim();
    const labelFromContent = (this.textContent || '').trim();

    const entry = slug ? getConcept(slug) : undefined;
    const termLabel = labelFromContent || entry?.term[locale] || slug || 'concept';
    const summary = overrideSummary || entry?.summary[locale] || '';
    const href = overrideHref || entry?.href || '';

    // Avoid double-hydration.
    if (this.dataset.hydrated === 'true') return;
    this.dataset.hydrated = 'true';

    const root = document.createElement('span');
    root.className = 'proto-concept';
    root.dataset.protoConcept = '';
    root.id = this.#instanceId;

    root.innerHTML = `
      <button
        class="proto-concept__trigger"
        type="button"
        aria-expanded="false"
        aria-controls="${this.#instanceId}-card"
      >${escapeHtml(termLabel)}</button>
      <span class="proto-concept__card" role="note" id="${this.#instanceId}-card">
        <span class="proto-concept__eyebrow">${locale === 'zh-cn' ? '概念' : 'Concept'}</span>
        <span class="proto-concept__title">${escapeHtml(entry?.term[locale] || termLabel)}</span>
        ${summary ? `<span class="proto-concept__summary">${escapeHtml(summary)}</span>` : ''}
        <span class="proto-concept__actions">
          <button class="proto-concept__action proto-concept__close" type="button">
            ${locale === 'zh-cn' ? '关闭' : 'Close'}
          </button>
          ${
            href
              ? `<a class="proto-concept__action proto-concept__link" href="${escapeHtml(href)}">${
                  locale === 'zh-cn' ? '了解更多' : 'Learn more'
                }</a>`
              : ''
          }
        </span>
      </span>
    `;

    this.replaceWith(root);

    const trigger = root.querySelector('.proto-concept__trigger');
    const close = root.querySelector('.proto-concept__close');
    if (!(trigger instanceof HTMLButtonElement)) return;

    const setPinned = (next: boolean) => {
      root.dataset.pinned = next ? 'true' : 'false';
      trigger.setAttribute('aria-expanded', next ? 'true' : 'false');
    };

    const supportsHover =
      window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches ?? false;
    const onEnter = () => {
      if (supportsHover) root.dataset.hovering = 'true';
    };
    const onLeave = () => {
      if (supportsHover) root.dataset.hovering = 'false';
    };

    trigger.addEventListener('click', () => {
      const pinned = root.dataset.pinned === 'true';
      setPinned(!pinned);
    });

    if (close instanceof HTMLButtonElement) {
      close.addEventListener('click', () => setPinned(false));
    }

    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointerleave', onLeave);

    const onDocClick = (event: MouseEvent) => {
      if (!root.contains(event.target as Node)) setPinned(false);
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinned(false);
    };

    document.addEventListener('click', onDocClick);
    root.addEventListener('keydown', onKeydown);

    this.#cleanup = () => {
      document.removeEventListener('click', onDocClick);
      root.removeEventListener('keydown', onKeydown);
      root.removeEventListener('pointerenter', onEnter);
      root.removeEventListener('pointerleave', onLeave);
    };
  }

  disconnectedCallback() {
    this.#cleanup?.();
    this.#cleanup = null;
  }
}

if (!customElements.get('proto-concept')) {
  customElements.define('proto-concept', ProtoConceptElement);
}
