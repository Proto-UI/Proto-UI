import { afterEach, expect, it, vi } from 'vitest';
import { createPassiveShellComposition } from './passive-shell-composition';
import { loadPrototypes } from './prototype-modules';
import { renderDemo } from './demo-renderer';
import { panelSurfaceProps, surfacePrototypeId } from '../surface-recipes';
import type { ProjectionFamilyId } from './projection-families';
import type { ProjectionThemeSurfaceStyle } from './projection-theme';
import type { RuntimeId } from './runtimes/registry';

// Keep the real public Prototype loader and adapters. Only control load timing
// and failures, and replace CDN framework loading with installed dependencies.
vi.mock('./demo-renderer', async (original) => {
  const current = await original<typeof import('./demo-renderer')>();
  return { ...current, renderDemo: vi.fn(current.renderDemo) };
});
vi.mock('./prototype-modules', async (original) => {
  const current = await original<typeof import('./prototype-modules')>();
  return { ...current, loadPrototypes: vi.fn(current.loadPrototypes) };
});
vi.mock('./runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('./runtimes/vue2-runtime', async (original) => {
  const current = await original<typeof import('./runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...current, loadVue2: async () => require('vue') };
});

const INITIAL: ProjectionThemeSurfaceStyle = {
  '--pui-background': '#123456',
  '--pui-retained-only': 'retained',
};
const NEXT: ProjectionThemeSurfaceStyle = {
  '--pui-background': '#abcdef',
  '--pui-candidate-only': 'candidate',
};
const LATEST: ProjectionThemeSurfaceStyle = { '--pui-background': '#654321' };
const compositions: Array<ReturnType<typeof createPassiveShellComposition>> = [];
const pendingLoads: Array<ReturnType<typeof defer>> = [];

function defer() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

function delayNextLoad() {
  const gate = defer();
  pendingLoads.push(gate);
  vi.mocked(loadPrototypes).mockImplementationOnce(async (ids) => {
    await gate.promise;
    const original =
      await vi.importActual<typeof import('./prototype-modules')>('./prototype-modules');
    await original.loadPrototypes(ids);
  });
  return gate;
}

function startShell(runtime: RuntimeId = 'wc', style?: string) {
  const home = document.createElement('div');
  const mount = document.createElement('div');
  const content = document.createElement('div');
  const input = document.createElement('input');
  input.value = 'Original uncontrolled content';
  content.append(input);
  if (style !== undefined) content.setAttribute('style', style);
  const before = document.createTextNode('before');
  const after = document.createTextNode('after');
  home.append(before, content, after);
  document.body.append(mount, home);
  const shell = createPassiveShellComposition({
    runtime,
    mount,
    content,
    family: 'shadcn',
    theme: INITIAL,
    prototypeId: (family) => surfacePrototypeId(family as ProjectionFamilyId),
    props: () => ({ ...panelSurfaceProps('canvas') }),
    layout: { display: 'block', width: '100%' },
    className: 'transaction-shell',
  });
  compositions.push(shell);
  const surface = () => content.closest<HTMLElement>('.transaction-shell')!;
  return { shell, mount, home, content, input, surface, before, after };
}

async function mountShell(runtime: RuntimeId = 'wc', style?: string) {
  const fixture = startShell(runtime, style);
  const { shell, surface, input } = fixture;
  await shell.ready;
  expect(surface().dataset.projectionPrototype).toBe('shadcn-surface-root');
  expect(surface().hasAttribute('data-pui-root')).toBe(true);
  expect(surface().shadowRoot).toBeNull();
  expect(surface().querySelector('input')).toBe(input);
  return fixture;
}

function expectTheme(surface: HTMLElement, theme: ProjectionThemeSurfaceStyle) {
  for (const property of new Set([...Object.keys(INITIAL), ...Object.keys(NEXT)])) {
    expect(
      surface.style.getPropertyValue(property),
      `${surface.dataset.projectionFamily}/${property}`
    ).toBe(theme[property as keyof ProjectionThemeSurfaceStyle] ?? '');
  }
}

afterEach(async () => {
  for (const gate of pendingLoads.splice(0)) gate.resolve();
  await Promise.all(compositions.splice(0).map((shell) => shell.destroy()));
  vi.mocked(loadPrototypes).mockClear();
  vi.mocked(renderDemo).mockClear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

// D-HOST-PROTOTYPE-PROJECTION-SCOPE-0001 (draft): ATOMIC-GENERATION,
// NO-HYBRID-PRESENTATION and FAIL-CLOSED govern these host-local observations.
for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
  it(`${runtime}: pending and failed family replacement retain the committed family and theme`, async () => {
    const { shell, content, input, surface } = await mountShell(runtime);
    const original = surface();
    const gate = delayNextLoad();
    const replacement = shell.update('brutalist', NEXT);
    const outcome = replacement.then(
      () => null,
      (error: unknown) => error
    );
    expect(surface()).toBe(original);
    expectTheme(original, INITIAL);
    gate.reject(new Error('Injected candidate load failure'));
    expect(await outcome).toEqual(new Error('Injected candidate load failure'));
    expect(surface()).toBe(original);
    expect(original.dataset.projectionFamily).toBe('shadcn');
    expectTheme(original, INITIAL);
    expect(content.querySelector('input')).toBe(input);
    expect(input.value).toBe('Original uncontrolled content');

    // A failed request must not poison the theme captured by a later retry.
    await shell.update('brutalist', NEXT);
    expect(surface().dataset.projectionPrototype).toBe('brutalist-surface-root');
    expectTheme(surface(), NEXT);
    expect(surface().querySelector('input')).toBe(input);
    expect(surface().shadowRoot).toBeNull();
  });

  it(`${runtime}: same-family themes update synchronously without remounting or moving content`, async () => {
    const { shell, input, surface } = await mountShell(runtime);
    const original = surface();
    input.focus();
    const loads = vi.mocked(loadPrototypes).mock.calls.length;
    const update = shell.update('shadcn', LATEST);
    expectTheme(original, LATEST);
    expect(surface()).toBe(original);
    expect(document.activeElement).toBe(input);
    await update;
    expect(vi.mocked(loadPrototypes).mock.calls).toHaveLength(loads);
    expect(surface().querySelector('input')).toBe(input);
  });
}

it('a stale successful family load cannot recolor the retained fallback after the latest request fails', async () => {
  const { shell, surface } = await mountShell();
  const original = surface();
  const stale = delayNextLoad();
  const first = shell.update('brutalist', NEXT);
  const latest = delayNextLoad();
  const second = shell.update('bootstrap-2-3-2', LATEST);
  const outcome = second.then(
    () => null,
    (error: unknown) => error
  );
  latest.reject(new Error('Injected latest load failure'));
  expect(await outcome).toEqual(new Error('Injected latest load failure'));
  expect(surface()).toBe(original);
  expectTheme(original, INITIAL);
  stale.resolve();
  await first;
  expect(surface()).toBe(original);
  expectTheme(original, INITIAL);
});

it('the latest same-target request owns its theme even when an older load finishes last', async () => {
  const { shell, mount, surface } = await mountShell();
  const firstLoad = delayNextLoad();
  const first = shell.update('brutalist', NEXT);
  const secondLoad = delayNextLoad();
  const second = shell.update('brutalist', LATEST);
  expectTheme(surface(), INITIAL);
  secondLoad.resolve();
  await second;
  const committed = surface();
  expect(committed.dataset.projectionFamily).toBe('brutalist');
  expectTheme(committed, LATEST);
  firstLoad.resolve();
  await first;
  expect(surface()).toBe(committed);
  expectTheme(committed, LATEST);
  expect(mount.querySelectorAll('.transaction-shell')).toHaveLength(1);
});

it('returning to the committed family updates only its theme while superseding another pending family', async () => {
  const { shell, surface } = await mountShell();
  const original = surface();
  const gate = delayNextLoad();
  const pending = shell.update('brutalist', NEXT);
  const returned = shell.update('shadcn', LATEST);
  expectTheme(original, LATEST);
  await returned;
  gate.resolve();
  await pending;
  expect(surface().dataset.projectionFamily).toBe('shadcn');
  expectTheme(surface(), LATEST);
});

it('destroy returns the original LightDOM content immediately and revokes pending theme publication', async () => {
  const { shell, mount, home, content, input, surface } = await mountShell();
  const original = surface();
  const gate = delayNextLoad();
  const pending = shell.update('brutalist', NEXT);
  const destroyed = shell.destroy();
  expect(content.parentNode).toBe(home);
  expect(content.querySelector('input')).toBe(input);
  expectTheme(original, INITIAL);
  await shell.update('bootstrap-2-3-2', LATEST);
  gate.resolve();
  await Promise.all([pending, destroyed]);
  expect(content.parentNode).toBe(home);
  expect(mount.childNodes).toHaveLength(0);
  expectTheme(original, INITIAL);
});

function interceptNextSetup(afterSetup: (slot: HTMLElement) => void) {
  vi.mocked(renderDemo).mockImplementationOnce(async (options) => {
    const original = await vi.importActual<typeof import('./demo-renderer')>('./demo-renderer');
    const setup = options.demo.setup;
    return original.renderDemo({
      ...options,
      demo: {
        ...options.demo,
        setup(context) {
          const cleanup = setup?.(context);
          afterSetup(context.refs.slot!);
          return cleanup;
        },
      },
    });
  });
}

function rejectNextPublication(content: HTMLElement, afterMove: () => void = () => {}) {
  interceptNextSetup((slot) => {
    const insertBefore = slot.insertBefore;
    vi.spyOn(slot, 'insertBefore').mockImplementationOnce((node, before) => {
      insertBefore.call(slot, node, before);
      expect(node).toBe(content);
      afterMove();
      throw new Error('Injected publication failure after content move');
    });
  });
}

function expectReturned(fixture: ReturnType<typeof startShell>) {
  const { home, content, input, before, after } = fixture;
  expect(content.parentNode).toBe(home);
  expect(home.childNodes).toHaveLength(3);
  for (const [index, node] of [before, content, after].entries())
    expect(home.childNodes[index]).toBe(node);
  expect(content.firstChild).toBe(input);
  expect(input.value).toBe('Original uncontrolled content');
}

// These are inline-CSS ownership and real renderer/Adapter observations in
// Happy DOM, not native-browser cascade, layout or paint evidence.
for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
  for (const [style, value, priority] of [
    [undefined, '', ''],
    ['', '', ''],
    ['display: grid;', 'grid', ''],
    ['display: inline-flex !important; color: red;', 'inline-flex', 'important'],
  ] as const) {
    it(`${runtime}: destroy restores borrowed display and sibling identity (${style ?? 'no style attribute'})`, async () => {
      const fixture = await mountShell(runtime, style);
      expect(fixture.content.style.display).toBe('contents');
      expect(fixture.content.style.getPropertyPriority('display')).toBe('');
      const destroyed = fixture.shell.destroy();
      expectReturned(fixture);
      expect(fixture.content.style.getPropertyValue('display')).toBe(value);
      expect(fixture.content.style.getPropertyPriority('display')).toBe(priority);
      expect(fixture.content.hasAttribute('style')).toBe(style !== undefined);
      expect(fixture.content.style.color).toBe(style?.includes('color') ? 'red' : '');
      await destroyed;
      await fixture.shell.destroy();
      expectReturned(fixture);
    });
  }

  it(`${runtime}: first materialization failure after real setup leaves author display untouched`, async () => {
    interceptNextSetup(() => {
      throw new Error('Injected setup failure');
    });
    const fixture = startShell(runtime, 'display: grid !important');
    await expect(fixture.shell.ready).rejects.toThrow('Injected setup failure');
    expectReturned(fixture);
    expect(fixture.content.style.display).toBe('grid');
    expect(fixture.content.style.getPropertyPriority('display')).toBe('important');
    expect(fixture.mount.childNodes).toHaveLength(0);
  });

  it(`${runtime}: first publication rollback restores the original display before cleanup`, async () => {
    const gate = delayNextLoad();
    const fixture = startShell(runtime, 'display: grid !important');
    rejectNextPublication(fixture.content);
    gate.resolve();
    await expect(fixture.shell.ready).rejects.toThrow('Injected publication failure');
    expectReturned(fixture);
    expect(fixture.content.style.display).toBe('grid');
    expect(fixture.content.style.getPropertyPriority('display')).toBe('important');
    expect(fixture.mount.childNodes).toHaveLength(0);
  });

  it(`${runtime}: failed replacement retains the old display lease through the next successful owner`, async () => {
    const fixture = await mountShell(runtime, 'display: grid !important');
    const { shell, content, surface } = fixture;
    const original = surface();
    rejectNextPublication(content);
    await expect(shell.update('brutalist', NEXT)).rejects.toThrow('Injected publication failure');
    expect(surface()).toBe(original);
    expect(content.style.display).toBe('contents');
    await shell.update('brutalist', NEXT);
    expect(surface()).not.toBe(original);
    expect(content.style.display).toBe('contents');
    await shell.destroy();
    expectReturned(fixture);
    expect(content.style.display).toBe('grid');
    expect(content.style.getPropertyPriority('display')).toBe('important');
  });
}

it('captures author display at publication after a delayed first load', async () => {
  const gate = delayNextLoad();
  const fixture = startShell();
  fixture.content.style.setProperty('display', 'inline-grid', 'important');
  gate.resolve();
  await fixture.shell.ready;
  expect(fixture.content.style.display).toBe('contents');
  await fixture.shell.destroy();
  expectReturned(fixture);
  expect(fixture.content.style.display).toBe('inline-grid');
  expect(fixture.content.style.getPropertyPriority('display')).toBe('important');
});

for (const [value, priority] of [
  ['flex', ''],
  ['contents', 'important'],
  ['', ''],
] as const) {
  it(`leaves external display edits in place on destroy (${value}/${priority})`, async () => {
    const fixture = await mountShell('wc', 'display: grid !important');
    fixture.content.style.setProperty('display', value, priority);
    await fixture.shell.destroy();
    expectReturned(fixture);
    expect(fixture.content.style.getPropertyValue('display')).toBe(value);
    expect(fixture.content.style.getPropertyPriority('display')).toBe(priority);
  });
}

it('restores only display while retaining unrelated external inline styles', async () => {
  const fixture = await mountShell();
  fixture.content.style.color = 'blue';
  await fixture.shell.destroy();
  expectReturned(fixture);
  expect(fixture.content.style.display).toBe('');
  expect(fixture.content.style.color).toBe('blue');
});

it('a failed replacement setup cannot overwrite externally updated display', async () => {
  const fixture = await mountShell('wc', 'display: grid !important');
  fixture.content.style.setProperty('display', 'flex', 'important');
  interceptNextSetup(() => {
    throw new Error('Injected replacement setup failure');
  });
  await expect(fixture.shell.update('brutalist', NEXT)).rejects.toThrow(
    'Injected replacement setup failure'
  );
  expect(fixture.surface().dataset.projectionFamily).toBe('shadcn');
  expect(fixture.content.style.display).toBe('flex');
  expect(fixture.content.style.getPropertyPriority('display')).toBe('important');
  await fixture.shell.destroy();
  expect(fixture.content.style.display).toBe('flex');
});

it('a rollback preserves external display changes made during publication', async () => {
  const fixture = await mountShell('wc', 'display: grid !important');
  rejectNextPublication(fixture.content, () => {
    fixture.content.style.setProperty('display', 'inline-block', 'important');
  });
  await expect(fixture.shell.update('brutalist', NEXT)).rejects.toThrow(
    'Injected publication failure'
  );
  expect(fixture.content.style.display).toBe('inline-block');
  await fixture.shell.destroy();
  expectReturned(fixture);
  expect(fixture.content.style.display).toBe('inline-block');
  expect(fixture.content.style.getPropertyPriority('display')).toBe('important');
});

it('a replacement reborrows the latest external display rather than restoring an obsolete snapshot', async () => {
  const fixture = await mountShell('wc', 'display: grid !important');
  fixture.content.style.setProperty('display', 'flex', 'important');
  await fixture.shell.update('brutalist', NEXT);
  expect(fixture.content.style.display).toBe('contents');
  await fixture.shell.destroy();
  expect(fixture.content.style.display).toBe('flex');
  expect(fixture.content.style.getPropertyPriority('display')).toBe('important');
});

it('late stale setup and disposal cannot reset the current owner display', async () => {
  const fixture = await mountShell('wc', 'display: grid !important');
  const stale = delayNextLoad();
  const first = fixture.shell.update('brutalist', NEXT);
  await fixture.shell.update('bootstrap-2-3-2', LATEST);
  const current = fixture.surface();
  fixture.content.style.setProperty('display', 'flex', 'important');
  stale.resolve();
  await first;
  expect(fixture.surface()).toBe(current);
  expect(fixture.content.style.display).toBe('flex');
  expect(fixture.content.style.getPropertyPriority('display')).toBe('important');
  await fixture.shell.destroy();
  expect(fixture.content.style.display).toBe('flex');
});

it('destroy restores display synchronously while late candidate cleanup and repeated destroy are harmless', async () => {
  const fixture = await mountShell('wc', 'display: grid !important');
  const gate = delayNextLoad();
  const pending = fixture.shell.update('brutalist', NEXT);
  const destroyed = fixture.shell.destroy();
  expectReturned(fixture);
  expect(fixture.content.style.display).toBe('grid');
  expect(fixture.content.style.getPropertyPriority('display')).toBe('important');
  fixture.content.style.setProperty('display', 'inline-flex', 'important');
  await fixture.shell.destroy();
  gate.resolve();
  await Promise.all([pending, destroyed]);
  expectReturned(fixture);
  expect(fixture.content.style.display).toBe('inline-flex');
  expect(fixture.content.style.getPropertyPriority('display')).toBe('important');
  expect(fixture.mount.childNodes).toHaveLength(0);
});

it('first publication failure before moving content releases the absent display declaration', async () => {
  interceptNextSetup((slot) => {
    vi.spyOn(slot, 'insertBefore').mockImplementationOnce(() => {
      throw new Error('Injected publication failure before content move');
    });
  });
  const fixture = startShell();
  await expect(fixture.shell.ready).rejects.toThrow('Injected publication failure');
  expectReturned(fixture);
  expect(fixture.content.hasAttribute('style')).toBe(false);
  expect(fixture.mount.childNodes).toHaveLength(0);
});

it('a render completing after destroy leaves the returned subtree and newer author style alone', async () => {
  const rendered = defer(),
    gate = defer();
  pendingLoads.push(gate);
  vi.mocked(renderDemo).mockImplementationOnce(async (options) => {
    const original = await vi.importActual<typeof import('./demo-renderer')>('./demo-renderer');
    const result = await original.renderDemo(options);
    rendered.resolve();
    await gate.promise;
    return result;
  });
  const fixture = startShell('wc', 'display: grid !important');
  await rendered.promise;
  // The real setup ran, but this candidate has not published or borrowed styles.
  expectReturned(fixture);
  expect(fixture.content.style.display).toBe('grid');
  const destroyed = fixture.shell.destroy();
  fixture.content.style.setProperty('display', 'inline-flex', 'important');
  gate.resolve();
  await Promise.all([fixture.shell.ready, destroyed]);
  expectReturned(fixture);
  expect(fixture.content.style.display).toBe('inline-flex');
  expect(fixture.content.style.getPropertyPriority('display')).toBe('important');
  expect(fixture.mount.childNodes).toHaveLength(0);
});

it('late old-shell renderer disposal cannot release the new owner display lease', async () => {
  const disposing = defer(),
    gate = defer();
  pendingLoads.push(gate);
  vi.mocked(renderDemo).mockImplementationOnce(async (options) => {
    const original = await vi.importActual<typeof import('./demo-renderer')>('./demo-renderer');
    const result = await original.renderDemo(options);
    return {
      ...result,
      async destroy() {
        disposing.resolve();
        await gate.promise;
        await result.destroy();
      },
    };
  });
  const fixture = await mountShell('wc', 'display: grid !important');
  const replacement = fixture.shell.update('brutalist', NEXT);
  await disposing.promise;
  expect(fixture.surface().dataset.projectionFamily).toBe('brutalist');
  expect(fixture.content.style.display).toBe('contents');
  gate.resolve();
  await replacement;
  expect(fixture.content.style.display).toBe('contents');
  await fixture.shell.destroy();
  expectReturned(fixture);
  expect(fixture.content.style.display).toBe('grid');
  expect(fixture.content.style.getPropertyPriority('display')).toBe('important');
});
