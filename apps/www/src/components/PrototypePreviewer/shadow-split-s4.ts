import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  dialogRoot,
  dialogTrigger,
  dialogMask,
  dialogContent,
  dialogTitle,
  dialogDescription,
  dialogClose,
  dialogCloseIcon,
  dialogHeader,
  dialogFooter,
} from '@proto.ui/prototypes-shadcn/dialog';
import { protoShadowStyleArtifact } from '../../styles/proto-ui-shadow-style.generated.js';
import { mountShadowSplitS3 } from './shadow-split-s3';

// Maker composition only: official prototypes own focus, dismissal and presence.
// The model survives view teardown; descendant instances/native state need not.
export function mountShadowSplitS4(section: HTMLElement) {
  if (section.dataset.ready) return;
  section.dataset.ready = 'mounting';
  const zh = section.dataset.lang !== 'en';
  const app = section.querySelector<HTMLElement>('[data-s4-app]')!;
  let serial = 0;
  while (customElements.get(`pui-s4-light-root-${serial}`)) serial++;
  const rows = (['light', 'split', 'mixed'] as const).map((profile) => {
    const card = document.createElement('article');
    card.dataset.s4Card = profile;
    const heading = document.createElement('h3');
    heading.textContent = profile;
    const home = document.createElement('div'),
      destination = document.createElement('div');
    const output = document.createElement('output');
    output.dataset.s4Stats = '';
    card.append(heading, home, destination, output);
    app.append(card);
    const counts: Record<
      string,
      { setup: number; mount: number; unmount: number; dispose: number }
    > = {};
    const parts: Record<string, HTMLElement & { getExposes?(): any }> = {};
    let open = false,
      reject = false,
      moved = false,
      removed = false;
    const requests: Array<{ open: boolean; reason: string; focusReason: string }> = [];
    function report() {
      card.dataset.open = String(open);
      card.dataset.requests = JSON.stringify(requests);
      card.dataset.counts = JSON.stringify(counts);
      output.textContent =
        `open=${open} · requests=${requests.length} · last=${requests.at(-1)?.reason ?? '-'}\n` +
        `Content: ${JSON.stringify(counts.content)}`;
    }
    const prototypes = {
      root: dialogRoot,
      trigger: dialogTrigger,
      mask: dialogMask,
      content: dialogContent,
      title: dialogTitle,
      description: dialogDescription,
      close: dialogClose,
      icon: dialogCloseIcon,
      header: dialogHeader,
      footer: dialogFooter,
    };
    for (const [key, proto] of Object.entries(prototypes)) {
      counts[key] = { setup: 0, mount: 0, unmount: 0, dispose: 0 };
      const split =
        profile === 'split' ||
        (profile === 'mixed' && !['header', 'footer', 'title'].includes(key));
      const C = AdaptToWebComponent(proto, {
        registerAs: `pui-s4-${profile}-${key}-${serial}`,
        shadow: split
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
      el.dataset.s4Profile = profile;
      el.dataset.s4Part = key;
      if (split) el.dataset.s4Split = '';
      parts[key] = el;
    }
    parts.trigger.textContent = zh ? `打开 ${profile} 设置` : `Open ${profile} settings`;
    parts.title.textContent = `S4 ${profile} settings`;
    parts.description.textContent = zh
      ? '对比弹窗中的 Tabs 与设置控件。'
      : 'Compare Tabs and settings inside a Dialog.';
    parts.close.textContent = zh ? '关闭' : 'Close';
    const settingsSection = document.createElement('section');
    settingsSection.className = 's3 s4-settings';
    settingsSection.dataset.lang = zh ? 'zh' : 'en';
    const settingsApp = document.createElement('div');
    settingsApp.dataset.s3App = '';
    settingsSection.append(settingsApp);
    const settings = mountShadowSplitS3(settingsSection, { profiles: [profile], compact: true })!;
    function setOpen(next: boolean) {
      open = next;
      settings.rows.forEach((row) => row.sync());
      setElementProps(parts.root, { open });
      report();
    }
    parts.root.addEventListener('openChange', (event) => {
      const detail = (event as CustomEvent).detail;
      requests.push(detail);
      if (!reject || detail.open) setOpen(detail.open);
      report();
    });
    const tools = document.createElement('div');
    tools.className = 's4-tools';
    function control(parent: HTMLElement, key: string, label: string, run: () => void) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 's3-control';
      button.dataset.s4Action = key;
      button.textContent = label;
      button.addEventListener('click', run);
      parent.append(button);
      return button;
    }
    for (const [key, label] of [
      ['scheme', 'light / dark'],
      ['tone', 'Badge tone'],
      ['slot', zh ? '替换 slot' : 'Replace slots'],
      ['disabled', 'disabled'],
    ])
      control(tools, key, label, () => settings.action(key));
    control(tools, 'move', zh ? '同步移动 Root' : 'Move Root', () => {
      moved = !moved;
      (moved ? destination : home).append(parts.root);
    });
    control(tools, 'remove', zh ? '移除 Root' : 'Remove Root', () => {
      removed = true;
      parts.root.remove();
    });
    control(card, 'reconnect', zh ? '重连 Root' : 'Reconnect Root', () => {
      if (!removed) return;
      removed = false;
      // Maker deliberately reconnects closed; its settings model is retained.
      setOpen(false);
      (moved ? destination : home).append(parts.root);
    });
    const rejectLabel = document.createElement('label'),
      rejectInput = document.createElement('input');
    rejectInput.type = 'checkbox';
    rejectInput.dataset.s4Reject = '';
    rejectInput.addEventListener('change', () => {
      reject = rejectInput.checked;
    });
    rejectLabel.append(rejectInput, zh ? ' 拒绝关闭请求' : ' Decline close requests');
    tools.append(rejectLabel);
    parts.header.append(parts.title, parts.description);
    parts.footer.append(parts.close);
    parts.content.append(parts.header, settingsSection, tools, parts.footer, parts.icon);
    parts.root.append(parts.trigger, parts.mask, parts.content);
    setOpen(false);
    home.append(parts.root);
    return { card, parts, settings, requests, counts, setOpen };
  });
  section.dataset.ready = 'true';
  return {
    rows,
    dispose() {
      rows.forEach((r) => r.parts.root.remove());
      app.replaceChildren();
      delete section.dataset.ready;
    },
  };
}
