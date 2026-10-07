import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { tabsRoot, tabsList, tabsTrigger, tabsContent } from '@proto.ui/prototypes-shadcn/tabs';
import button from '@proto.ui/prototypes-shadcn/button';
import { switchRoot, switchThumb } from '@proto.ui/prototypes-shadcn/switch';
import { checkboxRoot, checkboxIndicator } from '@proto.ui/prototypes-shadcn/checkbox';
import { BrutalistBadgeRoot } from '@proto.ui/prototypes-brutalist/badge';
import { protoShadowStyleArtifact } from '../../styles/proto-ui-shadow-style.generated.js';

// S3 acceptance consumer; the split profile remains draft.
// Consumer-owned configuration/model only. Tabs navigation, visibility, focus
// and lifecycle are supplied by the complete public prototypes and Adapter.
export function mountShadowSplitS3(
  section: HTMLElement,
  options: { profiles?: Array<'light' | 'split' | 'mixed'>; compact?: boolean } = {}
) {
  if (section.dataset.ready) return;
  section.dataset.ready = 'mounting';
  const zh = section.dataset.lang !== 'en';
  let serial = 0;
  while (['light', 'split', 'mixed'].some((p) => customElements.get(`pui-s3-${p}-root-${serial}`)))
    serial++;
  const app = section.querySelector<HTMLElement>('[data-s3-app]')!;
  const controls = document.createElement('div');
  controls.className = 's3-controls';
  const columns = document.createElement('div');
  columns.className = 's3-columns';
  if (!options.compact) app.append(controls);
  app.append(columns);
  let config = {
    keepMounted: false,
    orientation: 'horizontal',
    activationMode: 'automatic',
    loop: false,
  };
  let disconnected = false,
    moved = false,
    longSlot = false,
    disabled = false,
    tone = 0;
  const tones = ['accent', 'info', 'danger'] as const;
  const rows = (options.profiles ?? ['light', 'split', 'mixed']).map((profile) => {
    const column = document.createElement('article');
    column.dataset.s3Profile = profile;
    const title = document.createElement('h3');
    title.textContent = profile;
    const home = document.createElement('div'),
      destination = document.createElement('div'),
      output = document.createElement('output');
    home.dataset.home = '';
    destination.dataset.destination = '';
    output.dataset.stats = '';
    const after = document.createElement('button');
    after.className = 's3-control';
    after.dataset.s3After = profile;
    after.textContent = zh ? '离开面板' : 'After panel';
    if (options.compact) column.append(home, destination);
    else column.append(title, home, destination, after, output);
    columns.append(column);
    const counts: Record<
      string,
      { setup: number; mount: number; unmount: number; dispose: number }
    > = {};
    const elements: Record<
      string,
      HTMLElement & { update?(): void; getExposes?(): Record<string, unknown> }
    > = {};
    let value = 'a',
      checked = false,
      checkboxChecked = false,
      changes = 0,
      switchChanges = 0,
      checkboxChanges = 0,
      clicks = 0;
    const splitFor = (key: string) =>
      profile === 'split' ||
      (profile === 'mixed' &&
        (key === 'root' ||
          key.startsWith('trigger-') ||
          key.startsWith('content-') ||
          ['switch', 'indicator', 'button'].includes(key)));
    function report() {
      column.dataset.value = value;
      column.dataset.changes = String(changes);
      column.dataset.counts = JSON.stringify(counts);
      column.dataset.model = JSON.stringify({
        checked,
        checkboxChecked,
        switchChanges,
        checkboxChanges,
        clicks,
      });
      output.textContent =
        `value=${value} · valueChange=${changes} · switch/checkbox=${checked}/${checkboxChecked}\n` +
        `switchChange=${switchChanges} · checkboxChange=${checkboxChanges} · click=${clicks}\n` +
        ['content-a', 'content-b', 'content-c', 'switch']
          .map((k) => `${k}: ${JSON.stringify(counts[k])}`)
          .join('\n');
    }
    function make(key: string, proto: Parameters<typeof AdaptToWebComponent>[0]) {
      counts[key] = { setup: 0, mount: 0, unmount: 0, dispose: 0 };
      const C = AdaptToWebComponent(proto, {
        registerAs: `pui-s3-${profile}-${key}-${serial}`,
        shadow: splitFor(key)
          ? { mode: 'open', presentation: 'split', styleArtifact: protoShadowStyleArtifact }
          : false,
        diagnostics: {
          onLifecycleEvent(event) {
            const field = (
              {
                'instance.setup.exit': 'setup',
                'mount.mounted': 'mount',
                'unmount.done': 'unmount',
                'instance.dispose.done': 'dispose',
              } as const
            )[event.type as 'mount.mounted'];
            if (field) {
              counts[key][field]++;
              requestAnimationFrame(report);
            }
          },
        },
      });
      const el = new C();
      el.dataset.s3Component = key;
      if (splitFor(key)) el.dataset.s3Split = '';
      elements[key] = el;
      return el;
    }
    const root = make('root', tabsRoot),
      list = make('list', tabsList);
    const labels = zh
      ? { a: '设置', d: '禁用', b: '详情', c: '空' }
      : { a: 'Settings', d: 'Disabled', b: 'Details', c: 'Empty' };
    for (const v of ['a', 'd', 'b', 'c'] as const) {
      const trigger = make(`trigger-${v}`, tabsTrigger);
      trigger.textContent = labels[v];
      setElementProps(trigger, { value: v, disabled: v === 'd' });
      list.append(trigger);
    }
    const panels = ['a', 'b', 'c', 'd'].map((v) => make(`content-${v}`, tabsContent));
    // Consumer overflow policy for long labels, without changing List/Trigger
    // intrinsic sizing or the Tabs keyboard implementation.
    const listScroll = document.createElement('div');
    listScroll.className = 's3-tabs-scroll';
    listScroll.append(list);
    root.append(listScroll, ...panels);
    const settings = document.createElement('div');
    settings.className = 's3-settings';
    const sw = make('switch', switchRoot),
      thumb = make('thumb', switchThumb),
      cb = make('checkbox', checkboxRoot),
      indicator = make('indicator', checkboxIndicator),
      save = make('button', button),
      badge = make('badge', BrutalistBadgeRoot);
    sw.setAttribute('aria-label', 'Auto sync');
    cb.setAttribute('aria-label', 'Receive notifications');
    sw.append(thumb);
    cb.append(indicator);
    for (const [el, label] of [
      [sw, zh ? '自动同步' : 'Auto sync'],
      [cb, zh ? '接收通知' : 'Receive notifications'],
    ] as const) {
      const line = document.createElement('div');
      line.className = 's3-line';
      const text = document.createElement('span');
      text.textContent = label;
      line.append(el, text);
      settings.append(line);
    }
    const line = document.createElement('div');
    line.className = 's3-line';
    line.append(save, badge);
    settings.append(line);
    panels[0].append(settings);
    const details = document.createElement('button');
    details.className = 's3-control';
    details.dataset.s3Details = '';
    details.textContent = zh ? '详情操作' : 'Details action';
    panels[1].append(details);
    panels[2].textContent = zh
      ? '没有可聚焦后代：入口应回退到面板自身。'
      : 'No focusable descendants: entry falls back to the panel.';
    panels[3].textContent = 'Disabled panel';
    function sync() {
      setElementProps(root, {
        value,
        orientation: config.orientation,
        activationMode: config.activationMode,
      });
      setElementProps(list, { loop: config.loop, a11yLabel: `S3 ${profile}` });
      panels.forEach((panel, i) =>
        setElementProps(panel, { value: ['a', 'b', 'c', 'd'][i], keepMounted: config.keepMounted })
      );
      setElementProps(sw, { checked, disabled });
      setElementProps(cb, { checked: checkboxChecked, disabled });
      setElementProps(save, { disabled });
      setElementProps(badge, { tone: tones[tone] });
      Object.values(elements).forEach((el) => el.update?.());
      requestAnimationFrame(report);
    }
    function slots() {
      save.textContent = longSlot ? (zh ? '保存设置' : 'Save preferences') : zh ? '保存' : 'Save';
      badge.textContent = longSlot ? 'Updated' : 'Ready';
    }
    root.addEventListener('valueChange', (event) => {
      value = (event as CustomEvent<{ value: string }>).detail.value;
      changes++;
      sync();
    });
    sw.addEventListener('checkedChange', (event) => {
      checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
      switchChanges++;
      sync();
    });
    cb.addEventListener('checkedChange', (event) => {
      checkboxChecked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
      checkboxChanges++;
      sync();
    });
    save.addEventListener('click', (event) => {
      if (event instanceof CustomEvent) {
        clicks++;
        report();
      }
    });
    slots();
    sync();
    home.append(root);
    return {
      column,
      root,
      home,
      destination,
      elements,
      sync,
      slots,
      report,
      select(next: string) {
        value = next;
        sync();
      },
      toggle() {
        checked = !checked;
        checkboxChecked = checked;
        sync();
      },
    };
  });
  const sync = () => rows.forEach((r) => r.sync());
  function selectControl(key: 'orientation' | 'activationMode', values: string[]) {
    const label = document.createElement('label');
    label.textContent = key + ' ';
    const select = document.createElement('select');
    select.dataset.option = key;
    select.className = 's3-control';
    for (const value of values) {
      const option = document.createElement('option');
      option.value = option.textContent = value;
      select.append(option);
    }
    select.addEventListener('change', () => {
      config = { ...config, [key]: select.value };
      sync();
    });
    label.append(select);
    controls.append(label);
  }
  selectControl('orientation', ['horizontal', 'vertical']);
  selectControl('activationMode', ['automatic', 'manual']);
  const actions: Record<string, { label: string; run: () => void }> = {
    keepMounted: {
      label: 'keepMounted',
      run() {
        config.keepMounted = !config.keepMounted;
        sync();
      },
    },
    loop: {
      label: 'loop',
      run() {
        config.loop = !config.loop;
        sync();
      },
    },
    scheme: {
      label: 'light / dark',
      run() {
        const doc = document.documentElement;
        const dark = !(doc.dataset.theme === 'dark' || doc.classList.contains('dark'));
        doc.dataset.theme = dark ? 'dark' : 'light';
        doc.classList.toggle('dark', dark);
        doc.classList.toggle('light', !dark);
      },
    },
    checked: {
      label: 'checked',
      run() {
        rows.forEach((r) => r.toggle());
      },
    },
    disabled: {
      label: 'disabled',
      run() {
        disabled = !disabled;
        sync();
      },
    },
    tone: {
      label: 'Badge tone',
      run() {
        tone = (tone + 1) % tones.length;
        sync();
      },
    },
    slot: {
      label: zh ? '替换 slot' : 'Replace slots',
      run() {
        longSlot = !longSlot;
        rows.forEach((r) => r.slots());
      },
    },
    move: {
      label: zh ? '同步移动' : 'Move synchronously',
      run() {
        moved = !moved;
        if (!disconnected) rows.forEach((r) => (moved ? r.destination : r.home).append(r.root));
      },
    },
    disconnect: {
      label: zh ? '移除 / 重连' : 'Remove / reconnect',
      run() {
        disconnected = !disconnected;
        rows.forEach((r) => {
          if (disconnected) r.root.remove();
          else {
            r.sync();
            (moved ? r.destination : r.home).append(r.root);
          }
        });
      },
    },
  };
  for (const [key, action] of Object.entries(actions)) {
    const control = document.createElement('button');
    control.className = 's3-control';
    control.dataset.action = key;
    control.textContent = action.label;
    control.addEventListener('click', () => {
      action.run();
      if (['keepMounted', 'loop', 'disabled', 'slot', 'move', 'disconnect'].includes(key))
        control.setAttribute(
          'aria-pressed',
          String(control.getAttribute('aria-pressed') !== 'true')
        );
    });
    controls.append(control);
  }
  section.dataset.ready = 'true';
  return {
    rows,
    set(next: Partial<typeof config>) {
      config = { ...config, ...next };
      sync();
    },
    select(value: string) {
      rows.forEach((r) => r.select(value));
    },
    action(key: string) {
      actions[key].run();
    },
    dispose() {
      rows.forEach((r) => r.root.remove());
      app.replaceChildren();
      delete section.dataset.ready;
    },
  };
}
