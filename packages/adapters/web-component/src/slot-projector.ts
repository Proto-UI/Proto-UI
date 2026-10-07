// packages/adapters/web-component/src/slot-projector.ts

import { isOwnedVisualNode } from './visual-surface';

export class SlotProjector {
  private el: HTMLElement;

  // 每次 commit 都会换新的 WeakSet（不要复用老的，否则没法“清掉”旧 owned 节点）
  owned: WeakSet<Node> = new WeakSet<Node>();

  // 当前被投影进去的节点（外部节点）
  projected: Node[] = [];

  // light slot anchors（空 Text）
  slotStart: Text | null = null;
  slotEnd: Text | null = null;

  private mo: MutationObserver | null = null;
  private suppress = 0;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  disconnect() {
    this.mo?.disconnect();
    this.mo = null;
    this.slotStart = null;
    this.slotEnd = null;
  }

  /** rebuild 前：收集并“保住”外部节点 */
  collectSlotPoolBeforeCommit(): Node[] {
    // Snapshot before detaching anything: observer delivery may lag a caller
    // removal, reparent, prepend or reorder. Only a no-slot commit parks nodes.
    const candidates = new Set<Node>();
    for (const node of this.projected) {
      if (this.el.contains(node) || (!this.slotEnd && !node.parentNode)) candidates.add(node);
    }
    for (const node of Array.from(this.el.childNodes)) {
      if (!this.owned.has(node) && !isOwnedVisualNode(this.el, node)) candidates.add(node);
    }
    const roots = [...candidates].filter((node) => {
      for (let parent = node.parentNode; parent && parent !== this.el; parent = parent.parentNode) {
        if (candidates.has(parent)) return false;
      }
      return true;
    });
    const parked = roots.filter((node) => !this.el.contains(node));
    const live = roots.filter((node) => this.el.contains(node));
    live.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const pool = [...parked, ...live];
    for (const node of pool) node.parentNode?.removeChild(node);
    return pool;
  }

  /** rebuild 后：更新 anchors / owned / projected，并启动 MO */
  afterCommit(args: {
    owned: WeakSet<Node>;
    slotStart?: Text;
    slotEnd?: Text;
    projected: Node[];
    enableMO: boolean;
  }) {
    this.owned = args.owned;
    this.slotStart = args.slotStart ?? null;
    this.slotEnd = args.slotEnd ?? null;
    this.projected = args.projected;

    if (!args.enableMO) {
      this.disconnect();
      return;
    }

    if (!this.mo) {
      this.mo = new MutationObserver((muts) => this.onMutations(muts));
      // subtree 需要 true：用户可能 remove 掉已经在内部 div 的投影节点
      this.mo.observe(this.el, { childList: true, subtree: true });
    }
  }

  private onMutations(muts: MutationRecord[]) {
    if (this.suppress) return;
    if (!this.slotEnd) return;

    // 1) 把 direct children 上新加的“非 owned”节点投影进去
    const toMove: Node[] = [];
    for (const m of muts) {
      if (m.type !== 'childList') continue;
      if (m.target !== this.el) continue; // 只处理 direct children 的新增
      for (const n of Array.from(m.addedNodes)) {
        if (this.owned.has(n) || isOwnedVisualNode(this.el, n)) continue;
        // Ignore nodes that are already projected in-place before slotEnd.
        // This prevents re-moving the same node and creating a mutation loop.
        if (!this.shouldMoveToSlot(n)) continue;
        toMove.push(n);
      }
    }

    if (toMove.length) {
      this.suppress++;
      try {
        const end = this.slotEnd!;
        const parent = end.parentNode;
        if (!parent) return;

        for (const n of toMove) {
          // n 目前是 el 的 direct child，移走
          if (n.parentNode === this.el) this.el.removeChild(n);

          parent.insertBefore(n, end);
          if (!this.projected.includes(n)) this.projected.push(n);
        }
      } finally {
        this.suppress--;
      }
    }

    // 2) 清理已被用户移除的投影节点（removeChild 可能发生在 subtree 内）
    if (this.projected.length) {
      this.projected = this.projected.filter((n) => !!n.parentNode);
    }
  }

  private shouldMoveToSlot(node: Node): boolean {
    const end = this.slotEnd;
    if (!end) return false;
    const slotParent = end.parentNode;
    if (!slotParent) return false;

    const fromHostDirectChild = node.parentNode === this.el;
    const alreadyInSlotParent = node.parentNode === slotParent;
    if (!fromHostDirectChild && !alreadyInSlotParent) return false;

    // If node is already before slotEnd in the same parent, it is already projected.
    if (alreadyInSlotParent) {
      const pos = node.compareDocumentPosition(end);
      const isBeforeEnd = (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      if (isBeforeEnd) return false;
    }

    return true;
  }
}
