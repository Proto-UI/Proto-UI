// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { loadReact } from './react-runtime';

describe('real reader React loader', () => {
  it('retains matched React 18 client roots, commit and portal APIs', async () => {
    const { React, ReactDOM } = await loadReact();
    expect(React.version).toBe('18.3.1');
    for (const key of ['createRoot', 'hydrateRoot', 'flushSync', 'createPortal'])
      expect(typeof ReactDOM[key], key).toBe('function');
  });

  it('commits before synchronous consumer setup and cleans up real body portals', async () => {
    const { React, ReactDOM } = await loadReact();
    const host = document.createElement('div');
    const portal = document.createElement('div');
    document.body.append(host, portal);
    const root = ReactDOM.createRoot(host);
    try {
      ReactDOM.flushSync(() =>
        root.render(
          React.createElement(
            'div',
            { 'data-reader-content': '' },
            ReactDOM.createPortal(
              React.createElement('span', { 'data-reader-portal': '' }, 'Real portal'),
              portal
            )
          )
        )
      );
      // Actual DOM immediately after the commit boundary, without frames or mocked modules.
      expect(host.querySelector('[data-reader-content]')).not.toBeNull();
      expect(portal.querySelector('[data-reader-portal]')?.textContent).toBe('Real portal');
      expect(host.querySelector('[data-reader-portal]')).toBeNull();
    } finally {
      ReactDOM.flushSync(() => root.unmount());
      host.remove();
      portal.remove();
    }
    expect(host.innerHTML).toBe('');
    expect(portal.innerHTML).toBe('');
  });
});
