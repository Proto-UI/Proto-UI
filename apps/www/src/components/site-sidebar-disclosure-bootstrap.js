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
 * Native details owns activation. This owner stores only committed manual state.
 * The resource runs before the rendered groups, so the stored manual expansion
 * and the legacy session state reach every group while it is still parsed and
 * no painted frame can show an unrelated disclosure state. */
(() => {
  const script = document.currentScript;
  const root = script?.parentElement;
  const view = root?.ownerDocument.defaultView;
  if (!root || !view) return;
  const ownerDocument = root.ownerDocument;
  const leaseKey = Symbol.for('proto-ui.site-sidebar-disclosure.v1');
  if (root[leaseKey]) return;
  const identities = JSON.parse(script.dataset.sidebarIdentities || 'null');
  const managed = JSON.parse(script.dataset.sidebarManaged || 'null');
  const rendered = root.querySelectorAll('.top-level details').length;
  if (
    !Array.isArray(identities) ||
    identities.some((id) => typeof id !== 'string') ||
    new Set(identities).size !== identities.length ||
    !Array.isArray(managed) ||
    managed.length !== identities.length ||
    managed.some((value) => typeof value !== 'boolean') ||
    (rendered > 0 && rendered !== identities.length)
  )
    throw new Error('Sidebar identity/rendered group mismatch');
  const storageKey = 'proto-ui.sidebar.manual.v1';
  const limit = 65_536;
  const known = new Set(identities.filter((id, index) => managed[index]));
  const manual = Object.create(null);
  const pending = new Map();
  const settled = new Set();
  const applied = new WeakSet();
  const legacyApplied = new WeakSet();
  let alive = true;
  let epoch = 0;
  let intervened = false;
  let route = view.location.pathname;
  let groups = [];
  let observer = null;
  let completed = false;
  let legacy = null;
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
  function readLegacy() {
    legacy = null;
    try {
      if (!view.matchMedia('(min-width: 50em)').matches) return;
      const state = JSON.parse(view.sessionStorage.getItem('sl-sidebar-state') || '0');
      if (!state || state.hash !== root.dataset.hash) return;
      legacy = state;
    } catch {
      /* Same optional legacy session behavior; leave native defaults. */
    }
  }
  // One legacy group per rendered group, applied while that group is parsed.
  // The restore point is the first child, so a group without it is retried.
  function applyLegacy(element) {
    if (legacyApplied.has(element)) return;
    const point = element.querySelector('sl-sidebar-restore');
    if (!point) return;
    legacyApplied.add(element);
    const originalIndex = Number.parseInt(point.dataset.index || '', 10);
    const open = legacy && Array.isArray(legacy.open) ? legacy.open[originalIndex] : undefined;
    if (typeof open === 'boolean') element.open = open;
  }
  function restoreLegacyScroll() {
    try {
      const scroller = ownerDocument.getElementById('starlight__sidebar');
      if (legacy?.scroll && scroller) scroller.scrollTop = legacy.scroll;
    } catch {
      /* Same optional legacy session behavior; leave native defaults. */
    }
  }
  // The initial application runs while the groups are parsed. A managed group
  // is authored collapsed, so its server-rendered open attribute marks the
  // current ancestry until the current link of that group is parsed.
  function applyGroup(element, index, force) {
    if (index >= identities.length) return;
    const id = identities[index];
    if (force || !applied.has(element)) {
      applied.add(element);
      element.dataset.siteSidebarGroup = id;
      element.dataset.siteSidebarManaged = String(managed[index]);
      if (managed[index]) {
        const current =
          !!element.querySelector('a[aria-current="page"]') ||
          (!force && element.hasAttribute('open'));
        element.open = current || manual[id] === true;
      }
    }
    if (!managed[index]) applyLegacy(element);
  }
  function applyAll(force = false) {
    if (!alive) return;
    groups = [...root.querySelectorAll('.top-level details')];
    for (let index = 0; index < groups.length; index++) applyGroup(groups[index], index, force);
  }
  // The rendered groups arrive after this resource, so the policy applies each
  // group as the parser inserts it. Every painted frame then already carries
  // the stored manual expansion instead of an unrelated disclosure state.
  function observe() {
    if (!view.MutationObserver) return;
    observer = new view.MutationObserver(() => {
      if (!alive) return;
      applyAll();
    });
    observer.observe(root, { childList: true, subtree: true });
  }
  function cancelPending() {
    for (const intent of pending.values()) view.clearTimeout(intent.timer);
    pending.clear();
  }
  // The policy is applied once the rendered groups are complete. A group count
  // that never matches the authored identities is a hard authoring mismatch.
  function complete() {
    if (!alive || completed) return;
    applyAll();
    if (root.querySelectorAll('.top-level details').length !== identities.length) {
      if (ownerDocument.readyState === 'loading') return;
      throw new Error('Sidebar identity/rendered group mismatch');
    }
    completed = true;
    epoch++;
    cancelPending();
    intervened = false;
    root.dataset.siteSidebarPolicyEpoch = String(epoch);
    root.dataset.siteSidebarPolicyRoute = view.location.pathname;
    restoreLegacyScroll();
    observer?.disconnect();
    observer = null;
    notifySettled('settled');
  }
  function enter() {
    epoch++;
    cancelPending();
    intervened = false;
    route = view.location.pathname;
    applyAll(true);
    root.dataset.siteSidebarPolicyEpoch = String(epoch);
    root.dataset.siteSidebarPolicyRoute = view.location.pathname;
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
    const index = groups.indexOf(group);
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
    observer?.disconnect();
    observer = null;
    ownerDocument.removeEventListener('DOMContentLoaded', complete);
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
  readLegacy();
  observe();
  applyAll();
  complete();
  if (!completed && ownerDocument.readyState === 'loading')
    ownerDocument.addEventListener('DOMContentLoaded', complete, { once: true });
  root.addEventListener('click', click);
  ownerDocument.addEventListener('astro:page-load', pageLoad);
  ownerDocument.addEventListener('astro:before-swap', dispose);
  view.addEventListener('pageshow', pageShow);
})();
