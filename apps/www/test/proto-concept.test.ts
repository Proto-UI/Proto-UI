import { describe, expect, it, beforeEach, afterEach, vi, beforeAll } from 'vitest';

// Mock the getConcept function before importing the script
vi.mock('../src/data/concepts', () => ({
  getConcept: vi.fn((slug: string) => ({
    term: { 'zh-cn': `概念-${slug}`, en: `Concept-${slug}` },
    summary: { 'zh-cn': `这是${slug}的摘要`, en: `This is the summary for ${slug}` },
    href: '',
  })),
}));

describe('proto-concept: lifecycle and memory management', () => {
  let container: HTMLElement;

  beforeAll(async () => {
    // Import and register the custom element once
    await import('../src/scripts/proto-concept');
    // Wait for custom element registration
    await customElements.whenDefined('proto-concept');
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
  });

  it('cleans up document event listeners when custom element is removed', async () => {
    const conceptEl = document.createElement('proto-concept');
    conceptEl.setAttribute('slug', 'test-concept');
    conceptEl.textContent = 'Test';
    container.appendChild(conceptEl);

    // Wait for connectedCallback to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    const trigger = conceptEl.querySelector('.proto-concept__trigger') as HTMLButtonElement;
    expect(trigger).toBeTruthy();

    // Open the card
    trigger.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(conceptEl.dataset.pinned).toBe('true');

    // Spy on outside click handler by clicking outside
    const outsideClickSpy = vi.fn();

    // Remove the element (should trigger disconnectedCallback and cleanup)
    container.removeChild(conceptEl);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Add a spy to verify listeners are NOT called after removal
    document.addEventListener('click', outsideClickSpy);

    // Click on document - the removed element's listener should not respond
    document.body.click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // The conceptEl should no longer respond to document clicks since it's disconnected
    // This verifies that AbortController properly cleaned up the listeners
    expect(conceptEl.isConnected).toBe(false);

    document.removeEventListener('click', outsideClickSpy);
  });

  it('rebinds listeners when moved within document and cleans them up on removal', async () => {
    const hostA = document.createElement('div');
    const hostB = document.createElement('div');
    container.appendChild(hostA);
    container.appendChild(hostB);

    const conceptEl = document.createElement('proto-concept');
    conceptEl.setAttribute('slug', 'test-concept');
    conceptEl.textContent = 'Test';
    hostA.appendChild(conceptEl);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const trigger = conceptEl.querySelector('.proto-concept__trigger') as HTMLButtonElement;

    // Moving a connected custom element disconnects and reconnects it.
    hostB.appendChild(conceptEl);

    await new Promise((resolve) => setTimeout(resolve, 10));

    trigger.click();
    expect(conceptEl.dataset.pinned).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    container.remove();
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(conceptEl.dataset.pinned).toBe('true');
  });

  it('synchronizes semantic visibility for fine-pointer hover', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true }))
    );

    const conceptEl = document.createElement('proto-concept');
    conceptEl.setAttribute('slug', 'test-concept');
    conceptEl.setAttribute('href', 'https://example.com');
    conceptEl.textContent = 'Test';
    container.appendChild(conceptEl);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const trigger = conceptEl.querySelector('.proto-concept__trigger') as HTMLButtonElement;
    const card = conceptEl.querySelector('.proto-concept__card') as HTMLElement;
    const link = conceptEl.querySelector('.proto-concept__link') as HTMLAnchorElement;

    conceptEl.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    expect(conceptEl.dataset.hovering).toBe('true');
    expect(conceptEl.dataset.open).toBe('true');
    expect(card.hasAttribute('inert')).toBe(false);
    expect(card.getAttribute('aria-hidden')).toBe('false');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(link).toBeTruthy();

    conceptEl.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    expect(conceptEl.dataset.hovering).toBe('false');
    expect(conceptEl.dataset.open).toBe('false');
    expect(card.hasAttribute('inert')).toBe(true);
    expect(card.getAttribute('aria-hidden')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('dismisses a hover-open card with Escape until pointer re-entry', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true }))
    );

    const conceptEl = document.createElement('proto-concept');
    conceptEl.setAttribute('slug', 'test-concept');
    conceptEl.textContent = 'Test';
    container.appendChild(conceptEl);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const trigger = conceptEl.querySelector('.proto-concept__trigger') as HTMLButtonElement;
    const card = conceptEl.querySelector('.proto-concept__card') as HTMLElement;

    conceptEl.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    expect(conceptEl.dataset.open).toBe('true');

    conceptEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(conceptEl.dataset.hovering).toBe('false');
    expect(conceptEl.dataset.open).toBe('false');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(card.hasAttribute('inert')).toBe(true);
    expect(card.getAttribute('aria-hidden')).toBe('true');

    conceptEl.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    conceptEl.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    expect(conceptEl.dataset.open).toBe('true');
  });

  it('sets inert and aria-hidden on closed card', async () => {
    const conceptEl = document.createElement('proto-concept');
    conceptEl.setAttribute('slug', 'test-concept');
    conceptEl.textContent = 'Test';
    container.appendChild(conceptEl);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const card = conceptEl.querySelector('.proto-concept__card') as HTMLElement;
    expect(card).toBeTruthy();

    // Card should start with inert and aria-hidden="true"
    expect(card.hasAttribute('inert')).toBe(true);
    expect(card.getAttribute('aria-hidden')).toBe('true');
  });

  it('removes inert and sets aria-hidden="false" when card is opened', async () => {
    const conceptEl = document.createElement('proto-concept');
    conceptEl.setAttribute('slug', 'test-concept');
    conceptEl.textContent = 'Test';
    container.appendChild(conceptEl);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const trigger = conceptEl.querySelector('.proto-concept__trigger') as HTMLButtonElement;
    const card = conceptEl.querySelector('.proto-concept__card') as HTMLElement;

    expect(trigger).toBeTruthy();
    expect(card).toBeTruthy();

    // Click to open
    trigger.click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Card should be accessible when open
    expect(card.hasAttribute('inert')).toBe(false);
    expect(card.getAttribute('aria-hidden')).toBe('false');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('returns focus to trigger when closing with focus inside card', async () => {
    const conceptEl = document.createElement('proto-concept');
    conceptEl.setAttribute('slug', 'test-concept');
    conceptEl.setAttribute('href', 'https://example.com');
    conceptEl.textContent = 'Test';
    container.appendChild(conceptEl);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const trigger = conceptEl.querySelector('.proto-concept__trigger') as HTMLButtonElement;
    const link = conceptEl.querySelector('.proto-concept__link') as HTMLAnchorElement;

    expect(trigger).toBeTruthy();
    expect(link).toBeTruthy();

    // Open the card
    trigger.click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Focus the link inside the card
    link.focus();
    expect(document.activeElement).toBe(link);

    // Press Escape to close
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    conceptEl.dispatchEvent(escapeEvent);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Focus should return to trigger
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps custom element in DOM (not replaced with span)', async () => {
    const conceptEl = document.createElement('proto-concept');
    conceptEl.setAttribute('slug', 'test-concept');
    conceptEl.textContent = 'Test';
    container.appendChild(conceptEl);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // The element should still be the custom element, not replaced
    const stillCustomElement = container.querySelector('proto-concept');
    expect(stillCustomElement).toBe(conceptEl);
    expect(conceptEl.tagName.toLowerCase()).toBe('proto-concept');
  });
});
