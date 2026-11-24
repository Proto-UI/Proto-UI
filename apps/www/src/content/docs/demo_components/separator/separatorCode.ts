import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

interface FamilyCodeConfig {
  prefix: string;
  wcTag: string;
  componentName: string;
  wcDefaultAttrs?: string;
  componentDefaultProps?: string;
  wrapperClass?: string;
  cardClass?: string;
  mutedClass?: string;
  boldClass?: string;
}

function wcEl(tag: string, attrs: string): string {
  const trimmed = attrs.trim();
  return trimmed ? `<${tag} ${trimmed}></${tag}>` : `<${tag}></${tag}>`;
}

function jsxEl(name: string, props: string): string {
  const trimmed = props.trim();
  return trimmed ? `<${name} ${trimmed} />` : `<${name} />`;
}

function joinAttrs(...parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}

function wrapReact(componentName: string, fnName: string, body: string): string {
  return formatCode(`
import { ${componentName} } from '../proto-ui/components/react';

export function ${fnName}() {
  return (
${body}
  );
}
  `);
}

function wrapVue(componentName: string, body: string): string {
  return formatCode(`
<script setup lang="ts">
import { ${componentName} } from '../proto-ui/components/vue';
</script>

<template>
${body}
</template>
  `);
}

function wrapVue2(componentName: string, body: string): string {
  return formatCode(`
<template>
${body}
</template>

<script>
import { ${componentName} } from '../proto-ui/components/vue2';

export default {
  components: {
    ${componentName},
  },
};
</script>
  `);
}

function buildFamilySnippets(cfg: FamilyCodeConfig) {
  const muted = cfg.mutedClass ?? 'text-muted-foreground';
  const bold = cfg.boldClass ?? 'font-medium';
  const wcAttr = (extra?: string) => joinAttrs(cfg.wcDefaultAttrs, extra);
  const compProp = (extra?: string) => joinAttrs(cfg.componentDefaultProps, extra);

  const heroBoxClass = cfg.cardClass ?? 'flex w-full max-w-sm flex-col gap-4 text-sm';
  const verticalBoxClass =
    cfg.prefix === 'demo-bootstrap-2-3-2-separator'
      ? 'flex h-9 items-center gap-4 rounded border border-[#e3e3e3] bg-[#f5f5f5] px-4 py-2 text-sm text-[#333333]'
      : cfg.prefix === 'demo-liquid-glass-separator'
        ? 'flex h-10 items-center gap-4 rounded-xl bg-background/75 px-4 py-2 text-sm shadow-sm ring-1 ring-border/50 backdrop-blur-md'
        : 'flex h-5 items-center gap-4 text-sm';
  const menuBoxClass =
    cfg.prefix === 'demo-bootstrap-2-3-2-separator'
      ? 'flex items-center gap-3 rounded border border-[#e3e3e3] bg-[#f5f5f5] px-4 py-3 text-sm text-[#333333] md:gap-4'
      : cfg.prefix === 'demo-liquid-glass-separator'
        ? 'flex items-center gap-3 rounded-xl bg-background/75 px-4 py-3 text-sm shadow-sm ring-1 ring-border/50 backdrop-blur-md md:gap-4'
        : 'flex items-center gap-2 text-sm md:gap-4';
  const listBoxClass =
    cfg.prefix === 'demo-bootstrap-2-3-2-separator'
      ? 'flex w-full max-w-sm flex-col gap-2.5 rounded border border-[#e3e3e3] bg-[#f5f5f5] p-4 text-sm text-[#333333]'
      : cfg.prefix === 'demo-liquid-glass-separator'
        ? 'flex flex-col gap-2.5 rounded-xl bg-background/75 p-4 text-sm shadow-sm ring-1 ring-border/50 backdrop-blur-md'
        : 'flex w-full max-w-sm flex-col gap-2 text-sm';

  const maybeWrapHtml = (inner: string, classAttr: 'class' | 'className') =>
    cfg.wrapperClass ? `    <div ${classAttr}="${cfg.wrapperClass}">\n${inner}\n    </div>` : inner;

  const renderHero = (isReact: boolean, el: string) => {
    const c = isReact ? 'className' : 'class';
    const inner = `      <div ${c}="${heroBoxClass}">
        <div ${c}="flex flex-col gap-1.5">
          <div ${c}="leading-none ${bold}">Proto UI</div>
          <div ${c}="${muted}">The foundation for your design system.</div>
        </div>
        ${el}
        <div>A set of portable component protocols that you can customize, extend, and build on.</div>
      </div>`;
    return maybeWrapHtml(inner, c);
  };

  const renderVertical = (isReact: boolean, el: string) => {
    const c = isReact ? 'className' : 'class';
    const inner = `      <div ${c}="${verticalBoxClass}">
        <div>Blog</div>
        ${el}
        <div>Docs</div>
        ${el}
        <div>Source</div>
      </div>`;
    return maybeWrapHtml(inner, c);
  };

  const renderMenu = (isReact: boolean, el: string, responsiveEl: string) => {
    const c = isReact ? 'className' : 'class';
    const inner = `      <div ${c}="${menuBoxClass}">
        <div ${c}="flex flex-col gap-1">
          <span ${c}="${bold}">Settings</span>
          <span ${c}="text-xs ${muted}">Manage preferences</span>
        </div>
        ${el}
        <div ${c}="flex flex-col gap-1">
          <span ${c}="${bold}">Account</span>
          <span ${c}="text-xs ${muted}">Profile &amp; security</span>
        </div>
        ${responsiveEl}
        <div ${c}="hidden flex-col gap-1 md:flex">
          <span ${c}="${bold}">Help</span>
          <span ${c}="text-xs ${muted}">Support &amp; docs</span>
        </div>
      </div>`;
    return maybeWrapHtml(inner, c);
  };

  const renderList = (isReact: boolean, el: string) => {
    const c = isReact ? 'className' : 'class';
    const inner = `      <div ${c}="${listBoxClass}">
        <div ${c}="flex items-center justify-between">
          <span>Item 1</span>
          <span ${c}="${muted}">Value 1</span>
        </div>
        ${el}
        <div ${c}="flex items-center justify-between">
          <span>Item 2</span>
          <span ${c}="${muted}">Value 2</span>
        </div>
        ${el}
        <div ${c}="flex items-center justify-between">
          <span>Item 3</span>
          <span ${c}="${muted}">Value 3</span>
        </div>
      </div>`;
    return maybeWrapHtml(inner, c);
  };

  const renderRtl = (isReact: boolean, el: string) => {
    const c = isReact ? 'className' : 'class';
    const inner = `      <div dir="rtl" ${c}="${heroBoxClass}">
        <div ${c}="flex flex-col gap-1.5">
          <div ${c}="leading-none ${bold}">Proto UI</div>
          <div ${c}="${muted}">الأساس لنظام التصميم الخاص بك</div>
        </div>
        ${el}
        <div>مجموعة من المكونات القابلة للتخصيص والتوسيع والبناء عليها.</div>
      </div>`;
    return maybeWrapHtml(inner, c);
  };

  const heroId = cfg.prefix;
  const verticalId = `${cfg.prefix}-vertical`;
  const menuId = `${cfg.prefix}-menu`;
  const listId = `${cfg.prefix}-list`;
  const rtlId = `${cfg.prefix}-rtl`;

  const wc: Record<string, string> = {
    [heroId]: formatCode(renderHero(false, wcEl(cfg.wcTag, wcAttr()))),
    [verticalId]: formatCode(
      renderVertical(false, wcEl(cfg.wcTag, wcAttr('orientation="vertical"')))
    ),
    [menuId]: formatCode(
      renderMenu(
        false,
        wcEl(cfg.wcTag, wcAttr('orientation="vertical"')),
        wcEl(cfg.wcTag, wcAttr('orientation="vertical" class="hidden md:block"'))
      )
    ),
    [listId]: formatCode(renderList(false, wcEl(cfg.wcTag, wcAttr('decorative="false"')))),
    [rtlId]: formatCode(renderRtl(false, wcEl(cfg.wcTag, wcAttr()))),
  };

  const react: Record<string, string> = {
    [heroId]: wrapReact(
      cfg.componentName,
      'SeparatorDemo',
      renderHero(true, jsxEl(cfg.componentName, compProp()))
    ),
    [verticalId]: wrapReact(
      cfg.componentName,
      'SeparatorVerticalDemo',
      renderVertical(true, jsxEl(cfg.componentName, compProp('orientation="vertical"')))
    ),
    [menuId]: wrapReact(
      cfg.componentName,
      'SeparatorMenuDemo',
      renderMenu(
        true,
        jsxEl(cfg.componentName, compProp('orientation="vertical"')),
        jsxEl(cfg.componentName, compProp('orientation="vertical" className="hidden md:block"'))
      )
    ),
    [listId]: wrapReact(
      cfg.componentName,
      'SeparatorListDemo',
      renderList(true, jsxEl(cfg.componentName, compProp('decorative={false}')))
    ),
    [rtlId]: wrapReact(
      cfg.componentName,
      'SeparatorRtlDemo',
      renderRtl(true, jsxEl(cfg.componentName, compProp()))
    ),
  };

  const vue: Record<string, string> = {
    [heroId]: wrapVue(cfg.componentName, renderHero(false, jsxEl(cfg.componentName, compProp()))),
    [verticalId]: wrapVue(
      cfg.componentName,
      renderVertical(false, jsxEl(cfg.componentName, compProp('orientation="vertical"')))
    ),
    [menuId]: wrapVue(
      cfg.componentName,
      renderMenu(
        false,
        jsxEl(cfg.componentName, compProp('orientation="vertical"')),
        jsxEl(cfg.componentName, compProp('orientation="vertical" class="hidden md:block"'))
      )
    ),
    [listId]: wrapVue(
      cfg.componentName,
      renderList(false, jsxEl(cfg.componentName, compProp(':decorative="false"')))
    ),
    [rtlId]: wrapVue(cfg.componentName, renderRtl(false, jsxEl(cfg.componentName, compProp()))),
  };

  const vue2: Record<string, string> = {
    [heroId]: wrapVue2(cfg.componentName, renderHero(false, jsxEl(cfg.componentName, compProp()))),
    [verticalId]: wrapVue2(
      cfg.componentName,
      renderVertical(false, jsxEl(cfg.componentName, compProp('orientation="vertical"')))
    ),
    [menuId]: wrapVue2(
      cfg.componentName,
      renderMenu(
        false,
        jsxEl(cfg.componentName, compProp('orientation="vertical"')),
        jsxEl(cfg.componentName, compProp('orientation="vertical" class="hidden md:block"'))
      )
    ),
    [listId]: wrapVue2(
      cfg.componentName,
      renderList(false, jsxEl(cfg.componentName, compProp(':decorative="false"')))
    ),
    [rtlId]: wrapVue2(cfg.componentName, renderRtl(false, jsxEl(cfg.componentName, compProp()))),
  };

  return { wc, react, vue, vue2 };
}

const shadcn = buildFamilySnippets({
  prefix: 'demo-shadcn-separator',
  wcTag: 'wc-shadcn-separator-root',
  componentName: 'ShadcnSeparatorRoot',
  wcDefaultAttrs: 'style-profile="rhea"',
  componentDefaultProps: 'styleProfile="rhea"',
});

const brutalist = buildFamilySnippets({
  prefix: 'demo-brutalist-separator',
  wcTag: 'wc-brutalist-separator-root',
  componentName: 'BrutalistSeparatorRoot',
  boldClass: 'font-bold',
});

const bootstrap = buildFamilySnippets({
  prefix: 'demo-bootstrap-2-3-2-separator',
  wcTag: 'wc-bootstrap-2-3-2-separator-root',
  componentName: 'BootstrapSeparatorRoot',
  cardClass:
    'flex w-full max-w-sm flex-col gap-4 rounded border border-[#e3e3e3] bg-[#f5f5f5] p-4 text-sm text-[#333333]',
  mutedClass: 'text-[#666666]',
  boldClass: 'font-bold',
});

const liquidGlass = buildFamilySnippets({
  prefix: 'demo-liquid-glass-separator',
  wcTag: 'wc-liquid-glass-separator-root',
  componentName: 'LiquidGlassSeparatorRoot',
  wrapperClass:
    'w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
  cardClass:
    'flex flex-col gap-4 rounded-xl bg-background/75 p-4 text-sm shadow-sm ring-1 ring-border/50 backdrop-blur-md',
  boldClass: 'font-semibold',
});

const liquidOpaqueBody = (isReact: boolean, autoEl: string, opaqueEl: string) => {
  const c = isReact ? 'className' : 'class';
  return `    <div ${c}="w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <div ${c}="flex flex-col gap-3 rounded-xl bg-background p-4 text-sm shadow-sm ring-1 ring-border">
        <div ${c}="flex items-center justify-between">
          <span ${c}="font-medium">Vibrancy</span>
          <span ${c}="text-xs text-muted-foreground">material="auto"</span>
        </div>
        ${autoEl}
        <div ${c}="flex items-center justify-between">
          <span ${c}="font-medium">Opaque</span>
          <span ${c}="text-xs text-muted-foreground">material="opaque"</span>
        </div>
        ${opaqueEl}
      </div>
    </div>`;
};

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    ...shadcn.wc,
    ...brutalist.wc,
    ...bootstrap.wc,
    ...liquidGlass.wc,
    'demo-liquid-glass-separator-opaque': formatCode(
      liquidOpaqueBody(
        false,
        '<wc-liquid-glass-separator-root material="auto"></wc-liquid-glass-separator-root>',
        '<wc-liquid-glass-separator-root material="opaque"></wc-liquid-glass-separator-root>'
      )
    ),
  },
  react: {
    ...shadcn.react,
    ...brutalist.react,
    ...bootstrap.react,
    ...liquidGlass.react,
    'demo-liquid-glass-separator-opaque': wrapReact(
      'LiquidGlassSeparatorRoot',
      'LiquidGlassSeparatorOpaqueDemo',
      liquidOpaqueBody(
        true,
        '<LiquidGlassSeparatorRoot material="auto" />',
        '<LiquidGlassSeparatorRoot material="opaque" />'
      )
    ),
  },
  vue: {
    ...shadcn.vue,
    ...brutalist.vue,
    ...bootstrap.vue,
    ...liquidGlass.vue,
    'demo-liquid-glass-separator-opaque': wrapVue(
      'LiquidGlassSeparatorRoot',
      liquidOpaqueBody(
        false,
        '<LiquidGlassSeparatorRoot material="auto" />',
        '<LiquidGlassSeparatorRoot material="opaque" />'
      )
    ),
  },
  vue2: {
    ...shadcn.vue2,
    ...brutalist.vue2,
    ...bootstrap.vue2,
    ...liquidGlass.vue2,
    'demo-liquid-glass-separator-opaque': wrapVue2(
      'LiquidGlassSeparatorRoot',
      liquidOpaqueBody(
        false,
        '<LiquidGlassSeparatorRoot material="auto" />',
        '<LiquidGlassSeparatorRoot material="opaque" />'
      )
    ),
  },
};
