// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import {
  installSearchCloseFocusReceipt,
  judgeSearchCloseFocus,
  type SearchCloseFocusReceipt,
} from './site-search-close-focus-evidence';

function onTimeReceipt(): SearchCloseFocusReceipt {
  const owners = {
    openerCurrent: true,
    dialogCurrent: true,
    focused: true,
    deepActive: { tag: 'button', ref: null, owner: null, generation: null },
  };
  return {
    timeOrigin: 1_795_631_900_000,
    budgetMs: 1000,
    expected: {
      opener: { owner: 'command', generation: '7' },
      dialog: { owner: 'dialog', generation: '4' },
    },
    clickedAt: 2000,
    clickObservedAt: 2001,
    clickedTrusted: true,
    clickOwners: { ...owners, focused: false },
    focusedAt: 2511.7,
    focusObservedAt: 2512,
    focusedTrusted: true,
    focusOwners: { ...owners },
    readAt: 4300,
    readOwners: { ...owners },
    disposed: false,
  };
}

describe('Search Close focus receipt keeps the original browser deadline', () => {
  it('accepts actual focus at 511.7 ms even when receipt transport finishes later', () => {
    const verdict = judgeSearchCloseFocus(onTimeReceipt());
    expect(verdict).toMatchObject({ ok: true, reason: 'restored' });
    expect(verdict.restoredInMs).toBeCloseTo(511.7, 6);
  });

  it('accepts the original exact 1000 ms boundary', () => {
    const receipt = onTimeReceipt();
    receipt.focusedAt = 3000;
    receipt.focusObservedAt = 3001;
    expect(judgeSearchCloseFocus(receipt)).toEqual({
      ok: true,
      reason: 'restored',
      restoredInMs: 1000,
    });
  });

  it('rejects 1000.1 ms without using the later receipt time as allowance', () => {
    const receipt = onTimeReceipt();
    receipt.focusedAt = 3000.1;
    receipt.focusObservedAt = 3001;
    expect(judgeSearchCloseFocus(receipt)).toMatchObject({ ok: false, reason: 'late-focus' });
  });

  it('rejects an unavailable transport receipt', () => {
    expect(judgeSearchCloseFocus(null)).toEqual({
      ok: false,
      reason: 'receipt-unavailable',
      restoredInMs: null,
    });
  });

  it.each([
    [
      'missing click',
      (r: SearchCloseFocusReceipt) => {
        r.clickedAt = null;
      },
      'missing-trusted-close',
    ],
    [
      'synthetic click',
      (r: SearchCloseFocusReceipt) => {
        r.clickedTrusted = false;
      },
      'missing-trusted-close',
    ],
    [
      'missing focus',
      (r: SearchCloseFocusReceipt) => {
        r.focusedAt = null;
      },
      'missing-trusted-focus',
    ],
    [
      'synthetic focus',
      (r: SearchCloseFocusReceipt) => {
        r.focusedTrusted = false;
      },
      'missing-trusted-focus',
    ],
    [
      'preexisting focus',
      (r: SearchCloseFocusReceipt) => {
        r.focusedAt = 1999;
      },
      'invalid-page-clock',
    ],
    [
      'nonfinite clock',
      (r: SearchCloseFocusReceipt) => {
        r.focusedAt = Number.NaN;
      },
      'invalid-page-clock',
    ],
    [
      'clock from the future',
      (r: SearchCloseFocusReceipt) => {
        r.focusObservedAt = 2510;
      },
      'invalid-page-clock',
    ],
    [
      'stale click owner',
      (r: SearchCloseFocusReceipt) => {
        r.clickOwners!.openerCurrent = false;
      },
      'stale-close-owner',
    ],
    [
      'wrong focus owner',
      (r: SearchCloseFocusReceipt) => {
        r.focusOwners!.focused = false;
      },
      'wrong-focus-owner',
    ],
    [
      'retired Dialog at focus',
      (r: SearchCloseFocusReceipt) => {
        r.focusOwners!.dialogCurrent = false;
      },
      'wrong-focus-owner',
    ],
    [
      'new opener at retrieval',
      (r: SearchCloseFocusReceipt) => {
        r.readOwners.openerCurrent = false;
      },
      'current-owner-not-focused',
    ],
    [
      'new Dialog at retrieval',
      (r: SearchCloseFocusReceipt) => {
        r.readOwners.dialogCurrent = false;
      },
      'current-owner-not-focused',
    ],
    [
      'focus moved elsewhere',
      (r: SearchCloseFocusReceipt) => {
        r.readOwners.focused = false;
      },
      'current-owner-not-focused',
    ],
    [
      'changed deadline',
      (r: SearchCloseFocusReceipt) => {
        r.budgetMs = 1500;
      },
      'wrong-budget',
    ],
    [
      'disposed observer',
      (r: SearchCloseFocusReceipt) => {
        r.disposed = true;
      },
      'observer-disposed',
    ],
  ] as const)('rejects %s', (_name, mutate, reason) => {
    const receipt = onTimeReceipt();
    mutate(receipt);
    expect(judgeSearchCloseFocus(receipt)).toMatchObject({ ok: false, reason });
  });
});

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  document.body.replaceChildren();
});

function publicOwners() {
  document.body.innerHTML = `
    <site-search data-search-generation="7">
      <div data-projection-owner-host="command" data-projection-generation-host="7" data-projection-generation-state="active">
        <button data-open-modal data-projection-owner="command" data-projection-generation="7">Search</button>
      </div>
      <div data-search-dialog-mount data-projection-owner="dialog">
        <div data-projection-owner-host="dialog" data-projection-generation-host="4" data-projection-generation-state="active"></div>
      </div>
    </site-search>
    <div data-demo-ref="panel" data-projection-owner="dialog" data-projection-generation="4">
      <button data-demo-ref="close" data-projection-owner="dialog" data-projection-generation="4">Close</button>
    </div>`;
  const trigger = document.querySelector<HTMLElement>('[data-open-modal]')!;
  const close = document.querySelector<HTMLElement>('[data-demo-ref="close"]')!;
  const panel = document.querySelector<HTMLElement>('[data-demo-ref="panel"]')!;
  return { trigger, close, panel, dialog: { owner: 'dialog', generation: '4' } };
}

describe('Search Close observer reads actual owners without making readiness', () => {
  it('pins independent opener and portaled Dialog generations without any DOM writes', async () => {
    const nodes = publicOwners();
    const changes = new MutationObserver(() => {});
    changes.observe(document.body, { attributes: true, childList: true, subtree: true });
    cleanup.push(() => changes.disconnect());
    const observer = installSearchCloseFocusReceipt(nodes);
    cleanup.push(() => observer.dispose());
    const receipt = await observer.read();
    expect(receipt.expected).toEqual({
      opener: { owner: 'command', generation: '7' },
      dialog: nodes.dialog,
    });
    expect(receipt.readOwners).toMatchObject({
      openerCurrent: true,
      dialogCurrent: true,
      focused: false,
    });
    expect(judgeSearchCloseFocus(receipt).reason).toBe('missing-trusted-close');
    observer.dispose();
    expect(changes.takeRecords()).toEqual([]);
  });

  it('does not accept synthetic Close/focus events even if the real opener is active', async () => {
    const nodes = publicOwners();
    const observer = installSearchCloseFocusReceipt(nodes);
    cleanup.push(() => observer.dispose());
    nodes.close.click();
    nodes.trigger.focus();
    nodes.trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    const receipt = await observer.read();
    expect(receipt.readOwners.focused).toBe(true);
    expect(receipt.clickedAt).toBeNull();
    expect(receipt.focusedAt).toBeNull();
    expect(judgeSearchCloseFocus(receipt).reason).toBe('missing-trusted-close');
  });

  it('inspects the deep active element inside the exact pinned public host', async () => {
    const nodes = publicOwners();
    const host = document.createElement('x-search-opener');
    for (const attr of [...nodes.trigger.attributes]) host.setAttribute(attr.name, attr.value);
    nodes.trigger.replaceWith(host);
    const inner = document.createElement('button');
    host.attachShadow({ mode: 'open' }).append(inner);
    const observer = installSearchCloseFocusReceipt({ ...nodes, trigger: host });
    cleanup.push(() => observer.dispose());
    inner.focus();
    const receipt = await observer.read();
    expect(document.activeElement).toBe(host);
    expect(receipt.readOwners.focused).toBe(true);
    expect(receipt.readOwners.deepActive?.tag).toBe('button');
    expect(judgeSearchCloseFocus(receipt).ok).toBe(false);
  });

  it('rejects a replacement opener carrying identical coordinates', async () => {
    const nodes = publicOwners();
    const observer = installSearchCloseFocusReceipt(nodes);
    cleanup.push(() => observer.dispose());
    const replacement = nodes.trigger.cloneNode(true) as HTMLElement;
    nodes.trigger.replaceWith(replacement);
    replacement.focus();
    const receipt = await observer.read();
    expect(receipt.readOwners.openerCurrent).toBe(false);
    expect(receipt.readOwners.focused).toBe(false);
  });

  it('rejects a replacement Dialog generation host carrying identical coordinates', async () => {
    const nodes = publicOwners();
    const observer = installSearchCloseFocusReceipt(nodes);
    cleanup.push(() => observer.dispose());
    const host = document.querySelector('[data-projection-owner-host="dialog"]')!;
    host.replaceWith(host.cloneNode(true));
    expect((await observer.read()).readOwners.dialogCurrent).toBe(false);
  });

  it('rejects wrong expected Dialog coordinates before installing listeners', () => {
    const nodes = publicOwners();
    expect(() =>
      installSearchCloseFocusReceipt({ ...nodes, dialog: { owner: 'dialog', generation: '7' } })
    ).toThrow('exact current committed owners');
  });

  it('rejects duplicate active Dialog hosts with identical coordinates before arming', () => {
    const nodes = publicOwners();
    const host = document.querySelector('[data-projection-owner-host="dialog"]')!;
    host.after(host.cloneNode(true));
    expect(() => installSearchCloseFocusReceipt(nodes)).toThrow(
      'committed Search Close/opener owners'
    );
  });

  it('keeps rejecting a second active Dialog host introduced after arming', async () => {
    const nodes = publicOwners();
    const observer = installSearchCloseFocusReceipt(nodes);
    cleanup.push(() => observer.dispose());
    const host = document.querySelector('[data-projection-owner-host="dialog"]')!;
    host.after(host.cloneNode(true));
    expect((await observer.read()).readOwners.dialogCurrent).toBe(false);
  });

  it('rejects a different Panel with identical coordinates that does not contain Close', () => {
    const nodes = publicOwners();
    const wrongPanel = nodes.panel.cloneNode(false) as HTMLElement;
    nodes.panel.after(wrongPanel);
    expect(() => installSearchCloseFocusReceipt({ ...nodes, panel: wrongPanel })).toThrow(
      'exact current committed owners'
    );
  });

  it('rejects Close moving to a different same-coordinate Panel after arming', async () => {
    const nodes = publicOwners();
    const observer = installSearchCloseFocusReceipt(nodes);
    cleanup.push(() => observer.dispose());
    const wrongPanel = nodes.panel.cloneNode(false) as HTMLElement;
    nodes.panel.after(wrongPanel);
    wrongPanel.append(nodes.close);
    expect((await observer.read()).readOwners.dialogCurrent).toBe(false);
  });
});
