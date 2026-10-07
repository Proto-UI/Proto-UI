import {
  AdaptToWebComponent,
  setElementProps,
  type ShadowColorSchemeSource,
} from '@proto.ui/adapter-web-component';
import { BrutalistBadgeRoot, type BrutalistBadgeTone } from '@proto.ui/prototypes-brutalist/badge';
import { checkboxRoot, checkboxIndicator } from '@proto.ui/prototypes-shadcn/checkbox';
import { protoShadowStyleArtifact } from '../../styles/proto-ui-shadow-style.generated.js';

type Scheme = 'light' | 'dark';
function schemeSource() {
  let value: Scheme = 'light';
  const listeners = new Set<() => void>();
  const source: ShadowColorSchemeSource = {
    get: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    source,
    listeners,
    toggle() {
      value = value === 'light' ? 'dark' : 'light';
      listeners.forEach((fn) => fn());
    },
  };
}

/** App-level acceptance composition. Component semantics come only from the public packages. */
export function mountShadowSplitAcceptance(section: HTMLElement) {
  if (section.dataset.ready) return;
  section.dataset.ready = 'mounting';
  const badgeScheme = schemeSource(),
    checkboxScheme = schemeSource();
  let serial = 0;
  while (customElements.get(`pui-s1-light-badge-${serial}`)) serial++;
  let tone = 0,
    disabled = false,
    mixed = false,
    painted = false,
    classed = false,
    theme = false;
  let longSlot = false,
    moved = false,
    disconnected = false;
  const tones = ['accent', 'info', 'danger'] as const satisfies readonly BrutalistBadgeTone[];
  const rows = Array.from(section.querySelectorAll<HTMLElement>('[data-profile]')).map((column) => {
    const profile = column.dataset.profile!;
    const generations = { badge: 0, checkbox: 0, indicator: 0 };
    let changes = 0;
    let checked = false;
    let indeterminate = false;
    const options = (kind: keyof typeof generations) => ({
      registerAs: `pui-s1-${profile}-${kind}-${serial}`,
      shadow:
        profile === 'split'
          ? {
              mode: 'open' as const,
              presentation: 'split' as const,
              styleArtifact: protoShadowStyleArtifact,
              colorSchemeSource: kind === 'badge' ? badgeScheme.source : checkboxScheme.source,
            }
          : false,
      diagnostics: {
        onLifecycleEvent(event: { type: string }) {
          if (event.type === 'instance.setup.exit') generations[kind]++;
        },
      },
    });
    const Badge = AdaptToWebComponent(BrutalistBadgeRoot, options('badge'));
    const Root = AdaptToWebComponent(checkboxRoot, options('checkbox'));
    const Indicator = AdaptToWebComponent(checkboxIndicator, options('indicator'));
    const badge = new Badge(),
      root = new Root(),
      indicator = new Indicator();
    badge.dataset.s1Component = 'badge';
    root.dataset.s1Component = 'checkbox';
    indicator.dataset.s1Component = 'indicator';
    const slotText = document.createElement('span');
    slotText.className = 's1-slot-text';
    slotText.textContent = 'Badge text';
    badge.append(slotText);
    const name = document.createElement('span');
    name.className = 's1-sr';
    name.textContent = 'Accept terms';
    root.append(indicator, name);
    const badgeMount = column.querySelector<HTMLElement>('[data-badge-mount]')!;
    const rootMount = column.querySelector<HTMLElement>('[data-checkbox-mount]')!;
    const layout = column.querySelector<HTMLElement>('.s1-demo-layout')!;
    const home = layout.parentElement!;
    const destination = column.querySelector<HTMLElement>('[data-move-target]')!;
    const stats = column.querySelector<HTMLOutputElement>('[data-stats]')!;
    const surfaceProps = () => ({
      surfaceStyle: painted ? { backgroundColor: 'rgb(100, 80, 210)' } : undefined,
      surfaceClassName: classed ? 's1-consumer-paint' : undefined,
    });
    const sync = () => {
      setElementProps(badge, { tone: tones[tone], ...surfaceProps() });
      setElementProps(root, { checked, indeterminate, disabled, ...surfaceProps() });
      badge.update?.();
      root.update?.();
    };
    const report = () => {
      const boundary = root.getBoundingClientRect();
      const surface = (
        root.shadowRoot?.querySelector('[part="surface"]') ?? root
      ).getBoundingClientRect();
      stats.textContent = `generation B/C/I: ${generations.badge}/${generations.checkbox}/${generations.indicator}\ncheckedChange: ${changes} · checked: ${root.getAttribute('aria-checked')}\nCheckbox host/surface: ${boundary.width}×${boundary.height} / ${surface.width}×${surface.height}\nscheme B/C: ${badge.getAttribute('data-pui-color-scheme') ?? 'document'} / ${root.getAttribute('data-pui-color-scheme') ?? 'document'}`;
      column.dataset.changes = String(changes);
      column.dataset.generation = String(generations.checkbox);
    };
    root.addEventListener('checkedChange', (event) => {
      changes++;
      checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
      sync();
      requestAnimationFrame(report);
    });
    root.addEventListener('indeterminateChange', (event) => {
      indeterminate = (event as CustomEvent<{ indeterminate: boolean }>).detail.indeterminate;
      sync();
      requestAnimationFrame(report);
    });
    // Props arrive before connection; no page-authored event or focus emulation.
    sync();
    badgeMount.append(badge);
    rootMount.append(root);
    return {
      column,
      badge,
      root,
      indicator,
      badgeMount,
      rootMount,
      layout,
      home,
      destination,
      sync,
      report,
      setMixed(value: boolean) {
        indeterminate = value;
      },
    };
  });

  const applyTheme = () => {
    const values = theme
      ? {
          foreground: '#f1f5f9',
          primary: '#e2e8f0',
          'primary-foreground': '#0f172a',
          input: '#73849a',
          ring: '#a1adff',
        }
      : {
          foreground: '#172033',
          primary: '#263a60',
          'primary-foreground': '#ffffff',
          input: '#8794aa',
          ring: '#6366f1',
        };
    for (const row of rows) {
      row.layout.style.color = values.foreground;
      row.layout.style.backgroundColor = theme ? '#172033' : '#f8fafc';
      for (const [key, value] of Object.entries(values))
        row.layout.style.setProperty(`--pui-${key}`, value);
      for (const [key, value] of Object.entries({
        canary: '#ffd83d',
        sky: '#85d7ff',
        coral: '#ff937f',
        'canary-foreground': '#172033',
        'sky-foreground': '#172033',
        'coral-foreground': '#172033',
      }))
        row.layout.style.setProperty(`--pui-${key}`, value);
    }
  };
  const report = () => {
    section.querySelector<HTMLElement>('[data-tone]')!.textContent = tones[tone];
    rows.forEach((row) => row.report());
  };
  applyTheme();
  section.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      switch (action) {
        case 'theme':
          theme = !theme;
          applyTheme();
          break;
        case 'scheme-badge':
          badgeScheme.toggle();
          break;
        case 'scheme-checkbox':
          checkboxScheme.toggle();
          break;
        case 'tone':
          tone = (tone + 1) % tones.length;
          break;
        case 'disabled':
          disabled = !disabled;
          break;
        case 'mixed':
          mixed = !mixed;
          rows.forEach((row) => row.setMixed(mixed));
          break;
        case 'constraint':
          section.toggleAttribute('data-constrained');
          break;
        case 'disturb':
          section.toggleAttribute('data-disturb');
          break;
        case 'reset':
          section.toggleAttribute('data-reset-interference');
          break;
        case 'part':
          section.toggleAttribute('data-part');
          break;
        case 'inline':
          painted = !painted;
          break;
        case 'class':
          classed = !classed;
          break;
        case 'slot':
          longSlot = !longSlot;
          rows.forEach(({ badge }) => {
            const text = document.createElement('span');
            text.className = 's1-slot-text';
            text.textContent = longSlot ? 'A longer replacement badge' : 'Badge text';
            badge.replaceChildren(text);
          });
          break;
        case 'move':
          moved = !moved;
          rows.forEach((row) => (moved ? row.destination : row.home).append(row.layout));
          break;
        case 'disconnect':
          disconnected = !disconnected;
          rows.forEach((row) => {
            if (disconnected) {
              row.badge.remove();
              row.root.remove();
            } else {
              row.badgeMount.append(row.badge);
              row.rootMount.append(row.root);
            }
          });
          break;
      }
      // Tone is a three-value cycle, not a binary pressed state.
      if (action !== 'tone')
        button.setAttribute(
          'aria-pressed',
          button.getAttribute('aria-pressed') !== 'true' ? 'true' : 'false'
        );
      rows.forEach((row) => row.sync());
      requestAnimationFrame(report);
    });
  });
  requestAnimationFrame(() => {
    report();
    // Captured at the first animation frame after synchronous CE connection.
    section.dataset.firstFrame = JSON.stringify(
      rows.map((row) => {
        const host = row.root.getBoundingClientRect();
        const surface = (
          row.root.shadowRoot?.querySelector('[part="surface"]') ?? row.root
        ).getBoundingClientRect();
        return {
          profile: row.column.dataset.profile,
          host: [host.width, host.height],
          surface: [surface.width, surface.height],
        };
      })
    );
    section.dataset.ready = 'true';
  });
}
