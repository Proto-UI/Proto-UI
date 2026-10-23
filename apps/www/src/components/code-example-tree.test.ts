import { afterEach, describe, expect, it, vi } from 'vitest';
import { initCodeExamples } from './code-example-client';
import { codeFileNodes, codeTreeIndent, enhanceCodeExampleTree } from './code-example-tree';

const projections: ReturnType<typeof enhanceCodeExampleTree>[] = [];
afterEach(() => {
  projections.splice(0).forEach((projection) => projection.destroy());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function fixture() {
  document.body.innerHTML = `<section data-code-example><nav aria-label="Files">
    <a id="main-file" aria-selected="true" data-code-file-path="src/main.ts">src/main.ts</a>
    <a id="html-file" aria-selected="false" data-code-file-path="index.html">index.html</a>
  </nav><figure id="main" role="region" aria-labelledby="main-file"><pre>main exact</pre></figure>
  <figure id="html" role="region" aria-labelledby="html-file"><pre>html exact</pre></figure></section>`;
  const list = document.querySelector('nav')!;
  const tabs = [...list.querySelectorAll<HTMLElement>('a')];
  const panels = [...document.querySelectorAll<HTMLElement>('figure')];
  return { list, tabs, panels };
}
describe('CodeExample real file Tree', () => {
  it('builds canonical ancestors and stable depth-first keys without inventing files', () => {
    expect(codeFileNodes(['src/a.ts', 'index.html', 'src/lib/b.ts']).map((node) => [node.key, node.parentKey, node.fileIndex]))
      .toEqual([['src', '', undefined], ['src/a.ts', 'src', 0], ['src/lib', 'src', undefined], ['src/lib/b.ts', 'src/lib', 2], ['index.html', '', 1]]);
    for (const paths of [['src', 'src/a.ts'], ['a.ts', 'a.ts'], ['../a.ts'], ['/a.ts']]) expect(() => codeFileNodes(paths)).toThrow();
  });
  it('uses actual tree semantics and keeps source nodes in place with labelled regions', async () => {
    const { list, tabs, panels } = fixture();
    const parents = panels.map((panel) => panel.parentNode);
    const sources = panels.map((panel) => panel.firstChild);
    const projection = enhanceCodeExampleTree({ list, tabs, panels, onSelect() {} });
    projections.push(projection);
    await Promise.resolve();
    const tree = document.querySelector('[data-code-example-tree]')!;
    expect(tree.querySelectorAll('[data-code-tree-icon="file-code"]')).toHaveLength(2);
    expect(tree.querySelectorAll('[data-code-tree-icon="folder"]')).toHaveLength(1);
    expect(tree.getAttribute('role')).toBe('tree');
    expect([...tree.querySelectorAll('[role="treeitem"]')].map((item) => item.getAttribute('data-code-tree-path'))).toEqual(['src', 'src/main.ts', 'index.html']);
    expect(tree.querySelector('[data-code-tree-path="src"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(tree.querySelector('[data-code-tree-path="src/main.ts"]')?.getAttribute('aria-selected')).toBe('true');
    expect(list.hidden).toBe(true);
    expect(panels.map((panel) => panel.parentNode)).toEqual(parents);
    expect(panels.map((panel) => panel.firstChild)).toEqual(sources);
    expect(panels.map((panel) => panel.getAttribute('aria-labelledby'))).toEqual(['main-file-tree', 'html-file-tree']);
    projection.destroy();
    expect(list.hidden).toBe(false);
    expect(panels.map((panel) => panel.getAttribute('aria-labelledby'))).toEqual(['main-file', 'html-file']);
  });
  it('routes folder activation to expansion, keeps leaf selection, and ignores nested requests', async () => {
    const { list, tabs, panels } = fixture();
    const onSelect = vi.fn();
    projections.push(enhanceCodeExampleTree({ list, tabs, panels, onSelect }));
    const tree = document.querySelector('[data-code-example-tree]')!;
    const request = (value: string) => tree.dispatchEvent(new CustomEvent('valueChange', { detail: { value } }));
    request('src');
    await Promise.resolve();
    expect(onSelect).not.toHaveBeenCalled();
    expect(tree.querySelector('[data-code-tree-path="src"]')?.getAttribute('aria-expanded')).toBe('false');
    request('src');
    await Promise.resolve();
    expect(tree.querySelector('[data-code-tree-path="src/main.ts"]')?.getAttribute('aria-selected')).toBe('true');
    request('index.html');
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(tree.querySelector('[data-code-tree-path="index.html"]')?.getAttribute('aria-selected')).toBe('true');
    tree.firstElementChild!.dispatchEvent(new CustomEvent('valueChange', { bubbles: true, detail: { value: 'src/main.ts' } }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
  it('retains native controls on role admission failure and during active fallback focus', () => {
    const { list, tabs, panels } = fixture();
    const original = Element.prototype.getAttribute;
    vi.spyOn(Element.prototype, 'getAttribute').mockImplementation(function (this: Element, name) {
      if (this.localName.endsWith('tree-item') && name === 'role') return null;
      return original.call(this, name);
    });
    expect(() => enhanceCodeExampleTree({ list, tabs, panels, onSelect() {} })).toThrow('native file controls retained');
    expect(list.hidden).toBe(false);
    expect(document.querySelector('[data-code-example-tree]')).toBeNull();
    vi.restoreAllMocks();
    tabs[0].tabIndex = 0;
    tabs[0].focus();
    projections.push(enhanceCodeExampleTree({ list, tabs, panels, onSelect() {} }));
    expect(document.activeElement).toBe(tabs[0]);
    expect(document.querySelector('[data-code-example-tree]')).toBeNull();
  });
});

it('composes host Tabs and file Tree without duplicating source or resetting each host file', async () => {
  document.body.innerHTML = `<section data-code-example data-initial-host="wc">
    <div data-code-toolbar><nav data-code-host-tabs aria-label="Host">
      <a id="host-wc" data-code-host-tab data-code-host="wc" aria-controls="panel-wc">Web Components</a>
      <a id="host-react" data-code-host-tab data-code-host="react" aria-controls="panel-react">React</a>
    </nav></div>
    ${['wc', 'react'].map((host) => `<section id="panel-${host}" data-code-host-panel data-code-host="${host}" ${host === 'react' ? 'hidden' : ''}>
      <section data-code-file-browser><aside><nav data-code-file-tabs aria-label="Files">
        ${['src/main.ts', 'index.html'].map((name, index) => `<a id="file-${host}-${index}" data-code-file-tab data-code-file-index="${index}" data-code-file-path="${name}" aria-controls="source-${host}-${index}">${name}</a>`).join('')}
      </nav></aside><div data-code-file-source>
        ${[0,1].map((index) => `<figure id="source-${host}-${index}" data-code-file-panel data-code-file-index="${index}" ${index ? 'hidden' : ''}><pre>${host}-${index}</pre></figure>`).join('')}
      </div></section>
    </section>`).join('')}
  </section>`;
  const sources = [...document.querySelectorAll('pre')];
  initCodeExamples(document);
  const wc = document.querySelector<HTMLElement>('#panel-wc')!;
  const tree = wc.querySelector('[data-code-example-tree]')!;
  tree.dispatchEvent(new CustomEvent('valueChange', { detail: { value: 'index.html' } }));
  await Promise.resolve();
  expect(wc.querySelector<HTMLElement>('#source-wc-1')!.hidden).toBe(false);
  const hostRoot = document.querySelector('[data-code-example-tabs-projection]')!;
  hostRoot.dispatchEvent(new CustomEvent('valueChange', { detail: { value: '1' } }));
  await Promise.resolve();
  expect(wc.hidden).toBe(true);
  hostRoot.dispatchEvent(new CustomEvent('valueChange', { detail: { value: '0' } }));
  await Promise.resolve();
  expect(wc.hidden).toBe(false);
  expect(wc.querySelector<HTMLElement>('#source-wc-1')!.hidden).toBe(false);
  expect([...document.querySelectorAll('pre')]).toEqual(sources);
  initCodeExamples(document);
  expect(document.querySelectorAll('[data-code-example-tree]')).toHaveLength(2);
  document.dispatchEvent(new Event('astro:before-swap'));
  expect(document.querySelector('[data-code-example-tree]')).toBeNull();
});


it('groups nested layout without replacing Tree semantics and uses upstream folder indentation', async () => {
  const { list, tabs, panels } = fixture();
  tabs[0].dataset.codeFilePath = 'src/lib/deep/a.ts';
  tabs[1].dataset.codeFilePath = 'src/lib/deep/b.ts';
  projections.push(enhanceCodeExampleTree({ list, tabs, panels, onSelect() {} }));
  await Promise.resolve();
  const tree = document.querySelector<HTMLElement>('[data-code-example-tree]')!;
  expect([...tree.querySelectorAll('[role="treeitem"]')].map((node) => node.getAttribute('data-code-tree-path')))
    .toEqual(['src', 'src/lib', 'src/lib/deep', 'src/lib/deep/a.ts', 'src/lib/deep/b.ts']);
  expect(tree.children.length).toBe(1);
  const siblings = tree.querySelector<HTMLElement>('[data-code-tree-children="src/lib/deep"]')!;
  expect(siblings.children.length).toBe(2);
  expect(siblings.style.gap).toBe('0.25rem');
  expect(siblings.hasAttribute('role')).toBe(false);
  expect(codeTreeIndent(0, true)).toBe('1rem');
  expect(parseFloat(codeTreeIndent(2, true))).toBeCloseTo(3.6);
  expect(codeTreeIndent(1, false)).toBe('2.4rem');
  expect(parseFloat(codeTreeIndent(2, false))).toBeCloseTo(3.9);
  const folder = tree.querySelector<HTMLElement>('[data-code-tree-path="src/lib/deep"]')!;
  expect(parseFloat(folder.style.paddingInlineStart)).toBeCloseTo(3.6);
  tree.dispatchEvent(new CustomEvent('expandedChange', { detail: { expandedKeys: ['src', 'src/lib'] } }));
  await Promise.resolve(); await Promise.resolve();
  expect(siblings.hidden).toBe(true);
  expect(siblings.style.display).toBe('none');
});

it('preserves explicit empty directories without inventing selectable files', async () => {
  expect(codeFileNodes(['proto-ui/config.json'], ['proto-ui', 'proto-ui/adapters']).map((node) => [node.key, node.fileIndex]))
    .toEqual([['proto-ui', undefined], ['proto-ui/adapters', undefined], ['proto-ui/config.json', 0]]);
  expect(() => codeFileNodes(['proto-ui'], ['proto-ui/adapters'])).toThrow();
  const { list, tabs, panels } = fixture();
  const onSelect = vi.fn();
  projections.push(enhanceCodeExampleTree({ list, tabs, panels, directories: ['src/empty'], onSelect }));
  const tree = document.querySelector('[data-code-example-tree]')!;
  const empty = tree.querySelector('[data-code-tree-path="src/empty"]')!;
  expect(empty.getAttribute('data-code-tree-kind')).toBe('folder');
  expect(empty.hasAttribute('aria-expanded')).toBe(false);
  expect(empty.querySelector('[data-code-tree-chevron]')).toBeNull();
  expect(empty.querySelector('[data-code-tree-icon="folder"]')).not.toBeNull();
  tree.dispatchEvent(new CustomEvent('valueChange', { detail: { value: 'src/empty' } }));
  await Promise.resolve();
  expect(onSelect).not.toHaveBeenCalled();
  expect(tree.querySelector('[data-code-tree-path="src/main.ts"]')?.getAttribute('aria-selected')).toBe('true');
  expect(empty.getAttribute('aria-selected')).toBe('false');
});


it('keeps long Shadcn navigation labels single-line without truncating the DOM name or full path', () => {
  const { list, tabs, panels } = fixture();
  tabs[0].dataset.codeFilePath = 'src/styles/proto-ui-tokens.generated.css';
  projections.push(enhanceCodeExampleTree({ list, tabs, panels, onSelect() {} }));
  const item = document.querySelector<HTMLElement>('[data-code-tree-path="src/styles/proto-ui-tokens.generated.css"]')!;
  const label = item.querySelector<HTMLElement>('[data-code-tree-label]')!;
  expect(label.textContent).toBe('proto-ui-tokens.generated.css');
  expect(label.title).toBe('src/styles/proto-ui-tokens.generated.css');
  expect(item.title).toBe(label.title);
  expect(label.style.whiteSpace).toBe('nowrap');
  expect(label.style.textOverflow).toBe('ellipsis');
  expect(label.style.minWidth).toBe('10ch');
});


it('reserves readable text and describes empty directories without sacrificing their names', async () => {
  const { list, tabs, panels } = fixture();
  projections.push(enhanceCodeExampleTree({ list, tabs, panels, onSelect() {}, directories: ['src/components'] }));
  const tree = document.querySelector<HTMLElement>('[data-code-example-tree]')!;
  expect(tree.style.minWidth).toContain('10ch');
  const empty = tree.querySelector<HTMLElement>('[data-code-tree-path="src/components"]')!;
  const label = empty.querySelector<HTMLElement>('[data-code-tree-label]')!;
  expect(label.style.minWidth).toBe('max-content');
  expect(label.style.flexShrink).toBe('0');
  const description = document.getElementById(empty.getAttribute('aria-describedby')!)!;
  expect(description.textContent).toContain('empty');
  expect(description.style.flexShrink).toBe('1');
  expect(empty.title).toContain('src/components');
});
