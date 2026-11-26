import { afterEach, describe, expect, it } from 'vitest';
import {
  applyProjectionThemeSurfaceStyle,
  clearProjectionThemeSurfaceStyle,
} from './projection-theme';

afterEach(() => document.body.replaceChildren());

let customElementSerial = 0;

describe('atomic typography theme publication', () => {
  it.each(['html', 'svg'] as const)(
    'publishes one complete %s palette and preserves unrelated inline declarations',
    (kind) => {
      const surface =
        kind === 'html'
          ? document.createElement('span')
          : document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      surface.style.cssText =
        'color: red !important; margin: 1px 2px; --caller: var(--private, blue) !important';
      const original = [
        surface.style.getPropertyValue('color'),
        surface.style.getPropertyPriority('color'),
        surface.style.getPropertyValue('margin'),
        surface.style.getPropertyValue('--caller'),
        surface.style.getPropertyPriority('--caller'),
      ];
      document.body.append(surface);
      const observer = new MutationObserver(() => {});
      observer.observe(surface, { attributes: true, attributeFilter: ['style'] });
      try {
        applyProjectionThemeSurfaceStyle(
          surface,
          { '--pui-background': '#fff', '--pui-foreground': '#111' },
          'replace-batch'
        );
        expect(observer.takeRecords()).toHaveLength(1);
        expect(surface.style.getPropertyValue('--pui-background')).toBe('#fff');
        expect(surface.style.getPropertyValue('--pui-foreground')).toBe('#111');
        expect([
          surface.style.getPropertyValue('color'),
          surface.style.getPropertyPriority('color'),
          surface.style.getPropertyValue('margin'),
          surface.style.getPropertyValue('--caller'),
          surface.style.getPropertyPriority('--caller'),
        ]).toEqual(original);
      } finally {
        observer.disconnect();
      }
    }
  );

  it('withdraws retired owned keys and replaces priority in the same publication', () => {
    const surface = document.body.appendChild(document.createElement('span'));
    surface.style.setProperty('--unowned', 'retained', 'important');
    applyProjectionThemeSurfaceStyle(surface, {
      '--pui-background': '#fff',
      '--pui-foreground': '#111',
    });
    surface.style.setProperty('--pui-background', '#fff', 'important');
    const observer = new MutationObserver(() => {});
    observer.observe(surface, { attributes: true, attributeFilter: ['style'] });
    try {
      const next = { '--pui-background': '#222', '--pui-border': '#888' } as const;
      applyProjectionThemeSurfaceStyle(surface, next, 'replace-batch');
      expect(observer.takeRecords()).toHaveLength(1);
      expect(surface.style.getPropertyValue('--pui-background')).toBe('#222');
      expect(surface.style.getPropertyPriority('--pui-background')).toBe('');
      expect(surface.style.getPropertyValue('--pui-foreground')).toBe('');
      expect(surface.style.getPropertyValue('--pui-border')).toBe('#888');
      applyProjectionThemeSurfaceStyle(surface, next, 'replace-batch');
      expect(observer.takeRecords()).toHaveLength(0);
      clearProjectionThemeSurfaceStyle(surface);
      expect(surface.style.getPropertyValue('--pui-background')).toBe('');
      expect(surface.style.getPropertyValue('--pui-border')).toBe('');
      expect(surface.style.getPropertyValue('--unowned')).toBe('retained');
      expect(surface.style.getPropertyPriority('--unowned')).toBe('important');
    } finally {
      observer.disconnect();
    }
  });

  it.each(['equal', 'changed', 'priority', 'deleted'] as const)(
    'switches a preserved stamp to replacement after an author %s value',
    (takeover) => {
      const surface = document.body.appendChild(document.createElement('span'));
      surface.style.setProperty('--pui-author', 'owned-by-author', 'important');
      applyProjectionThemeSurfaceStyle(
        surface,
        {
          '--pui-author': 'must-not-overwrite',
          '--pui-retired': 'first',
          '--pui-background': '#fff',
        },
        'preserve-inline'
      );
      if (takeover === 'changed') surface.style.setProperty('--pui-retired', 'author-change');
      if (takeover === 'priority') surface.style.setProperty('--pui-retired', 'first', 'important');
      if (takeover === 'deleted') surface.style.removeProperty('--pui-retired');
      const retired = [
        surface.style.getPropertyValue('--pui-retired'),
        surface.style.getPropertyPriority('--pui-retired'),
      ];
      const observer = new MutationObserver(() => {});
      observer.observe(surface, { attributes: true, attributeFilter: ['style'] });
      try {
        applyProjectionThemeSurfaceStyle(
          surface,
          { '--pui-background': '#222', '--pui-foreground': '#eee' },
          'replace-batch'
        );
        expect(observer.takeRecords()).toHaveLength(1);
        expect([
          surface.style.getPropertyValue('--pui-retired'),
          surface.style.getPropertyPriority('--pui-retired'),
        ]).toEqual(takeover === 'equal' ? ['', ''] : retired);
        clearProjectionThemeSurfaceStyle(surface);
        expect(surface.style.getPropertyValue('--pui-background')).toBe('');
        expect(surface.style.getPropertyValue('--pui-foreground')).toBe('');
        expect(surface.style.getPropertyValue('--pui-author')).toBe('owned-by-author');
        expect(surface.style.getPropertyPriority('--pui-author')).toBe('important');
        expect([
          surface.style.getPropertyValue('--pui-retired'),
          surface.style.getPropertyPriority('--pui-retired'),
        ]).toEqual(takeover === 'equal' ? ['', ''] : retired);
      } finally {
        observer.disconnect();
      }
    }
  );

  it('uses the surface document CSSOM even without a browsing context', () => {
    const other = document.implementation.createHTMLDocument('detached');
    const surface = other.body.appendChild(other.createElement('span'));
    surface.style.setProperty('--unowned', 'other-document', 'important');
    applyProjectionThemeSurfaceStyle(
      surface,
      { '--pui-background': '#fff', '--pui-foreground': '#111' },
      'replace-batch'
    );
    expect(surface.style.getPropertyValue('--pui-background')).toBe('#fff');
    expect(surface.style.getPropertyValue('--pui-foreground')).toBe('#111');
    clearProjectionThemeSurfaceStyle(surface);
    expect(surface.style.getPropertyValue('--pui-background')).toBe('');
    expect(surface.style.getPropertyValue('--unowned')).toBe('other-document');
    expect(surface.style.getPropertyPriority('--unowned')).toBe('important');
  });

  it('keeps declaration parsing for empty and nested custom values', () => {
    const surface = document.body.appendChild(document.createElement('span'));
    const reference = document.createElement('span');
    surface.style.cssText =
      '--pui-retired: old; --pui-empty: old; --pui-nested: original; color: red !important';
    applyProjectionThemeSurfaceStyle(
      surface,
      { '--pui-retired': 'old', '--pui-empty': 'old', '--pui-nested': 'original' },
      'replace-batch'
    );
    reference.style.cssText = surface.style.cssText;
    const next = {
      '--pui-empty': '',
      '--pui-nested': 'var(--page-color, rgb(1, 2, 3))',
      '--pui-next': 'blue',
      '--pui-font': 'Example Serif, serif',
    } as const;
    reference.style.removeProperty('--pui-retired');
    for (const [key, value] of Object.entries(next)) reference.style.setProperty(key, value);
    applyProjectionThemeSurfaceStyle(surface, next, 'replace-batch');
    const declarations = (style: CSSStyleDeclaration) =>
      Array.from({ length: style.length }, (_, index) => {
        const key = style.item(index);
        return [key, style.getPropertyValue(key), style.getPropertyPriority(key)];
      }).sort(([a], [b]) => a.localeCompare(b));
    expect(declarations(surface.style)).toEqual(declarations(reference.style));
    expect(surface.style.getPropertyPriority('color')).toBe('important');
    clearProjectionThemeSurfaceStyle(surface);
    expect(surface.style.color).toBe('red');
    expect(surface.style.getPropertyPriority('color')).toBe('important');
  });

  it.each(['inspect', 'clear', 'replace'] as const)(
    'allows a synchronous style callback to %s the complete palette',
    (action) => {
      const observed: string[][] = [];
      let armed = false;
      const name = `theme-batch-callback-${++customElementSerial}`;
      class Surface extends HTMLElement {
        static observedAttributes = ['style'];
        attributeChangedCallback() {
          if (!armed) return;
          armed = false;
          observed.push([
            this.style.getPropertyValue('--pui-background'),
            this.style.getPropertyValue('--pui-foreground'),
          ]);
          if (action === 'clear') clearProjectionThemeSurfaceStyle(this);
          if (action === 'replace')
            applyProjectionThemeSurfaceStyle(
              this,
              { '--pui-reentrant': 'latest' },
              'replace-batch'
            );
        }
      }
      customElements.define(name, Surface);
      const surface = document.body.appendChild(document.createElement(name));
      armed = true;
      applyProjectionThemeSurfaceStyle(
        surface,
        { '--pui-background': '#fff', '--pui-foreground': '#111' },
        'replace-batch'
      );
      expect(observed).toEqual([['#fff', '#111']]);
      if (action === 'clear') {
        expect(surface.style.getPropertyValue('--pui-background')).toBe('');
        expect(surface.style.getPropertyValue('--pui-foreground')).toBe('');
      }
      if (action === 'replace') {
        expect(surface.style.getPropertyValue('--pui-background')).toBe('');
        expect(surface.style.getPropertyValue('--pui-foreground')).toBe('');
        expect(surface.style.getPropertyValue('--pui-reentrant')).toBe('latest');
      }
      clearProjectionThemeSurfaceStyle(surface);
      expect(surface.style.getPropertyValue('--pui-reentrant')).toBe('');
    }
  );
});
