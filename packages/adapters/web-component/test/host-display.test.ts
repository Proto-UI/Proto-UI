import { describe, expect, it } from 'vitest';
import { tw } from '@proto.ui/core';

import { AdaptToWebComponent } from '../src/adapt';
import { installDefaultHostDisplay } from '../src/host-display';

describe('adapter-web-component: host display', () => {
  it('lets a private presentation recipe own display without removing visibility infrastructure or consumer classes', () => {
    const host = document.createElement('x-private-split-display');
    host.className = 'consumer pui-host-root';
    const controller = installDefaultHostDisplay(host, { displayOwner: 'presentation' });
    expect(host.className).toBe('consumer');
    host.setAttribute('data-pui-split-root-style', 'size-4');
    controller.sync();
    expect(host.className).toBe('consumer');
    host.removeAttribute('data-pui-split-root-style');
    controller.sync();
    expect(host.className).toBe('consumer');
    controller.disconnect();
    controller.disconnect();
    expect(host.className).toBe('consumer');
    expect(document.head.textContent).toContain('data-pui-view-detached');
  });

  it('injects a low-specificity block display rule and default host class', async () => {
    const tag = 'x-host-display-default';

    AdaptToWebComponent({
      name: tag,
      setup() {
        return (r) => [r.el('div', 'ok')];
      },
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await Promise.resolve();

    const styleEl = document.getElementById('proto-ui-wc-host-display') as HTMLStyleElement | null;
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain(`:where(.pui-host-root) { display: block; }`);
    expect(el.classList.contains('pui-host-root')).toBe(true);
  });

  it('does not force block when author provides a class-based display utility', async () => {
    const tag = 'x-host-display-class';

    AdaptToWebComponent({
      name: tag,
      setup() {
        return (r) => [r.el('div', 'ok')];
      },
    });

    const authorStyle = document.createElement('style');
    authorStyle.textContent = `.inline { display: inline; }`;
    document.head.appendChild(authorStyle);

    const el = document.createElement(tag);
    el.className = 'inline';
    document.body.appendChild(el);
    await Promise.resolve();

    expect(getComputedStyle(el).display).toBe('inline');
    expect(el.classList.contains('pui-host-root')).toBe(false);

    authorStyle.remove();
  });

  it('keeps the default host display class when feedback adds non-display utility classes', async () => {
    const tag = 'x-host-display-feedback-non-display';

    AdaptToWebComponent({
      name: tag,
      setup(def) {
        def.feedback.style.use(tw('rounded bg-red-500 text-white'));
        return (r) => [r.el('div', 'ok')];
      },
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('data-pui-style')).toBe('rounded bg-red-500 text-white');
    expect(el.classList.contains('rounded')).toBe(false);
    expect(el.classList.contains('bg-red-500')).toBe(false);
    expect(el.classList.contains('pui-host-root')).toBe(true);
  });

  it('removes the default host display class when feedback adds a display utility class', async () => {
    const tag = 'x-host-display-feedback-display';

    AdaptToWebComponent({
      name: tag,
      setup(def) {
        def.feedback.style.use(tw('inline-flex rounded'));
        return (r) => [r.el('div', 'ok')];
      },
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('data-pui-style')).toBe('inline-flex rounded');
    expect(el.classList.contains('inline-flex')).toBe(false);
    expect(el.classList.contains('pui-host-root')).toBe(false);
  });

  it('applies setProps className onto the host without dropping feedback classes', async () => {
    const tag = 'x-host-display-set-props-class';

    AdaptToWebComponent({
      name: tag,
      setup(def) {
        def.feedback.style.use(tw('rounded bg-red-500'));
        return (r) => [r.el('div', 'ok')];
      },
    });

    const el = document.createElement(tag) as HTMLElement & {
      setProps(next: Record<string, unknown>): void;
    };
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();

    el.setProps({ className: 'user-a' });

    expect(el.classList.contains('user-a')).toBe(true);
    expect(el.getAttribute('data-pui-style')).toBe('rounded bg-red-500');
    expect(el.classList.contains('rounded')).toBe(false);
    expect(el.classList.contains('bg-red-500')).toBe(false);

    el.setProps({});

    expect(el.classList.contains('user-a')).toBe(false);
    expect(el.getAttribute('data-pui-style')).toBe('rounded bg-red-500');
    expect(el.classList.contains('rounded')).toBe(false);
    expect(el.classList.contains('bg-red-500')).toBe(false);
  });
});
