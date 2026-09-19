import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DemoSpec } from './demo-types';

const fakes = vi.hoisted(() => ({
  applyTheme: vi.fn(),
  collectPrototypeIds: vi.fn(),
  createComposition: vi.fn(),
  destroyRender: vi.fn(),
  loadDemo: vi.fn(),
  loadPrototypes: vi.fn(),
  prepareRuntime: vi.fn(),
  releaseHostMount: vi.fn(),
  renderDemo: vi.fn(),
  resolveTheme: vi.fn(),
}));

vi.mock('./demo-modules', () => ({ loadDemo: fakes.loadDemo }));
vi.mock('./demo-renderer', () => ({
  prepareDemoRuntime: fakes.prepareRuntime,
  renderDemo: fakes.renderDemo,
}));
vi.mock('./demo-types', () => ({ collectPrototypeIds: fakes.collectPrototypeIds }));
vi.mock('./projection-composition', () => ({
  PROJECTION_FOCUS_KEYS: {
    runtime: 'runtime-select',
    family: 'family-select',
    component: 'component-select',
  },
  createProjectionComposition: fakes.createComposition,
}));
vi.mock('./projection-theme', () => ({
  applyProjectionThemeSurfaceStyle: fakes.applyTheme,
  resolveProjectionThemeSurfaceStyle: fakes.resolveTheme,
}));
vi.mock('./prototype-modules', () => ({ loadPrototypes: fakes.loadPrototypes }));
vi.mock('./runtimes/host-mount', () => ({ releaseHostMount: fakes.releaseHostMount }));

import {
  materializeProjectionCandidate,
  restoreProjectionControlFocus,
} from './projection-materializer';

const childDemo = {
  type: 'demo',
  root: { kind: 'proto', prototypeId: 'shadcn-button', children: ['Button'] },
} satisfies DemoSpec;

function controls() {
  return {
    runtime: {
      label: 'Runtime',
      options: [{ value: 'wc', label: 'Web Components' }],
      onValueChange() {},
    },
    family: {
      label: 'Component Library',
      options: [{ value: 'shadcn', label: 'Shadcn' }],
      onValueChange() {},
    },
    component: {
      label: 'Component',
      options: [{ value: 'button', label: 'Button' }],
      onValueChange() {},
    },
  } as const;
}

function computedInitial(element: Element, property: 'opacity' | 'visibility'): string {
  const value = getComputedStyle(element).getPropertyValue(property);
  if (value) return value;
  // jsdom omits these CSS initial values; real-browser coverage below reads
  // the same properties without this fallback.
  return property === 'opacity' ? '1' : 'visible';
}

describe('Website projection materializer', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    fakes.applyTheme.mockReset();
    fakes.collectPrototypeIds.mockReset();
    fakes.createComposition.mockReset();
    fakes.destroyRender.mockReset();
    fakes.loadDemo.mockReset().mockResolvedValue(childDemo);
    fakes.loadPrototypes.mockReset().mockResolvedValue(undefined);
    fakes.prepareRuntime.mockReset().mockResolvedValue(undefined);
    fakes.releaseHostMount.mockReset();
    fakes.resolveTheme.mockReset().mockReturnValue({ '--pui-background': '#fff' });
  });

  it('seals staging portals and atomically swaps exact owner generations on activation', async () => {
    const setLocked = vi.fn();
    const setEventGateOpen = vi.fn();
    const setThemeSurfaceStyle = vi.fn();
    const candidatePortal = document.createElement('section');
    candidatePortal.dataset.projectionOwner = 'materializer-owner';
    candidatePortal.dataset.projectionGeneration = '2';
    const candidateItem = document.createElement('div');
    candidateItem.dataset.projectionOwner = 'materializer-owner';
    candidateItem.dataset.projectionGeneration = '2';
    candidatePortal.appendChild(candidateItem);
    const authoredPortal = document.createElement('section');
    authoredPortal.dataset.projectionOwner = 'materializer-owner';
    authoredPortal.dataset.projectionGeneration = '2';
    authoredPortal.inert = true;
    authoredPortal.setAttribute('aria-hidden', 'false');
    authoredPortal.style.setProperty('visibility', 'collapse');
    authoredPortal.style.setProperty('pointer-events', 'auto', 'important');
    const insideSurface = document.createElement('div');
    insideSurface.dataset.projectionOwner = 'materializer-owner';
    insideSurface.dataset.projectionGeneration = '2';
    fakes.createComposition.mockReturnValue({
      demo: childDemo,
      setLocked,
      setEventGateOpen,
      setThemeSurfaceStyle,
    });
    fakes.renderDemo.mockImplementation(async ({ host }: { host: HTMLElement }) => {
      const scope = document.createElement('section');
      scope.dataset.projectionScope = 'materializer-owner';
      scope.appendChild(insideSurface);
      host.appendChild(scope);
      document.body.append(candidatePortal, authoredPortal);
      return { destroy: fakes.destroyRender };
    });

    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    const mount = document.createElement('div');
    mount.dataset.projectionOwner = 'materializer-owner';
    document.body.appendChild(mount);
    const oldPortal = document.createElement('section');
    oldPortal.dataset.projectionOwner = 'materializer-owner';
    oldPortal.dataset.projectionGeneration = '1';
    document.body.appendChild(oldPortal);
    const futurePortal = document.createElement('section');
    futurePortal.dataset.projectionOwner = 'materializer-owner';
    futurePortal.dataset.projectionGeneration = '3';
    document.body.appendChild(futurePortal);
    const otherOwnerPortal = document.createElement('section');
    otherOwnerPortal.dataset.projectionOwner = 'another-owner';
    otherOwnerPortal.dataset.projectionGeneration = '2';
    document.body.appendChild(otherOwnerPortal);
    let settled = false;
    const pendingCandidate = materializeProjectionCandidate(
      {
        selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
        generation: 2,
      },
      {
        mount,
        ownerId: 'materializer-owner',
        componentId: 'button',
        controls: controls(),
      }
    ).then((candidate) => {
      settled = true;
      return candidate;
    });

    await vi.waitFor(() => expect(setLocked).toHaveBeenCalledWith(false));
    expect(fakes.createComposition).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true, eventGateOpen: false })
    );
    const stagingHost = mount.querySelector<HTMLElement>('[data-projection-generation-host]');
    const stagingScope = stagingHost?.querySelector<HTMLElement>('[data-projection-scope]');
    expect(stagingHost?.isConnected).toBe(true);
    expect(stagingHost?.dataset.projectionGenerationState).toBe('staging');
    expect(stagingHost?.inert).toBe(true);
    expect(stagingHost?.getAttribute('aria-hidden')).toBe('true');
    expect(stagingHost?.style.getPropertyValue('opacity')).toBe('0');
    expect(stagingHost?.style.getPropertyPriority('opacity')).toBe('important');
    expect(stagingHost && computedInitial(stagingHost, 'opacity')).toBe('0');
    expect(stagingHost?.style.getPropertyValue('visibility')).toBe('');
    expect(stagingHost?.style.getPropertyValue('transition')).toBe('none');
    expect(stagingHost?.style.getPropertyPriority('transition')).toBe('important');
    expect(stagingHost?.style.getPropertyValue('animation')).toBe('none');
    expect(stagingHost?.style.getPropertyPriority('animation')).toBe('important');
    expect(stagingScope && computedInitial(stagingScope, 'visibility')).toBe('visible');
    expect(settled).toBe(false);
    expect(frames).toHaveLength(1);
    expect(setEventGateOpen).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(candidatePortal.inert).toBe(true);
      expect(candidatePortal.getAttribute('aria-hidden')).toBe('true');
      expect(candidatePortal.style.getPropertyValue('visibility')).toBe('hidden');
      expect(candidatePortal.style.getPropertyPriority('visibility')).toBe('important');
      expect(candidatePortal.style.getPropertyValue('pointer-events')).toBe('none');
      expect(authoredPortal.getAttribute('aria-hidden')).toBe('true');
      expect(insideSurface.inert).toBe(false);
      expect(otherOwnerPortal.inert).toBe(false);
    });

    frames.shift()!(0);
    const candidate = await pendingCandidate;
    setLocked.mockClear();
    candidate.activate();

    expect(setLocked).not.toHaveBeenCalled();
    expect(setEventGateOpen).toHaveBeenCalledTimes(1);
    expect(setEventGateOpen).toHaveBeenLastCalledWith(true);
    expect(candidate.host.dataset.projectionGenerationState).toBe('active');
    expect(candidate.host.inert).toBe(false);
    expect(candidate.host.hasAttribute('aria-hidden')).toBe(false);
    expect(candidate.host.style.getPropertyValue('opacity')).toBe('');
    expect(computedInitial(candidate.host, 'opacity')).toBe('1');
    expect(candidate.host.style.getPropertyValue('transition')).toBe('none');
    expect(candidate.host.style.getPropertyPriority('transition')).toBe('important');
    expect(candidate.host.style.getPropertyValue('animation')).toBe('none');
    expect(candidate.host.style.getPropertyPriority('animation')).toBe('important');
    expect(computedInitial(candidate.scope, 'visibility')).toBe('visible');
    expect(candidatePortal.inert).toBe(false);
    expect(candidatePortal.hasAttribute('aria-hidden')).toBe(false);
    expect(candidatePortal.style.getPropertyValue('visibility')).toBe('');
    expect(candidatePortal.style.getPropertyValue('pointer-events')).toBe('');
    expect(authoredPortal.inert).toBe(true);
    expect(authoredPortal.getAttribute('aria-hidden')).toBe('false');
    expect(authoredPortal.style.getPropertyValue('visibility')).toBe('collapse');
    expect(authoredPortal.style.getPropertyPriority('visibility')).toBe('');
    expect(authoredPortal.style.getPropertyValue('pointer-events')).toBe('auto');
    expect(authoredPortal.style.getPropertyPriority('pointer-events')).toBe('important');
    expect(oldPortal.inert).toBe(true);
    expect(oldPortal.getAttribute('aria-hidden')).toBe('true');
    expect(oldPortal.style.getPropertyValue('visibility')).toBe('hidden');
    expect(futurePortal.inert).toBe(true);
    expect(otherOwnerPortal.inert).toBe(false);
    expect(otherOwnerPortal.hasAttribute('aria-hidden')).toBe(false);

    expect(candidate.setLocked?.(true)).toBeUndefined();
    expect(setEventGateOpen).toHaveBeenLastCalledWith(false);
    expect(candidatePortal.inert).toBe(true);
    expect(candidatePortal.getAttribute('aria-hidden')).toBe('true');
    expect(candidatePortal.style.getPropertyValue('visibility')).toBe('hidden');
    expect(candidate.setLocked?.(false)).toBeUndefined();
    expect(setEventGateOpen).toHaveBeenLastCalledWith(true);
    expect(candidatePortal.inert).toBe(false);
    expect(candidatePortal.hasAttribute('aria-hidden')).toBe(false);
    expect(authoredPortal.inert).toBe(true);
    expect(authoredPortal.getAttribute('aria-hidden')).toBe('false');
    setLocked.mockClear();

    const nextTheme = { '--pui-background': '#090909' } as const;
    candidate.setThemeSurfaceStyle(nextTheme);
    expect(setThemeSurfaceStyle).toHaveBeenCalledWith(nextTheme);
    expect(fakes.applyTheme).toHaveBeenLastCalledWith(candidate.scope, nextTheme);

    await candidate.dispose();
    expect(setLocked).toHaveBeenCalledWith(true);
    expect(fakes.destroyRender).toHaveBeenCalledTimes(1);
    expect(candidate.host.isConnected).toBe(false);
    expect(candidatePortal.isConnected).toBe(false);
    expect(candidateItem.isConnected).toBe(false);
    expect(authoredPortal.isConnected).toBe(false);
    expect(oldPortal.isConnected).toBe(true);
    expect(futurePortal.isConnected).toBe(true);
    expect(otherOwnerPortal.isConnected).toBe(true);
  });

  it('shares one owner-filtered document portal observer across candidates', async () => {
    fakes.createComposition.mockImplementation(() => ({
      demo: childDemo,
      setLocked: vi.fn(),
      setEventGateOpen: vi.fn(),
      setThemeSurfaceStyle: vi.fn(),
      restoreFocus: vi.fn(),
    }));
    fakes.renderDemo.mockImplementation(async ({ host }: { host: HTMLElement }) => {
      const scope = document.createElement('section');
      scope.dataset.projectionScope = host.dataset.projectionOwnerHost;
      host.appendChild(scope);
      return { destroy: vi.fn() };
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queueMicrotask(() => callback(0));
      return 1;
    });
    const firstMount = document.createElement('div');
    const secondMount = document.createElement('div');
    document.body.append(firstMount, secondMount);

    const [first, second] = await Promise.all([
      materializeProjectionCandidate(
        {
          selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
          generation: 1,
        },
        {
          mount: firstMount,
          ownerId: 'observer-owner-a',
          componentId: 'button',
          controls: controls(),
        }
      ),
      materializeProjectionCandidate(
        {
          selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
          generation: 1,
        },
        {
          mount: secondMount,
          ownerId: 'observer-owner-b',
          componentId: 'button',
          controls: controls(),
        }
      ),
    ]);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const documentQuery = vi.spyOn(document, 'querySelectorAll');
    const portal = document.createElement('section');
    portal.dataset.projectionOwner = 'observer-owner-a';
    portal.dataset.projectionGeneration = '1';

    document.body.appendChild(portal);

    await vi.waitFor(() => expect(portal.inert).toBe(true));
    expect(documentQuery).toHaveBeenCalledTimes(1);

    await Promise.all([first.dispose(), second.dispose()]);
  });

  it('removes only the failed candidate external portal roots', async () => {
    fakes.createComposition.mockReturnValue({
      demo: childDemo,
      setLocked: vi.fn(),
      setEventGateOpen: vi.fn(),
      setThemeSurfaceStyle: vi.fn(),
    });
    const stalePortal = document.createElement('section');
    stalePortal.dataset.projectionOwner = 'failed-owner';
    stalePortal.dataset.projectionGeneration = '4';
    const staleItem = document.createElement('div');
    staleItem.dataset.projectionOwner = 'failed-owner';
    staleItem.dataset.projectionGeneration = '4';
    stalePortal.appendChild(staleItem);
    const currentPortal = document.createElement('section');
    currentPortal.dataset.projectionOwner = 'failed-owner';
    currentPortal.dataset.projectionGeneration = '5';
    const otherOwnerPortal = document.createElement('section');
    otherOwnerPortal.dataset.projectionOwner = 'another-owner';
    otherOwnerPortal.dataset.projectionGeneration = '4';
    fakes.renderDemo.mockImplementation(async () => {
      document.body.append(stalePortal, currentPortal, otherOwnerPortal);
      return { destroy: fakes.destroyRender };
    });

    const mount = document.createElement('div');
    mount.dataset.projectionOwner = 'failed-owner';
    document.body.appendChild(mount);
    await expect(
      materializeProjectionCandidate(
        {
          selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
          generation: 4,
        },
        {
          mount,
          ownerId: 'failed-owner',
          componentId: 'button',
          controls: controls(),
        }
      )
    ).rejects.toThrow(/scope root is missing/);

    expect(fakes.destroyRender).toHaveBeenCalledTimes(1);
    expect(stalePortal.isConnected).toBe(false);
    expect(staleItem.isConnected).toBe(false);
    expect(currentPortal.isConnected).toBe(true);
    expect(otherOwnerPortal.isConnected).toBe(true);
    expect(mount.querySelector('[data-projection-generation-host]')).toBeNull();
  });

  it('preserves preparation failure while exhaustively cleaning secondary teardown failures', async () => {
    const preparationFailure = new Error('projection theme preparation failed');
    const eventGateFailure = new Error('event gate failed to close');
    const runtimeFailure = new Error('Runtime destroy also failed');
    const setEventGateOpen = vi.fn((open: boolean) => {
      if (!open) throw eventGateFailure;
    });
    const setLocked = vi.fn();
    fakes.createComposition.mockReturnValue({
      demo: childDemo,
      setLocked,
      setEventGateOpen,
      setThemeSurfaceStyle: vi.fn(),
    });
    fakes.applyTheme.mockImplementationOnce(() => {
      throw preparationFailure;
    });
    fakes.destroyRender.mockRejectedValueOnce(runtimeFailure);
    const portal = document.createElement('section');
    portal.dataset.projectionOwner = 'preparation-owner';
    portal.dataset.projectionGeneration = '6';
    fakes.renderDemo.mockImplementation(async ({ host }: { host: HTMLElement }) => {
      const scope = document.createElement('section');
      scope.dataset.projectionScope = 'preparation-owner';
      host.appendChild(scope);
      document.body.append(portal);
      return { destroy: fakes.destroyRender };
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mount = document.createElement('div');
    mount.dataset.projectionOwner = 'preparation-owner';
    document.body.appendChild(mount);
    await expect(
      materializeProjectionCandidate(
        {
          selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
          generation: 6,
        },
        {
          mount,
          ownerId: 'preparation-owner',
          componentId: 'button',
          controls: controls(),
        }
      )
    ).rejects.toBe(preparationFailure);

    expect(setEventGateOpen).toHaveBeenCalledWith(false);
    expect(setLocked).toHaveBeenCalledWith(true);
    expect(fakes.destroyRender).toHaveBeenCalledTimes(1);
    expect(mount.querySelector('[data-projection-generation-host]')).toBeNull();
    expect(portal.isConnected).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      '[PrototypePreviewer] Failed to clean up a projection candidate after preparation failure.',
      eventGateFailure
    );

    consoleError.mockRestore();
  });

  it('releases Runtime, host, and portal leases when disposal sealing throws', async () => {
    const sealFailure = new Error('Adapter lock failed during disposal');
    const renderFailure = new Error('Runtime destroy also failed');
    const setLocked = vi.fn((locked: boolean) => {
      if (locked) throw sealFailure;
    });
    fakes.createComposition.mockReturnValue({
      demo: childDemo,
      setLocked,
      setEventGateOpen: vi.fn(),
      setThemeSurfaceStyle: vi.fn(),
    });
    const portal = document.createElement('section');
    portal.dataset.projectionOwner = 'dispose-owner';
    portal.dataset.projectionGeneration = '7';
    fakes.destroyRender.mockRejectedValueOnce(renderFailure);
    fakes.renderDemo.mockImplementation(async ({ host }: { host: HTMLElement }) => {
      const scope = document.createElement('section');
      scope.dataset.projectionScope = 'dispose-owner';
      host.appendChild(scope);
      document.body.append(portal);
      return { destroy: fakes.destroyRender };
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    const mount = document.createElement('div');
    mount.dataset.projectionOwner = 'dispose-owner';
    document.body.appendChild(mount);
    const projected = await materializeProjectionCandidate(
      {
        selection: { runtimeId: 'wc', projectionFamilyId: 'shadcn' },
        generation: 7,
      },
      {
        mount,
        ownerId: 'dispose-owner',
        componentId: 'button',
        controls: controls(),
      }
    );

    await expect(projected.dispose()).rejects.toBe(sealFailure);

    expect(fakes.destroyRender).toHaveBeenCalledTimes(1);
    expect(projected.host.isConnected).toBe(false);
    expect(portal.isConnected).toBe(false);
    expect(mount.querySelector('[data-projection-generation-host]')).toBeNull();
  });

  it('distinguishes newer focus from teardown blur before restoration', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const mount = document.createElement('div');
    mount.dataset.projectionOwner = 'focus-owner';
    const activeHost = document.createElement('div');
    activeHost.dataset.projectionOwnerHost = 'focus-owner';
    activeHost.dataset.projectionGenerationHost = '2';
    activeHost.dataset.projectionGenerationState = 'active';
    activeHost.innerHTML =
      '<div data-projection-control="runtime"><button role="combobox">Runtime</button></div>';
    mount.appendChild(activeHost);
    const source = document.createElement('button');
    const newerFocus = document.createElement('button');
    document.body.append(source, newerFocus, mount);
    const runtimeControl = activeHost.querySelector<HTMLElement>('[role="combobox"]')!;

    source.focus();
    restoreProjectionControlFocus(mount, 'runtime-select', 2);
    newerFocus.focus();
    frames.shift()!(0);
    expect(document.activeElement).toBe(newerFocus);

    restoreProjectionControlFocus(mount, 'runtime-select', 2);
    frames.shift()!(0);
    expect(document.activeElement).toBe(runtimeControl);

    source.focus();
    newerFocus.focus();
    expect(frames).toHaveLength(0);
    restoreProjectionControlFocus(mount, 'runtime-select', 2, source);
    expect(frames).toHaveLength(0);
    expect(document.activeElement).toBe(newerFocus);

    const portaledOrigin = document.createElement('button');
    portaledOrigin.dataset.projectionOwner = 'focus-owner';
    document.body.appendChild(portaledOrigin);
    portaledOrigin.focus();
    portaledOrigin.blur();
    expect(document.activeElement).toBe(document.body);
    restoreProjectionControlFocus(mount, 'runtime-select', 2, portaledOrigin);
    frames.shift()!(0);
    expect(document.activeElement).toBe(runtimeControl);

    const retiredControl = document.createElement('button');
    document.body.appendChild(retiredControl);
    retiredControl.focus();
    restoreProjectionControlFocus(mount, 'runtime-select', 2);
    retiredControl.remove();
    expect(document.activeElement).toBe(document.body);
    frames.shift()!(0);
    expect(document.activeElement).toBe(runtimeControl);
  });
});
