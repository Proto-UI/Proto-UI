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
  #trigger: HTMLButtonElement | null = null;
  #card: HTMLElement | null = null;
  #abortController: AbortController | null = null;

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

    if (this.dataset.hydrated !== 'true') {
      this.dataset.hydrated = 'true';

      // Keep the custom element as the container to preserve lifecycle.
      this.className = 'proto-concept';
      this.dataset.protoConcept = '';
      this.id = this.#instanceId;

      this.innerHTML = `
        <button
          class="proto-concept__trigger"
          type="button"
          aria-expanded="false"
          aria-controls="${this.#instanceId}-card"
        >${escapeHtml(termLabel)}</button>
        <span class="proto-concept__card" role="note" id="${this.#instanceId}-card" inert aria-hidden="true">
          <span class="proto-concept__eyebrow">${locale === 'zh-cn' ? '概念' : 'Concept'}</span>
          <span class="proto-concept__title">${escapeHtml(entry?.term[locale] || termLabel)}</span>
          ${summary ? `<span class="proto-concept__summary">${escapeHtml(summary)}</span>` : ''}
          ${
            href
              ? `<span class="proto-concept__actions">
                  <a class="proto-concept__action proto-concept__link" href="${escapeHtml(href)}">${
                    locale === 'zh-cn' ? '了解更多' : 'Learn more'
                  }</a>
                </span>`
              : ''
          }
        </span>
      `;
    }

    this.#trigger = this.querySelector('.proto-concept__trigger');
    this.#card = this.querySelector('.proto-concept__card');
    if (!this.#trigger || !this.#card) return;

    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    const syncOpenState = () => {
      if (!this.#trigger || !this.#card) return;

      const isOpen = this.dataset.pinned === 'true' || this.dataset.hovering === 'true';
      this.dataset.open = isOpen ? 'true' : 'false';
      this.#trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

      if (isOpen) {
        this.#card.removeAttribute('inert');
        this.#card.setAttribute('aria-hidden', 'false');
      } else {
        this.#card.setAttribute('inert', '');
        this.#card.setAttribute('aria-hidden', 'true');

        // Return focus to trigger if focus is inside the card.
        if (this.#card.contains(document.activeElement)) {
          this.#trigger.focus();
        }
      }
    };

    const setPinned = (next: boolean) => {
      this.dataset.pinned = next ? 'true' : 'false';
      syncOpenState();
    };

    const supportsHover =
      window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches ?? false;
    const onEnter = () => {
      if (supportsHover) {
        this.dataset.hovering = 'true';
        syncOpenState();
      }
    };
    const onLeave = () => {
      if (supportsHover) {
        this.dataset.hovering = 'false';
        syncOpenState();
      }
    };

    this.#trigger.addEventListener(
      'click',
      () => {
        if (signal.aborted) return;
        const pinned = this.dataset.pinned === 'true';
        setPinned(!pinned);
      },
      { signal }
    );

    this.addEventListener('pointerenter', onEnter, { signal });
    this.addEventListener('pointerleave', onLeave, { signal });

    const onDocClick = (event: MouseEvent) => {
      if (signal.aborted) return;
      if (!this.contains(event.target as Node)) setPinned(false);
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (signal.aborted) return;
      if (event.key === 'Escape') setPinned(false);
    };

    document.addEventListener('click', onDocClick, { signal });
    this.addEventListener('keydown', onKeydown, { signal });

    syncOpenState();
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    this.#abortController = null;
    this.#trigger = null;
    this.#card = null;
  }
}

if (!customElements.get('proto-concept')) {
  customElements.define('proto-concept', ProtoConceptElement);
}
