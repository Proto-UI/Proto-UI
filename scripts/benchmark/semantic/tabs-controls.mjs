import { createHash } from 'node:crypto';

// Public hand-authored measurement controls. Not Proto output or model submissions.
// No imports from the evaluator or product; IDs deliberately vary with the seed.
export function tabsControl({ seed = 'control', variant = 'wrapped', mutation = null } = {}) {
  const token = createHash('sha256').update(seed).digest('hex').slice(0, 12);
  const names = ['Overview', 'Unavailable', 'Details', 'History'];
  const tag = variant === 'generic' ? 'div' : 'button';
  const detached = variant === 'detached';
  const panelRole =
    variant === 'role-list'
      ? 'tabpanel region'
      : variant === 'role-fallback'
        ? 'unknown-role tabpanel region'
        : mutation === 'role-conflict'
          ? 'region tabpanel'
          : 'tabpanel';
  const ids = names.map((_, i) => `a-${token}-${i}`);
  const panelIds = names.map((_, i) => `b-${token}-${i}`);
  const labelIds = names.map((_, i) => `c-${token}-${i}`);
  const tabs = names
    .map((name, i) => {
      const disabled = i === 1;
      const label = variant === 'labelled' ? `aria-labelledby="${labelIds[i]}"` : '';
      const text = variant === 'labelled' ? `<span id="${labelIds[i]}">${name}</span>` : name;
      const stop = i === 0 || (disabled && variant === 'native-zero') ? 0 : -2;
      return `<span class="wrap"><${tag} role="tab" id="${ids[i]}" ${label}
      aria-selected="${i === 0}" aria-controls="${panelIds[i]}" tabindex="${stop}"
      ${disabled ? 'aria-disabled="true"' : ''} ${disabled && tag === 'button' ? 'disabled' : ''}>${text}</${tag}></span>`;
    })
    .join('');
  const panels = names
    .map(
      (name, i) => `<article data-panel role="${panelRole}" id="${panelIds[i]}"
    aria-labelledby="${ids[i]}" tabindex="0" ${i ? 'hidden' : ''}>${name} content</article>`
    )
    .join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Independent public Tabs control</title>
    <style>body{font:16px system-ui;margin:30px} [role=tab]{display:inline-block;padding:12px;margin:4px;border:1px solid}
      [data-panel]{padding:24px;border:1px solid} [hidden]{display:none!important} :focus-visible{outline:3px solid blue}
      [aria-selected=true]{background:#ddf}</style>
    <h1>Public measurement control, not a model result</h1>
    <div data-owner="${token}"><div><div role="tablist" aria-label="Reference sections" aria-orientation="horizontal">${tabs}</div></div>
    <div data-panels>${panels}</div></div>
    <button data-remove>Remove reference fixture</button><button data-after>After fixture</button>
    <script>
    (() => {
      const owner = document.querySelector('[data-owner]');
      const tabs = [...owner.querySelectorAll('[role=tab]')];
      const enabled = tabs.filter(t => t.getAttribute('aria-disabled') !== 'true');
      const panels = [...owner.querySelectorAll('[data-panel]')];
      const box = owner.querySelector('[data-panels]');
      const mutation = ${JSON.stringify(mutation)};
      const detached = ${JSON.stringify(detached)};
      let selected = tabs[0];
      function focus(t) {
        tabs.forEach(n => n.tabIndex = n === t ? 0 : -2);
        t.focus();
        if (mutation === 'escaped-focus') document.querySelector('[data-after]').focus();
      }
      function select(t) {
        if (t.getAttribute('aria-disabled') === 'true' && mutation !== 'disabled-activation') return;
        selected = t;
        tabs.forEach(n => n.setAttribute('aria-selected', String(n === t)));
        const index = tabs.indexOf(t);
        if (detached) { box.replaceChildren(panels[index].cloneNode(true)); box.firstElementChild.hidden = false; }
        else panels.forEach((p, i) => p.hidden = i !== index);
        focus(t);
        if (mutation === 'extra-panel') panels[0].hidden = false;
        if (mutation === 'duplicate-on-repeat' && index === 2) box.append(panels[index].cloneNode(true));
      }
      if (detached) { box.replaceChildren(panels[0]); }
      for (const t of tabs) {
        t.addEventListener('click', () => select(t));
        t.addEventListener('keydown', e => {
          if (t.getAttribute('aria-disabled') === 'true') return;
          const i = enabled.indexOf(t);
          const targets = { ArrowRight: enabled[(i+1)%enabled.length], ArrowLeft: enabled[(i-1+enabled.length)%enabled.length], Home: enabled[0], End: enabled.at(-1) };
          if (targets[e.key]) { e.preventDefault(); focus(targets[e.key]); if (mutation === 'navigation-selects') select(targets[e.key]); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (mutation !== 'missing-key-activation') select(t); }
        });
      }
      document.querySelector('[data-remove]').onclick = () => {
        if (mutation !== 'broken-cleanup') owner.remove();
        if (${JSON.stringify(variant === 'focus-after-removal')}) document.querySelector('[data-after]').focus();
      };
      if (mutation === 'cleanup-keyboard-trap') document.querySelector('[data-remove]').addEventListener('keydown', e => { if (e.key === 'Tab') e.preventDefault(); });
      if (mutation === 'duplicate-list') document.body.append(owner.querySelector('[role=tablist]').cloneNode(true));
      if (mutation === 'missing-name') tabs[2].textContent = '';
      if (mutation === 'dangling-selected') tabs[0].setAttribute('aria-controls', 'absent-' + Math.random());
      if (mutation === 'cross-relationships') tabs[0].setAttribute('aria-controls', panels[2].id);
      if (mutation === 'missing-panel-label') panels[0].removeAttribute('aria-labelledby');
      if (mutation === 'disabled-activation') { tabs[1].removeAttribute('disabled'); }
      if (mutation === 'multiple-tab-stops') tabs[2].tabIndex = 0;
    })();
    </script></html>`;
}
