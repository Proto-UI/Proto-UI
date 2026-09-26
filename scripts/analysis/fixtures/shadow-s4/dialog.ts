import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  dialogRoot,
  dialogTrigger,
  dialogMask,
  dialogContent,
  dialogTitle,
  dialogDescription,
  dialogClose,
  dialogCloseIcon,
  dialogHeader,
  dialogFooter,
} from '@proto.ui/prototypes-shadcn/dialog';
import { protoShadowStyleArtifact } from '../../../../apps/www/src/styles/proto-ui-shadow-style.generated.js';

// Complete public prototypes, no author-token surgery or package source aliases.
export function mount(mode: string, oldContentArtifact = false) {
  const prototypes = {
    root: dialogRoot,
    trigger: dialogTrigger,
    mask: dialogMask,
    content: dialogContent,
    title: dialogTitle,
    description: dialogDescription,
    close: dialogClose,
    icon: dialogCloseIcon,
    header: dialogHeader,
    footer: dialogFooter,
  };
  const parts: Record<string, HTMLElement & { getExposes?(): any }> = {};
  const lifecycle: Record<string, string[]> = {};
  for (const [key, proto] of Object.entries(prototypes)) {
    lifecycle[key] = [];
    const split =
      mode === 'split' || (mode === 'mixed' && !['header', 'footer', 'title'].includes(key));
    const C = AdaptToWebComponent(proto, {
      diagnostics: {
        onLifecycleEvent(event) {
          lifecycle[key].push(event.type);
        },
      },
      registerAs: `s4-audit-${key}`,
      shadow: split
        ? {
            mode: 'open',
            presentation: 'split',
            styleArtifact:
              oldContentArtifact && key === 'content'
                ? {
                    ...protoShadowStyleArtifact,
                    cssText: protoShadowStyleArtifact.cssText.replace(
                      '--pui-split-dialog-motion-recipe: k1;',
                      ''
                    ),
                  }
                : protoShadowStyleArtifact,
          }
        : false,
    });
    parts[key] = new C();
    parts[key].dataset.part = key;
  }
  parts.trigger.textContent = 'Open settings';
  parts.title.textContent = 'Settings';
  parts.description.textContent = 'Dialog settings description';
  parts.close.textContent = 'Close';
  parts.header.append(parts.title, parts.description);
  parts.footer.append(parts.close);
  parts.content.append(parts.header, parts.footer, parts.icon);
  parts.root.append(parts.trigger, parts.mask, parts.content);
  const wrapper = document.createElement('section');
  wrapper.style.setProperty('--pui-background', 'rgb(210, 20, 30)');
  wrapper.append(parts.root);
  document.body.append(wrapper);
  return {
    parts,
    lifecycle,
    wrapper,
    setOpen(open: boolean) {
      setElementProps(parts.root, { open });
    },
    sample() {
      const part = (key: string) => {
        const h = parts[key],
          s = h.shadowRoot?.querySelector<HTMLElement>('[part="surface"]') ?? h;
        const hr = h.getBoundingClientRect(),
          sr = s.getBoundingClientRect();
        const hs = getComputedStyle(h),
          ss = getComputedStyle(s);
        const centerHit = document.elementFromPoint(hr.x + hr.width / 2, hr.y + hr.height / 2);
        const scale = hs.transform === 'none' ? 1 : new DOMMatrixReadOnly(hs.transform).a;
        const animations = [...h.getAnimations(), ...(s === h ? [] : s.getAnimations())];
        return {
          x: hr.x,
          y: hr.y,
          w: hr.width,
          h: hr.height,
          sx: sr.x,
          sy: sr.y,
          sw: sr.width,
          sh: sr.height,
          transform: hs.transform,
          surfaceTransform: s === h ? null : ss.transform,
          opacity: Number(hs.opacity) * (s === h ? 1 : Number(ss.opacity)),
          background: ss.backgroundColor,
          variable: hs.getPropertyValue('--pui-background'),
          physicalParent: h.parentElement?.tagName,
          logicalParent: h.parentNode?.nodeName,
          detached: h.hasAttribute('data-pui-view-detached'),
          animations: animations.map((a) => ({
            name: (a as CSSAnimation).animationName,
            time: a.currentTime,
            duration: a.effect?.getTiming().duration,
          })),
          state: h.getExposes?.().transitionState?.get(),
          scale,
          centerHit: centerHit === h || (centerHit !== null && h.contains(centerHit)),
        };
      };
      return {
        content: part('content'),
        mask: part('mask'),
        open: parts.root.getExposes?.().open?.get(),
        overflow: document.body.style.overflow,
        active: document.activeElement?.getAttribute('data-part'),
      };
    },
    async frames(count: number) {
      const result = [];
      for (let i = 0; i < count; i++) {
        await new Promise(requestAnimationFrame);
        result.push(this.sample());
      }
      return result;
    },
  };
}
