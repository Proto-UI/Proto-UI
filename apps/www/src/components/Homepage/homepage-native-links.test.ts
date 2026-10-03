import { describe, expect, it, vi } from 'vitest';
import { createHomepageContent } from './homepage-runtime-client';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import SiteLinkSurface from '../../prototypes/site-link-surface.proto';

const Surface = AdaptToWebComponent(SiteLinkSurface, {
  registerAs: 'test-home-staged-link-surface',
});

describe('Homepage native-link Prototype ownership', () => {
  it('materializes current paint before a staged generation activates without input', async () => {
    document.body.innerHTML =
      '<div><a href="/docs/" aria-current="page" data-site-link-appearance="nav">Docs</a></div>';
    const root = document.querySelector('div')!;
    const link = root.querySelector('a')!;
    let active = false;
    const content = createHomepageContent(
      {
        root,
        fallback: root,
        mount: root,
        ownerId: 'current',
        links: [link],
        theme: false,
        runtime: false,
      },
      'wc',
      () => active,
      'brutalist'
    );
    if (content.root.kind !== 'box') throw new Error('Expected composition');
    const anchor = content.root.children![0];
    if (typeof anchor === 'string' || anchor.kind !== 'box') throw new Error('Expected anchor');
    const surfaceNode = anchor.children![0];
    if (typeof surfaceNode === 'string' || surfaceNode.kind !== 'proto')
      throw new Error('Expected surface');
    expect(surfaceNode.props).toMatchObject({
      family: 'brutalist',
      appearance: 'nav',
      current: true,
      hovered: false,
      pressed: false,
      focusVisible: false,
    });
    const surface = new Surface();
    setElementProps(surface, surfaceNode.props!);
    link.append(surface);
    const project = vi.fn((_ref: string, props: Record<string, unknown>) =>
      setElementProps(surface, props)
    );
    const cleanup = content.setup?.({
      host: root,
      refs: { 'home-link-0': link },
      api: {
        call() {},
        getExposes() {
          return undefined;
        },
        setProps: project,
      },
    });
    for (let index = 0; index < 12; index++) await Promise.resolve();
    expect(project).not.toHaveBeenCalled();
    active = true;
    for (let index = 0; index < 12; index++) await Promise.resolve();
    expect(project).not.toHaveBeenCalled();
    expect(surface.getAttribute('data-pui-style')?.split(' ')).toEqual(
      expect.arrayContaining(['underline', 'font-semibold'])
    );
    if (typeof cleanup === 'function') cleanup();
    document.body.replaceChildren();
  });
  it('puts a real passive visual Prototype inside the native anchor', () => {
    document.body.innerHTML =
      '<div id="hero"><div data-homepage-fallback><a href="/docs/" target="_blank" rel="noreferrer" data-home-action-variant="primary">Docs</a></div><div data-homepage-mount></div></div>';
    const root = document.querySelector<HTMLElement>('#hero')!;
    const demo = createHomepageContent(
      {
        root,
        fallback: root.querySelector('[data-homepage-fallback]')!,
        mount: root.querySelector('[data-homepage-mount]')!,
        ownerId: 'hero',
        links: Array.from(root.querySelectorAll('a')),
        theme: false,
        runtime: false,
      },
      'wc',
      () => true,
      'brutalist'
    );
    if (demo.root.kind !== 'box') throw new Error('Expected website composition');
    const anchor = demo.root.children![0];
    expect(anchor).toMatchObject({
      kind: 'box',
      tag: 'a',
      attrs: { href: '/docs/', target: '_blank', rel: 'noreferrer' },
    });
    expect(anchor).toMatchObject({
      children: [
        { kind: 'proto', prototypeId: 'site-link-surface', props: { family: 'brutalist' } },
      ],
    });
  });
});

it('retains full visual identity on every fact update and clears the disposed generation', () => {
  document.body.innerHTML =
    '<div id="social"><a href="#docs" aria-label="GitHub" data-site-link-appearance="icon" data-site-link-icon="github">GitHub</a><div></div></div>';
  const root = document.querySelector<HTMLElement>('#social')!;
  const link = root.querySelector('a')!;
  const project = vi.fn();
  let active = true;
  const content = createHomepageContent(
    {
      root,
      fallback: root,
      mount: root,
      ownerId: 'social',
      links: [link],
      theme: false,
      runtime: false,
    },
    'wc',
    () => active,
    'brutalist'
  );
  const cleanup = content.setup?.({
    host: root,
    refs: { 'home-link-0': link },
    api: {
      call() {},
      getExposes() {
        return undefined;
      },
      setProps: project,
    },
  });
  link.dispatchEvent(new Event('pointerenter'));
  link.focus();
  link.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
  for (const [ref, props] of project.mock.calls) {
    expect(ref).toBe('home-link-surface-0');
    expect(props).toMatchObject({
      family: 'brutalist',
      appearance: 'icon',
      emphasis: 'secondary',
      icon: 'github',
    });
  }
  expect(project).toHaveBeenLastCalledWith(
    'home-link-surface-0',
    expect.objectContaining({ hovered: true, pressed: true })
  );
  active = false;
  const count = project.mock.calls.length;
  link.dispatchEvent(new Event('pointerleave'));
  expect(project).toHaveBeenCalledTimes(count);
  if (typeof cleanup === 'function') cleanup();
  expect(project).toHaveBeenLastCalledWith(
    'home-link-surface-0',
    expect.objectContaining({
      family: 'brutalist',
      icon: 'github',
      hovered: false,
      pressed: false,
      focusVisible: false,
    })
  );
  const disposedCount = project.mock.calls.length;
  link.dispatchEvent(new Event('pointerenter'));
  expect(project).toHaveBeenCalledTimes(disposedCount);
  document.body.replaceChildren();
});
