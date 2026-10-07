// packages/adapters/web-component/src/style.ts
import { mergeTwTokensV0, type TemplateStyleHandle } from '@proto.ui/core';

export type TwResolver = (tokens: string) => string; // returns cssText for v0

let twResolver: TwResolver | null = null;

export function configureTemplateStyle(opt: { tw?: TwResolver }) {
  twResolver = opt.tw ?? null;
}

export function applyTemplateStyle(el: Element, style?: TemplateStyleHandle) {
  if (!style) return;

  if (style.kind === 'tw') {
    // commitChildren calls this only for newly created adapter-owned elements.
    const tokens = mergeTwTokensV0(style.tokens).tokens;
    if (tokens.length > 0) el.setAttribute('data-pui-style', tokens.join(' '));

    // Preserve the resolver's original input and inline-style precedence.
    if (!twResolver) return;
    const cssText = twResolver(style.tokens.join(' '));
    if (cssText) (el as HTMLElement).setAttribute('style', cssText);
  }
}
