import type { StaticHitInset } from '@proto.ui/core';

const ATTRIBUTE = 'data-pui-static-hit';
let nextId = 0;

type Root = Document | ShadowRoot;
export type StaticHitInsetLease = {
  inset: StaticHitInset;
  root: Root;
  isOwned(): boolean;
  release(): void;
};

function styleRoot(target: HTMLElement): Root {
  const root = target.getRootNode();
  return root.nodeType === 11 && 'host' in root ? (root as ShadowRoot) : target.ownerDocument;
}

/** Preflight only. Never borrow an author's pseudo-element or change positioning. */
export function prepareStaticHitInset(
  target: HTMLElement,
  inset: StaticHitInset,
  previous?: StaticHitInsetLease
): () => StaticHitInsetLease {
  const view = target.ownerDocument.defaultView;
  if (!view) throw new Error('[HitParticipation] staticHitInset unsupported: no host style view.');
  if (previous && !previous.isOwned()) {
    throw new Error(
      '[HitParticipation] staticHitInset unsupported: host projection changed externally.'
    );
  }
  if (
    !view.CSS?.supports(
      'clip-path',
      'polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,1px 1px,1px 2px,2px 2px,2px 1px,1px 1px)'
    )
  ) {
    throw new Error(
      '[HitParticipation] staticHitInset unsupported: native inset-only hit ring is unavailable.'
    );
  }
  const computed = view.getComputedStyle(target);
  const position = computed.position;
  const replaced = new Set([
    'INPUT',
    'TEXTAREA',
    'SELECT',
    'IMG',
    'VIDEO',
    'AUDIO',
    'CANVAS',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'METER',
    'PROGRESS',
    'BR',
    'HR',
  ]);
  if (
    replaced.has(target.tagName) ||
    ![
      'block',
      'inline-block',
      'flex',
      'inline-flex',
      'grid',
      'inline-grid',
      'flow-root',
      'none',
    ].includes(computed.display)
  ) {
    throw new Error(
      '[HitParticipation] staticHitInset unsupported: a non-replaced single principal box is required.'
    );
  }
  if (!position || position === 'static') {
    throw new Error(
      '[HitParticipation] staticHitInset unsupported: root needs an existing positioned padding-box.'
    );
  }
  const root = styleRoot(target);

  const content =
    !previous || previous.root !== root ? view.getComputedStyle(target, '::after').content : 'none';
  if (content && content !== 'none' && content !== 'normal') {
    throw new Error('[HitParticipation] staticHitInset unsupported: author already owns ::after.');
  }
  if (!previous && target.hasAttribute(ATTRIBUTE)) {
    throw new Error(
      '[HitParticipation] staticHitInset unsupported: occupied host projection attribute.'
    );
  }
  return () => {
    const id = String(++nextId);
    const style = target.ownerDocument.createElement('style');
    const length = (side: keyof StaticHitInset) => `${inset[side].value}${inset[side].unit}`;
    const edge = (side: keyof StaticHitInset) => `${-inset[side].value}${inset[side].unit}`;
    const l = length('left'),
      t = length('top');
    const r = `calc(100% - ${length('right')})`,
      b = `calc(100% - ${length('bottom')})`;
    // The inset-only ring leaves the existing padding-box's descendants and
    // their native default actions untouched; never overlay a child control.
    const ring = `polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${l} ${t},${l} ${b},${r} ${b},${r} ${t},${l} ${t})`;
    // Empty and unpainted; native hit testing keeps clipping, stacking, pointer-events,
    // cancellation, focus defaults and event.target on the same semantic root.
    const text = `[${ATTRIBUTE}="${id}"]::after{all:initial!important;content:""!important;position:absolute!important;display:block!important;top:${edge('top')}!important;right:${edge('right')}!important;bottom:${edge('bottom')}!important;left:${edge('left')}!important;pointer-events:inherit!important;visibility:inherit!important;cursor:inherit!important;clip-path:${ring}!important;}`;
    style.textContent = text;
    (root.nodeType === 9 ? (root as Document).head : root).appendChild(style);
    target.setAttribute(ATTRIBUTE, id);
    const sheet = style.sheet;
    const ruleSnapshot = sheet
      ? Array.from(sheet.cssRules, (rule) => ({ rule, text: rule.cssText }))
      : [];
    const initialParent = style.parentNode;
    const initialRoot = style.getRootNode();
    const initialDisabled = Boolean(style.disabled);
    const initialSheetDisabled = Boolean(sheet?.disabled);
    const initialMedia = style.media;
    const initialSheetMedia = sheet?.media?.mediaText;
    const initialType = style.type;
    const ownsStyle = () => {
      try {
        const current = style.sheet;
        return (
          style.textContent === text &&
          style.isConnected &&
          style.parentNode === initialParent &&
          style.getRootNode() === initialRoot &&
          style.media === initialMedia &&
          style.type === initialType &&
          Boolean(style.disabled) === initialDisabled &&
          current === sheet &&
          Boolean(current?.disabled) === initialSheetDisabled &&
          current?.media?.mediaText === initialSheetMedia &&
          (!current ||
            (current.cssRules.length === ruleSnapshot.length &&
              ruleSnapshot.every(
                ({ rule, text }, index) => current.cssRules[index] === rule && rule.cssText === text
              )))
        );
      } catch {
        return false;
      }
    };
    return {
      inset,
      root,
      isOwned: () => target.getAttribute(ATTRIBUTE) === id && ownsStyle(),
      release() {
        if (target.getAttribute(ATTRIBUTE) === id) target.removeAttribute(ATTRIBUTE);
        // A host author who replaces a leased artifact owns its subsequent contents.
        if (ownsStyle()) style.remove();
      },
    };
  };
}

export function staticHitInsetRootChanged(
  target: HTMLElement,
  lease: StaticHitInsetLease
): boolean {
  return styleRoot(target) !== lease.root;
}
