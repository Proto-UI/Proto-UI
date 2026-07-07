import { describe, expect, it } from 'vitest';
import { createWebVisibilityHostBridge } from '../src';

describe('module-visibility web host bridge (v0)', () => {
  it('projects hidden facts to the host hidden attribute', () => {
    const el = document.createElement('div');
    const bridge = createWebVisibilityHostBridge(el);

    bridge.project({ hidden: true });
    expect(el.hidden).toBe(true);

    bridge.project({ hidden: false });
    expect(el.hidden).toBe(false);
  });

  it('restores a pre-existing host hidden factor when visibility clears its own factor', () => {
    const el = document.createElement('div');
    el.hidden = true;
    const bridge = createWebVisibilityHostBridge(el);

    bridge.project({ hidden: true });
    expect(el.hidden).toBe(true);

    bridge.project({ hidden: false });
    expect(el.hidden).toBe(true);
  });
});
