import { assertProjectionRecipeClosure } from './projection-composition';
import { registerNativeContentContainer, withNativeContentLease } from './native-content-lease';
import { createProjectionScopeController } from './projection-scope';
import { renderDemo } from './demo-renderer';
import { loadPrototypes } from './prototype-modules';
import {
  applyProjectionThemeSurfaceStyle,
  type ProjectionThemeSurfaceStyle,
} from './projection-theme';
import type { DemoRenderResult, DemoSpec } from './demo-types';
import type { RuntimeId } from './runtimes/ids';

/** Composition lease, not a host runtime: existing public renderers own each
 * shell; the original renderer exclusively owns the borrowed content subtree.
 * Return that subtree synchronously before its renderer tears down. */
export function createPassiveShellComposition(options: {
  runtime: RuntimeId;
  mount: HTMLElement;
  content: HTMLElement;
  family: string;
  theme: ProjectionThemeSurfaceStyle;
  prototypeId(family: string): string;
  props(family: string): Record<string, unknown>;
  layout: Record<string, string>;
  className: string;
  surfaceRef?: string;
}) {
  const { mount, content } = options;
  const home = content.parentNode!;
  // These new owner carriers must not become shrink-to-fit flex items.
  // The original demo still owns its own width/overflow inside the canvas.
  for (const carrier of [mount, home as HTMLElement]) {
    carrier.style.width = '100%';
    carrier.style.minWidth = '0';
  }
  const nextSibling = content.nextSibling;
  const document = mount.ownerDocument;
  let alive = true;
  let requestedTheme = { ...options.theme };
  const slots = new Map<number, HTMLElement>();
  const surfaces = new Map<number, HTMLElement>();
  const captureDisplay = () => ({
    value: content.style.getPropertyValue('display'),
    priority: content.style.getPropertyPriority('display'),
    hadStyleAttribute: content.hasAttribute('style'),
  });
  type DisplayLease = { generation: number; original: ReturnType<typeof captureDisplay> };
  let displayLease: DisplayLease | null = null;
  const hasOwnedDisplay = () =>
    content.style.getPropertyValue('display') === 'contents' &&
    content.style.getPropertyPriority('display') === '';
  const restoreDisplay = (original: ReturnType<typeof captureDisplay>) => {
    if (original.value) content.style.setProperty('display', original.value, original.priority);
    else content.style.removeProperty('display');
    if (!original.hadStyleAttribute && content.getAttribute('style') === '')
      content.removeAttribute('style');
    else if (original.hadStyleAttribute && !content.hasAttribute('style'))
      content.setAttribute('style', '');
  };
  const releaseDisplay = (generation = displayLease?.generation) => {
    if (!displayLease || displayLease.generation !== generation) return;
    const { original } = displayLease;
    displayLease = null;
    // Restore only our own declaration; the content owner may have edited it.
    if (hasOwnedDisplay()) restoreDisplay(original);
  };
  const move = (parent: Node, before: Node | null = null) =>
    withNativeContentLease(content, () => {
      parent.insertBefore(content, before?.parentNode === parent ? before : null);
    });
  const controller = createProjectionScopeController({
    initialSelection: { runtimeId: options.runtime, projectionFamilyId: options.family },
    async materialize(request) {
      // Capture before loading: each hidden candidate owns the theme supplied
      // with its family request, and exposes both through the scope commit.
      const theme = requestedTheme;
      const prototypeId = options.prototypeId(request.selection.projectionFamilyId);
      await loadPrototypes([prototypeId]);
      if (!alive) throw new Error('Passive shell composition disposed');
      const host = document.createElement('div');
      host.hidden = true;
      host.style.width = '100%';
      host.style.minWidth = '0';
      mount.append(host);
      let rendered: DemoRenderResult | undefined;
      try {
        const demo: DemoSpec = {
          type: 'demo',
          root: {
            kind: 'proto',
            prototypeId,
            ref: options.surfaceRef ?? 'shell',
            className: options.className,
            props: options.props(request.selection.projectionFamilyId),
            surfaceStyle: { ...options.layout, ...theme },
            children: [
              {
                kind: 'box',
                ref: 'slot',
                attrs: { 'data-passive-shell-slot': '' },
                children: [],
              },
            ],
          },
          setup(context) {
            const slot = context.refs.slot!;
            const surface = context.refs[options.surfaceRef ?? 'shell']!;
            registerNativeContentContainer(slot, [content]);
            registerNativeContentContainer(surface, [content]);
            slot.style.display = 'contents';
            surface.dataset.projectionPrototype = prototypeId;
            surface.dataset.projectionRuntime = options.runtime;
            surface.dataset.projectionFamily = request.selection.projectionFamilyId;
            surface.dataset.projectionGeneration = String(request.generation);
            slots.set(request.generation, slot);
            surfaces.set(request.generation, surface);
            applyProjectionThemeSurfaceStyle(surface, theme);
          },
        };
        assertProjectionRecipeClosure(demo.root, [prototypeId], `passive-shell:${prototypeId}`);
        rendered = await renderDemo({
          runtime: options.runtime,
          host,
          isCurrent: () => alive,
          demo,
        });
        return {
          activate() {
            host.hidden = false;
          },
          setLocked() {},
          async dispose() {
            const slot = slots.get(request.generation);
            releaseDisplay(request.generation);
            if (slot?.contains(content)) move(home, nextSibling);
            slots.delete(request.generation);
            surfaces.delete(request.generation);
            await rendered?.destroy();
            host.remove();
          },
        };
      } catch (error) {
        slots.delete(request.generation);
        surfaces.delete(request.generation);
        await rendered?.destroy();
        host.remove();
        throw error;
      }
    },
    prepareCommit(commit) {
      const slot = slots.get(commit.generation);
      if (!slot) throw new Error('Prepared passive shell slot missing');
      const previous = content.parentNode!;
      const before = content.nextSibling;
      let previousDisplay: ReturnType<typeof captureDisplay> | undefined;
      let previousLease: DisplayLease | null = null;
      return {
        publish() {
          if (!alive) throw new Error('Passive shell composition disposed');
          previousDisplay = captureDisplay();
          previousLease = displayLease;
          // Hidden, failed and stale candidates never acquire authored styles.
          // A replacement inherits only a still-owned lease, so the original
          // value survives shell switches without losing newer external edits.
          displayLease = {
            generation: commit.generation,
            original: previousLease && hasOwnedDisplay() ? previousLease.original : previousDisplay,
          };
          content.style.setProperty('display', 'contents');
          move(slot);
        },
        rollback() {
          if (slot.contains(content)) move(previous, before);
          if (displayLease?.generation !== commit.generation) return;
          displayLease = previousLease;
          if (previousDisplay && hasOwnedDisplay()) restoreDisplay(previousDisplay);
        },
      };
    },
  });
  const ready = controller.start();
  return {
    ready,
    async update(family: string, nextTheme: ProjectionThemeSurfaceStyle) {
      if (!alive) return;
      requestedTheme = { ...nextTheme };
      const current = controller.getSnapshot();
      // Same-family theme edits remain immediate. A replacement's theme must
      // never recolor the retained generation or another pending candidate.
      if (current.selection.projectionFamilyId === family) {
        const surface = surfaces.get(current.generation);
        if (surface) applyProjectionThemeSurfaceStyle(surface, requestedTheme);
      }
      await controller.request({ runtimeId: options.runtime, projectionFamilyId: family });
    },
    destroy() {
      if (!alive) return Promise.resolve();
      alive = false;
      releaseDisplay();
      move(home, nextSibling);
      return controller.destroy();
    },
  };
}
