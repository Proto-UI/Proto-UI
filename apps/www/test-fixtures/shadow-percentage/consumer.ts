import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import {
  AdaptToWebComponent,
  setElementProps,
  type ShadowStyleArtifactV1,
} from '@proto.ui/adapter-web-component';
import {
  switchRoot,
  switchThumb,
  type ShadcnSwitchRootProps,
} from '@proto.ui/prototypes-shadcn/switch';

// Authored public inputs. The CLI discovers these ordinary tw() calls; the
// browser observer maintains its equations independently of this list.
const movements = [
  tw('translate-x-[calc(100%_-_4px)]'),
  tw('translate-x-[calc((100%_-_2px)*var(--pui-percentage)/100)]'),
  tw('translate-x-[calc((100%_-_4px)*var(--pui-percentage)/100)]'),
  tw('translate-x-[calc((100%_-_8px)*var(--pui-percentage)/100)]'),
  tw('translate-x-[calc((2px_-_100%)*var(--pui-percentage)/100)]'),
  tw('translate-x-[calc((4px_-_100%)*var(--pui-percentage)/100)]'),
  tw('translate-x-[calc((8px_-_100%)*var(--pui-percentage)/100)]'),
  tw('translate-x-[calc(1px_+_(100%_+_1px)*var(--pui-percentage)/100)]'),
  tw('translate-x-[calc(-1px_-_(100%_+_1px)*var(--pui-percentage)/100)]'),
  tw('translate-x-[-0.0625rem]'),
  tw('translate-x-[calc(2px_-_100%)]'),
  tw('translate-x-[calc(8px_-_100%)]'),
  tw('translate-x-[calc(-100%_-_2px)]'),
  tw('translate-x-[calc(4px_-_100%)]'),
  tw('translate-x-[calc(0.0625rem_+_(100%_+_2px_-_0.0625rem)*var(--pui-percentage)/100)]'),
  tw('translate-x-[calc(-0.0625rem_-_(100%_+_2px_-_0.0625rem)*var(--pui-percentage)/100)]'),
];
const widths = { 16: tw('w-4'), 32: tw('w-8'), 48: tw('w-12') };
const base = tw('block h-4 transition-none');
const animated = tw('transition-transform duration-200 ease-linear');

export type Configuration = {
  expression: number;
  width: 16 | 32 | 48;
  direction: 'ltr' | 'rtl';
};
type Controls = {
  move(value: number): void;
  present(value: boolean): void;
  animate(value: boolean): void;
  counts(): { clicks: number; setups: number };
  read(): number | null;
};
type Instance = HTMLElement & { getExposes(): unknown };
type Row = {
  host: Instance;
  anchor: HTMLElement;
  caller: HTMLElement;
  trustedClicks: boolean[];
  profile: 'light' | 'split';
};

export function createPercentageLab(artifact: ShadowStyleArtifactV1) {
  const stage = document.createElement('main');
  // This only places the experiment in the viewport. All measured dimensions,
  // transforms and transitions come from authored tokens and the real CLI.
  stage.style.cssText = 'padding:120px;display:flex;flex-direction:column;gap:48px;';
  document.body.append(stage);
  let serial = 0;
  let rows: Row[] = [];
  let stale: Controls[] = [];

  function controls(host: Instance): Controls {
    return host.getExposes() as Controls;
  }
  function make(config: Configuration, profile: Row['profile']): Row {
    const movement = movements[config.expression];
    if (!movement) throw new Error('Unknown finite expression');
    const width = widths[config.width];
    if (!width) throw new Error('Unknown finite width');
    let setups = 0;
    const proto = definePrototype({
      name: `percentage-native-${++serial}`,
      setup(def) {
        setups++;
        let run!: RunHandle<Record<string, unknown>>;
        let clicks = 0;
        const percentage =
          config.expression === 0 || (config.expression >= 9 && config.expression <= 13)
            ? null
            : def.state.numberRange('percentage', 0, { min: 0, max: 100 });
        if (percentage) def.expose.state('percentage', percentage);
        def.lifecycle.onCreated((current) => {
          run = current;
        });
        def.expose.method('move', (next: number) => percentage?.set(next));
        def.expose.method('read', () => percentage?.get() ?? null);
        def.expose.method('present', (next: boolean) => run.lifecycle.setPresent(next));
        def.expose.method('animate', (next: boolean) => {
          if (next) run.feedback.style.patch(animated);
          else run.feedback.style.clearPatch();
        });
        def.expose.method('counts', () => ({ clicks, setups }));
        def.event.on('host:click', () => {
          clicks++;
        });
        def.feedback.style.use(base, width, movement);
        return (r) => r.slot();
      },
    });
    const C = AdaptToWebComponent(proto, {
      shadow:
        profile === 'split'
          ? { mode: 'open', presentation: 'split', styleArtifact: artifact }
          : false,
    });
    const host = new C();
    host.dir = config.direction;
    host.dataset.profile = profile;
    const anchor = document.createElement('section');
    anchor.style.cssText =
      'width:320px;height:64px;display:flex;align-items:flex-start;direction:ltr;';
    // Deliberately conflicting inherited progress must not provide an owner
    // lease or alter the independent static W - 4px expression.
    anchor.style.setProperty('--pui-percentage', '93');
    const caller = document.createElement('span');
    caller.dataset.slotMarker = '';
    caller.style.cssText = 'display:block;width:100%;height:4px;background:rgb(240,20,220);';
    host.append(caller);
    const trustedClicks: boolean[] = [];
    host.addEventListener('click', (event) => trustedClicks.push(event.isTrusted));
    anchor.append(host);
    stage.append(anchor);
    return { host, caller, anchor, trustedClicks, profile };
  }
  function rect(element: Element) {
    const r = element.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }
  function sample(row: Row) {
    const { host, anchor, caller, trustedClicks, profile } = row;
    const surface = host.shadowRoot?.querySelector('[part="surface"]') ?? host;
    const slot = host.shadowRoot?.querySelector('slot');
    const style = getComputedStyle(host);
    const surfaceStyle = getComputedStyle(surface);
    const h = host.getBoundingClientRect();
    const hit = document.elementFromPoint(h.x + h.width / 2, h.y + h.height / 2);
    return {
      profile,
      anchor: rect(anchor),
      host: rect(host),
      surface: rect(surface),
      caller: rect(caller),
      transform: style.transform,
      surfaceTransform: surfaceStyle.transform,
      transition: style.transitionProperty,
      transitionDuration: style.transitionDuration,
      surfaceTransition: surfaceStyle.transitionProperty,
      surfaceInlineTransition: (surface as HTMLElement).style.getPropertyValue(
        'transition-property'
      ),
      inlinePercentage: host.style.getPropertyValue('--pui-percentage'),
      computedPercentage: style.getPropertyValue('--pui-percentage').trim(),
      rootTokens: host.getAttribute('data-pui-split-root-style'),
      surfaceTokens: surface.getAttribute('data-pui-style'),
      slotIdentity:
        profile === 'light' ? host.contains(caller) : slot?.assignedNodes().includes(caller),
      callerIdentity: host.firstChild === caller,
      hit: hit === host || (hit !== null && host.contains(hit)),
      trustedClicks: [...trustedClicks],
      ...controls(host).counts(),
      state: controls(host).read(),
      rootFont: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    };
  }
  return {
    mount(config: Configuration) {
      for (const row of rows) row.anchor.remove();
      rows = [make(config, 'light'), make(config, 'split')];
      stale = [];
    },
    sample: () => rows.map(sample),
    move(value: number) {
      for (const row of rows) controls(row.host).move(value);
    },
    animate(value: boolean) {
      for (const row of rows) controls(row.host).animate(value);
    },
    present(value: boolean) {
      for (const row of rows) controls(row.host).present(value);
    },
    absence() {
      return rows.map(({ host, caller }) => ({
        profile: host.dataset.profile,
        rootTokens: host.getAttribute('data-pui-split-root-style'),
        connected: host.isConnected,
        callerIdentity: host.firstChild === caller,
      }));
    },
    disconnect() {
      stale = rows.map(({ host }) => controls(host));
      for (const row of rows) row.host.remove();
    },
    disconnected() {
      return rows.map(({ host }) => ({
        profile: host.dataset.profile,
        shadowChildren: host.shadowRoot?.childNodes.length ?? null,
        connected: host.isConnected,
      }));
    },
    reconnect() {
      for (const row of rows) row.anchor.append(row.host);
    },
    invokeStale() {
      return stale.map((previous) => {
        try {
          previous.move(100);
          return { threw: false };
        } catch (error) {
          return { threw: true, message: String(error) };
        }
      });
    },
    duplicateSurfaceGeometry(value: number | null) {
      const surface = rows[1]?.host.shadowRoot?.querySelector<HTMLElement>('[part="surface"]');
      if (!surface) throw new Error('Missing split surface');
      if (value === null) surface.style.removeProperty('transform');
      else surface.style.setProperty('transform', `translateX(${value}px)`);
    },
    nested() {
      for (const row of rows) row.anchor.remove();
      const outer = make({ expression: 2, width: 48, direction: 'rtl' }, 'split');
      const inner = make({ expression: 8, width: 16, direction: 'ltr' }, 'split');
      inner.anchor.remove();
      outer.caller.replaceWith(inner.host);
      rows = [outer, inner];
      controls(outer.host).move(75);
      controls(inner.host).move(25);
    },
    nestedSample() {
      return rows.map(({ host, caller, anchor }) => ({
        host: rect(host),
        caller: rect(caller),
        anchor: rect(anchor),
        state: controls(host).read(),
        inlinePercentage: host.style.getPropertyValue('--pui-percentage'),
        transform: getComputedStyle(host).transform,
        slotContainsHost: host.shadowRoot
          ?.querySelector('slot')
          ?.assignedNodes()
          .includes(rows[1]!.host),
      }));
    },
    dispose() {
      stage.remove();
    },
  };
}

// The actual public Switch/Thumb pair exercises the finite recipe in its real
// owner graph. Only ordinary public props and trusted browser input change it.
export function createSwitchLab(artifact: ShadowStyleArtifactV1) {
  const stage = document.createElement('main');
  stage.style.cssText = 'padding:48px;display:grid;gap:32px;';
  document.body.append(stage);
  let rows: Array<{
    root: HTMLElement & { getExposes(): any };
    thumb: HTMLElement;
    direction: 'ltr' | 'rtl';
    profile: 'light' | 'split';
    trustedClicks: boolean[];
  }> = [];
  const classes = (profile: 'light' | 'split') => {
    const options = {
      shadow:
        profile === 'split'
          ? ({ mode: 'open', presentation: 'split', styleArtifact: artifact } as const)
          : false,
    } as const;
    return {
      Root: AdaptToWebComponent(switchRoot, {
        ...options,
        registerAs: `percentage-real-${profile}-switch`,
      }),
      Thumb: AdaptToWebComponent(switchThumb, {
        ...options,
        registerAs: `percentage-real-${profile}-thumb`,
      }),
    };
  };
  const light = classes('light');
  const split = classes('split');
  const rect = (element: Element) => {
    const value = element.getBoundingClientRect();
    return { x: value.x, y: value.y, width: value.width, height: value.height };
  };
  return {
    mount(styleProfile: ShadcnSwitchRootProps['styleProfile'], size: 'default' | 'sm') {
      stage.replaceChildren();
      rows = [];
      for (const profile of ['light', 'split'] as const)
        for (const direction of ['ltr', 'rtl'] as const) {
          const { Root, Thumb } = profile === 'light' ? light : split;
          const root = new Root();
          const thumb = new Thumb();
          setElementProps(root, { styleProfile, size, direction, defaultChecked: false });
          root.dataset.switchCase = `${profile}-${direction}`;
          root.append(thumb);
          const trustedClicks: boolean[] = [];
          root.addEventListener('click', (event) => trustedClicks.push(event.isTrusted));
          stage.append(root);
          rows.push({ root, thumb, direction, profile, trustedClicks });
        }
    },
    sample() {
      return rows.map(({ root, thumb, direction, profile, trustedClicks }) => ({
        direction,
        profile,
        root: rect(root),
        thumb: rect(thumb),
        translationX: new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41,
        checked: root.getExposes().checked.get(),
        rootFont: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        rootTokens: root.getAttribute('data-pui-split-root-style'),
        thumbTokens: thumb.getAttribute('data-pui-split-root-style'),
        trustedClicks: [...trustedClicks],
        retainedThumb: root.firstChild === thumb,
      }));
    },
    dispose() {
      stage.remove();
    },
  };
}
