import { siteTypographyParticipant } from '../site-typography';
import { headerSurfaceParticipant } from '../site-header-surface';
import { bindNativeLinkFacts } from '../site-native-link-facts';
import { siteLinkAppearance, siteLinkEmphasis, siteLinkIcon } from '../site-native-controls';
import { initSiteHeaderDisclosure, type SiteHeaderDisclosure } from '../site-header-disclosure';
import { homepageDemoParticipant } from './homepage-demo-participant';
import {
  applySiteLibraryFamily,
  requireSiteLibraryFamily,
  type SiteLibraryFamily,
} from '../site-library-family';
import { searchCommandParticipant } from '../site-search-commands';
import {
  resolveProjectionPart,
  type ProjectionFamilyId,
  type SharedBaseFamilyId,
} from '../PrototypePreviewer/projection-families';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from '../adapter-preference';
import type { DemoNode, DemoSpec, DemoSetupContext } from '../PrototypePreviewer/demo-types';
import {
  PROJECTION_FOCUS_KEYS,
  type ProjectionCompositionControls,
} from '../PrototypePreviewer/projection-composition';
import {
  materializeProjectionCandidate,
  restoreProjectionControlFocus,
  type MaterializedProjectionCandidate,
} from '../PrototypePreviewer/projection-materializer';
import {
  createProjectionScopeController,
  type ProjectionScopeSnapshot,
} from '../PrototypePreviewer/projection-scope';
import {
  resolveProjectionThemeSurfaceStyle,
  watchProjectionThemeSurfaceStyle,
} from '../PrototypePreviewer/projection-theme';
import { AdapterIds, isRuntimeId, type RuntimeId } from '../PrototypePreviewer/runtimes/registry';

const LABELS: Record<RuntimeId, string> = {
  wc: 'Web Components',
  react: 'React',
  vue: 'Vue',
  vue2: 'Vue 2',
};
const ANCHOR_ATTRIBUTES = [
  'href',
  'target',
  'rel',
  'title',
  'aria-label',
  'aria-current',
  'aria-describedby',
  'aria-labelledby',
  'data-site-link-icon',
  'download',
  'hreflang',
  'data-home-locale',
  'data-home-brand',
] as const;
type Group = {
  root: HTMLElement;
  mount: HTMLElement;
  fallback: HTMLElement;
  ownerId: string;
  links: HTMLAnchorElement[];
  theme: boolean;
  runtime: boolean;
  menu?: boolean;
  disclosure?: SiteHeaderDisclosure;
};
type HomepageHandle = { destroy(): Promise<void>; getSnapshot(): ProjectionScopeSnapshot };

/** Bind exactly one protocol event channel; native and WC projected clicks must not double-fire. */
function bindThemeButton(
  context: DemoSetupContext,
  runtime: RuntimeId,
  isActive: () => boolean,
  label: string
): () => void {
  const button = context.refs['home-theme'];
  if (!button) return () => {};
  const document = button.ownerDocument;
  const window = document.defaultView;
  const provider = () =>
    (window as (Window & { StarlightTheme?: { toggle(): void } }) | null)?.StarlightTheme;
  const onClick = () => {
    if (isActive()) provider()?.toggle();
  };
  const listener = (event: Event) => {
    if (window && event instanceof window.CustomEvent) onClick();
  };
  if (runtime === 'wc') button.addEventListener('click', listener);
  else context.api.setProps('home-theme', { onClick });
  const update = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    // Title is a Website-owned annotation. The accessible name is host slot text
    // because Button does not declare arbitrary DOM attributes as props.
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(dark));
  };
  update();
  document.addEventListener('starlight-theme:change', update);
  let alive = true;
  return () => {
    if (!alive) return;
    alive = false;
    button.removeEventListener('click', listener);
    document.removeEventListener('starlight-theme:change', update);
    if (runtime !== 'wc') context.api.setProps('home-theme', { onClick: () => {} });
  };
}

export function createHomepageContent(
  group: Group,
  runtime: RuntimeId,
  isActive: () => boolean,
  family: SiteLibraryFamily = 'shadcn'
): DemoSpec {
  const children: DemoNode[] = group.links.map((link, index) => {
    const attrs: Record<string, string> = {};
    for (const name of ANCHOR_ATTRIBUTES) {
      const value = link.getAttribute(name);
      if (value !== null) attrs[name] = value;
    }
    return {
      kind: 'box',
      tag: 'a',
      ref: `home-link-${index}`,
      attrs: { ...attrs, 'data-site-link-enhanced': 'true' },
      className: 'site-native-link home-runtime-link',
      children: [
        {
          kind: 'proto',
          prototypeId: 'site-link-surface',
          ref: `home-link-surface-${index}`,
          props: {
            family,
            appearance: siteLinkAppearance(link),
            emphasis: siteLinkEmphasis(link),
            icon: siteLinkIcon(link),
            // Setup runs while the generation is staged. Carry native static
            // truth into the first materialized frame before its active gate
            // permits later host-fact publications.
            current:
              link.hasAttribute('aria-current') && link.getAttribute('aria-current') !== 'false',
            hovered: false,
            pressed: false,
            focusVisible: false,
          },
          children: [link.textContent?.trim() || link.getAttribute('aria-label') || 'Link'],
        },
      ],
    };
  });
  if (group.theme)
    children.push({
      kind: 'proto',
      prototypeId: resolveProjectionPart(family, 'button', 'root').prototypeId,
      ref: 'home-theme',
      surfaceStyle: {
        minHeight: 'var(--site-control-height, 2.75rem)',
        height: '2.75rem',
        width: '2.75rem',
        padding: '0',
        fontFamily: 'inherit',
      },
      props: {
        variant: family === 'shadcn' ? 'ghost' : 'surface',
        size: group.root.dataset.homepageThemeIcon === 'true' ? 'icon' : 'default',
      },
      children:
        group.root.dataset.homepageThemeIcon === 'true'
          ? [
              {
                kind: 'box',
                className: 'site-header-theme-icon',
                attrs: { 'aria-hidden': 'true' },
              },
              {
                kind: 'box',
                className: 'home-theme-accessible-label',
                children: [group.root.dataset.homepageThemeLabel || 'Toggle theme'],
              },
            ]
          : [group.root.dataset.homepageThemeLabel || 'Toggle theme'],
    });
  if (group.menu)
    children.push({
      kind: 'proto',
      prototypeId: resolveProjectionPart(family, 'button', 'root').prototypeId,
      ref: 'home-menu',
      surfaceStyle: {
        minHeight: 'var(--site-control-height, 2.75rem)',
        height: '2.75rem',
        width: '2.75rem',
        padding: '0',
        fontFamily: 'inherit',
      },
      props: { variant: family === 'shadcn' ? 'ghost' : 'surface', size: 'icon' },
      children: [
        { kind: 'box', className: 'site-header-menu-icon', attrs: { 'aria-hidden': 'true' } },
        {
          kind: 'box',
          className: 'home-theme-accessible-label',
          children: [group.root.dataset.homepageMenuLabel || 'Navigation and settings'],
        },
      ],
    });
  return {
    type: 'demo',
    root: { kind: 'box', className: 'home-runtime-actions', children },
    setup(context) {
      const cleanupTheme = bindThemeButton(
        context,
        runtime,
        isActive,
        group.root.dataset.homepageThemeLabel || 'Toggle theme'
      );
      const menuButton = context.refs['home-menu'];
      const unbindMenu = menuButton && group.disclosure?.bindButton(menuButton);
      const toggleMenu = () => {
        if (isActive()) group.disclosure?.toggle();
      };
      const onMenuClick = (event: Event) => {
        if (event instanceof (context.host.ownerDocument.defaultView?.CustomEvent ?? CustomEvent))
          toggleMenu();
      };
      if (menuButton) {
        menuButton.setAttribute(
          'title',
          group.root.dataset.homepageMenuLabel || 'Navigation and settings'
        );
        if (runtime === 'wc') menuButton.addEventListener('click', onMenuClick);
        else context.api.setProps('home-menu', { onClick: toggleMenu });
      }
      const cleanupLinkFacts = group.links.map((_link, index) => {
        const link = context.refs[`home-link-${index}`] as HTMLAnchorElement | undefined;
        if (!link) return () => {};
        return bindNativeLinkFacts(
          link,
          (facts) =>
            context.api.setProps(`home-link-surface-${index}`, {
              family,
              appearance: siteLinkAppearance(group.links[index]!),
              emphasis: siteLinkEmphasis(group.links[index]!),
              icon: siteLinkIcon(group.links[index]!),
              ...facts,
            }),
          { isActive }
        );
      });
      const listeners: Array<{ link: Element; listener: EventListener }> = [];
      for (const link of context.host.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        const listener: EventListener = () => {
          // Staged generations are already inert at the reveal boundary.
          // Ignore stale preference side effects without taking link activation.
          if (!isActive()) return;
          const locale = link.getAttribute('data-home-locale');
          if (!locale) return;
          try {
            link.ownerDocument.defaultView?.localStorage.setItem('preferred-locale', locale);
          } catch {
            /* Optional preference. */
          }
          link.ownerDocument.cookie = `preferred-locale=${encodeURIComponent(locale)}; path=/; max-age=31536000; SameSite=Lax`;
        };
        link.addEventListener('click', listener);
        listeners.push({ link, listener });
      }
      return () => {
        cleanupTheme();
        for (const cleanup of cleanupLinkFacts) cleanup();
        unbindMenu?.();
        menuButton?.removeEventListener('click', onMenuClick);
        if (menuButton && runtime !== 'wc')
          context.api.setProps('home-menu', { onClick: () => {} });
        for (const { link, listener } of listeners) link.removeEventListener('click', listener);
      };
    },
  };
}

/** One atomic controller for homepage actions, real PUI controls, and the live example. */
export function initHomepageRuntime(root: HTMLElement): HomepageHandle | undefined {
  const ownedRoot = root as HTMLElement & { __homepageRuntime__?: HomepageHandle };
  if (ownedRoot.__homepageRuntime__) return ownedRoot.__homepageRuntime__;
  const document = root.ownerDocument;
  const disclosure = root.hasAttribute('data-site-header')
    ? initSiteHeaderDisclosure(root)
    : undefined;
  const groups: Group[] = Array.from(
    document.querySelectorAll<HTMLElement>('[data-homepage-actions]')
  ).map((group, index) => {
    const mount = group.querySelector<HTMLElement>('[data-homepage-mount]');
    const fallback = group.querySelector<HTMLElement>('[data-homepage-fallback]');
    if (!mount || !fallback)
      throw new Error('[HomepageRuntime] action group requires an SSR fallback and mount.');
    const ownerId = `homepage-${group.id || index}`;
    mount.dataset.projectionOwner = ownerId;
    return {
      root: group,
      mount,
      fallback,
      ownerId,
      links: Array.from(fallback.querySelectorAll<HTMLAnchorElement>('a[href]')),
      theme: !!fallback.querySelector('[data-homepage-theme]'),
      runtime: group.dataset.homepageControls === 'runtime',
      menu: !!fallback.querySelector('[data-homepage-menu]'),
      disclosure,
    };
  });
  const selectorGroup = groups.find((group) => group.runtime);
  if (!selectorGroup || groups.filter((group) => group.runtime).length !== 1)
    throw new Error('[HomepageRuntime] exactly one page runtime selector is required.');
  let initialRuntime: RuntimeId = 'wc';
  try {
    const stored = document.defaultView?.localStorage.getItem(PREFERRED_ADAPTER_KEY);
    if (isRuntimeId(stored)) initialRuntime = stored;
  } catch {
    /* Optional preference. */
  }
  const headerSurface = headerSurfaceParticipant(root);
  const demo = homepageDemoParticipant(document);
  const searchRoot = root.querySelector<HTMLElement>('site-search');
  const search = searchRoot ? searchCommandParticipant(searchRoot) : null;
  const initialFamily = requireSiteLibraryFamily(demo?.initialFamily ?? 'shadcn');
  const typography = siteTypographyParticipant(document.body, { ownerId: 'homepage-typography' });
  let desiredFamily: SiteLibraryFamily = initialFamily;
  let activeFamily: SiteLibraryFamily = initialFamily;
  let desiredComponent: SharedBaseFamilyId = demo?.initialComponent ?? 'button';
  let committedComponent = desiredComponent;
  const roots = [
    ...groups.map((group) => group.root),
    ...(demo ? [demo.root] : []),
    ...(headerSurface ? [headerSurface.root] : []),
    ...(search?.mounts ?? []),
    typography.root,
  ];
  let destroyed = false;
  let epoch = 0;
  let desiredRuntime = initialRuntime;
  let activeCandidates: MaterializedProjectionCandidate[] = [];
  let activeTypography: MaterializedProjectionCandidate | undefined;
  let typographyEpoch = 0;
  let failedTypographyRevision: number | undefined;
  let typographyRefresh: Promise<void> | undefined;
  const staged = new Map<
    number,
    {
      candidates: MaterializedProjectionCandidate[];
      component: SharedBaseFamilyId;
      typography: MaterializedProjectionCandidate;
    }
  >();
  const status = root.querySelector<HTMLElement>('[data-homepage-runtime-status]');
  const setStatus = (state: 'loading' | 'ready' | 'error', runtime: RuntimeId) => {
    root.dataset.runtimeState = state;
    root.dataset.runtime = runtime;
    root.setAttribute('aria-busy', String(state === 'loading'));
    demo?.setStatus(state, runtime);
    if (status)
      status.textContent = `${LABELS[runtime]} · ${root.dataset[`status${state[0]!.toUpperCase()}${state.slice(1)}`] || state}`;
  };
  const controls = (): ProjectionCompositionControls => ({
    runtime: {
      label: root.dataset.runtimeLabel || 'Page runtime',
      wrapValue: true,
      brutalistTriggerAppearance: 'elevated',
      options: AdapterIds.map((value) => ({ value, label: LABELS[value] })),
      onValueChange: requestRuntime,
    },
    family: {
      label: root.dataset.familyLabel || demo?.root.dataset.familyLabel || 'Page library',
      wrapValue: true,
      brutalistTriggerAppearance: 'elevated',
      options: [
        { value: 'shadcn', label: 'Shadcn' },
        { value: 'brutalist', label: 'Brutalist' },
      ],
      onValueChange: requestFamily,
    },
    component: {
      label: demo?.root.dataset.pickerLabel || 'Component',
      options: [{ value: 'button', label: 'Button' }],
      onValueChange: (value) => requestComponent(value as SharedBaseFamilyId),
    },
  });
  const controller = createProjectionScopeController({
    initialSelection: { runtimeId: initialRuntime, projectionFamilyId: initialFamily },
    async materialize(request) {
      // A page selection supersedes any passive refresh of its retained view.
      typographyEpoch++;
      const runtime = request.selection.runtimeId as RuntimeId;
      const family = requireSiteLibraryFamily(request.selection.projectionFamilyId);
      const component = desiredComponent;
      const work = groups.map(async (group) => {
        const ids = [
          ...(group.links.length ? ['site-link-surface'] : []),
          ...(group.theme || group.menu
            ? [resolveProjectionPart(family, 'button', 'root').prototypeId]
            : []),
        ];
        if (!group.links.length && !group.theme && !group.menu && !group.runtime)
          throw new Error('[HomepageRuntime] action groups must not be empty.');
        return materializeProjectionCandidate(request, {
          mount: group.mount,
          ownerId: group.ownerId,
          componentId: 'button',
          controls: controls(),
          controlIds: group.runtime ? ['runtime', 'family'] : [],
          content: {
            demo: createHomepageContent(
              group,
              runtime,
              () =>
                !destroyed &&
                controller.getSnapshot().phase === 'ready' &&
                controller.getSnapshot().generation === request.generation,
              family
            ),
            recipe: { id: group.ownerId, prototypeIds: ids, rootPrototypeId: ids[0] ?? null },
          },
        });
      });
      if (demo)
        work.push(
          materializeProjectionCandidate(request, {
            mount: demo.mount,
            ownerId: demo.ownerId,
            componentId: component,
            controls: controls(),
            controlIds: [],
            content: demo.createContent(
              family,
              runtime,
              () =>
                !destroyed &&
                controller.getSnapshot().phase === 'ready' &&
                controller.getSnapshot().generation === request.generation,
              () => !destroyed && controller.getSnapshot().generation === request.generation
            ),
          })
        );
      if (headerSurface) work.push(headerSurface.materialize(request));
      // Search contributes to this exact request. Its native dialog and Pagefind
      // owner stay mounted while all three command views commit with the page.
      const searchWork = search?.materialize(request);
      let preparedTypography: MaterializedProjectionCandidate | undefined;
      const typographyWork = typography.materialize(request).then((candidate) => {
        preparedTypography = candidate;
        return candidate;
      });
      const outcomes = await Promise.allSettled([
        ...work,
        ...(searchWork ? [searchWork] : []),
        typographyWork,
      ]);
      const candidates = outcomes.flatMap((outcome) =>
        outcome.status === 'fulfilled'
          ? Array.isArray(outcome.value)
            ? outcome.value
            : [outcome.value]
          : []
      );
      const failure = outcomes.find((outcome) => outcome.status === 'rejected');
      if (failure?.status === 'rejected') {
        await Promise.allSettled(candidates.map((candidate) => candidate.dispose()));
        throw failure.reason;
      }
      staged.set(request.generation, { candidates, component, typography: preparedTypography! });
      let disposed = false;
      return {
        activate() {
          for (const candidate of candidates) candidate.activate();
        },
        setLocked(locked: boolean) {
          for (const candidate of candidates) candidate.setLocked?.(locked);
        },
        async dispose() {
          if (disposed) return;
          disposed = true;
          staged.delete(request.generation);
          const results = await Promise.allSettled(
            candidates.map((candidate) => candidate.dispose())
          );
          const failed = results.find((result) => result.status === 'rejected');
          if (failed?.status === 'rejected') throw failed.reason;
        },
      };
    },
    prepareCommit(commit) {
      const prepared = staged.get(commit.generation);
      if (!prepared) throw new Error('[HomepageRuntime] prepared page generation is missing.');
      const next = prepared.candidates;
      const family = requireSiteLibraryFamily(commit.selection.projectionFamilyId);
      for (let index = 0; index < next.length; index++)
        next[index]!.setThemeSurfaceStyle(
          resolveProjectionThemeSurfaceStyle(family, roots[index]!)
        );
      const demoPublication = demo?.prepareCommit(commit, prepared.component);
      const headerPublication = headerSurface?.prepareCommit(commit);
      const searchPublication = search?.prepareCommit(commit);
      const previous = activeCandidates;
      const previousTypography = activeTypography;
      const previousFamily = activeFamily;
      const previousComponent = committedComponent;
      const previousSiteMarkers = [
        document.documentElement,
        ...document.querySelectorAll<HTMLElement>('[data-site-family-scope]'),
      ].map((element) => ({ element, value: element.getAttribute('data-site-library-family') }));
      const hidden = groups.map((group) => group.fallback.hidden);
      const previousAttributes = [
        'data-runtime-generation',
        'data-family',
        'data-runtime-state',
        'data-runtime',
        'aria-busy',
      ].map((name) => [name, root.getAttribute(name)] as const);
      const previousStatus = status?.textContent ?? null;
      return {
        publish() {
          activeCandidates = next;
          activeTypography = prepared.typography;
          activeFamily = family;
          committedComponent = prepared.component;
          for (const group of groups) group.fallback.hidden = true;
          root.dataset.runtimeGeneration = String(commit.generation);
          root.dataset.family = family;
          applySiteLibraryFamily(document, family);
          demoPublication?.publish();
          headerPublication?.publish();
          searchPublication?.publish();
          setStatus('ready', commit.selection.runtimeId as RuntimeId);
          disclosure?.enhance();
        },
        rollback() {
          activeCandidates = previous;
          activeTypography = previousTypography;
          activeFamily = previousFamily;
          committedComponent = previousComponent;
          groups.forEach((group, index) => {
            group.fallback.hidden = hidden[index]!;
          });
          for (const [name, value] of previousAttributes) {
            if (value === null) root.removeAttribute(name);
            else root.setAttribute(name, value);
          }
          for (const { element, value } of previousSiteMarkers) {
            if (value === null) element.removeAttribute('data-site-library-family');
            else element.setAttribute('data-site-library-family', value);
          }
          if (status) status.textContent = previousStatus;
          demoPublication?.rollback();
          headerPublication?.rollback();
          searchPublication?.rollback();
        },
      };
    },
    restoreFocus(key, commit, origin) {
      const mount =
        key === PROJECTION_FOCUS_KEYS.runtime || key === PROJECTION_FOCUS_KEYS.family
          ? selectorGroup.mount
          : demo?.mount;
      if (mount) restoreProjectionControlFocus(mount, key, commit.generation, origin);
    },
  });
  const observe = (promise: Promise<ProjectionScopeSnapshot>, publishPreference: boolean) => {
    const requestEpoch = ++epoch;
    setStatus('loading', desiredRuntime);
    void promise
      .then((snapshot) => {
        if (destroyed || requestEpoch !== epoch) return;
        desiredRuntime = snapshot.selection.runtimeId as RuntimeId;
        desiredFamily = requireSiteLibraryFamily(snapshot.selection.projectionFamilyId);
        desiredComponent = committedComponent;
        setStatus('ready', desiredRuntime);
        onTypographyChange();
        if (publishPreference) {
          try {
            document.defaultView?.localStorage.setItem(PREFERRED_ADAPTER_KEY, desiredRuntime);
          } catch {
            /* Optional preference. */
          }
          document.dispatchEvent(
            new CustomEvent(PREFERRED_ADAPTER_EVENT, {
              detail: { adapter: desiredRuntime, source: root },
            })
          );
        }
      })
      .catch((error) => {
        if (destroyed || requestEpoch !== epoch) return;
        desiredRuntime = controller.getSnapshot().selection.runtimeId as RuntimeId;
        desiredFamily = requireSiteLibraryFamily(
          controller.getSnapshot().selection.projectionFamilyId
        );
        desiredComponent = committedComponent;
        setStatus('error', desiredRuntime);
        console.error('[HomepageRuntime] retained previous generation or native SSR links.', error);
        onTypographyChange();
      });
  };
  function requestRuntime(runtime: RuntimeId): void {
    if (destroyed || runtime === desiredRuntime) return;
    desiredRuntime = runtime;
    observe(
      controller.request(
        { runtimeId: runtime, projectionFamilyId: desiredFamily },
        {
          force: desiredComponent !== committedComponent,
          focusKey: PROJECTION_FOCUS_KEYS.runtime,
          focusOrigin: document.activeElement,
        }
      ),
      true
    );
  }
  function requestFamily(value: ProjectionFamilyId): void {
    if (destroyed) return;
    const family = requireSiteLibraryFamily(value);
    if (family === desiredFamily) return;
    desiredFamily = family;
    observe(
      controller.request(
        { runtimeId: desiredRuntime, projectionFamilyId: family },
        {
          force: desiredComponent !== committedComponent,
          focusKey: PROJECTION_FOCUS_KEYS.family,
          focusOrigin: document.activeElement,
        }
      ),
      false
    );
  }
  function requestComponent(component: SharedBaseFamilyId): void {
    if (destroyed || component === desiredComponent) return;
    desiredComponent = component;
    observe(
      controller.request(
        { runtimeId: desiredRuntime, projectionFamilyId: desiredFamily },
        {
          force: true,
          focusKey: PROJECTION_FOCUS_KEYS.component,
          focusOrigin: document.activeElement,
        }
      ),
      false
    );
  }
  const onAdapterChange = (event: Event) => {
    const detail = (event as CustomEvent<{ adapter?: unknown; source?: unknown }>).detail;
    if (
      detail?.source === root ||
      !isRuntimeId(detail?.adapter) ||
      detail.adapter === desiredRuntime ||
      destroyed
    )
      return;
    desiredRuntime = detail.adapter;
    observe(
      controller.request(
        { runtimeId: desiredRuntime, projectionFamilyId: desiredFamily },
        { force: desiredComponent !== committedComponent }
      ),
      false
    );
  };
  document.addEventListener(PREFERRED_ADAPTER_EVENT, onAdapterChange);
  const stopThemes = (['shadcn', 'brutalist'] as const).map((family) =>
    watchProjectionThemeSurfaceStyle(family, root, () => {
      if (destroyed || family !== activeFamily) return;
      for (let index = 0; index < activeCandidates.length; index++)
        activeCandidates[index]!.setThemeSurfaceStyle(
          resolveProjectionThemeSurfaceStyle(family, roots[index]!)
        );
    })
  );
  let destroyPromise: Promise<void> | undefined;
  const destroy = () =>
    (destroyPromise ??= (async () => {
      destroyed = true;
      epoch++;
      typographyEpoch++;
      observer.disconnect();
      compactMedia?.removeEventListener('change', onTypographyChange);
      typography.destroy();
      disclosure?.destroy();
      for (const stop of stopThemes) stop();
      document.removeEventListener(PREFERRED_ADAPTER_EVENT, onAdapterChange);
      document.removeEventListener('astro:before-swap', onBeforeSwap);
      activeCandidates = [];
      activeTypography = undefined;
      await controller.destroy();
      await typographyRefresh;
      staged.clear();
      for (const group of groups) group.fallback.hidden = false;
      delete ownedRoot.__homepageRuntime__;
    })());
  const onBeforeSwap = () => {
    void destroy();
  };
  const onTypographyChange = () => {
    const snapshot = controller.getSnapshot();
    if (destroyed || typographyRefresh || snapshot.phase !== 'ready' || !typography.needsRefresh())
      return;
    const candidates = activeCandidates;
    const previous = activeTypography;
    if (!previous) return;
    const index = candidates.indexOf(previous);
    if (index < 0) return;
    const sourceRevision = typography.getSourceRevision();
    if (sourceRevision === failedTypographyRevision) return;
    const refreshEpoch = ++typographyEpoch;
    typographyRefresh = (async () => {
      let candidate: Awaited<ReturnType<typeof typography.materialize>> | undefined;
      let recheck = false;
      try {
        candidate = await typography.materialize(snapshot);
        const current = controller.getSnapshot();
        if (
          destroyed ||
          refreshEpoch !== typographyEpoch ||
          current.phase !== 'ready' ||
          current.generation !== snapshot.generation ||
          activeCandidates !== candidates ||
          activeTypography !== previous ||
          sourceRevision !== typography.getSourceRevision()
        ) {
          recheck = true;
          return;
        }
        candidate.setThemeSurfaceStyle(
          resolveProjectionThemeSurfaceStyle(activeFamily, typography.root)
        );
        try {
          candidate.activate();
        } catch (error) {
          previous.activate();
          throw error;
        }
        // The page candidate owns this same array. Its rollback, theme updates
        // and eventual disposal therefore retain the latest passive batch.
        // Interactive participants and the page snapshot never change here.
        candidates[index] = candidate;
        activeTypography = candidate;
        failedTypographyRevision = undefined;
        candidate = undefined;
        recheck = true;
        try {
          await previous.dispose();
        } catch (error) {
          console.error('[HomepageRuntime] failed to retire previous typography batch.', error);
        }
      } catch (error) {
        if (!destroyed && refreshEpoch === typographyEpoch) {
          failedTypographyRevision = sourceRevision;
          recheck = sourceRevision !== typography.getSourceRevision();
          console.error('[HomepageRuntime] retained previous typography batch.', error);
        }
      } finally {
        try {
          await candidate?.dispose();
        } catch (error) {
          console.error('[HomepageRuntime] failed to dispose prepared typography batch.', error);
        } finally {
          typographyRefresh = undefined;
          // Source/viewport changes made during preparation need one more pass.
          if (recheck) onTypographyChange();
        }
      }
    })();
  };
  const compactMedia = document.defaultView?.matchMedia('(max-width: 47.999rem)');
  compactMedia?.addEventListener('change', onTypographyChange);
  const observer = new MutationObserver(() => {
    if (!root.isConnected) void destroy();
    else onTypographyChange();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-site-typography'],
  });
  document.addEventListener('astro:before-swap', onBeforeSwap);
  ownedRoot.__homepageRuntime__ = { destroy, getSnapshot: () => controller.getSnapshot() };
  observe(controller.start(), false);
  return ownedRoot.__homepageRuntime__;
}
