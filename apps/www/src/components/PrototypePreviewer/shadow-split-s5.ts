import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import input from '@proto.ui/prototypes-base/input';
import baseTextarea from '@proto.ui/prototypes-base/textarea';
import textarea from '@proto.ui/prototypes-shadcn/textarea';
import { tabsRoot, tabsList, tabsTrigger, tabsContent } from '@proto.ui/prototypes-shadcn/tabs';
import { protoShadowStyleArtifact } from '../../styles/proto-ui-shadow-style.generated.js';

/** S5 consumer evidence. Models belong to the Maker, not the Adapter. */
export function mountShadowSplitS5(section: HTMLElement) {
  if (section.dataset.ready) return;
  section.dataset.ready = 'mounting';
  const app = section.querySelector<HTMLElement>('[data-s5-app]')!;
  const zh = section.dataset.lang !== 'en';
  let serial = 0;
  while (customElements.get(`pui-s5-light-input-${serial}`)) serial++;
  const controls = document.createElement('div');
  controls.className = 's5-controls';
  const columns = document.createElement('div');
  columns.className = 's5-columns';
  app.append(controls, columns);
  let disabled = false,
    readOnly = false,
    reject = false,
    keepMounted = false,
    custom = false;
  let rowsCount = 3,
    disconnected = false,
    revision = 0;
  const rows = (['light', 'split', 'mixed'] as const).map((profile) => {
    const card = document.createElement('article');
    card.dataset.s5Profile = profile;
    const title = document.createElement('h3');
    title.textContent = profile;
    const home = document.createElement('div');
    home.dataset.s5Home = '';
    const output = document.createElement('output');
    output.dataset.s5Stats = '';
    card.append(title, home, output);
    columns.append(card);
    const counts: Record<string, number> = {};
    const model: Record<string, string> = {
      input: 'Input',
      base: `Uncontrolled seed ${revision}`,
      styled: 'Shadcn\nTextarea',
      tab: 'Tabs editor',
    };
    const editors: Record<string, ReturnType<typeof make>> = {};
    function report() {
      output.textContent = JSON.stringify({ model, counts }, null, 2);
      card.dataset.model = JSON.stringify(model);
      card.dataset.counts = JSON.stringify(counts);
    }
    function make(key: string, proto: Parameters<typeof AdaptToWebComponent>[0]) {
      const split =
        profile === 'split' ||
        (profile === 'mixed' && !['input', 'tabs', 'list', 'trigger-a', 'trigger-b'].includes(key));
      const C = AdaptToWebComponent(proto, {
        registerAs: `pui-s5-${profile}-${key}-${serial}`,
        shadow: split
          ? { mode: 'open', presentation: 'split', styleArtifact: protoShadowStyleArtifact }
          : false,
        diagnostics: {
          onLifecycleEvent(event) {
            if (key === 'base' && event.type === 'instance.setup.exit')
              model.base = `Uncontrolled seed ${revision}`;
            if (
              [
                'instance.setup.exit',
                'mount.mounted',
                'unmount.done',
                'instance.dispose.done',
              ].includes(event.type)
            ) {
              const k = `${key}:${event.type}`;
              counts[k] = (counts[k] ?? 0) + 1;
              queueMicrotask(report);
            }
          },
        },
      });
      const el = new C();
      el.dataset.s5Component = key;
      if (split) el.dataset.s5Split = '';
      return el;
    }
    function editor(
      key: string,
      proto: Parameters<typeof AdaptToWebComponent>[0],
      controlled: boolean
    ) {
      const host = make(key, proto);
      editors[key] = host;
      host.dataset.s5Controlled = String(controlled);
      for (const event of [
        'valueChange',
        'change',
        'compositionStart',
        'compositionUpdate',
        'compositionEnd',
      ]) {
        host.addEventListener(event, (e) => {
          counts[`${key}:${event}`] = (counts[`${key}:${event}`] ?? 0) + 1;
          if (event === 'valueChange') {
            const detail = (e as CustomEvent<{ value: string }>).detail;
            if (!controlled || !reject) {
              model[key] = detail.value;
              if (controlled) syncEditor(key);
            }
          }
          report();
        });
      }
      syncEditor(key);
      return host;
    }
    function syncEditor(key: string) {
      const el = editors[key];
      const controlled = el.dataset.s5Controlled === 'true';
      setElementProps(el, {
        ...(controlled ? { value: model[key] } : { defaultValue: `Uncontrolled seed ${revision}` }),
        ariaLabel: `${profile} ${key}`,
        placeholder: `${zh ? '请输入' : 'Enter text'} · ${revision}`,
        disabled,
        readOnly,
        ...(key === 'input' ? { inputMode: 'text', enterKeyHint: 'next' } : { rows: rowsCount }),
        surfaceClassName: custom ? 's5-maker-surface' : undefined,
        surfaceStyle: custom ? { color: 'rgb(109, 40, 217)' } : undefined,
      });
      el.update?.();
    }
    const headings = (text: string, node: HTMLElement) => {
      const label = document.createElement('p');
      label.className = 's5-label';
      label.textContent = text;
      home.append(label, node);
    };
    headings('Base Input · controlled', editor('input', input, true));
    headings('Base Textarea · uncontrolled', editor('base', baseTextarea, false));
    headings('Shadcn Textarea · controlled', editor('styled', textarea, true));
    const root = make('tabs', tabsRoot),
      list = make('list', tabsList);
    let selected = 'a';
    for (const value of ['a', 'b']) {
      const trigger = make(`trigger-${value}`, tabsTrigger);
      trigger.textContent = value === 'a' ? 'Editor' : 'Other';
      setElementProps(trigger, { value });
      list.append(trigger);
    }
    const panel = make('panel-a', tabsContent),
      other = make('panel-b', tabsContent);
    panel.append(editor('tab', textarea, true));
    other.textContent = zh
      ? '切回 Editor 检查值与生命周期。'
      : 'Return to Editor to check values and lifecycle.';
    root.append(list, panel, other);
    root.addEventListener('valueChange', (e) => {
      // Native text valueChange shares the event name; only the Tabs boundary owns selection.
      if (e.target !== root) return;
      selected = (e as CustomEvent<{ value: string }>).detail.value;
      syncTabs();
    });
    function syncTabs() {
      setElementProps(root, { value: selected });
      root.update?.();
      setElementProps(panel, { value: 'a', keepMounted });
      panel.update?.();
      setElementProps(other, { value: 'b', keepMounted });
      other.update?.();
    }
    function sync() {
      Object.keys(editors).forEach(syncEditor);
      syncTabs();
      report();
    }
    sync();
    headings('Tabs · controlled editor', root);
    return {
      card,
      home,
      editors,
      root,
      sync,
      report,
      select(value: string) {
        selected = value;
        syncTabs();
      },
    };
  });
  const sync = () => rows.forEach((row) => row.sync());
  const actions: Record<string, { label: string; run(): void }> = {
    disabled: {
      label: 'disabled',
      run() {
        disabled = !disabled;
        sync();
      },
    },
    readOnly: {
      label: 'readOnly',
      run() {
        readOnly = !readOnly;
        sync();
      },
    },
    reject: {
      label: zh ? '拒绝受控提案' : 'Reject controlled proposals',
      run() {
        reject = !reject;
      },
    },
    keepMounted: {
      label: 'keepMounted',
      run() {
        keepMounted = !keepMounted;
        sync();
      },
    },
    rows: {
      label: 'rows 3 / 6',
      run() {
        rowsCount = rowsCount === 3 ? 6 : 3;
        sync();
      },
    },
    patch: {
      label: zh ? '无关 props 更新' : 'Unrelated props update',
      run() {
        revision++;
        sync();
      },
    },
    custom: {
      label: 'surface customization',
      run() {
        custom = !custom;
        sync();
      },
    },
    theme: {
      label: 'light / dark',
      run() {
        const dark = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', dark);
        document.documentElement.classList.toggle('light', !dark);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      },
    },
    disconnect: {
      label: zh ? '移除 / 重连' : 'Remove / reconnect',
      run() {
        disconnected = !disconnected;
        rows.forEach((row) => {
          if (disconnected) row.home.remove();
          else {
            row.sync();
            row.card.insertBefore(row.home, row.card.querySelector('output'));
          }
        });
      },
    },
  };
  for (const [key, action] of Object.entries(actions)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.s5Action = key;
    button.textContent = action.label;
    button.addEventListener('click', () => {
      action.run();
      if (!['patch', 'rows'].includes(key))
        button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
    });
    controls.append(button);
  }
  section.dataset.ready = 'true';
  return {
    rows,
    action(key: string) {
      actions[key].run();
    },
    dispose() {
      rows.forEach((row) => row.home.remove());
      app.replaceChildren();
      delete section.dataset.ready;
    },
  };
}
