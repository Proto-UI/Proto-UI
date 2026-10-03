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
  private _onScroll = () => this.scheduleVisibleUpdate();
  private _onResize = () => {
    // 布局变化大，重收集并更新一次
    this.collectHeadings();
    this.scheduleVisibleUpdate();
    // 同时走原有的 observer resize 逻辑（保持原功能）
    // 这里不触碰原 observer 的实现，仍交由 init 中的 resize 监听处理
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

  private onIdle = (cb: IdleRequestCallback) =>
    (window.requestIdleCallback || ((cb) => setTimeout(cb, 1)))(cb);

  constructor() {
    super();
    this.onIdle(() => this.init());
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

    // 去重并保持文档顺序
    const seen = new Set<string>();
    this._headings = list.filter((h) => {
      if (!h.id || seen.has(h.id)) return false;
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
      return;
    }

    // 预先算好每个标题的绝对 top
    const tops = heads.map((h) => this.getHeadingTop(h));

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

  /** ===== 新增：rAF 节流封装 ===== */
  private scheduleVisibleUpdate() {
    if (this._rafScheduled) return;
    this._rafScheduled = true;
    requestAnimationFrame(() => {
      this._rafScheduled = false;
      this.updateVisibleNow();
    });
  }

  private init = (): void => {
    /** All the links in the table of contents. */
    const links = [...this.querySelectorAll('a')];

    /** Test if an element is a table-of-contents heading. */
    const isHeading = (el: Element): el is HTMLHeadingElement => {
      if (el instanceof HTMLHeadingElement) {
        // Special case for page title h1
        if (el.id === PAGE_TITLE_ID) return true;
        // Check the heading level is within the user-configured limits for the ToC
        const level = el.tagName[1];
        if (level) {
          const int = parseInt(level, 10);
          if (int >= this.minH && int <= this.maxH) return true;
        }
      }
      return false;
    };

    /** Walk up the DOM to find the nearest heading. */
    const getElementHeading = (el: Element | null): HTMLHeadingElement | null => {
      if (!el) return null;
      const origin = el;
      while (el) {
        if (isHeading(el)) return el;
        // Assign the previous sibling’s last, most deeply nested child to el.
        el = el.previousElementSibling;
        while (el?.lastElementChild) {
          el = el.lastElementChild;
        }
        // Look for headings amongst siblings.
        const h = getElementHeading(el);
        if (h) return h;
      }
      // Walk back up the parent.
      return getElementHeading(origin.parentElement);
    };

    /** Handle intersections and set the current link to the heading for the current intersection. */
    const setCurrent: IntersectionObserverCallback = (entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting) continue;
        const heading = getElementHeading(target);
        if (!heading) continue;
        const link = links.find((link) => link.hash === '#' + encodeURIComponent(heading.id));
        if (link) {
          this.current = link;
          break;
        }
      }
    };

    // Observe elements with an `id` (most likely headings) and their siblings.
    // Also observe direct children of `.content` to include elements before
    // the first heading.
    const toObserve = document.querySelectorAll('main [id], main [id] ~ *, main .content > *');

    let observer: IntersectionObserver | undefined;
    const observe = () => {
      if (observer) return;
      observer = new IntersectionObserver(setCurrent, { rootMargin: this.getRootMargin() });
      toObserve.forEach((h) => observer!.observe(h));
    };
    observe();

    let timeout: NodeJS.Timeout;
    window.addEventListener('resize', () => {
      // Disable intersection observer while window is resizing.
      if (observer) {
        observer.disconnect();
        observer = undefined;
      }
      clearTimeout(timeout);
      timeout = setTimeout(() => this.onIdle(observe), 200);
    });

    /** ===== 新增：初始化“可见小节”维护 ===== */
    this.collectHeadings(); // 1) 收集标题
    this.updateVisibleNow(); // 2) 初始化完成后立刻计算一次
    window.addEventListener('scroll', this._onScroll, { passive: true }); // 3) 监听滚动
    window.addEventListener('resize', this._onResize); //    监听尺寸变化
  };

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
  }
}

customElements.define('sl-toc', StarlightTOC);
