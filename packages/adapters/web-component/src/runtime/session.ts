import { runAllSteps as completeCleanup } from '@proto.ui/core/internal';
import type { RuntimeHost } from '@proto.ui/runtime';
import {
  withWebComponentCallerDomMove,
  withWebComponentOwnedRelocation,
} from '../owned-relocation';
import {
  createWebOwnedDecorationPortalGate,
  hasOwnedWebPresenceZeroOpacity,
} from '@proto.ui/adapter-base';
import type { OwnedDecorationBinding } from '@proto.ui/module-feedback';
import { equalOwnedTemplateBlueprint, type InstanceAssociations } from '@proto.ui/core';
import { createAdapterHost, createHostWiring } from '@proto.ui/adapter-base';
import type { Prototype, TemplateChildren } from '@proto.ui/core';
import { type RawPropsSource } from '@proto.ui/module-props';
import type { RuntimeCheckpoint, RuntimeLifecycleEvent } from '@proto.ui/runtime';
import { type PropsBaseType } from '@proto.ui/types';

import { commitChildren } from '../commit';
import { hasCurrentOwnedDecorationPaint } from '../owned-decoration';
import { SlotProjector } from '../slot-projector';
import { hasCurrentSplitSurfacePaint, hasOwnedSplitZeroOpacity } from '../shadow-split-effects';
import type { ShadowInnerSurface } from '../shadow-inner-surface';

type DecorationNodeRecord = {
  node: Node;
  parent: Node | null;
  decoration: boolean;
  text: string | null;
  splitChildren?: ChildNode[];
  splitAttributes?: string;
};

type DecorationTreeRecord = {
  nodes: DecorationNodeRecord[];
  splitRoot?: {
    children: ChildNode[];
    identity: readonly (string | null)[];
    document: Document;
  };
};

const SPLIT_SURFACE_ATTRIBUTES = [
  'part',
  'data-pui-split-surface',
  'aria-hidden',
  'inert',
  'hidden',
];

function captureSplitSurfaceIdentity(surface: HTMLElement) {
  return SPLIT_SURFACE_ATTRIBUTES.map((name) => surface.getAttribute(name));
}

// The effects owner publishes data-pui-split-surface="" while the commit that
// snapshotted the surface is still running. That owned marker is not an
// external blueprint edit. Any other attribute drift still rejects.
function sameSplitSurfaceIdentity(
  recorded: readonly (string | null)[],
  surface: HTMLElement
): boolean {
  return SPLIT_SURFACE_ATTRIBUTES.every((name, index) => {
    const live = surface.getAttribute(name);
    return (
      recorded[index] === live ||
      (name === 'data-pui-split-surface' && recorded[index] === null && live === '')
    );
  });
}

function hasCollapsedSplitTransform(
  computed: CSSStyleDeclaration | undefined,
  Matrix: typeof DOMMatrixReadOnly | undefined
): boolean {
  const transform = computed?.getPropertyValue('transform') ?? '';
  const matrix = /^matrix\(([^)]+)\)$/.exec(transform)?.[1].split(',').map(Number);
  // The admitted Root recipes translate or scale by a nonzero amount.
  if (matrix?.length === 6 && matrix.every(Number.isFinite)) {
    const [a, b, c, d] = matrix;
    if (a! * d! - b! * c! === 0) return true;
  }
  if (
    transform.startsWith('matrix3d(') &&
    Matrix &&
    Number.isNaN(new Matrix(transform).inverse().m11)
  )
    return true;
  const scale = computed?.getPropertyValue('scale') ?? '';
  return scale
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .some((axis) => Number.parseFloat(axis) === 0);
}

function isSplitNodeConcealed(node: Element, visibilityOwner?: HTMLElement): boolean {
  const style = (node as Element & ElementCSSInlineStyle).style;
  const view = node.ownerDocument.defaultView;
  const computed = view?.getComputedStyle(node);
  for (const declaration of [style, computed]) {
    if (
      declaration?.getPropertyValue('display') === 'none' ||
      (Number.parseFloat(declaration?.getPropertyValue('opacity') ?? '') === 0 &&
        !hasOwnedWebPresenceZeroOpacity(node) &&
        (declaration === style || !hasOwnedSplitZeroOpacity(node))) ||
      declaration?.getPropertyValue('content-visibility') === 'hidden'
    )
      return true;
  }
  if (hasCollapsedSplitTransform(computed, view?.DOMMatrixReadOnly)) return true;
  // The computed list normalizes zero percentages. A URL may contain the
  // same text, but only an actual opacity filter conceals the caller here.
  const filter = computed?.getPropertyValue('filter');
  if (
    filter?.includes('opacity(0)') &&
    filter
      .replace(/url\("(?:\\.|[^"\\])*"\)/g, '')
      .split(/\s+/)
      .includes('opacity(0)')
  )
    return true;
  if (!visibilityOwner) return false;
  const inlineVisibility = style?.getPropertyValue('visibility');
  if (inlineVisibility === 'hidden' || inlineVisibility === 'collapse') return true;
  const visibility = computed?.getPropertyValue('visibility');
  // An inherited hidden phase of the owner does not conceal its slot locally.
  return (
    (visibility === 'hidden' || visibility === 'collapse') &&
    visibility !== view?.getComputedStyle(visibilityOwner).getPropertyValue('visibility')
  );
}

function isSplitSlotPathConcealed(slot: Element, surface: HTMLElement, host: HTMLElement): boolean {
  if (isSplitNodeConcealed(slot, host)) return true;
  // The slot's own computed visibility includes inheritance. Layout and
  // paint on a wrapper can hide assigned content without changing that value.
  for (
    let wrapper = slot.parentElement;
    wrapper && wrapper !== surface;
    wrapper = wrapper.parentElement
  )
    if (isSplitNodeConcealed(wrapper)) return true;
  return false;
}

function isSplitDecorationLayoutHidden(leaf: HTMLElement, surface: HTMLElement): boolean {
  const view = leaf.ownerDocument.defaultView;
  if (!view) return false;
  for (let node: Element | null = leaf; node && node !== surface; node = node.parentElement)
    if (view.getComputedStyle(node).getPropertyValue('display') === 'none') return true;
  return false;
}

function hasSameChildren(parent: Node, expected: readonly ChildNode[]): boolean {
  const { childNodes } = parent;
  return (
    childNodes.length === expected.length &&
    expected.every((child, index) => childNodes[index] === child)
  );
}

type CallerSnapshot = { isCurrent(): boolean; restore(): void };

function captureCallerControlState(node: Element): CallerSnapshot {
  const document = node.ownerDocument;
  if (node.localName === 'select') {
    const select = node as HTMLSelectElement;
    const { value } = select;
    const options = Array.from(select.options, (option) => ({ option, selected: option.selected }));
    return {
      isCurrent: () =>
        select.value === value &&
        select.options.length === options.length &&
        options.every(
          ({ option, selected }, index) =>
            option === select.options[index] && option.selected === selected
        ),
      restore() {
        if (
          select.ownerDocument !== document ||
          select.options.length !== options.length ||
          !options.every(
            ({ option }, index) =>
              option.ownerDocument === document && select.options[index] === option
          )
        )
          return;
        for (const { option, selected } of options)
          if (option.selected !== selected) option.selected = selected;
      },
    };
  }
  const control = node as HTMLInputElement | HTMLTextAreaElement;
  const input = node.localName === 'input' ? (node as HTMLInputElement) : undefined;
  const { value, selectionStart, selectionEnd, selectionDirection } = control;
  const checked = input?.checked;
  const indeterminate = input?.indeterminate;
  const fileList = input?.files;
  // FileList can change in place, and value names only the first selected file.
  const files: readonly File[] | undefined = fileList ? Array.from(fileList) : undefined;
  return {
    isCurrent() {
      const currentFiles = input?.files;
      return (
        control.value === value &&
        control.selectionStart === selectionStart &&
        control.selectionEnd === selectionEnd &&
        control.selectionDirection === selectionDirection &&
        input?.checked === checked &&
        input?.indeterminate === indeterminate &&
        (!files ||
          (!!currentFiles &&
            currentFiles.length === files.length &&
            files.every((file, index) => currentFiles[index] === file)))
      );
    },
    restore() {
      if (control.ownerDocument !== document) return;
      if (input?.type === 'file') {
        const currentFiles = input.files;
        if (
          files &&
          (!currentFiles ||
            currentFiles.length !== files.length ||
            files.some((file, index) => currentFiles[index] !== file))
        ) {
          const transfer = new (document.defaultView?.DataTransfer ?? DataTransfer)();
          for (const file of files) transfer.items.add(file);
          input.files = transfer.files;
        }
      } else if (control.value !== value) control.value = value;
      if (input && checked !== undefined && input.checked !== checked) input.checked = checked;
      if (input && indeterminate !== undefined && input.indeterminate !== indeterminate)
        input.indeterminate = indeterminate;
      if (
        selectionStart !== null &&
        selectionEnd !== null &&
        (control.selectionStart !== selectionStart ||
          control.selectionEnd !== selectionEnd ||
          control.selectionDirection !== selectionDirection)
      )
        control.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? undefined);
    },
  };
}

function activeWithinOpenTree(root: Document | ShadowRoot): Element | null {
  let active = root.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

function captureSplitCallerSelection(
  host: HTMLElement,
  root: Document | ShadowRoot
): CallerSnapshot | undefined {
  const document = host.ownerDocument;
  const ownsNode = (node: Node | null) => node === document || node?.ownerDocument === document;
  const selectionRoot = root as (Document | ShadowRoot) & { getSelection?(): Selection | null };
  const read = () => selectionRoot.getSelection?.() ?? document.getSelection();
  const selection = read();
  if (!selection?.rangeCount) return;
  const ranges = Array.from({ length: selection.rangeCount }, (_, index) =>
    selection.getRangeAt(index)
  );
  if (!ranges.some((range) => range.intersectsNode(host))) return;
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
  const boundaries = ranges.map(({ startContainer, startOffset, endContainer, endOffset }) => ({
    startContainer,
    startOffset,
    endContainer,
    endOffset,
  }));
  return {
    isCurrent() {
      const current = read();
      return (
        host.ownerDocument === document &&
        host.getRootNode() === root &&
        !!current &&
        current.anchorNode === anchorNode &&
        current.anchorOffset === anchorOffset &&
        current.focusNode === focusNode &&
        current.focusOffset === focusOffset &&
        current.rangeCount === boundaries.length &&
        boundaries.every((before, index) => {
          const after = current.getRangeAt(index);
          return (
            after.startContainer === before.startContainer &&
            after.startOffset === before.startOffset &&
            after.endContainer === before.endContainer &&
            after.endOffset === before.endOffset
          );
        })
      );
    },
    restore() {
      if (
        host.ownerDocument !== document ||
        host.getRootNode() !== root ||
        !ownsNode(anchorNode) ||
        !ownsNode(focusNode) ||
        !boundaries.every(
          ({ startContainer, endContainer }) => ownsNode(startContainer) && ownsNode(endContainer)
        )
      )
        return;
      const current = read();
      if (!current || this.isCurrent()) return;
      if (boundaries.length === 1 && anchorNode && focusNode) {
        current.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
      } else {
        current.removeAllRanges();
        for (const boundary of boundaries) {
          const range = document.createRange();
          range.setStart(boundary.startContainer, boundary.startOffset);
          range.setEnd(boundary.endContainer, boundary.endOffset);
          current.addRange(range);
        }
      }
    },
  };
}

function captureSplitCallerProjection(
  host: HTMLElement,
  isCurrentPublication: () => boolean
): CallerSnapshot {
  const document = host.ownerDocument;
  const root = host.getRootNode() as Document | ShadowRoot;
  const canRestore = () =>
    host.ownerDocument === document && host.getRootNode() === root && isCurrentPublication();
  const active = activeWithinOpenTree(root);
  const activeBranch = root.activeElement;
  const callerOwnsFocus = !!activeBranch && activeBranch !== host && host.contains(activeBranch);
  const selection = captureSplitCallerSelection(host, root);
  const children = Array.from(host.childNodes);
  const content = children.map((node) => ({
    text: node.textContent,
    slot: node.nodeType === 1 ? (node as Element).getAttribute('slot') : null,
  }));
  // Snapshot light DOM edges parent first, including empty elements that can gain children.
  const parents: [Element, readonly ChildNode[]][] = [];
  const emptyChildren: readonly ChildNode[] = [];
  const textNodes: { node: Text; data: string }[] = [];
  const controls: { node: Element; state: CallerSnapshot }[] = [];
  let node: Node | null = host.firstChild;
  while (node && node !== host) {
    if (node.nodeType === 3) {
      const text = node as Text;
      textNodes.push({ node: text, data: text.data });
    } else if (node.nodeType === 1) {
      const element = node as Element;
      parents.push([element, element.firstChild ? Array.from(element.childNodes) : emptyChildren]);
      if (element.matches('input, textarea, select'))
        controls.push({ node: element, state: captureCallerControlState(element) });
    }
    if (node.firstChild) {
      node = node.firstChild;
      continue;
    }
    while (node && node !== host && !node.nextSibling) node = node.parentNode;
    node = node && node !== host ? node.nextSibling : null;
  }
  return {
    isCurrent() {
      if (host.ownerDocument !== document || host.getRootNode() !== root) return false;
      for (const [parent, children] of parents)
        if (!hasSameChildren(parent, children)) return false;
      return (
        (!callerOwnsFocus ||
          (host.getRootNode() === root && activeWithinOpenTree(root) === active)) &&
        (!selection || selection.isCurrent()) &&
        hasSameChildren(host, children) &&
        children.every(
          (node, index) =>
            node.textContent === content[index].text &&
            (node.nodeType === 1 ? (node as Element).getAttribute('slot') : null) ===
              content[index].slot
        ) &&
        textNodes.every(({ node, data }) => node.data === data) &&
        controls.every(({ node, state }) => host.contains(node) && state.isCurrent())
      );
    },
    restore() {
      if (!canRestore()) return;
      if (
        !hasSameChildren(host, children) &&
        children.every((node) => node.ownerDocument === document)
      ) {
        withWebComponentOwnedRelocation(children, host, () =>
          withWebComponentCallerDomMove(children, () => host.replaceChildren(...children))
        );
      }
      for (const [parent, children] of parents) {
        if (!canRestore()) return;
        if (
          parent.ownerDocument === document &&
          host.contains(parent) &&
          children.every((node) => node.ownerDocument === document) &&
          !hasSameChildren(parent, children)
        )
          withWebComponentOwnedRelocation(children, parent, () =>
            withWebComponentCallerDomMove(children, () => parent.replaceChildren(...children))
          );
      }
      children.forEach((node, index) => {
        if (
          !canRestore() ||
          node.ownerDocument !== document ||
          !host.contains(node) ||
          node.nodeType !== 1
        )
          return;
        const element = node as Element;
        const { slot } = content[index]!;
        if (element.getAttribute('slot') === slot) return;
        if (slot === null) element.removeAttribute('slot');
        else element.setAttribute('slot', slot);
      });
      for (const { node, data } of textNodes) {
        if (!canRestore()) return;
        if (node.ownerDocument === document && host.contains(node) && node.data !== data)
          node.data = data;
      }
      if (!canRestore()) return;
      if (
        callerOwnsFocus &&
        active?.ownerDocument === document &&
        activeBranch?.ownerDocument === document &&
        host.contains(activeBranch) &&
        activeWithinOpenTree(root) !== active
      )
        (active as HTMLElement | null)?.focus({ preventScroll: true });
      for (const { node, state } of controls) {
        if (!canRestore()) return;
        if (node.ownerDocument === document && host.contains(node)) state.restore();
      }
      if (!selection || !canRestore() || !hasSameChildren(host, children)) return;
      // Focus/control reactions may have changed a captured relationship again.
      for (const [parent, children] of parents)
        if (
          parent.ownerDocument !== document ||
          !host.contains(parent) ||
          children.some((node) => node.ownerDocument !== document) ||
          !hasSameChildren(parent, children)
        )
          return;
      selection.restore();
    },
  };
}

function captureSplitAttributes(element: Element, decoration: boolean): string {
  // The decoration sink replaces paint while immutable attributes retain ownership.
  return JSON.stringify(
    Array.from(element.attributes)
      .filter(({ name }) => !decoration || (name !== 'style' && name !== 'data-pui-style'))
      .map(({ namespaceURI, name, value }) => [namespaceURI, name, value])
      .sort()
  );
}

export function createWebComponentHostSession<Props extends PropsBaseType>(args: {
  proto: Prototype<Props>;
  tagName: string;
  shadow: boolean;
  host: HTMLElement;
  root: Element | ShadowRoot;
  shadowViewTarget?: ShadowInnerSurface;
  schedule: (task: () => void) => void;
  rawPropsSource: RawPropsSource<Props>;
  getInstanceAssociations?: () => InstanceAssociations;
  viewOperations?: RuntimeHost<Props>['viewOperations'];
  textControlTarget: HTMLElement | null;
  imageViewTarget: HTMLImageElement | null;
  wiring: ReturnType<typeof createHostWiring>;
  eventGate: {
    enable(): void;
    disable(): void;
    dispose(): void;
  };
  router: {
    dispose(): void;
  };
  onLifecycleCheckpoint?: (cp: RuntimeCheckpoint) => void;
  onLifecycleEvent?: (event: RuntimeLifecycleEvent) => void;
  getSlotProjector: () => SlotProjector | null;
  ensureSlotProjector: () => SlotProjector;
  clearSlotProjector: () => void;
  /** Internal restoration notification. Must not throw; rejection preserves the original error. */
  onCallerProjectionRestored?: () => void;
  onAfterUnmount?: () => void;
  initialMount?: 'eager' | 'manual';
}): ReturnType<typeof createAdapterHost<Props>> & { host: HTMLElement } {
  const {
    proto,
    tagName,
    shadow,
    host,
    root,
    shadowViewTarget,
    schedule,
    rawPropsSource,
    wiring,
    textControlTarget,
    imageViewTarget,
    eventGate,
    router,
    onLifecycleCheckpoint,
    onLifecycleEvent,
    getSlotProjector,
    ensureSlotProjector,
    clearSlotProjector,
    onAfterUnmount,
    initialMount,
  } = args;

  let capsHub: any = null;
  let commitTurn = 0;
  let decorationCommit: {
    blueprint: TemplateChildren;
    lease: object;
    document: Document;
    tree: DecorationTreeRecord;
  } | null = null;
  const currentFeedback = () =>
    capsHub?.getPort?.('feedback') as import('@proto.ui/module-feedback').FeedbackPort | undefined;

  let portalDecorationGate: ReturnType<typeof createWebOwnedDecorationPortalGate> | null = null;
  // Stage split Template output without replacing owner-lived Shadow nodes.
  // Reuse the staging root; its live child list needs no intermediate copy.
  const shadowCommitRoot =
    shadowViewTarget && !textControlTarget ? root.ownerDocument.createDocumentFragment() : null;

  const splitSurface = shadowViewTarget?.element;
  const decorationRoot = splitSurface ?? root;
  const ownsDecorationRoot = () =>
    decorationRoot.isConnected && (!shadowViewTarget || decorationRoot.parentNode === root);
  const collectDecorationNodes = (source: Node, owned: WeakSet<Node>) => {
    const nodes: DecorationNodeRecord[] = [];
    const collect = (parent: Node) => {
      for (const node of Array.from(parent.childNodes)) {
        if (!owned.has(node)) continue;
        const element = node.nodeType === 1 ? (node as Element) : null;
        const decoration = element?.hasAttribute('data-pui-owned-decoration') ?? false;
        const record: DecorationNodeRecord = {
          node,
          parent: parent === source ? decorationRoot : parent,
          text: node.nodeType === 3 ? node.nodeValue : null,
          decoration,
        };
        nodes.push(record);
        collect(node);
      }
    };
    collect(source);
    return nodes;
  };
  const assertDecorationTree = (
    record: DecorationTreeRecord,
    document: Document,
    staging?: DocumentFragment
  ) => {
    const treeRoot = staging ?? decorationRoot;
    if (
      record.splitRoot &&
      (!splitSurface ||
        decorationRoot.ownerDocument !== record.splitRoot.document ||
        !hasSameChildren(treeRoot, record.splitRoot.children) ||
        !sameSplitSurfaceIdentity(record.splitRoot.identity, splitSurface) ||
        !hasCurrentSplitSurfacePaint(splitSurface) ||
        isSplitNodeConcealed(splitSurface, host))
    )
      throw new Error('[WC Adapter] decoration physical blueprint changed');
    for (const { node, parent, decoration, text, splitChildren, splitAttributes } of record.nodes) {
      if (
        node.ownerDocument !== document ||
        node.parentNode !== (parent === decorationRoot ? treeRoot : parent) ||
        !treeRoot.contains(node) ||
        (text !== null && node.nodeValue !== text) ||
        (splitChildren &&
          (!hasSameChildren(node, splitChildren) ||
            captureSplitAttributes(node as Element, decoration) !== splitAttributes))
      )
        throw new Error('[WC Adapter] decoration physical blueprint changed');
      if (
        !staging &&
        record.splitRoot &&
        splitSurface &&
        splitChildren &&
        (node as Element).localName === 'slot' &&
        isSplitSlotPathConcealed(node as Element, splitSurface, host)
      )
        throw new Error('[WC Adapter] decoration physical blueprint changed');
      if (decoration) {
        const leaf = node as HTMLElement;
        if (
          leaf.childNodes.length ||
          leaf.hasAttribute('tabindex') ||
          leaf.hasAttribute('contenteditable') ||
          !leaf.hasAttribute('data-pui-owned-decoration') ||
          leaf.getAttribute('aria-hidden') !== 'true' ||
          !leaf.hasAttribute('inert') ||
          (shadowViewTarget && !hasCurrentOwnedDecorationPaint(leaf)) ||
          (!staging && splitSurface && isSplitDecorationLayoutHidden(leaf, splitSurface)) ||
          leaf.style.getPropertyValue('pointer-events') !== 'none' ||
          leaf.style.getPropertyPriority('pointer-events') !== 'important'
        )
          throw new Error('[WC Adapter] decoration physical leaf changed');
      }
    }
  };
  const stageOwnedDecorations = (blueprint: TemplateChildren, turn: number) => {
    const feedback = currentFeedback();
    // Track the intended shape while creating nodes. Later constructors must
    // not be able to redefine an earlier sibling's physical blueprint.
    const splitRoot =
      splitSurface && feedback?.hasDecorationTargets?.()
        ? {
            identity: captureSplitSurfaceIdentity(splitSurface),
            document: splitSurface.ownerDocument,
          }
        : undefined;
    // A staged child may run a constructor or connected reaction. The
    // caller still owns this light-DOM sequence until acknowledgement.
    const callerProjection = splitRoot
      ? captureSplitCallerProjection(
          host,
          () =>
            turn === commitTurn &&
            ownsDecorationRoot() &&
            decorationRoot.ownerDocument === splitRoot.document &&
            currentFeedback() === feedback
        )
      : undefined;
    const restoreCallerProjection = (error: unknown) => {
      if (!callerProjection || callerProjection.isCurrent()) return;
      if (turn === commitTurn && ownsDecorationRoot()) {
        try {
          callerProjection.restore();
          if (
            turn === commitTurn &&
            ownsDecorationRoot() &&
            currentFeedback() === feedback &&
            callerProjection.isCurrent()
          )
            args.onCallerProjectionRestored?.();
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            error instanceof Error
              ? error.message
              : '[WC Adapter] decoration caller projection changed'
          );
        }
      }
    };
    const assertCallerProjection = () => {
      if (!callerProjection || callerProjection.isCurrent()) return;
      const error = new Error('[WC Adapter] decoration caller projection changed');
      restoreCallerProjection(error);
      throw error;
    };
    const stagedChildren = splitRoot ? new Map<Node, ChildNode[]>() : undefined;
    const stagedNodes: DecorationNodeRecord[] = [];
    const owned = new WeakSet<Node>();
    const lease = feedback?.captureDecorationLease?.();
    let boundLease: object | undefined;
    return {
      owned,
      recordStagedNode: stagedChildren
        ? (parent: Node, node: ChildNode) => {
            let children = stagedChildren.get(parent);
            if (!children) stagedChildren.set(parent, (children = []));
            children.push(node);
            const element = node.nodeType === 1 ? (node as Element) : null;
            const decoration = element?.hasAttribute('data-pui-owned-decoration') ?? false;
            const record: DecorationNodeRecord = {
              node,
              parent: parent === shadowCommitRoot ? decorationRoot : parent,
              decoration,
              text: node.nodeType === 3 ? node.nodeValue : null,
            };
            if (element) {
              record.splitChildren = Array.from(element.childNodes);
              record.splitAttributes = captureSplitAttributes(element, decoration);
              stagedChildren.set(element, record.splitChildren);
            }
            stagedNodes.push(record);
          }
        : undefined,
      bindDecorations(bindings: readonly OwnedDecorationBinding[]) {
        const overlay = capsHub?.getPort?.('overlay') as
          | import('@proto.ui/module-overlay').OverlayPort
          | undefined;
        const gate =
          bindings.length && overlay?.getConfig().portal
            ? createWebOwnedDecorationPortalGate(host, () => {
                try {
                  return feedback?.captureDecorationLease?.() === lease;
                } catch {
                  return false;
                }
              })
            : null;
        try {
          if (feedback?.bindDecorations)
            feedback.bindDecorations(
              gate
                ? bindings.map((binding) => ({
                    target: binding.target,
                    sink: gate.wrap(binding.sink),
                  }))
                : bindings,
              lease!
            );
          else if (bindings.length)
            throw new Error('[WC Adapter] owned-decoration binding unavailable');
          portalDecorationGate?.dispose();
          portalDecorationGate = gate;
          if (bindings.length) boundLease = lease;
        } catch (error) {
          gate?.dispose();
          throw error;
        }
      },
      restoreCallerProjection,
      captureSplitTree(staging: DocumentFragment): DecorationTreeRecord | undefined {
        if (!boundLease || !splitRoot || !stagedChildren) return;
        const staged = {
          nodes: stagedNodes,
          splitRoot: { ...splitRoot, children: stagedChildren.get(staging) ?? [] },
        };
        assertCallerProjection();
        assertDecorationTree(staged, splitRoot.document, staging);
        return staged;
      },
      recordCommit(staged?: DecorationTreeRecord) {
        if (!boundLease) return;
        if (currentFeedback()?.captureDecorationLease?.() !== boundLease)
          throw new Error('[WC Adapter] decoration lease changed during commit');
        if (
          turn !== commitTurn ||
          !ownsDecorationRoot() ||
          currentFeedback()?.captureDecorationLease?.() !== boundLease
        )
          throw new Error('[WC Adapter] decoration commit superseded');
        const document = decorationRoot.ownerDocument;
        if (staged) {
          assertCallerProjection();
          assertDecorationTree(staged, document);
        }
        decorationCommit = {
          blueprint,
          lease: boundLease,
          document,
          tree: staged ?? { nodes: collectDecorationNodes(decorationRoot, owned) },
        };
      },
    };
  };

  const commitWebComponentChildren = (children: TemplateChildren) => {
    const turn = ++commitTurn;
    if (decorationCommit) {
      const record = decorationCommit;
      if (
        currentFeedback()?.captureDecorationLease?.() !== record.lease ||
        decorationRoot.ownerDocument !== record.document ||
        !ownsDecorationRoot()
      )
        throw new Error('[WC Adapter] stale decoration blueprint lease');
      if (!equalOwnedTemplateBlueprint(record.blueprint, children))
        throw new Error('[feedback] decoration structural rebind unsupported');
      assertDecorationTree(record.tree, record.document);
      portalDecorationGate?.assertReusable();
      if (
        turn !== commitTurn ||
        decorationCommit !== record ||
        !ownsDecorationRoot() ||
        decorationRoot.ownerDocument !== record.document ||
        currentFeedback()?.captureDecorationLease?.() !== record.lease
      )
        throw new Error('[WC Adapter] decoration reuse superseded');
      return;
    }

    const nativeTarget = textControlTarget ?? imageViewTarget;
    if (nativeTarget) {
      const hasChildren = Array.isArray(children) ? children.length > 0 : children != null;
      if (hasChildren) {
        const role = textControlTarget ? 'text-control' : 'image-view';
        throw new Error(`[WC Adapter] ${role} prototypes must return empty Template children.`);
      }
      if (textControlTarget && shadowViewTarget) {
        if (!shadowViewTarget.hasOnlyRenderedNode(nativeTarget))
          shadowViewTarget.replaceRenderedChildren([nativeTarget]);
      } else if (root.firstChild !== nativeTarget || root.childNodes.length !== 1) {
        root.replaceChildren(nativeTarget);
      }
    } else if (shadow) {
      const decorations = shadowCommitRoot ? stageOwnedDecorations(children, turn) : null;
      try {
        commitChildren(shadowCommitRoot ?? root, children, {
          mode: 'shadow',
          owned: decorations?.owned,
          bindDecorations: decorations?.bindDecorations,
          recordStagedNode: decorations?.recordStagedNode,
        });
      } catch (error) {
        decorations?.restoreCallerProjection(error);
        throw error;
      }
      if (shadowCommitRoot && decorations) {
        const staged = decorations.captureSplitTree(shadowCommitRoot);
        shadowViewTarget!.replaceRenderedChildren(shadowCommitRoot.childNodes);
        decorations.recordCommit(staged);
      }
    } else if (isSlotOnly(children)) {
      const projector = getSlotProjector();
      if (projector) {
        // Preserve caller nodes before dropping the previous owned-node boundary.
        // An initial slot-only view has no projector and leaves its children alone.
        const slotPool = projector.collectSlotPoolBeforeCommit({ detach: false });
        withWebComponentOwnedRelocation(slotPool, root, () =>
          withWebComponentCallerDomMove(slotPool, () => root.replaceChildren(...slotPool))
        );
      }
    } else {
      const projector = getSlotProjector() ?? ensureSlotProjector();
      const slotPool = projector.collectSlotPoolBeforeCommit({ detach: false });
      const decorations = stageOwnedDecorations(children, turn);

      const result = commitChildren(root, children, {
        mode: 'light',
        slotPool,
        owned: decorations.owned,
        bindDecorations: decorations.bindDecorations,
      });

      // Preserve the established no-slot parking contract, but only after
      // staging and commit have succeeded. Rejected blueprints keep live nodes.
      if (!result.hasSlot) for (const node of slotPool) node.parentNode?.removeChild(node);

      projector.afterCommit({
        owned: decorations.owned,
        slotStart: result.slotStart,
        slotEnd: result.slotEnd,
        projected: slotPool,
        enableMO: result.hasSlot,
      });
      decorations.recordCommit();
      return;
    }
    clearSlotProjector();
  };

  const hostSession = createAdapterHost(
    { ...proto, name: tagName },
    {
      getRawProps: () => rawPropsSource.get() as Readonly<Props & PropsBaseType>,
      getInstanceAssociations: args.getInstanceAssociations,
      viewOperations: args.viewOperations,
      schedule,
      onLifecycleCheckpoint,
      onLifecycleEvent,
      commit: (children, signal) => {
        commitWebComponentChildren(children);
        eventGate.enable();
        signal?.done();
      },
    },
    {
      onRuntimeReady: (wiringApi) => {
        wiring.onRuntimeReady(wiringApi);
      },
      onUnmountBegin: () => {
        commitTurn++;
        decorationCommit = null;
        portalDecorationGate?.dispose();
        portalDecorationGate = null;
        eventGate.disable();
      },
      afterUnmount: () => {
        try {
          const port = (capsHub as any).getPort?.('test-sys');
          port?.trace?.('after-unmount');
        } catch {}

        // A readiness observer may throw while the view is released. Complete
        // the session tail too, preserving the original disposal failure.
        completeCleanup([
          () => wiring.afterUnmount(),
          () => eventGate.dispose(),
          () => router.dispose(),
          clearSlotProjector,
          () => onAfterUnmount?.(),
        ]);
      },
    },
    { initialMount: 'manual' }
  );

  capsHub = hostSession.caps;
  if (initialMount !== 'manual') void hostSession.mount();
  return { ...hostSession, host };
}

// WC-internal release fanout follows the acquired-owner convention in adapter-base.
// Track failure separately: JavaScript permits throwing undefined.
export { runAllSteps as completeCleanup } from '@proto.ui/core/internal';

function isSlotOnly(children: TemplateChildren): boolean {
  if (children == null) return false;

  const one = Array.isArray(children) ? (children.length === 1 ? children[0] : null) : children;
  if (!one || typeof one !== 'object') return false;

  const type = (one as any).type;
  return !!type && typeof type === 'object' && type.kind === 'slot';
}
