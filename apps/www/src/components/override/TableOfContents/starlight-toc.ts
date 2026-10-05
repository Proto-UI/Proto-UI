import { PAGE_TITLE_ID } from '../../../constants';

/**
 * 计算 newArr 相对 oldArr 的成员变更（仅新增/减少，按 key 唯一）。
 * - 不关心次序与重复次数（同 key 视为同一成员）。
 * - keySelector 缺省时使用值本身做键（适合字符串/数字等原始类型）。
 */
export function diffBy<T, K = T>(
  oldArr: readonly T[],
  newArr: readonly T[],
  keySelector?: (item: T) => K
): { added: T[]; removed: T[] } {
  const getKey = keySelector ?? ((x: T) => x as unknown as K);

  // 构建 key -> item 映射；若数组中有重复 key，最后一次出现会覆盖之前的
  const oldMap = new Map<K, T>();
  for (const item of oldArr) oldMap.set(getKey(item), item);

  const newMap = new Map<K, T>();
  for (const item of newArr) newMap.set(getKey(item), item);

  const oldKeys = new Set(oldMap.keys());
  const newKeys = new Set(newMap.keys());

  const added: T[] = [];
  for (const k of newKeys) {
    if (!oldKeys.has(k)) added.push(newMap.get(k)!);
  }

  const removed: T[] = [];
  for (const k of oldKeys) {
    if (!newKeys.has(k)) removed.push(oldMap.get(k)!);
  }

  return { added, removed };
}

/** Current follows document heading geometry, never a projected child or a
 * large wrapper that happened to enter IntersectionObserver first. */
export function currentHeadingIndex(tops: readonly number[], viewportTop: number): number {
  if (tops.length === 0) return -1;
  for (let i = tops.length - 1; i >= 0; i--) {
    if (tops[i] <= viewportTop) return i;
  }
  return 0;
}

type VisibleSection = {
  id: string;
  heading: HTMLHeadingElement;
  link: HTMLAnchorElement;
};

export class StarlightTOC extends HTMLElement {
  private _current = this.querySelector<HTMLAnchorElement>('a[aria-current="true"]');
  private minH = parseInt(this.dataset.minH || '2', 10);
  private maxH = parseInt(this.dataset.maxH || '3', 10);

  /** ===== 新增：可见小节内部状态 ===== */
  private _headings: HTMLHeadingElement[] = [];
  private _links: HTMLAnchorElement[] = [];
  private _visible: VisibleSection[] = [];
  private _rafScheduled = false;
  private _rafId: number | undefined;
  private _idleId: number | undefined;
  private _idleUsesTimeout = false;
  private _initialized = false;
  private _observer: IntersectionObserver | undefined;
  private _resizeTimer: number | undefined;
  private _layoutObserver: ResizeObserver | undefined;
  private _highlight: HTMLElement | null = null;
  private _onLayout = () => this.scheduleVisibleUpdate();
  private _onScroll = () => this.scheduleVisibleUpdate();
  private _onResize = () => {
    this.collectHeadings();
    this.scheduleVisibleUpdate();
    this._observer?.disconnect();
    this._observer = undefined;
    window.clearTimeout(this._resizeTimer);
    this._resizeTimer = window.setTimeout(() => {
      this._resizeTimer = undefined;
      this.observeCurrent();
    }, 200);
  };

  /** 对外只读：当前“可见小节”列表（顺序按文档流） */
  public get visibleSections(): ReadonlyArray<VisibleSection> {
    return this._visible;
  }

  /** 对外事件：当可见小节变化时触发 */
  private emitVisibleChange() {
    this.dispatchEvent(
      new CustomEvent('toc:visible-sections', {
        detail: { sections: this._visible },
      })
    );
  }

  protected set current(link: HTMLAnchorElement) {
    if (link === this._current) return;
    if (this._current) this._current.removeAttribute('aria-current');
    link.setAttribute('aria-current', 'true');
    this._current = link;
  }

  connectedCallback() {
    if (this._initialized || this._idleId !== undefined) return;
    const initialize = () => {
      this._idleId = undefined;
      if (!this.isConnected || this._initialized) return;
      this._initialized = true;
      this.init();
    };
    this._idleUsesTimeout = !window.requestIdleCallback;
    this._idleId = this._idleUsesTimeout
      ? window.setTimeout(initialize, 1)
      : window.requestIdleCallback(initialize);
  }

  /** ===== 新增：收集参与 TOC 的 heading 与链接 ===== */
  private collectHeadings() {
    // 收集 TOC 中所有 a
    this._links = [...this.querySelectorAll('a')];

    // 动态构造 heading 选择器（包含 PAGE_TITLE_ID）
    const levels = Array.from({ length: this.maxH - this.minH + 1 }, (_, i) => this.minH + i);
    const sel = levels.map((n) => `main h${n}[id]`).join(',');
    const nodes = document.querySelectorAll<HTMLHeadingElement>(sel);

    const title = document.getElementById(PAGE_TITLE_ID);
    const list: HTMLHeadingElement[] = [];
    if (title instanceof HTMLHeadingElement) list.push(title);
    nodes.forEach((h) => list.push(h));

    // Only generated TOC destinations participate. Embedded component headings
    // (including hidden modal titles) do not own a reading-position link.
    const linkedHashes = new Set(this._links.map((link) => link.hash));
    // 去重并保持文档顺序
    const seen = new Set<string>();
    this._headings = list.filter((h) => {
      if (!h.id || seen.has(h.id) || !linkedHashes.has('#' + encodeURIComponent(h.id)))
        return false;
      seen.add(h.id);
      return true;
    });
  }

  /** ===== 新增：计算有效视口上下界（与 getRootMargin 同源） ===== */
  private getViewportBounds() {
    const navBarHeight = document.querySelector('header')?.getBoundingClientRect().height || 0;
    const mobileTocHeight = this.querySelector('summary')?.getBoundingClientRect().height || 0;
    const topPad = navBarHeight + mobileTocHeight + 32; // 与 getRootMargin 的 top 一致
    const bottomExtra = 53; // 与 getRootMargin 注释中的 “稍多于 markdown margin-top” 一致

    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const viewportTop = scrollTop + topPad;
    const viewportBottom = scrollTop + window.innerHeight - (bottomExtra - 0); // 保持同源余量

    return { top: viewportTop, bottom: viewportBottom };
  }

  /** ===== 新增：立即更新可见小节列表 ===== */
  // 新增：取 heading 的文档绝对 top
  private getHeadingTop(h: HTMLElement): number {
    const docTop = window.scrollY || document.documentElement.scrollTop || 0;
    const rect = h.getBoundingClientRect();
    return docTop + rect.top;
  }

  // 替换：用 [headingTop, nextHeadingTop) 区间判断“可见小节”
  private updateVisibleNow() {
    const { top: vpTop, bottom: vpBottom } = this.getViewportBounds();

    const heads = this._headings;
    const n = heads.length;
    if (n === 0) {
      if (this._visible.length) {
        this._visible = [];
        this.emitVisibleChange();
      }
      this.writeHighlight(null);
      return;
    }

    // 预先算好每个标题的绝对 top
    const tops = heads.map((h) => this.getHeadingTop(h));
    const currentHeading = heads[currentHeadingIndex(tops, vpTop)];
    const currentLink = this._links.find(
      (link) => link.hash === '#' + encodeURIComponent(currentHeading.id)
    );

    const next: VisibleSection[] = [];
    for (let i = 0; i < n; i++) {
      const h = heads[i];
      const start = tops[i];
      let end = i + 1 < n ? tops[i + 1] : Number.POSITIVE_INFINITY;
      if (end <= start) end = start + 1; // 防零/负区间的极端情况

      // 区间与视口相交：end > vpTop && start < vpBottom
      if (end > vpTop && start < vpBottom) {
        const hash = '#' + encodeURIComponent(h.id);
        const link = this._links.find((a) => a.hash === hash) as HTMLAnchorElement;
        next.push({ id: h.id, heading: h, link });
      }
    }

    // Finish the shared range reads before publishing current/in-view writes.
    // This adds at most three rect reads per existing TOC frame, not one per link.
    const geometry = this.readHighlight(next);
    if (currentLink) this.current = currentLink;
    this.writeHighlight(geometry);

    // 只在实际变化时触发
    const { added, removed } = diffBy(this._visible, next, (s) => s.id);
    const changed = added.length > 0 || removed.length > 0;

    if (changed) {
      added.forEach((s) => {
        s.link?.setAttribute('in-view', '');
      });
      removed.forEach((s) => {
        s.link?.removeAttribute('in-view');
      });
      this._visible = next;
      this.emitVisibleChange();
    }
  }

  private readHighlight(sections: readonly VisibleSection[]) {
    if (!this._highlight || !sections.length) return null;
    const first = sections[0].link;
    const last = sections[sections.length - 1].link;
    if (!first || !last) return null;
    const container = this.getBoundingClientRect();
    const start = first.getBoundingClientRect();
    const end = last === first ? start : last.getBoundingClientRect();
    if (!container.width || !start.width || !end.height) return null;
    const left = Math.min(start.left, end.left) - container.left + this.scrollLeft;
    const top = start.top - container.top + this.scrollTop;
    const width = Math.max(start.right, end.right) - Math.min(start.left, end.left);
    const height = end.bottom - start.top;
    return height > 0 ? { left, top, width, height } : null;
  }

  private writeHighlight(geometry: ReturnType<StarlightTOC['readHighlight']>) {
    const range = this._highlight;
    if (!range) return;
    if (!geometry) {
      range.removeAttribute('data-toc-range-visible');
      return;
    }
    const values = {
      transform: `translate(${geometry.left}px, ${geometry.top}px)`,
      width: `${geometry.width}px`,
      height: `${geometry.height}px`,
    };
    for (const [property, value] of Object.entries(values)) {
      if (range.style.getPropertyValue(property) !== value)
        range.style.setProperty(property, value);
    }
    if (!range.hasAttribute('data-toc-range-visible'))
      range.setAttribute('data-toc-range-visible', '');
  }

  private flushObservedLayout() {
    if (!this._initialized || !this.isConnected) return;
    // ResizeObserver runs after layout and before paint. Deferring this
    // invalidation to another rAF paints one frame with the old current/range
    // after fonts or wrapping have already moved the headings. Reuse the same
    // read-before-write pass and consume any queued scroll invalidation.
    if (this._rafId !== undefined) cancelAnimationFrame(this._rafId);
    this._rafId = undefined;
    this._rafScheduled = false;
    this.updateVisibleNow();
  }

  /** ===== 新增：rAF 节流封装 ===== */
  private scheduleVisibleUpdate() {
    if (this._rafScheduled) return;
    this._rafScheduled = true;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = undefined;
      this._rafScheduled = false;
      if (this.isConnected) this.updateVisibleNow();
    });
  }

  private init = (): void => {
    // Upgraded HTML and parser-created custom elements attach children at
    // different points; acquire the authored current link after idle setup.
    this._current = this.querySelector<HTMLAnchorElement>('a[aria-current="true"]');
    /** ===== 新增：初始化“可见小节”维护 ===== */
    this.minH = parseInt(this.dataset.minH || '2', 10);
    this.maxH = parseInt(this.dataset.maxH || '3', 10);
    this._highlight = this.querySelector<HTMLElement>('[data-site-toc-highlight]');
    this.collectHeadings(); // 1) 收集标题
    this.observeCurrent();
    this.updateVisibleNow(); // 2) 初始化完成后立刻计算一次
    window.addEventListener('scroll', this._onScroll, { passive: true }); // 3) 监听滚动
    window.addEventListener('resize', this._onResize); //    监听尺寸变化
    window.addEventListener('hashchange', this._onLayout);
    window.addEventListener('pageshow', this._onLayout);
    document.fonts?.addEventListener('loadingdone', this._onLayout);
    if (typeof ResizeObserver !== 'undefined') {
      this._layoutObserver = new ResizeObserver(() => this.flushObservedLayout());
      // Content/font/runtime layout can change without a viewport resize.
      for (const target of [this, document.querySelector('main'), document.querySelector('header')])
        if (target) this._layoutObserver.observe(target);
    }
  };

  private observeCurrent() {
    if (this._observer || !this.isConnected) return;
    // Entries are invalidation only; large wrappers never get their own current.
    this._observer = new IntersectionObserver(() => this.scheduleVisibleUpdate(), {
      rootMargin: this.getRootMargin(),
    });
    this._headings.forEach((heading) => this._observer!.observe(heading));
  }

  private getRootMargin(): `-${number}px 0% ${number}px` {
    const navBarHeight = document.querySelector('header')?.getBoundingClientRect().height || 0;
    // `<summary>` only exists in mobile ToC, so will fall back to 0 in large viewport component.
    const mobileTocHeight = this.querySelector('summary')?.getBoundingClientRect().height || 0;
    /** Start intersections at nav height + 2rem padding. */
    const top = navBarHeight + mobileTocHeight + 32;
    /** End intersections `53px` later. This is slightly more than the maximum `margin-top` in Markdown content. */
    const bottom = top + 53;
    const height = document.documentElement.clientHeight;
    return `-${top}px 0% ${bottom - height}px`;
  }

  /** ===== 新增：卸载清理（避免内存泄露） ===== */
  disconnectedCallback() {
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('hashchange', this._onLayout);
    window.removeEventListener('pageshow', this._onLayout);
    document.fonts?.removeEventListener('loadingdone', this._onLayout);
    this._layoutObserver?.disconnect();
    this._layoutObserver = undefined;
    this.writeHighlight(null);
    this._highlight = null;
    if (this._idleId !== undefined) {
      if (this._idleUsesTimeout) window.clearTimeout(this._idleId);
      else window.cancelIdleCallback?.(this._idleId);
    }
    if (this._rafId !== undefined) cancelAnimationFrame(this._rafId);
    window.clearTimeout(this._resizeTimer);
    this._observer?.disconnect();
    for (const section of this._visible) section.link?.removeAttribute('in-view');
    this._idleId = this._rafId = this._resizeTimer = undefined;
    this._observer = undefined;
    this._initialized = this._rafScheduled = false;
    this._visible = [];
    this._headings = [];
    this._links = [];
  }
}

customElements.define('sl-toc', StarlightTOC);
