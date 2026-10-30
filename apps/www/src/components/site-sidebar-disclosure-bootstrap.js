/* Compatibility portions adapted from @astrojs/starlight 0.35.3.
 * Source: https://github.com/withastro/starlight/tree/@astrojs/starlight@0.35.3/packages/starlight
 * MIT License
 *
 * Copyright (c) 2023 [Astro contributors](https://github.com/withastro/starlight/graphs/contributors)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/** This exact native JavaScript resource is injected with ?raw; it must never
 * pass through Function#toString or a generated/evaluated application function.
 * Native details owns activation. This owner stores only committed manual state. */
(() => {
  const script = document.currentScript;
  const root = script?.parentElement;
  const view = root?.ownerDocument.defaultView;
  if (!root || !view) return;
  const ownerDocument = root.ownerDocument;
  const leaseKey = Symbol.for('proto-ui.site-sidebar-disclosure.v1');
  if (root[leaseKey]) return;
  const identities = JSON.parse(script.dataset.sidebarIdentities || 'null');
  const details = [...root.querySelectorAll('.top-level details')];
  const managed = JSON.parse(script.dataset.sidebarManaged || 'null');
  if (
    !Array.isArray(managed) ||
    managed.length !== details.length ||
    managed.some((value) => typeof value !== 'boolean') ||
    !Array.isArray(identities) ||
    identities.some((id) => typeof id !== 'string') ||
    details.length !== identities.length ||
    new Set(identities).size !== identities.length
  )
    throw new Error('Sidebar identity/rendered group mismatch');
  const storageKey = 'proto-ui.sidebar.manual.v1';
  const limit = 65_536;
  const known = new Set(identities.filter((id, index) => managed[index]));
  const manual = Object.create(null);
  const pending = new Map();
  const settled = new Set();
  let alive = true;
  let epoch = 0;
  let intervened = false;
  let route = view.location.pathname;
  function read() {
    try {
      const raw = view.localStorage.getItem(storageKey);
      for (const key of Object.keys(manual)) delete manual[key];
      if (!raw || raw.length > limit) return;
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        parsed.version !== 1 ||
        !parsed.open ||
        typeof parsed.open !== 'object' ||
        Array.isArray(parsed.open)
      )
        return;
      const entries = Object.entries(parsed.open);
      if (
        entries.length > 256 ||
        entries.some(([key, open]) => key.length > 2048 || typeof open !== 'boolean')
      )
        return;
      for (const [key, open] of entries) if (known.has(key)) manual[key] = open;
    } catch {
      /* Optional storage; preserve native disclosure and local fallback. */
    }
  }
  // Starlight 0.35.3's existing module remains the only legacy session writer.
  // It may record UI indices too; this reader never applies them to managed UI.
  // Do not install SidebarPersister's global restore custom element: that would
  // restore every subtree and race this scoped localStorage owner.
  function restoreLegacy() {
    try {
      if (!view.matchMedia('(min-width: 50em)').matches) return;
      const state = JSON.parse(view.sessionStorage.getItem('sl-sidebar-state') || '0');
      if (!state || state.hash !== root.dataset.hash) return;
      if (Array.isArray(state.open))
        details.forEach((element, index) => {
          if (managed[index]) return;
          const point = element.querySelector('sl-sidebar-restore');
          const originalIndex = Number.parseInt(point?.dataset.index || '', 10);
          if (typeof state.open[originalIndex] === 'boolean')
            element.open = state.open[originalIndex];
        });
      const scroller = ownerDocument.getElementById('starlight__sidebar');
      if (state.scroll && scroller) scroller.scrollTop = state.scroll;
    } catch {
      /* Same optional legacy session behavior; leave native defaults. */
    }
  }
  function cancelPending() {
    for (const intent of pending.values()) view.clearTimeout(intent.timer);
    pending.clear();
  }
  function enter(restoreHistory = false) {
    epoch++;
    cancelPending();
    intervened = false;
    route = view.location.pathname;
    details.forEach((element, index) => {
      const id = identities[index];
      element.dataset.siteSidebarGroup = id;
      element.dataset.siteSidebarManaged = String(managed[index]);
      if (!managed[index]) return;
      element.open = !!element.querySelector('a[aria-current="page"]') || manual[id] === true;
    });
    root.dataset.siteSidebarPolicyEpoch = String(epoch);
    root.dataset.siteSidebarPolicyRoute = view.location.pathname;
    if (restoreHistory) restoreLegacy();
    notifySettled('settled');
  }
  function readIntent() {
    if (!alive || route !== view.location.pathname) return 'none';
    if (intervened) return 'manual';
    let unresolved = false;
    for (const [group, intent] of pending) {
      if (intent.event.defaultPrevented || intent.epoch !== epoch || !group.isConnected) continue;
      if (group.open !== intent.before) return 'manual';
      unresolved = true;
    }
    return unresolved ? 'pending' : 'none';
  }
  function notifySettled(status = 'settled') {
    if (pending.size) return;
    const callbacks = [...settled];
    settled.clear();
    const errors = [];
    for (const callback of callbacks) {
      try {
        callback(alive ? status : 'retired');
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, 'Sidebar layout settlement observers failed');
  }
  function click(event) {
    if (!alive || !event.isTrusted || !(event.target instanceof view.Element)) return;
    const group = event.target.closest('summary')?.parentElement;
    if (!(group instanceof view.HTMLDetailsElement) || !root.contains(group)) return;
    const index = details.indexOf(group);
    if (index < 0 || !managed[index]) return;
    const previous = pending.get(group);
    if (previous) view.clearTimeout(previous.timer);
    const intent = { before: group.open, event, epoch, timer: 0 };
    pending.set(group, intent);
    // One event completion task, not readiness polling; microtasks may precede
    // native default activation. No state is persisted or called manual early.
    intent.timer = view.setTimeout(() => {
      if (pending.get(group) !== intent) return;
      pending.delete(group);
      if (
        alive &&
        epoch === intent.epoch &&
        !event.defaultPrevented &&
        group.isConnected &&
        group.open !== intent.before
      ) {
        intervened = true;
        manual[identities[index]] = group.open;
        try {
          const value = JSON.stringify({ version: 1, open: manual });
          if (value.length <= limit) view.localStorage.setItem(storageKey, value);
        } catch {
          /* Native state and in-memory choice remain usable. */
        }
      }
      notifySettled();
    }, 0);
  }
  function pageLoad() {
    if (!alive || route === view.location.pathname) return;
    route = view.location.pathname;
    enter();
  }
  function pageShow(event) {
    if (alive && event.persisted) {
      read();
      enter();
    }
  }
  function dispose() {
    if (!alive) return;
    alive = false;
    epoch++;
    cancelPending();
    root.removeEventListener('click', click);
    ownerDocument.removeEventListener('astro:page-load', pageLoad);
    ownerDocument.removeEventListener('astro:before-swap', dispose);
    view.removeEventListener('pageshow', pageShow);
    delete root[leaseKey];
    notifySettled('retired');
  }
  root[leaseKey] = {
    dispose,
    readIntent,
    afterSettled(callback) {
      if (!alive) {
        callback('retired');
        return () => {};
      }
      if (readIntent() !== 'pending') {
        callback('settled');
        return () => {};
      }
      settled.add(callback);
      return () => settled.delete(callback);
    },
  };
  read();
  enter(true);
  root.addEventListener('click', click);
  ownerDocument.addEventListener('astro:page-load', pageLoad);
  ownerDocument.addEventListener('astro:before-swap', dispose);
  view.addEventListener('pageshow', pageShow);
})();
