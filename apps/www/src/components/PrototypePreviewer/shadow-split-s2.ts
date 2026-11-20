import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import button from '@proto.ui/prototypes-shadcn/button';
import { switchRoot, switchThumb } from '@proto.ui/prototypes-shadcn/switch';
import { checkboxRoot, checkboxIndicator } from '@proto.ui/prototypes-shadcn/checkbox';
import { BrutalistBadgeRoot } from '@proto.ui/prototypes-brutalist/badge';
import { protoShadowStyleArtifact } from '../../styles/proto-ui-shadow-style.generated.js';

/** S2 consumer composition only: input, motion and lifecycle belong to packages. */
export function mountShadowSplitS2(section: HTMLElement) {
  if (section.dataset.ready) return;
  section.dataset.ready = 'mounting';
  // Private diagnostic hook, installed before navigation by the focused browser case.
  const checkpoint = (phase: string, detail: Record<string, unknown> = {}) => {
    (window as Window & { __s2Checkpoint?: (value: unknown) => void }).__s2Checkpoint?.({
      phase, ...detail, time: performance.now(), url: location.href,
    });
  };
  let serial = 0;
  while (customElements.get(`pui-s2-light-button-${serial}`)) serial++;
  let variant = 'default',
    size = 'default',
    disabled = false,
    tone = 0,
    longSlot = false,
    moved = false,
    disconnected = false;
  const tones = ['accent', 'info', 'danger'] as const;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const cancel = () => {
    timers.forEach(clearTimeout);
    timers.clear();
  };
  document.addEventListener('astro:before-swap', cancel, { once: true });
  const rows = Array.from(section.querySelectorAll<HTMLElement>('[data-s2-profile]')).map(
    (column) => {
      const profile = column.dataset.s2Profile!;
      const generations: Record<string, number> = {};
      const splitFor = (kind: string) =>
        profile === 'split' ||
        (profile === 'mixed' && ['button', 'switch', 'indicator'].includes(kind));
      const options = (kind: string) => ({
        registerAs: `pui-s2-${profile}-${kind}-${serial}`,
        shadow: splitFor(kind)
          ? {
              mode: 'open' as const,
              presentation: 'split' as const,
              styleArtifact: protoShadowStyleArtifact,
            }
          : false,
        diagnostics: {
          onLifecycleEvent(event: { type: string }) {
            if (event.type === 'instance.setup.exit')
              generations[kind] = (generations[kind] ?? 0) + 1;
          },
        },
      });
      const Button = AdaptToWebComponent(button, options('button'));
      const Switch = AdaptToWebComponent(switchRoot, options('switch'));
      const Thumb = AdaptToWebComponent(switchThumb, options('thumb'));
      const Checkbox = AdaptToWebComponent(checkboxRoot, options('checkbox'));
      const Indicator = AdaptToWebComponent(checkboxIndicator, options('indicator'));
      const Badge = AdaptToWebComponent(BrutalistBadgeRoot, options('badge'));
      const elements = {
        button: new Button(),
        switch: new Switch(),
        thumb: new Thumb(),
        checkbox: new Checkbox(),
        indicator: new Indicator(),
        badge: new Badge(),
      };
      for (const [kind, el] of Object.entries(elements)) {
        el.dataset.s2Component = kind;
        if (splitFor(kind)) el.dataset.s2Split = '';
      }
      const label = (text: string) => {
        const span = document.createElement('span');
        span.className = 's2-sr';
        span.textContent = text;
        return span;
      };
      elements.switch.append(elements.thumb, label('Auto sync'));
      elements.checkbox.append(elements.indicator, label('Receive notifications'));
      const badgeText = document.createElement('span');
      badgeText.textContent = 'Ready';
      elements.badge.append(badgeText);
      const replaceButtonSlot = () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(svg.namespaceURI, 'path');
        path.setAttribute('d', 'm5 12 4 4L19 6');
        svg.append(path);
        const text = document.createElement('span');
        text.textContent = longSlot ? 'Save preferences' : 'Save';
        if (size === 'icon') text.className = 's2-sr';
        elements.button.replaceChildren(svg, text);
      };
      let checked = false,
        checkboxChecked = false,
        clicks = 0,
        switchChanges = 0,
        checkboxChanges = 0;
      const settings = column.querySelector<HTMLElement>('[data-settings]')!;
      const home = column.querySelector<HTMLElement>('[data-home]')!;
      const destination = column.querySelector<HTMLElement>('[data-destination]')!;
      const report = () => {
        checkpoint('report:before', { profile });
        column.dataset.buttonClicks = String(clicks);
        column.dataset.switchChanges = String(switchChanges);
        column.dataset.checkboxChanges = String(checkboxChanges);
        column.dataset.generations = JSON.stringify(generations);
        column.querySelector('output')!.textContent =
          `click: ${clicks} · switchChange: ${switchChanges} · checkboxChange: ${checkboxChanges}\nchecked S/C: ${checked}/${checkboxChecked}\ngeneration: ${Object.entries(
            generations
          )
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')}\nvariant/size: ${variant}/${size} · tone: ${tones[tone]}`;
        checkpoint('report:after', { profile });
      };
      const sync = () => {
        checkpoint('row-sync:before', { profile });
        checkpoint('props:before', { profile, component: 'button' });
        setElementProps(elements.button, { variant, size, disabled });
        checkpoint('props:after', { profile, component: 'button' });
        checkpoint('props:before', { profile, component: 'switch' });
        setElementProps(elements.switch, { checked, disabled });
        checkpoint('props:after', { profile, component: 'switch' });
        checkpoint('props:before', { profile, component: 'checkbox' });
        setElementProps(elements.checkbox, { checked: checkboxChecked, disabled });
        checkpoint('props:after', { profile, component: 'checkbox' });
        checkpoint('props:before', { profile, component: 'badge' });
        setElementProps(elements.badge, { tone: tones[tone] });
        checkpoint('props:after', { profile, component: 'badge' });
        for (const kind of ['button', 'switch', 'checkbox', 'badge'] as const) {
          const el = elements[kind];
          checkpoint('update:before', { profile, component: kind });
          el.update?.();
          checkpoint('update:after', { profile, component: kind });
        }
        checkpoint('row-sync:after', { profile });
      };
      elements.button.addEventListener('click', (event) => {
        if (event instanceof CustomEvent) {
          clicks++;
          report();
        }
      });
      elements.switch.addEventListener('checkedChange', (event) => {
        switchChanges++;
        checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
        sync();
        requestAnimationFrame(report);
      });
      elements.checkbox.addEventListener('checkedChange', (event) => {
        checkboxChanges++;
        checkboxChecked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
        sync();
        requestAnimationFrame(report);
      });
      replaceButtonSlot();
      sync();
      for (const kind of ['button', 'switch', 'checkbox', 'badge'] as const)
        column.querySelector(`[data-mount="${kind}"]`)!.append(elements[kind]);
      return {
        column,
        elements,
        settings,
        home,
        destination,
        sync,
        report,
        replaceButtonSlot,
        toggle() {
          checkpoint('toggle:before', { profile });
          checked = !checked;
          checkboxChecked = checked;
          sync();
          requestAnimationFrame(report);
          checkpoint('toggle:after', { profile });
        },
        reverse() {
          checked = !checked;
          sync();
          requestAnimationFrame(report);
        },
      };
    }
  );
  const sync = () => {
    checkpoint('outer-sync:before');
    rows.forEach((r) => r.sync());
    requestAnimationFrame(() => rows.forEach((r) => r.report()));
    checkpoint('outer-sync:after');
  };
  section.querySelectorAll<HTMLSelectElement>('[data-option]').forEach((select) =>
    select.addEventListener('change', () => {
      if (select.dataset.option === 'variant') variant = select.value;
      else {
        size = select.value;
        rows.forEach((r) => r.replaceButtonSlot());
      }
      sync();
    })
  );
  section.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((control) =>
    control.addEventListener('click', () => {
      checkpoint('handler:before', { action: control.dataset.action });
      cancel();
      const action = control.dataset.action;
      switch (action) {
        case 'scheme': {
          const doc = document.documentElement;
          const dark = !(doc.dataset.theme === 'dark' || doc.classList.contains('dark'));
          doc.dataset.theme = dark ? 'dark' : 'light';
          doc.classList.toggle('dark', dark);
          doc.classList.toggle('light', !dark);
          break;
        }
        case 'checked':
          rows.forEach((r) => r.toggle());
          break;
        case 'rapid':
          for (let i = 0; i < 6; i++) {
            const timer = setTimeout(() => {
              timers.delete(timer);
              rows.forEach((r) => r.reverse());
            }, i * 55);
            timers.add(timer);
          }
          break;
        case 'disabled':
          disabled = !disabled;
          break;
        case 'tone':
          tone = (tone + 1) % tones.length;
          break;
        case 'slot':
          longSlot = !longSlot;
          rows.forEach((r) => r.replaceButtonSlot());
          break;
        case 'move':
          moved = !moved;
          if (!disconnected)
            rows.forEach((r) => (moved ? r.destination : r.home).append(r.settings));
          break;
        case 'disconnect':
          disconnected = !disconnected;
          rows.forEach((r) =>
            disconnected ? r.settings.remove() : (moved ? r.destination : r.home).append(r.settings)
          );
          break;
      }
      if (['disabled', 'slot', 'move', 'disconnect'].includes(action ?? ''))
        control.setAttribute(
          'aria-pressed',
          control.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'
        );
      sync();
      checkpoint('handler:after', { action });
    })
  );
  requestAnimationFrame(() => {
    rows.forEach((r) => r.report());
    section.dataset.ready = 'true';
  });
}
