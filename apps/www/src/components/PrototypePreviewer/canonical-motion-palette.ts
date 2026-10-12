import type { ResidentMotionPaletteSource } from '@proto.ui/adapter-base';
import type { MotionRgba } from '@proto.ui/module-feedback';
import { SHADCN_MOTION_PALETTE } from '../../generated/shadcn-motion-palette';
/** Compare declared theme inputs only to establish the generated source's authority.
 * No computed component paint is parsed into target semantics. Unknown overrides settle. */
export function createCanonicalMotionPalette(surface: HTMLElement): ResidentMotionPaletteSource {
  const doc = surface.ownerDocument,
    win = doc.defaultView;
  let revision = 0,
    signature = '';
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
  function ancestors() {
    const list: Element[] = [];
    let node: Element | null = surface;
    while (node) {
      list.push(node);
      const root = node.getRootNode();
      node = node.parentElement ?? ('host' in root ? (root as ShadowRoot).host : null);
    }
    return list;
  }
  function mode(): 'light' | 'dark' {
    for (const node of ancestors()) {
      if (node.getAttribute('data-theme') === 'dark' || node.classList.contains('dark'))
        return 'dark';
      if (node.getAttribute('data-theme') === 'light' || node.classList.contains('light'))
        return 'light';
    }
    return win?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  const source: ResidentMotionPaletteSource = {
    current() {
      const selected = mode(),
        facts = SHADCN_MOTION_PALETTE[selected];
      const computed = win?.getComputedStyle(surface);
      const colors: Record<string, MotionRgba> = {},
        diagnostics: string[] = [];
      for (const [role, color] of Object.entries(facts.colors)) {
        const expected = facts.expectedInputs[role as keyof typeof facts.expectedInputs];
        const observed = computed?.getPropertyValue('--pui-' + role) ?? '';
        if (expected && normalize(observed) === normalize(expected))
          colors[role] = color as unknown as MotionRgba;
        else diagnostics.push(`theme-source-mismatch:${role}`);
      }
      const next = JSON.stringify([
        SHADCN_MOTION_PALETTE.sourceHash,
        selected,
        colors,
        diagnostics,
      ]);
      if (next !== signature) {
        signature = next;
        revision++;
      }
      return { revision, colors: Object.freeze(colors), diagnostics: Object.freeze(diagnostics) };
    },
    subscribe(invalidate) {
      if (!win) return () => {};
      // Events cover ordinary source revision changes. Silent CSSOM changes are
      // validated by current() at the next target and every active animation frame.
      // Settled colors release their inline lease, so idle CSS remains authoritative.
      let active = true;
      const notify = () => {
        if (!active) return;
        const before = revision;
        source.current();
        if (revision !== before) invalidate();
      };
      const observer =
        typeof win.MutationObserver === 'function' ? new win.MutationObserver(notify) : null;
      for (const node of ancestors())
        observer?.observe(node, {
          attributes: true,
          attributeFilter: ['class', 'style', 'data-theme'],
        });
      if (doc.head)
        observer?.observe(doc.head, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['href', 'media', 'disabled'],
        });
      const media = win.matchMedia?.('(prefers-color-scheme: dark)');
      media?.addEventListener?.('change', notify);
      doc.addEventListener('pui-theme-change', notify);
      return () => {
        active = false;
        observer?.disconnect();
        media?.removeEventListener?.('change', notify);
        doc.removeEventListener('pui-theme-change', notify);
      };
    },
  };
  return source;
}
