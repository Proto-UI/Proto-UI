import { retainHappyDomMutationCallbacks } from '../../../../scripts/test/happy-dom-mutation-keepalive.mjs';
let observerKeeper: ReturnType<typeof retainHappyDomMutationCallbacks>;
beforeAll(() => {
  observerKeeper = retainHappyDomMutationCallbacks(window);
});
afterAll(() => observerKeeper.restore());
import { headerSurfaceParticipant } from './site-header-surface';
import { quickStartOwnershipReady } from '../content/docs/zh-cn/quick-start-first-frame-ownership';
import { renderDemo } from './PrototypePreviewer/demo-renderer';
import { loadPrototypes } from './PrototypePreviewer/prototype-modules';
import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { siteTypographyParticipant, collectSiteTypographyTargets } from './site-typography';
import { initDocumentationTypography } from './site-typography-client';
import { createProjectionScopeController } from './PrototypePreviewer/projection-scope';
import { PREFERRED_ADAPTER_EVENT } from './adapter-preference';
import { initHomepageRuntime } from './Homepage/homepage-runtime-client';
import type { MaterializedProjectionCandidate } from './PrototypePreviewer/projection-materializer';
vi.mock('./PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('./PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...actual, loadVue2: async () => require('vue') };
});
vi.mock('./PrototypePreviewer/projection-theme', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/projection-theme')>();
  return {
    resolveProjectionThemeSurfaceStyle: () => ({
      '--pui-background': '#fff',
      '--pui-foreground': '#111',
    }),
    applyProjectionThemeSurfaceStyle: actual.applyProjectionThemeSurfaceStyle,
    watchProjectionThemeSurfaceStyle: (
      _family: unknown,
      _root: unknown,
      callback: (value: Record<string, string>) => void
    ) => {
      callback({ '--pui-background': '#fff', '--pui-foreground': '#111' });
      return () => {};
    },
  };
});

const candidates: MaterializedProjectionCandidate[] = [];
const handles: Array<{ destroy(): Promise<void> }> = [];
afterEach(async () => {
  for (const handle of handles.splice(0)) await handle.destroy();
  for (const candidate of candidates.splice(0)) await candidate.dispose();
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});
const settle = async () => {
  for (let n = 0; n < 12; n++) await new Promise((resolve) => setTimeout(resolve, 5));
};
function fixture() {
  document.body.innerHTML = `<main data-site-family-scope><h1 id="hero" data-site-typography="slogan">组件可以独立于框架或设计体系</h1><p data-site-typography="tagline">而不是在不同框架中被反复实现</p><div data-doc-flow><h2 id="heading">Heading <a href="#heading" aria-label="Permalink">#</a></h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6><p id="body">Original <em>emphasis</em> <a href="/destination/" target="_blank">native link</a></p><label for="input">Your name</label><input id="input" value="retained"><fieldset><legend>Options</legend></fieldset><figcaption>Caption</figcaption><div data-pui-root><p>Component-owned text</p></div></div></main>`;
  return document.querySelector<HTMLElement>('main')!;
}
const request = (
  runtime: 'wc' | 'react' | 'vue' | 'vue2',
  generation: number,
  family: 'shadcn' | 'brutalist' = 'shadcn'
) => ({ generation, selection: { runtimeId: runtime, projectionFamilyId: family } });
describe('batched real typography adapters and stable native semantic owners', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const)
    it(`${runtime}: valid inline slots, one native source, repeated replacement and complete teardown`, async () => {
      const root = fixture();
      const original = root.innerHTML;
      const heading = root.querySelector('h1')!;
      const link = root.querySelector<HTMLAnchorElement>('#body a')!;
      const emphasis = root.querySelector('em')!;
      const sourceText = root.querySelector('#body')!.firstChild!;
      const label = root.querySelector('label')!;
      const participant = siteTypographyParticipant(root);
      expect(
        collectSiteTypographyTargets(root).some(
          (t) => t.native.textContent === 'Component-owned text'
        )
      ).toBe(false);
      const first = await participant.materialize(request(runtime, 1));
      candidates.push(first);
      expect(root.innerHTML).toBe(original);
      expect(first.host.textContent).toBe('');
      first.activate();
      await settle();
      expect(root.querySelector('h1')).toBe(heading);
      expect(
        heading.querySelector('[data-typography-prototype]')?.classList.contains('block')
      ).toBe(true);
      expect(
        root.querySelector('label [data-typography-prototype]')?.classList.contains('block')
      ).toBe(false);
      expect(root.querySelector('#body a')).toBe(link);
      expect(root.querySelector('em')).toBe(emphasis);
      expect(root.querySelector('#body [data-site-typography-slot]')!.firstChild).toBe(sourceText);
      expect(label.getAttribute('for')).toBe('input');
      expect(root.querySelectorAll('#hero')).toHaveLength(1);
      expect(root.querySelectorAll('h1')).toHaveLength(1);
      expect(root.querySelectorAll('p div,h1 div,label div,legend div')).toHaveLength(0);
      expect(
        root.querySelectorAll(
          '[data-site-typography-carrier] [role],[data-site-typography-carrier] [tabindex]'
        )
      ).toHaveLength(0);
      const surface = heading.querySelector<HTMLElement>('[data-typography-prototype]')!;
      expect(surface.dataset.typographyRuntime).toBe(runtime);
      expect(surface.style.getPropertyValue('--pui-font-sans')).toContain('system-ui');
      expect(surface.getAttribute('data-pui-style')).toContain('text-3xl');
      expect(surface.getAttribute('data-pui-style')).toContain('font-semibold');
      expect(surface.getAttribute('data-pui-style')).not.toContain('pointer-events-none');
      if (runtime !== 'wc') expect(surface.localName).toBe('span');
      const clicks = vi.fn((event: Event) => event.preventDefault());
      link.addEventListener('click', clicks);
      link.click();
      expect(clicks).toHaveBeenCalledTimes(1);
      link.focus();
      const second = await participant.materialize(request(runtime, 2, 'brutalist'));
      candidates.push(second);
      expect(heading.querySelector('[data-typography-prototype]')).toBe(surface);
      second.activate();
      await settle();
      expect(document.activeElement).toBe(link);
      expect(heading.querySelector('[data-typography-prototype]')).not.toBe(surface);
      expect(heading.textContent).toBe('组件可以独立于框架或设计体系');
      const replacement = heading.querySelector<HTMLElement>('[data-typography-prototype]')!;
      expect(replacement.getAttribute('data-pui-style')).toContain('font-bold');
      expect(replacement.getAttribute('data-pui-style')).toContain('font-heading');
      expect(first.host.textContent).toBe('');
      await first.dispose();
      expect(root.querySelector('#body a')).toBe(link);
      expect(root.querySelector('#body [data-site-typography-slot]')!.firstChild).toBe(sourceText);
      await second.dispose();
      expect(root.innerHTML).toBe(original);
      expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
      expect(root.querySelector('#body a')).toBe(link);
    });
  it('restores previous real batch after failed commit and retains source edits/language replacement', async () => {
    const root = fixture();
    const body = root.querySelector<HTMLElement>('#body')!;
    const participant = siteTypographyParticipant(root);
    let fail = false;
    const controller = createProjectionScopeController({
      initialSelection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
      materialize: participant.materialize,
      prepareCommit: () => ({
        publish() {
          if (fail) throw new Error('publish failed');
        },
        rollback() {},
      }),
    });
    handles.push(controller);
    await controller.start();
    const old = body.querySelector('[data-typography-prototype]');
    body.querySelector('[data-site-typography-slot]')!.firstChild!.textContent = 'Edited ';
    fail = true;
    await expect(
      controller.request({ runtimeId: 'react', projectionFamilyId: 'brutalist' })
    ).rejects.toThrow('publish failed');
    expect(body.querySelector('[data-typography-prototype]')).toBe(old);
    expect(body.textContent).toBe('Edited emphasis native link');
    body.textContent = 'New translated source';
    root.lang = 'en';
    expect(participant.needsRefresh()).toBe(true);
    fail = false;
    await controller.request({ runtimeId: 'vue2' }, { force: true });
    expect(body.textContent).toBe('New translated source');
    await controller.destroy();
    expect(body.textContent).toBe('New translated source');
    expect(body.querySelector('[data-typography-prototype]')).toBeNull();
  });
  it('honors an explicit committed Shadcn family on a Brutalist documentation path', async () => {
    const previous = location.href;
    history.replaceState(null, '', '/en/ui-libraries/brutalist/button/');
    try {
      const root = fixture();
      root.dataset.siteLibraryFamily = 'brutalist';
      const handle = initDocumentationTypography(document)!;
      handles.push(handle);
      await handle.ready;
      const body = root.querySelector<HTMLElement>('#body')!;
      expect(body.dataset.typographyFamily).toBe('brutalist');
      root.dataset.siteLibraryFamily = 'shadcn';
      await vi.waitFor(() => expect(body.dataset.typographyFamily).toBe('shadcn'));
      delete root.dataset.siteLibraryFamily;
      await vi.waitFor(() => expect(body.dataset.typographyFamily).toBe('brutalist'));
    } finally {
      history.replaceState(null, '', previous);
    }
  });
  it('uses one documentation scope, follows global runtime and responds to new semantic content', async () => {
    const root = fixture();
    const handle = initDocumentationTypography(document)!;
    handles.push(handle);
    await handle.ready;
    expect(root.querySelector('#body')!.getAttribute('data-typography-runtime')).toBe('wc');
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'vue' } })
    );
    await settle();
    expect(root.querySelector('#body')!.getAttribute('data-typography-runtime')).toBe('vue');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Added native content';
    root.querySelector('[data-doc-flow]')!.append(paragraph);
    await settle();
    expect(paragraph.dataset.typographyRuntime).toBe('vue');
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(1);
    await handle.destroy();
    expect(paragraph.textContent).toBe('Added native content');
    expect(paragraph.childElementCount).toBe(0);
  });
});

describe('typography scope transaction and bounded setup', () => {
  it('shares the homepage exact generation across real adapter changes and teardown', async () => {
    fixture();
    const header = document.createElement('header');
    header.dataset.homepageRuntime = '';
    header.innerHTML = `<output data-homepage-runtime-status></output><div data-homepage-actions data-homepage-controls="runtime"><div data-homepage-fallback><a href="/docs/">Docs</a></div><div data-homepage-mount></div></div>`;
    header.insertAdjacentHTML(
      'beforeend',
      `<div data-homepage-actions><div data-homepage-fallback>${['github', 'discord', 'x', 'bluesky'].map((icon) => `<a href="https://example.test/${icon}" aria-label="${icon}" data-site-link-icon="${icon}" data-site-link-appearance="icon"></a>`).join('')}</div><div data-homepage-mount></div></div>`
    );
    document.body.prepend(header);
    const heading = document.querySelector<HTMLElement>('h1')!;
    const handle = initHomepageRuntime(header)!;
    handles.push(handle);
    await vi.waitFor(() => expect(handle.getSnapshot().phase).toBe('ready'));
    for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
      if (runtime !== 'wc')
        document.dispatchEvent(
          new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
        );
      await vi.waitFor(() => expect(handle.getSnapshot().selection.runtimeId).toBe(runtime));
      expect(heading.dataset.typographyRuntime).toBe(runtime);
      expect(heading.dataset.typographyGeneration).toBe(header.dataset.runtimeGeneration);
      expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(1);
    }
    await handle.destroy();
    expect(heading.textContent).toBe('组件可以独立于框架或设计体系');
    expect(heading.childElementCount).toBe(0);
  });
  it('batches 100 semantic owners in one renderer root and does not react to text edits with stale copy', async () => {
    const root = document.createElement('main');
    root.setAttribute('data-doc-flow', '');
    document.body.append(root);
    for (let i = 0; i < 100; i++) {
      const p = document.createElement('p');
      p.textContent = `Paragraph ${i}`;
      root.append(p);
    }
    const participant = siteTypographyParticipant(root);
    const candidate = await participant.materialize(request('react', 1));
    candidates.push(candidate);
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(1);
    candidate.activate();
    expect(root.querySelectorAll('[data-typography-prototype]')).toHaveLength(100);
    const text = root.querySelector('[data-site-typography-slot]')!.firstChild!;
    text.textContent = 'Fresh source, zero renderer updates';
    expect(participant.needsRefresh()).toBe(false);
    await candidate.dispose();
    expect(root.firstElementChild!.textContent).toBe('Fresh source, zero renderer updates');
  });
});

describe('inline renderer cache isolation', () => {
  for (const runtime of ['react', 'vue', 'vue2'] as const)
    it(`${runtime}: keeps span and default roots distinct for the same prototype`, async () => {
      await loadPrototypes(['shadcn-text-root']);
      const host = document.createElement('div');
      document.body.append(host);
      const result = await renderDemo({
        runtime,
        host,
        demo: {
          type: 'demo',
          root: {
            kind: 'box',
            children: [
              { kind: 'proto', prototypeId: 'shadcn-text-root', ref: 'block', children: ['Block'] },
              {
                kind: 'box',
                tag: 'span',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-text-root',
                    rootTag: 'span',
                    ref: 'inline',
                    children: ['Inline'],
                  },
                ],
              },
            ],
          },
        },
      });
      expect(host.querySelector('[data-demo-ref="block"]')!.localName).toBe('div');
      expect(host.querySelector('[data-demo-ref="inline"]')!.localName).toBe('span');
      await result.destroy();
      expect(host.childNodes).toHaveLength(0);
    });
});

describe('native-source lease boundaries', () => {
  it('only lets explicit native labels cross the exact actual passive Header frame', async () => {
    document.body.innerHTML =
      '<div data-pui-root><span data-site-typography="label">Component text</span></div><header><div data-site-header-panel><div data-site-header-surface-mount></div><div data-site-header-panel-content><span data-site-typography="label">Runtime</span></div></div></header>';
    const header = document.querySelector<HTMLElement>('header')!;
    const frame = headerSurfaceParticipant(header)!;
    const selection = request('wc', 1);
    const rendered = await frame.materialize(selection);
    candidates.push(rendered);
    rendered.activate();
    frame.prepareCommit(selection).publish();
    const actual = header.querySelector('.site-header-popup-surface')!;
    expect(actual.getAttribute('data-projection-prototype')).toBe('shadcn-surface-root');
    expect(
      collectSiteTypographyTargets(document.body).map((target) => target.native.textContent)
    ).toEqual(['Runtime']);
    const typography = siteTypographyParticipant(header);
    const batch = await typography.materialize(request('react', 1));
    candidates.push(batch);
    batch.activate();
    expect(
      header.querySelector('[data-site-typography]')!.getAttribute('data-typography-runtime')
    ).toBe('react');
    await batch.dispose();
    actual.classList.remove('site-header-popup-surface');
    expect(collectSiteTypographyTargets(document.body)).toHaveLength(0);
  });
  it('preserves a text caret and backward labelled-input selection through replacement', async () => {
    const root = fixture();
    const input = root.querySelector<HTMLInputElement>('input')!;
    const label = root.querySelector('label')!;
    label.append(input);
    input.focus();
    input.setSelectionRange(1, 4, 'backward');
    const text = root.querySelector('#body')!.firstChild!;
    const selection = document.getSelection()!;
    // HappyDOM focusOffset aliases anchorOffset; noncollapsed directional
    // text selection is browser evidence debt, not a claimed host-unit pass.
    selection.setBaseAndExtent(text, 3, text, 3);
    const p = siteTypographyParticipant(root);
    const first = await p.materialize(request('react', 1));
    candidates.push(first);
    first.activate();
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([
      1,
      4,
      'backward',
    ]);
    expect(selection.anchorNode).toBe(text);
    expect(selection.anchorOffset).toBe(3);
    expect(selection.focusNode).toBe(text);
    expect(selection.focusOffset).toBe(3);
    const next = await p.materialize(request('vue', 2, 'brutalist'));
    candidates.push(next);
    next.activate();
    await first.dispose();
    expect(root.querySelector('input')).toBe(input);
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.value).toBe('retained');
    expect(selection.anchorNode).toBe(text);
    expect(selection.focusNode).toBe(text);
  });
});

// Matched source-bound reading observations at 23df79b showed the native
// paragraph retaining its reading ink while its real Text leaf selected the
// stronger family foreground. Assert the consuming participant, not a recipe
// snapshot; browser color/geometry comparison remains separate evidence.
describe('Shadcn document reading composition', () => {
  const readingFixture = () => {
    document.body.innerHTML = `<div data-site-family-scope>
      <header><p data-site-typography="body" id="chrome-copy">Header help</p></header>
      <main data-pagefind-body>
        <h1 data-site-typography="h1" id="page-title">快速开始</h1>
        <p data-site-typography="tagline" id="description">Authored description</p>
        <div data-doc-flow>
          <p id="prose" style="color: rgb(65, 65, 65)">Original <em>emphasis</em> <a href="/destination/">native link</a></p>
          <h2 id="section">Section</h2><h3 id="subsection">Subsection</h3>
          <aside class="starlight-aside starlight-aside--note">
            <p class="starlight-aside__title" data-site-typography="label" id="note-title">Note title</p>
            <div class="starlight-aside__content"><p id="note-body">Note body</p></div>
          </aside>
          <aside class="doc-stage-notice"><p data-site-typography="notice-title" id="stage-title">Release title</p><p id="stage-body">Stage notice</p></aside>
        </div>
      </main>
    </div>`;
    return document.querySelector<HTMLElement>('[data-site-family-scope]')!;
  };
  const tokens = (root: HTMLElement, id: string) =>
    root
      .querySelector(`#${id} [data-typography-prototype]`)!
      .getAttribute('data-pui-style')!
      .split(/\s+/);

  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: changes document Text inputs, preserves notice/chrome owners and survives family round-trip`, async () => {
      const root = readingFixture();
      const original = root.innerHTML;
      const source = root.querySelector('#prose')!.firstChild;
      const link = root.querySelector<HTMLAnchorElement>('#prose a')!;
      const participant = siteTypographyParticipant(root, { docsOnly: true });
      const first = await participant.materialize(request(runtime, 1));
      candidates.push(first);
      first.activate();
      await settle();
      expect(tokens(root, 'prose')).toEqual(
        expect.arrayContaining(['text-inherit', 'text-base', 'leading-relaxed', 'font-normal'])
      );
      expect(tokens(root, 'prose')).not.toContain('text-foreground');
      expect(tokens(root, 'page-title')).toEqual(
        expect.arrayContaining(['text-3xl', 'leading-tight', 'font-semibold', 'text-foreground'])
      );
      expect(tokens(root, 'description')).toEqual(
        expect.arrayContaining(['text-base', 'leading-relaxed', 'text-muted-foreground'])
      );
      expect(tokens(root, 'section')).toContain('text-2xl');
      expect(tokens(root, 'subsection')).toContain('text-xl');
      for (const id of ['note-body', 'stage-body', 'chrome-copy']) {
        expect(tokens(root, id)).toContain('text-foreground');
        expect(tokens(root, id)).not.toContain('text-inherit');
      }
      expect(tokens(root, 'stage-title')).toEqual(
        expect.arrayContaining(['text-base', 'font-semibold', 'leading-relaxed', 'text-foreground'])
      );
      expect(tokens(root, 'note-title')).toEqual(
        expect.arrayContaining(['text-sm', 'font-medium', 'text-foreground'])
      );
      expect(root.querySelector('#prose')!.getAttribute('style')).toBe('color: rgb(65, 65, 65)');
      expect(root.querySelector('#prose [data-site-typography-slot]')!.firstChild).toBe(source);
      expect(root.querySelector('#prose a')).toBe(link);
      link.focus();
      const brutalist = await participant.materialize(request(runtime, 2, 'brutalist'));
      candidates.push(brutalist);
      brutalist.activate();
      expect(tokens(root, 'prose')).toEqual(
        expect.arrayContaining(['text-foreground', 'font-medium'])
      );
      expect(tokens(root, 'page-title')).toEqual(
        expect.arrayContaining(['text-4xl', 'font-bold', 'font-heading'])
      );
      expect(tokens(root, 'description')).toEqual(
        expect.arrayContaining(['text-lg', 'text-muted-foreground'])
      );
      const restored = await participant.materialize(request(runtime, 3));
      candidates.push(restored);
      restored.activate();
      expect(tokens(root, 'prose')).toContain('text-inherit');
      expect(tokens(root, 'page-title')).toContain('text-3xl');
      expect(document.activeElement).toBe(link);
      await first.dispose();
      await brutalist.dispose();
      await restored.dispose();
      expect(root.innerHTML).toBe(original);
    });
    it(`${runtime}: refreshes recipe ownership when the same paragraph moves into and out of an aside`, async () => {
      const root = readingFixture();
      const prose = root.querySelector<HTMLElement>('#prose')!;
      const source = prose.firstChild;
      const participant = siteTypographyParticipant(root, { docsOnly: true });
      const before = participant.getSourceRevision();
      const first = await participant.materialize(request(runtime, 1));
      candidates.push(first);
      first.activate();
      expect(participant.needsRefresh()).toBe(false);
      // Keep target/node/role order unchanged: only its semantic container moves.
      const aside = document.createElement('aside');
      prose.before(aside);
      aside.append(prose);
      expect(participant.needsRefresh()).toBe(true);
      expect(participant.getSourceRevision()).toBeGreaterThan(before);
      const notice = await participant.materialize(request(runtime, 2));
      candidates.push(notice);
      notice.activate();
      expect(tokens(root, 'prose')).toContain('text-foreground');
      expect(participant.needsRefresh()).toBe(false);
      aside.before(prose);
      aside.remove();
      expect(participant.needsRefresh()).toBe(true);
      const restored = await participant.materialize(request(runtime, 3));
      candidates.push(restored);
      restored.activate();
      expect(tokens(root, 'prose')).toContain('text-inherit');
      expect(root.querySelector('#prose [data-site-typography-slot]')!.firstChild).toBe(source);
    });
    it(`${runtime}: retains document roles while using the source-aligned medium homepage slogan`, async () => {
      const root = readingFixture();
      root.querySelector('main')!.setAttribute('data-homepage-runtime', '');
      root
        .querySelector('[data-doc-flow]')!
        .insertAdjacentHTML(
          'beforeend',
          '<h1 data-site-typography="slogan" id="slogan">Homepage slogan</h1>'
        );
      const candidate = await siteTypographyParticipant(root).materialize(request(runtime, 1));
      candidates.push(candidate);
      candidate.activate();
      expect(tokens(root, 'page-title')).toContain('text-4xl');
      expect(tokens(root, 'slogan')).toContain('text-3xl');
      expect(tokens(root, 'description')).toContain('text-lg');
      expect(tokens(root, 'prose')).toContain('text-foreground');
    });
  }
});

it('discovers native note-title intent before any asynchronous Surface bootstrap', () => {
  document.body.innerHTML =
    '<div data-doc-flow><aside class="starlight-aside--note"><p class="starlight-aside__title">Title</p><p>Body</p></aside></div>';
  const collected = collectSiteTypographyTargets(document.body, true);
  expect(collected.map((target) => target.role)).toEqual(['label', 'body']);
});

// A document-wide typography commit must not rewrite an untouched code
// selection. Native Selection methods can run focus steps even when all four
// endpoints remain identical. Happy DOM does not model those browser steps;
// the controlled side effect below makes that source ownership boundary red.
describe('startup typography and independent native selection owners', () => {
  for (const focusOwner of ['button', 'a'] as const)
    it(`does not reapply a retained code selection while ${focusOwner} owns focus`, async () => {
      const root = fixture();
      const command = document.createElement(focusOwner);
      if (command instanceof HTMLAnchorElement) command.href = '/native';
      command.textContent = 'Header command';
      const code = document.createElement('pre');
      code.tabIndex = 0;
      code.textContent = 'npm create proto-ui';
      root.prepend(command, code);
      const text = code.firstChild!;
      const selection = document.getSelection()!;
      selection.setBaseAndExtent(text, 1, text, 1);
      command.focus();
      const setBaseAndExtent = selection.setBaseAndExtent.bind(selection);
      const restore = vi.spyOn(selection, 'setBaseAndExtent').mockImplementation((...args) => {
        setBaseAndExtent(...args);
        code.focus(); // Controlled browser focus side effect, not fabricated evidence.
      });
      const participant = siteTypographyParticipant(root);
      const candidate = await participant.materialize(request('react', 1));
      candidates.push(candidate);
      candidate.activate();
      expect(restore).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(command);
      expect(code.firstChild).toBe(text);
      expect(selection.anchorNode).toBe(text);
      expect(selection.anchorOffset).toBe(1);
    });
});

// Header/Code readiness is injected fixture state; Typography publication is
// produced by the real React participant and is held behind an explicit gate.
it('keeps native ownership evidence pending while real React Typography publication is delayed', async () => {
  document.body.innerHTML = `<header data-docs-site-header data-site-menu-ready></header>
    <div data-site-code-surface="frame" data-code-surface-view="ready"></div>
    <main data-doc-flow><p class="doc-stage-notice__title" data-site-typography="notice-title">Retained release text</p></main>`;
  const root = document.querySelector<HTMLElement>('main')!;
  const participant = siteTypographyParticipant(root, {
    docsOnly: true,
    ownerId: 'documentation-typography',
  });
  const candidate = await participant.materialize(request('react', 1));
  candidates.push(candidate);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const published = gate.then(() => candidate.activate());
  try {
    expect(
      document.querySelector('[data-docs-site-header]')?.hasAttribute('data-site-menu-ready')
    ).toBe(true);
    expect(
      document
        .querySelector('[data-site-code-surface="frame"]')
        ?.getAttribute('data-code-surface-view')
    ).toBe('ready');
    expect(
      root.querySelector('.doc-stage-notice__title')?.hasAttribute('data-typography-runtime')
    ).toBe(false);
    expect(
      quickStartOwnershipReady(),
      'prepared Typography must not pass the native completion gate'
    ).toBe(false);
    release();
    await published;
    expect(
      root.querySelector('.doc-stage-notice__title')?.getAttribute('data-typography-owner')
    ).toBe('documentation-typography');
    expect(quickStartOwnershipReady()).toBe(true);
    const title = root.querySelector('.doc-stage-notice__title')!;
    title.setAttribute('data-typography-runtime', 'vue');
    expect(quickStartOwnershipReady(), 'another runtime is not the React owner under test').toBe(
      false
    );
    title.setAttribute('data-typography-runtime', 'react');
    title.setAttribute('data-typography-owner', 'another-typography-owner');
    expect(
      quickStartOwnershipReady(),
      'another scope cannot certify documentation Typography'
    ).toBe(false);
    title.setAttribute('data-typography-owner', 'documentation-typography');
    expect(quickStartOwnershipReady()).toBe(true);
  } finally {
    release();
    await published;
  }
});

describe('Library Card ownership before any runtime marker exists', () => {
  for (const docsOnly of [false, true])
    it(`does not recollect empty-token Base/Lucide parts (docsOnly=${docsOnly})`, () => {
      document.body.innerHTML = `<main data-doc-flow>
        <h2 id="ordinary-title">Ordinary documentation</h2><p id="ordinary-body">Ordinary prose</p>
        ${['base', 'lucide']
          .map(
            (family) => `<article data-library="${family}">
          <wc-library-base-surface data-library-part="base-surface">
            <header><h2><wc-library-base-text data-library-part="base-text">${family}</wc-library-base-text></h2></header>
            <p><wc-library-base-text data-library-part="base-text">Description</wc-library-base-text></p>
            <p data-site-typography="body"><wc-library-base-text data-library-part="base-text">Caption</wc-library-base-text></p>
          </wc-library-base-surface>
        </article>`
          )
          .join('')}
      </main>`;
      const root = document.querySelector<HTMLElement>('main')!;
      expect(root.querySelector('[data-pui-root],[data-pui-style]')).toBeNull();
      const html = root.innerHTML;
      const sources = [...root.querySelectorAll('[data-library] h2,[data-library] p')];
      const collect = () =>
        collectSiteTypographyTargets(root, docsOnly).map(({ native }) => native.id);
      expect(collect()).toEqual(['ordinary-title', 'ordinary-body']);
      expect(root.innerHTML).toBe(html);
      expect([...root.querySelectorAll('[data-library] h2,[data-library] p')]).toEqual(sources);
      for (const part of root.querySelectorAll('[data-library-part]'))
        part.setAttribute('data-pui-root', '');
      expect(collect()).toEqual(['ordinary-title', 'ordinary-body']);
    });
});

// Controlled matchMedia samples are participant-unit input only. No change
// events are dispatched and no shared runtime/client listeners are exercised.
// In particular, these tests do not certify automatic 640/1280px resizing.
describe('finite Hero viewport participant contract (explicit refresh)', () => {
  const widths = [320, 639, 640, 767, 768, 1024, 1279, 1280, 1440] as const;
  function controlledViewport(initial: number) {
    let width = initial;
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      const matches =
        query === '(max-width: 47.999rem)'
          ? width <= 47.999 * 16
          : query === '(min-width: 40rem)'
            ? width >= 640
            : query === '(min-width: 80rem)'
              ? width >= 1280
              : false;
      return {
        matches,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    });
    return (next: number) => {
      width = next;
    };
  }
  function heroFixture() {
    document.body.innerHTML =
      '<main data-site-family-scope><h1 id="bounded-hero" data-site-typography="slogan">A reusable component model</h1><p id="bounded-tagline" data-site-typography="tagline">Authored source stays <em>owned</em> by the document.</p><p id="bounded-body">Regular body text.</p></main>';
    return document.querySelector<HTMLElement>('main')!;
  }
  function surfaceTokens(root: HTMLElement, id: string) {
    return root
      .querySelector<HTMLElement>(`#${id} [data-typography-prototype]`)!
      .getAttribute('data-pui-style')!
      .split(/\s+/)
      .filter(Boolean)
      .sort();
  }
  function expectedTokens(role: 'slogan' | 'tagline', width: number) {
    return role === 'slogan'
      ? [
          `text-${width >= 1280 ? '5xl' : '3xl'}`,
          'text-foreground',
          'font-semibold',
          'font-sans',
          'leading-[1.1]',
          width >= 1280 ? 'tracking-tighter' : 'tracking-tight',
          'not-italic',
          'no-underline',
        ].sort()
      : [
          `text-${width >= 640 ? 'lg' : 'base'}`,
          'text-foreground',
          'font-normal',
          'font-sans',
          'tracking-normal',
          'not-italic',
          'no-underline',
        ].sort();
  }
  it('increments revision exactly at Hero/compact boundaries, including backwards, without source edits', () => {
    const setWidth = controlledViewport(320);
    const root = heroFixture();
    const participant = siteTypographyParticipant(root);
    const original = root.innerHTML;
    const samples = [
      [320, 1],
      [639, 1],
      [640, 2],
      [767, 2],
      [768, 3],
      [1024, 3],
      [1279, 3],
      [1280, 4],
      [1440, 4],
      [1279, 5],
      [768, 5],
      [767, 6],
      [640, 6],
      [639, 7],
      [320, 7],
    ];
    for (const [width, revision] of samples) {
      setWidth(width!);
      expect(participant.getSourceRevision(), `${width}px revision`).toBe(revision);
      expect(participant.getSourceRevision(), 'a second sample must be stable').toBe(revision);
      expect(root.innerHTML).toBe(original);
    }
    participant.destroy();
    expect(participant.needsRefresh()).toBe(false);
  });

  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    for (const width of widths) {
      it(`${runtime}/${width}px: consumes exact public Text tokens in retained native owners`, async () => {
        controlledViewport(width);
        const root = heroFixture();
        const heading = root.querySelector('#bounded-hero')!;
        const headingText = heading.firstChild;
        const emphasis = root.querySelector('em');
        const participant = siteTypographyParticipant(root);
        const candidate = await participant.materialize(request(runtime, 1));
        candidates.push(candidate);
        candidate.activate();
        expect(surfaceTokens(root, 'bounded-hero')).toEqual(expectedTokens('slogan', width));
        expect(surfaceTokens(root, 'bounded-tagline')).toEqual(expectedTokens('tagline', width));
        expect(surfaceTokens(root, 'bounded-body')).toEqual(
          [
            'font-normal',
            'font-sans',
            'leading-relaxed',
            'no-underline',
            'not-italic',
            'text-base',
            'text-foreground',
            'tracking-normal',
          ].sort()
        );
        expect(root.querySelector('#bounded-hero')).toBe(heading);
        expect(heading.querySelector('[data-site-typography-slot]')!.firstChild).toBe(headingText);
        expect(root.querySelector('em')).toBe(emphasis);
        expect(root.querySelectorAll('h1')).toHaveLength(1);
        expect(root.querySelectorAll('p')).toHaveLength(2);
        expect(root.querySelectorAll('[role],[tabindex]')).toHaveLength(0);
        expect(participant.needsRefresh()).toBe(false);
      });
    }
    it(`${runtime}: refresh follows committed small/medium/wide snapshots and restores original source`, async () => {
      const setWidth = controlledViewport(639);
      const root = heroFixture();
      const original = root.innerHTML;
      const source = root.querySelector('#bounded-hero')!.firstChild;
      const participant = siteTypographyParticipant(root);
      let previous: MaterializedProjectionCandidate | undefined;
      let generation = 0;
      for (const width of [639, 640, 1280, 1279, 639]) {
        setWidth(width);
        expect(participant.needsRefresh()).toBe(true);
        const oldSurface = root.querySelector('#bounded-hero [data-typography-prototype]');
        const candidate = await participant.materialize(request(runtime, ++generation));
        candidates.push(candidate);
        // Preparation itself never publishes a viewport recipe.
        expect(root.querySelector('#bounded-hero [data-typography-prototype]')).toBe(oldSurface);
        expect(participant.needsRefresh()).toBe(true);
        candidate.activate();
        expect(participant.needsRefresh()).toBe(false);
        expect(surfaceTokens(root, 'bounded-hero')).toEqual(expectedTokens('slogan', width));
        expect(surfaceTokens(root, 'bounded-tagline')).toEqual(expectedTokens('tagline', width));
        expect(root.querySelector('#bounded-hero [data-site-typography-slot]')!.firstChild).toBe(
          source
        );
        if (previous) await previous.dispose();
        previous = candidate;
      }
      await previous!.dispose();
      participant.destroy();
      expect(root.innerHTML).toBe(original);
      expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
    });
  }
  it('commits the Hero bucket for empty scopes rather than refreshing forever', async () => {
    const setWidth = controlledViewport(639);
    document.body.innerHTML = '<main></main>';
    const participant = siteTypographyParticipant(document.querySelector<HTMLElement>('main')!);
    for (const width of [639, 640, 1280, 1279, 639]) {
      setWidth(width);
      const candidate = await participant.materialize(request('wc', width));
      candidates.push(candidate);
      candidate.activate();
      expect(participant.needsRefresh()).toBe(false);
    }
    participant.destroy();
  });
});

describe('homepage typography media-query transaction integration', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: refreshes both Hero boundaries and removes every listener on destruction`, async () => {
      let width = 639;
      const records = new Map<
        string,
        { query: MediaQueryList; callbacks: Set<EventListenerOrEventListenerObject> }
      >();
      const matches = (query: string) =>
        query === '(max-width: 47.999rem)'
          ? width < 768
          : query === '(min-width: 40rem)'
            ? width >= 640
            : query === '(min-width: 80rem)'
              ? width >= 1280
              : false;
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (!records.has(query)) {
          const callbacks = new Set<EventListenerOrEventListenerObject>();
          const media = {
            media: query,
            get matches() {
              return matches(query);
            },
            onchange: null,
            addEventListener: (_name: string, callback: EventListenerOrEventListenerObject) =>
              callbacks.add(callback),
            removeEventListener: (_name: string, callback: EventListenerOrEventListenerObject) =>
              callbacks.delete(callback),
            addListener() {},
            removeListener() {},
            dispatchEvent: () => true,
          } as MediaQueryList;
          records.set(query, { query: media, callbacks });
        }
        return records.get(query)!.query;
      });
      const changeWidth = (next: number) => {
        const before = new Map([...records].map(([query]) => [query, matches(query)]));
        width = next;
        for (const [query, { callbacks }] of records)
          if (before.get(query) !== matches(query)) {
            const event = new Event('change');
            for (const callback of [...callbacks])
              typeof callback === 'function' ? callback(event) : callback.handleEvent(event);
          }
      };
      document.body.innerHTML =
        '<header data-homepage-runtime><output data-homepage-runtime-status></output><div data-homepage-actions data-homepage-controls="runtime"><div data-homepage-fallback><a href="/docs/">Docs</a></div><div data-homepage-mount></div></div></header><main><h1 data-site-typography="slogan">Own unchanged heading</h1><p data-site-typography="tagline">Own unchanged description</p><input aria-label="Preserved editor" value="keep this value"></main>';
      const header = document.querySelector<HTMLElement>('header')!;
      const heading = document.querySelector<HTMLElement>('h1')!;
      const originalSource = heading.firstChild;
      const editor = document.querySelector<HTMLInputElement>('input')!;
      const handle = initHomepageRuntime(header)!;
      handles.push(handle);
      await vi.waitFor(() => expect(handle.getSnapshot().phase).toBe('ready'));
      if (runtime !== 'wc') {
        document.dispatchEvent(
          new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
        );
        await vi.waitFor(() => expect(heading.dataset.typographyRuntime).toBe(runtime));
      }
      editor.focus();
      for (const next of [639, 640, 1279, 1280, 1440, 1279, 640, 639]) {
        changeWidth(next);
        await vi.waitFor(() => {
          const headingTokens = heading
            .querySelector('[data-typography-prototype]')!
            .getAttribute('data-pui-style')!;
          const taglineTokens = document
            .querySelector('p [data-typography-prototype]')!
            .getAttribute('data-pui-style')!;
          expect(headingTokens.split(/\s+/)).toContain(next >= 1280 ? 'text-5xl' : 'text-3xl');
          expect(taglineTokens.split(/\s+/)).toContain(next >= 640 ? 'text-lg' : 'text-base');
        });
        expect(heading.querySelector('[data-site-typography-slot]')!.firstChild).toBe(
          originalSource
        );
        expect(document.querySelector('input')).toBe(editor);
        expect(editor.value).toBe('keep this value');
        expect(document.activeElement).toBe(editor);
      }
      for (const query of ['(max-width: 47.999rem)', '(min-width: 40rem)', '(min-width: 80rem)'])
        expect(
          [...records.get(query)!.callbacks].filter(
            (callback) => typeof callback === 'function' && callback.name === 'onTypographyChange'
          )
        ).toHaveLength(1);
      await handle.destroy();
      for (const query of ['(max-width: 47.999rem)', '(min-width: 40rem)', '(min-width: 80rem)'])
        expect(records.get(query)!.callbacks.size).toBe(0);
      changeWidth(1440);
      await settle();
      expect(document.querySelectorAll('[data-typography-prototype]')).toHaveLength(0);
      expect(heading.firstChild).toBe(originalSource);
      expect(editor.value).toBe('keep this value');
    });
  }
});

for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
  it(`${runtime}: keeps compact Overview source owners and authored roles through family replacement`, async () => {
    document.body.innerHTML = `<main data-site-family-scope data-pagefind-body><div data-doc-flow><article><header><span id="eyebrow">Basic demo</span><h2 id="card-title" data-site-typography="overview-card-title">Button</h2></header><p id="card-description" data-site-typography="overview-card-description">Original <em>description</em></p></article><h2 id="ordinary">Ordinary heading</h2></div></main>`;
    const root = document.querySelector<HTMLElement>('main')!;
    const title = root.querySelector<HTMLElement>('#card-title')!;
    const description = root.querySelector<HTMLElement>('#card-description')!;
    const titleSource = title.firstChild;
    const descriptionSource = description.firstChild;
    expect(
      collectSiteTypographyTargets(root, true).find((target) => target.native === title)?.role
    ).toBe('overview-card-title');
    const participant = siteTypographyParticipant(root, { docsOnly: true });
    for (const [index, family] of ['shadcn', 'brutalist', 'shadcn'].entries()) {
      const candidate = await participant.materialize(
        request(runtime, index + 1, family as 'shadcn' | 'brutalist')
      );
      candidates.push(candidate);
      candidate.activate();
      await settle();
      for (const [native, size, line, original] of [
        [title, '1rem', '1.25rem', titleSource],
        [description, '0.76rem', '1.14rem', descriptionSource],
      ] as const) {
        const leaf = native.querySelector<HTMLElement>('[data-typography-prototype]')!;
        expect(leaf.style.fontSize).toBe(size);
        expect(leaf.style.lineHeight).toBe(line);
        expect(leaf.style.fontFamily).toBe('inherit');
        expect(leaf.style.letterSpacing).toBe('inherit');
        expect(native.querySelector('[data-site-typography-slot]')!.firstChild).toBe(original);
        expect(native.hasAttribute('role')).toBe(false);
      }
      expect(root.querySelector('#eyebrow [data-typography-prototype]')).toBeNull();
      expect(
        root.querySelector('#ordinary [data-typography-prototype]')!.getAttribute('data-pui-style')
      ).toContain('text-2xl');
    }
  });
}
