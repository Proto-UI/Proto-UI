import { afterEach, describe, expect, it, vi } from 'vitest';

import { orderFocusTargetsByDocument } from '../src/platform/focus-order';

function tree(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('orderFocusTargetsByDocument', () => {
  it('orders targets by document order, whatever order they come in', () => {
    // T-FOCUS-ORDER-0001-CASE-WEB-DOCUMENT-ORDER
    const host = tree(
      '<span id="a"><i id="a1"></i></span><span id="b"></span><span id="c"></span>'
    );
    const [a, a1, b, c] = ['a', 'a1', 'b', 'c'].map((id) => host.querySelector(`#${id}`)!);
    expect(orderFocusTargetsByDocument([c, b, a1, a])).toEqual([a, a1, b, c]);
    expect(orderFocusTargetsByDocument([b])).toEqual([b]);
  });

  it('needs no Node global to compare positions', () => {
    // T-FOCUS-ORDER-0001-CASE-WEB-DOCUMENT-ORDER
    const host = tree('<span id="a"></span><span id="b"></span>');
    const [a, b] = ['a', 'b'].map((id) => host.querySelector(`#${id}`)!);
    vi.stubGlobal('Node', undefined);
    expect(orderFocusTargetsByDocument([b, a])).toEqual([a, b]);
  });

  it('reports targets in different trees unorderable', () => {
    // T-FOCUS-ORDER-0001-CASE-WEB-CROSS-TREE
    const host = tree('<span id="light"></span><div id="shadow-host"></div>');
    const light = host.querySelector('#light')!;
    const shadow = host.querySelector('#shadow-host')!.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button></button>';
    const inShadow = shadow.querySelector('button')!;
    expect(orderFocusTargetsByDocument([light, inShadow])).toBeNull();

    const detached = document.createElement('span');
    expect(orderFocusTargetsByDocument([light, detached])).toBeNull();
  });

  it('reports a set holding a target that is not a node unorderable', () => {
    // T-FOCUS-ORDER-0001-CASE-WEB-CROSS-TREE
    const host = tree('<span id="a"></span>');
    expect(orderFocusTargetsByDocument([host.querySelector('#a')!, { ref: 'a' }])).toBeNull();
  });
});
