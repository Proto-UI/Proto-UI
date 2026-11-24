import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

interface FamilyCodeConfig {
  id: 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
  tagPrefix: string;
  componentPrefix: string;
  outerClass: string;
  wideOuterClass: string;
  nestedProp: string;
  nestedPropJs: string;
  styleProfileAttr: string;
  styleProfileJs: string;
  wrapBackdrop: boolean;
}

const FAMILIES: readonly FamilyCodeConfig[] = [
  {
    id: 'shadcn',
    tagPrefix: 'proto-ui-shadcn-resizable',
    componentPrefix: 'ShadcnResizable',
    outerClass:
      'h-56 w-full max-w-md rounded-lg border border-border bg-background overflow-hidden',
    wideOuterClass:
      'h-56 w-full max-w-2xl rounded-lg border border-border bg-background overflow-hidden',
    nestedProp: '',
    nestedPropJs: '',
    styleProfileAttr: ' styleProfile="rhea"',
    styleProfileJs: ", styleProfile: 'rhea'",
    wrapBackdrop: false,
  },
  {
    id: 'brutalist',
    tagPrefix: 'proto-ui-brutalist-resizable',
    componentPrefix: 'BrutalistResizable',
    outerClass: 'h-56 w-full max-w-md',
    wideOuterClass: 'h-56 w-full max-w-2xl',
    nestedProp: ' variant="nested"',
    nestedPropJs: ", variant: 'nested'",
    styleProfileAttr: '',
    styleProfileJs: '',
    wrapBackdrop: false,
  },
  {
    id: 'bootstrap-2-3-2',
    tagPrefix: 'proto-ui-bootstrap-2-3-2-resizable',
    componentPrefix: 'Bootstrap232Resizable',
    outerClass:
      'h-56 w-full max-w-md rounded-[4px] border border-[#ccc] bg-background shadow-[0_1px_3px_rgb(0_0_0/5.5%)] overflow-hidden',
    wideOuterClass:
      'h-56 w-full max-w-2xl rounded-[4px] border border-[#ccc] bg-background shadow-[0_1px_3px_rgb(0_0_0/5.5%)] overflow-hidden',
    nestedProp: '',
    nestedPropJs: '',
    styleProfileAttr: '',
    styleProfileJs: '',
    wrapBackdrop: false,
  },
  {
    id: 'liquid-glass',
    tagPrefix: 'proto-ui-liquid-glass-resizable',
    componentPrefix: 'LiquidGlassResizable',
    outerClass: 'h-56 w-full',
    wideOuterClass: 'h-56 w-full',
    nestedProp: ' variant="nested"',
    nestedPropJs: ", variant: 'nested'",
    styleProfileAttr: '',
    styleProfileJs: '',
    wrapBackdrop: true,
  },
];

function wrapHtmlBackdrop(f: FamilyCodeConfig, inner: string, maxW = 'max-w-lg'): string {
  if (!f.wrapBackdrop) return inner;
  return `<div class="w-full ${maxW} rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">\n${inner}\n</div>`;
}

function wrapJsxBackdrop(f: FamilyCodeConfig, inner: string, maxW = 'max-w-lg'): string {
  if (!f.wrapBackdrop) return inner;
  return `<div className="w-full ${maxW} rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">\n${inner}\n</div>`;
}

function buildFamilySnippets(f: FamilyCodeConfig): Record<RuntimeId, Record<string, string>> {
  const R = `${f.componentPrefix}Root`;
  const P = `${f.componentPrefix}Panel`;
  const H = `${f.componentPrefix}Handle`;
  const rTag = `${f.tagPrefix}-root`;
  const pTag = `${f.tagPrefix}-panel`;
  const hTag = `${f.tagPrefix}-handle`;
  const key = (suffix = '') => `demo-${f.id}-resizable${suffix}`;
  const sp = f.styleProfileAttr;
  const spJs = f.styleProfileJs;
  const nested = f.nestedProp;
  const nestedJs = f.nestedPropJs;

  const wc: Record<string, string> = {
    [key()]: formatCode(`
${wrapHtmlBackdrop(
  f,
  `<${rTag} id="${f.id}-resizable-hero" class="${f.outerClass}">
  <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">One</span></div></${pTag}>
  <${hTag}></${hTag}>
  <${pTag}>
    <${rTag} id="${f.id}-resizable-nested" class="h-full w-full min-h-0">
      <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Two</span></div></${pTag}>
      <${hTag}></${hTag}>
      <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Three</span></div></${pTag}>
    </${rTag}>
  </${pTag}>
</${rTag}>`
)}
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${f.id}-resizable-hero');
  const nestedRoot = document.querySelector('#${f.id}-resizable-nested');
  setElementProps(root, { defaultSizes: [50, 50], constraints: [{ min: 20, max: 75, collapsible: true }, { min: 25 }]${spJs} });
  setElementProps(nestedRoot, { orientation: 'vertical', defaultSizes: [25, 75], constraints: [{ min: 20 }, { min: 25 }]${nestedJs}${spJs} });
  root.querySelectorAll(':scope > ${pTag}').forEach((panel, index) => setElementProps(panel, { index${spJs} }));
  setElementProps(root.querySelector(':scope > ${hTag}'), { index: 0, withHandle: true${spJs} });
  nestedRoot.querySelectorAll(':scope > ${pTag}').forEach((panel, index) => setElementProps(panel, { index${spJs} }));
  setElementProps(nestedRoot.querySelector(':scope > ${hTag}'), { index: 0, withHandle: true${spJs} });
</script>
    `),
    [key('-vertical')]: formatCode(`
${wrapHtmlBackdrop(
  f,
  `<${rTag} id="${f.id}-resizable-vertical" class="${f.outerClass}">
  <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Header</span></div></${pTag}>
  <${hTag}></${hTag}>
  <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Content</span></div></${pTag}>
</${rTag}>`
)}
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${f.id}-resizable-vertical');
  setElementProps(root, { orientation: 'vertical', defaultSizes: [25, 75], constraints: [{ min: 20 }, { min: 25 }]${spJs} });
  root.querySelectorAll('${pTag}').forEach((panel, index) => setElementProps(panel, { index${spJs} }));
  setElementProps(root.querySelector('${hTag}'), { index: 0${spJs} });
</script>
    `),
    [key('-handle')]: formatCode(`
${wrapHtmlBackdrop(
  f,
  `<div class="flex w-full max-w-md flex-col gap-4">
  <${rTag} id="${f.id}-resizable-with-handle" class="${f.outerClass.replace('h-56', 'h-40')}">
    <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Sidebar</span></div></${pTag}>
    <${hTag}></${hTag}>
    <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Content</span></div></${pTag}>${
      f.id === 'liquid-glass'
        ? `\n    <${hTag}></${hTag}>\n    <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Details</span></div></${pTag}>`
        : ''
    }
  </${rTag}>
  <${rTag} id="${f.id}-resizable-hairline" class="${f.outerClass.replace('h-56', 'h-32')}">
    <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Left</span></div></${pTag}>
    <${hTag}></${hTag}>
    <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Right</span></div></${pTag}>
  </${rTag}>
</div>`
)}
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const withGrip = document.querySelector('#${f.id}-resizable-with-handle');
  setElementProps(withGrip, { defaultSizes: ${f.id === 'liquid-glass' ? '[25, 50, 25]' : '[25, 75]'}, constraints: ${f.id === 'liquid-glass' ? '[{ min: 15 }, { min: 30 }, { min: 15 }]' : '[{ min: 15 }, { min: 30 }]'}${spJs} });
  withGrip.querySelectorAll('${pTag}').forEach((panel, index) => setElementProps(panel, { index${spJs} }));
  withGrip.querySelectorAll('${hTag}').forEach((handle, index) => setElementProps(handle, { index, withHandle: true${f.id === 'liquid-glass' ? ", prominence: index === 1 ? 'prominent' : 'regular'" : ''}${spJs} }));
  const hairline = document.querySelector('#${f.id}-resizable-hairline');
  setElementProps(hairline, { defaultSizes: [50, 50], constraints: [{ min: 20 }, { min: 20 }]${spJs} });
  hairline.querySelectorAll('${pTag}').forEach((panel, index) => setElementProps(panel, { index${spJs} }));
  setElementProps(hairline.querySelector('${hTag}'), { index: 0, withHandle: false${spJs} });
</script>
    `),
    [key('-rtl')]: formatCode(`
${wrapHtmlBackdrop(
  f,
  `<${rTag} id="${f.id}-resizable-rtl" class="${f.outerClass}">
  <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">واحد</span></div></${pTag}>
  <${hTag}></${hTag}>
  <${pTag}>
    <${rTag} id="${f.id}-resizable-rtl-nested" class="h-full w-full min-h-0">
      <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">اثنان</span></div></${pTag}>
      <${hTag}></${hTag}>
      <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">ثلاثة</span></div></${pTag}>
    </${rTag}>
  </${pTag}>
</${rTag}>`
)}
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${f.id}-resizable-rtl');
  const nestedRoot = document.querySelector('#${f.id}-resizable-rtl-nested');
  setElementProps(root, { direction: 'rtl', defaultSizes: [50, 50], constraints: [{ min: 20 }, { min: 20 }]${spJs} });
  setElementProps(nestedRoot, { orientation: 'vertical', direction: 'rtl', defaultSizes: [25, 75], constraints: [{ min: 20 }, { min: 25 }]${nestedJs}${spJs} });
  root.querySelectorAll(':scope > ${pTag}').forEach((panel, index) => setElementProps(panel, { index${spJs} }));
  setElementProps(root.querySelector(':scope > ${hTag}'), { index: 0, withHandle: true${spJs} });
  nestedRoot.querySelectorAll(':scope > ${pTag}').forEach((panel, index) => setElementProps(panel, { index${spJs} }));
  setElementProps(nestedRoot.querySelector(':scope > ${hTag}'), { index: 0, withHandle: true${spJs} });
</script>
    `),
    [key('-collapsible')]: formatCode(`
${wrapHtmlBackdrop(
  f,
  `<${rTag} id="${f.id}-resizable-collapsible" class="${f.wideOuterClass}">
  <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Sidebar</span></div></${pTag}>
  <${hTag}></${hTag}>
  <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Editor</span></div></${pTag}>
  <${hTag}></${hTag}>
  <${pTag}><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Inspector</span></div></${pTag}>
</${rTag}>`,
  'max-w-2xl'
)}
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#${f.id}-resizable-collapsible');
  setElementProps(root, {
    defaultSizes: [25, 50, 25],
    constraints: [{ min: 15, max: 35, collapsible: true }, { min: 30 }, { min: 15, max: 35 }]${spJs},
  });
  root.querySelectorAll('${pTag}').forEach((panel, index) => setElementProps(panel, { index${spJs} }));
  root.querySelectorAll('${hTag}').forEach((handle, index) => setElementProps(handle, { index, withHandle: true${spJs} }));
</script>
    `),
  };

  const react: Record<string, string> = {
    [key()]: formatCode(`
import { ${R}, ${P}, ${H} } from '../proto-ui/components/react';

export function ResizableDemo() {
  return (
    ${wrapJsxBackdrop(
      f,
      `<${R}${sp}
      defaultSizes={[50, 50]}
      constraints={[{ min: 20, max: 75, collapsible: true }, { min: 25 }]}
      className="${f.outerClass}"
    >
      <${P}${sp} index={0}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold text-sm">One</span>
        </div>
      </${P}>
      <${H}${sp} index={0} withHandle />
      <${P}${sp} index={1}>
        <${R}${sp}${nested}
          orientation="vertical"
          defaultSizes={[25, 75]}
          constraints={[{ min: 20 }, { min: 25 }]}
          className="h-full w-full min-h-0"
        >
          <${P}${sp} index={0}>
            <div className="flex h-full items-center justify-center p-6">
              <span className="font-semibold text-sm">Two</span>
            </div>
          </${P}>
          <${H}${sp} index={0} withHandle />
          <${P}${sp} index={1}>
            <div className="flex h-full items-center justify-center p-6">
              <span className="font-semibold text-sm">Three</span>
            </div>
          </${P}>
        </${R}>
      </${P}>
    </${R}>`
    )}
  );
}
    `),
    [key('-vertical')]: formatCode(`
import { ${R}, ${P}, ${H} } from '../proto-ui/components/react';

export function ResizableVerticalDemo() {
  return (
    ${wrapJsxBackdrop(
      f,
      `<${R}${sp}
      orientation="vertical"
      defaultSizes={[25, 75]}
      constraints={[{ min: 20 }, { min: 25 }]}
      className="${f.outerClass}"
    >
      <${P}${sp} index={0}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold text-sm">Header</span>
        </div>
      </${P}>
      <${H}${sp} index={0} />
      <${P}${sp} index={1}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold text-sm">Content</span>
        </div>
      </${P}>
    </${R}>`
    )}
  );
}
    `),
    [key('-handle')]: formatCode(`
import { ${R}, ${P}, ${H} } from '../proto-ui/components/react';

export function ResizableHandleDemo() {
  return (
    ${wrapJsxBackdrop(
      f,
      `<div className="flex w-full max-w-md flex-col gap-4">
      <${R}${sp}
        defaultSizes={${f.id === 'liquid-glass' ? '[25, 50, 25]' : '[25, 75]'}}
        constraints={${f.id === 'liquid-glass' ? '[{ min: 15 }, { min: 30 }, { min: 15 }]' : '[{ min: 15 }, { min: 30 }]'}}
        className="${f.outerClass.replace('h-56', 'h-40')}"
      >
        <${P}${sp} index={0}>
          <div className="flex h-full items-center justify-center p-6">
            <span className="font-semibold text-sm">Sidebar</span>
          </div>
        </${P}>
        <${H}${sp} index={0} withHandle${f.id === 'liquid-glass' ? ' prominence="regular"' : ''} />
        <${P}${sp} index={1}>
          <div className="flex h-full items-center justify-center p-6">
            <span className="font-semibold text-sm">Content</span>
          </div>
        </${P}>${
          f.id === 'liquid-glass'
            ? `\n        <${H} index={1} withHandle prominence="prominent" />\n        <${P} index={2}>\n          <div className="flex h-full items-center justify-center p-6">\n            <span className="font-semibold text-sm">Details</span>\n          </div>\n        </${P}>`
            : ''
        }
      </${R}>
      <${R}${sp}
        defaultSizes={[50, 50]}
        constraints={[{ min: 20 }, { min: 20 }]}
        className="${f.outerClass.replace('h-56', 'h-32')}"
      >
        <${P}${sp} index={0}>
          <div className="flex h-full items-center justify-center p-6">
            <span className="font-semibold text-sm">Left</span>
          </div>
        </${P}>
        <${H}${sp} index={0} />
        <${P}${sp} index={1}>
          <div className="flex h-full items-center justify-center p-6">
            <span className="font-semibold text-sm">Right</span>
          </div>
        </${P}>
      </${R}>
    </div>`
    )}
  );
}
    `),
    [key('-rtl')]: formatCode(`
import { ${R}, ${P}, ${H} } from '../proto-ui/components/react';

export function ResizableRtlDemo() {
  return (
    ${wrapJsxBackdrop(
      f,
      `<${R}${sp}
      direction="rtl"
      defaultSizes={[50, 50]}
      constraints={[{ min: 20 }, { min: 20 }]}
      className="${f.outerClass}"
    >
      <${P}${sp} index={0}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold text-sm">واحد</span>
        </div>
      </${P}>
      <${H}${sp} index={0} withHandle />
      <${P}${sp} index={1}>
        <${R}${sp}${nested}
          orientation="vertical"
          direction="rtl"
          defaultSizes={[25, 75]}
          constraints={[{ min: 20 }, { min: 25 }]}
          className="h-full w-full min-h-0"
        >
          <${P}${sp} index={0}>
            <div className="flex h-full items-center justify-center p-6">
              <span className="font-semibold text-sm">اثنان</span>
            </div>
          </${P}>
          <${H}${sp} index={0} withHandle />
          <${P}${sp} index={1}>
            <div className="flex h-full items-center justify-center p-6">
              <span className="font-semibold text-sm">ثلاثة</span>
            </div>
          </${P}>
        </${R}>
      </${P}>
    </${R}>`
    )}
  );
}
    `),
    [key('-collapsible')]: formatCode(`
import { ${R}, ${P}, ${H} } from '../proto-ui/components/react';

export function ResizableCollapsibleDemo() {
  return (
    ${wrapJsxBackdrop(
      f,
      `<${R}${sp}
      defaultSizes={[25, 50, 25]}
      constraints={[
        { min: 15, max: 35, collapsible: true },
        { min: 30 },
        { min: 15, max: 35 },
      ]}
      className="${f.wideOuterClass}"
    >
      <${P}${sp} index={0}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold text-sm">Sidebar</span>
        </div>
      </${P}>
      <${H}${sp} index={0} withHandle />
      <${P}${sp} index={1}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold text-sm">Editor</span>
        </div>
      </${P}>
      <${H}${sp} index={1} withHandle />
      <${P}${sp} index={2}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold text-sm">Inspector</span>
        </div>
      </${P}>
    </${R}>`,
      'max-w-2xl'
    )}
  );
}
    `),
  };

  const vueTemplateHero = wrapHtmlBackdrop(
    f,
    `<${R}${sp} :defaultSizes="[50, 50]" :constraints="[{ min: 20, max: 75, collapsible: true }, { min: 25 }]" class="${f.outerClass}">
    <${P}${sp} :index="0"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">One</span></div></${P}>
    <${H}${sp} :index="0" :withHandle="true" />
    <${P}${sp} :index="1">
      <${R}${sp}${nested} orientation="vertical" :defaultSizes="[25, 75]" :constraints="[{ min: 20 }, { min: 25 }]" class="h-full w-full min-h-0">
        <${P}${sp} :index="0"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Two</span></div></${P}>
        <${H}${sp} :index="0" :withHandle="true" />
        <${P}${sp} :index="1"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Three</span></div></${P}>
      </${R}>
    </${P}>
  </${R}>`
  );

  const vueTemplateVertical = wrapHtmlBackdrop(
    f,
    `<${R}${sp} orientation="vertical" :defaultSizes="[25, 75]" :constraints="[{ min: 20 }, { min: 25 }]" class="${f.outerClass}">
    <${P}${sp} :index="0"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Header</span></div></${P}>
    <${H}${sp} :index="0" />
    <${P}${sp} :index="1"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Content</span></div></${P}>
  </${R}>`
  );

  const vueTemplateHandle = wrapHtmlBackdrop(
    f,
    `<div class="flex w-full max-w-md flex-col gap-4">
    <${R}${sp} :defaultSizes="${f.id === 'liquid-glass' ? '[25, 50, 25]' : '[25, 75]'}" :constraints="${f.id === 'liquid-glass' ? '[{ min: 15 }, { min: 30 }, { min: 15 }]' : '[{ min: 15 }, { min: 30 }]'}" class="${f.outerClass.replace('h-56', 'h-40')}">
      <${P}${sp} :index="0"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Sidebar</span></div></${P}>
      <${H}${sp} :index="0" :withHandle="true"${f.id === 'liquid-glass' ? ' prominence="regular"' : ''} />
      <${P}${sp} :index="1"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Content</span></div></${P}>${
        f.id === 'liquid-glass'
          ? `\n      <${H} :index="1" :withHandle="true" prominence="prominent" />\n      <${P} :index="2"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Details</span></div></${P}>`
          : ''
      }
    </${R}>
    <${R}${sp} :defaultSizes="[50, 50]" :constraints="[{ min: 20 }, { min: 20 }]" class="${f.outerClass.replace('h-56', 'h-32')}">
      <${P}${sp} :index="0"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Left</span></div></${P}>
      <${H}${sp} :index="0" />
      <${P}${sp} :index="1"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Right</span></div></${P}>
    </${R}>
  </div>`
  );

  const vueTemplateRtl = wrapHtmlBackdrop(
    f,
    `<${R}${sp} direction="rtl" :defaultSizes="[50, 50]" :constraints="[{ min: 20 }, { min: 20 }]" class="${f.outerClass}">
    <${P}${sp} :index="0"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">واحد</span></div></${P}>
    <${H}${sp} :index="0" :withHandle="true" />
    <${P}${sp} :index="1">
      <${R}${sp}${nested} orientation="vertical" direction="rtl" :defaultSizes="[25, 75]" :constraints="[{ min: 20 }, { min: 25 }]" class="h-full w-full min-h-0">
        <${P}${sp} :index="0"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">اثنان</span></div></${P}>
        <${H}${sp} :index="0" :withHandle="true" />
        <${P}${sp} :index="1"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">ثلاثة</span></div></${P}>
      </${R}>
    </${P}>
  </${R}>`
  );

  const vueTemplateCollapsible = wrapHtmlBackdrop(
    f,
    `<${R}${sp} :defaultSizes="[25, 50, 25]" :constraints="[{ min: 15, max: 35, collapsible: true }, { min: 30 }, { min: 15, max: 35 }]" class="${f.wideOuterClass}">
    <${P}${sp} :index="0"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Sidebar</span></div></${P}>
    <${H}${sp} :index="0" :withHandle="true" />
    <${P}${sp} :index="1"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Editor</span></div></${P}>
    <${H}${sp} :index="1" :withHandle="true" />
    <${P}${sp} :index="2"><div class="flex h-full items-center justify-center p-6"><span class="font-semibold text-sm">Inspector</span></div></${P}>
  </${R}>`,
    'max-w-2xl'
  );

  const wrapVue3 = (tpl: string) =>
    formatCode(`
<script setup lang="ts">
import { ${R}, ${P}, ${H} } from '../proto-ui/components/vue';
</script>

<template>
  ${tpl}
</template>
    `);

  const wrapVue2 = (tpl: string) =>
    formatCode(`
<template>
  ${tpl}
</template>

<script>
import { ${R}, ${P}, ${H} } from '../proto-ui/components/vue2';

export default {
  components: {
    ${R},
    ${P},
    ${H},
  },
};
</script>
    `);

  const vue: Record<string, string> = {
    [key()]: wrapVue3(vueTemplateHero),
    [key('-vertical')]: wrapVue3(vueTemplateVertical),
    [key('-handle')]: wrapVue3(vueTemplateHandle),
    [key('-rtl')]: wrapVue3(vueTemplateRtl),
    [key('-collapsible')]: wrapVue3(vueTemplateCollapsible),
  };

  const vue2: Record<string, string> = {
    [key()]: wrapVue2(vueTemplateHero),
    [key('-vertical')]: wrapVue2(vueTemplateVertical),
    [key('-handle')]: wrapVue2(vueTemplateHandle),
    [key('-rtl')]: wrapVue2(vueTemplateRtl),
    [key('-collapsible')]: wrapVue2(vueTemplateCollapsible),
  };

  return { wc, react, vue, vue2 };
}

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {},
  react: {},
  vue: {},
  vue2: {},
};

for (const family of FAMILIES) {
  const snippets = buildFamilySnippets(family);
  Object.assign(codeMap.wc, snippets.wc);
  Object.assign(codeMap.react, snippets.react);
  Object.assign(codeMap.vue, snippets.vue);
  Object.assign(codeMap.vue2, snippets.vue2);
}
