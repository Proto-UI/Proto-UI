import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-popover': formatCode(`
<shadcn-style-scope id="popover-hero-scope">
  <shadcn-popover-root a11y-label="Dimensions">
    <shadcn-popover-trigger>Open popover</shadcn-popover-trigger>
    <shadcn-popover-content class="w-80">
      <div class="grid gap-1.5">
        <shadcn-popover-title>Dimensions</shadcn-popover-title>
        <shadcn-popover-description>Set the dimensions for the layer.</shadcn-popover-description>
      </div>
      <div class="grid gap-2">
        <div class="grid grid-cols-3 items-center gap-3">
          <label for="width">Width</label>
          <input id="width" value="100%" class="col-span-2 h-8" />
        </div>
        <div class="grid grid-cols-3 items-center gap-3">
          <label for="maxWidth">Max. width</label>
          <input id="maxWidth" value="300px" class="col-span-2 h-8" />
        </div>
        <div class="grid grid-cols-3 items-center gap-3">
          <label for="height">Height</label>
          <input id="height" value="25px" class="col-span-2 h-8" />
        </div>
        <div class="grid grid-cols-3 items-center gap-3">
          <label for="maxHeight">Max. height</label>
          <input id="maxHeight" value="none" class="col-span-2 h-8" />
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <shadcn-popover-close>Done</shadcn-popover-close>
      </div>
    </shadcn-popover-content>
  </shadcn-popover-root>
</shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#popover-hero-scope'), { styleProfile: 'rhea' });
</script>
    `),
    'demo-shadcn-popover-basic': formatCode(`
<shadcn-style-scope id="popover-basic-scope">
  <shadcn-popover-root>
    <shadcn-popover-trigger>Open Popover</shadcn-popover-trigger>
    <shadcn-popover-content id="popover-basic-content">
      <shadcn-popover-title>Dimensions</shadcn-popover-title>
      <shadcn-popover-description>Set the dimensions for the layer.</shadcn-popover-description>
    </shadcn-popover-content>
  </shadcn-popover-root>
</shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#popover-basic-scope'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#popover-basic-content'), { align: 'start' });
</script>
    `),
    'demo-shadcn-popover-align': formatCode(`
<shadcn-style-scope id="popover-align-scope">
  <div class="flex gap-6">
    <shadcn-popover-root>
      <shadcn-popover-trigger>Start</shadcn-popover-trigger>
      <shadcn-popover-content data-align="start" class="w-44">Aligned to start.</shadcn-popover-content>
    </shadcn-popover-root>
    <shadcn-popover-root>
      <shadcn-popover-trigger>Center</shadcn-popover-trigger>
      <shadcn-popover-content data-align="center" class="w-44">Aligned to center.</shadcn-popover-content>
    </shadcn-popover-root>
    <shadcn-popover-root>
      <shadcn-popover-trigger>End</shadcn-popover-trigger>
      <shadcn-popover-content data-align="end" class="w-44">Aligned to end.</shadcn-popover-content>
    </shadcn-popover-root>
  </div>
</shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#popover-align-scope'), { styleProfile: 'rhea' });
  document.querySelectorAll('#popover-align-scope shadcn-popover-content').forEach((el) => {
    setElementProps(el, { align: el.getAttribute('data-align') });
  });
</script>
    `),
    'demo-shadcn-popover-sides': formatCode(`
<shadcn-style-scope id="popover-sides-scope">
  <div class="flex flex-wrap gap-3">
    <shadcn-popover-root>
      <shadcn-popover-trigger>Top</shadcn-popover-trigger>
      <shadcn-popover-content data-side="top">Side: top</shadcn-popover-content>
    </shadcn-popover-root>
    <shadcn-popover-root>
      <shadcn-popover-trigger>Right</shadcn-popover-trigger>
      <shadcn-popover-content data-side="right">Side: right</shadcn-popover-content>
    </shadcn-popover-root>
    <shadcn-popover-root>
      <shadcn-popover-trigger>Bottom</shadcn-popover-trigger>
      <shadcn-popover-content data-side="bottom">Side: bottom</shadcn-popover-content>
    </shadcn-popover-root>
    <shadcn-popover-root>
      <shadcn-popover-trigger>Left</shadcn-popover-trigger>
      <shadcn-popover-content data-side="left">Side: left</shadcn-popover-content>
    </shadcn-popover-root>
  </div>
</shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#popover-sides-scope'), { styleProfile: 'rhea' });
  document.querySelectorAll('#popover-sides-scope shadcn-popover-content').forEach((el) => {
    setElementProps(el, { side: el.getAttribute('data-side'), sideOffset: 8 });
  });
</script>
    `),
    'demo-shadcn-popover-controlled': formatCode(`
<shadcn-style-scope id="popover-ctrl-scope">
  <shadcn-popover-root id="popover-ctrl-root">
    <shadcn-popover-trigger>Quick settings</shadcn-popover-trigger>
    <shadcn-popover-content class="w-72">
      <shadcn-popover-title>Notifications</shadcn-popover-title>
      <shadcn-popover-description>Controlled by parent state via open and openChange.</shadcn-popover-description>
      <shadcn-popover-close>Dismiss</shadcn-popover-close>
    </shadcn-popover-content>
  </shadcn-popover-root>
  <shadcn-button id="popover-ctrl-open">Open externally</shadcn-button>
</shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#popover-ctrl-root');
  setElementProps(document.querySelector('#popover-ctrl-scope'), { styleProfile: 'rhea' });
  const sync = (open) => setElementProps(root, { open });
  sync(false);
  root.addEventListener('openChange', (e) => sync(e.detail.open));
  document.querySelector('#popover-ctrl-open').addEventListener('click', () => sync(true));
</script>
    `),
    'demo-shadcn-popover-navigation': formatCode(`
<shadcn-popover-root id="nav-popover-root">
  <shadcn-popover-trigger id="nav-popover-trigger">Menu</shadcn-popover-trigger>
  <shadcn-popover-content id="nav-popover-content">
    <shadcn-popover-title>Documentation navigation</shadcn-popover-title>
    <nav class="flex flex-col">
      <a href="#navigation-section-01">Navigation section 01</a>
      <a href="#navigation-section-02">Navigation section 02</a>
      <a href="#navigation-section-03">Navigation section 03</a>
    </nav>
  </shadcn-popover-content>
</shadcn-popover-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#nav-popover-root'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#nav-popover-trigger'), { presentation: 'navigation' });
  setElementProps(document.querySelector('#nav-popover-content'), { presentation: 'navigation' });
</script>
    `),
    'demo-brutalist-popover': formatCode(`
<brutalist-popover-root>
  <brutalist-popover-trigger>Open popover</brutalist-popover-trigger>
  <brutalist-popover-content class="w-80">
    <brutalist-popover-title>Dimensions</brutalist-popover-title>
    <brutalist-popover-description>Set the dimensions for the layer.</brutalist-popover-description>
    <div class="grid gap-2">
      <label>Width <input value="100%" /></label>
      <label>Height <input value="25px" /></label>
    </div>
    <brutalist-popover-close>Done</brutalist-popover-close>
  </brutalist-popover-content>
</brutalist-popover-root>
    `),
    'demo-brutalist-popover-basic': formatCode(`
<brutalist-popover-root>
  <brutalist-popover-trigger>Open Popover</brutalist-popover-trigger>
  <brutalist-popover-content id="brutalist-basic-content">
    <brutalist-popover-title>Dimensions</brutalist-popover-title>
    <brutalist-popover-description>Set the dimensions for the layer.</brutalist-popover-description>
  </brutalist-popover-content>
</brutalist-popover-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-basic-content'), { align: 'start' });
</script>
    `),
    'demo-brutalist-popover-align': formatCode(`
<div id="brutalist-align" class="flex gap-6">
  <brutalist-popover-root>
    <brutalist-popover-trigger>Start</brutalist-popover-trigger>
    <brutalist-popover-content data-align="start" class="w-44">Aligned to start.</brutalist-popover-content>
  </brutalist-popover-root>
  <brutalist-popover-root>
    <brutalist-popover-trigger>Center</brutalist-popover-trigger>
    <brutalist-popover-content data-align="center" class="w-44">Aligned to center.</brutalist-popover-content>
  </brutalist-popover-root>
  <brutalist-popover-root>
    <brutalist-popover-trigger>End</brutalist-popover-trigger>
    <brutalist-popover-content data-align="end" class="w-44">Aligned to end.</brutalist-popover-content>
  </brutalist-popover-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  document.querySelectorAll('#brutalist-align brutalist-popover-content').forEach((el) => {
    setElementProps(el, { align: el.getAttribute('data-align') });
  });
</script>
    `),
    'demo-brutalist-popover-controlled': formatCode(`
<brutalist-popover-root id="brutalist-ctrl-root">
  <brutalist-popover-trigger>Quick settings</brutalist-popover-trigger>
  <brutalist-popover-content class="w-72">
    <brutalist-popover-title>Notifications</brutalist-popover-title>
    <brutalist-popover-description>Controlled by parent state via open and openChange.</brutalist-popover-description>
    <brutalist-popover-close>Dismiss</brutalist-popover-close>
  </brutalist-popover-content>
</brutalist-popover-root>
<brutalist-button id="brutalist-ctrl-open">Open externally</brutalist-button>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#brutalist-ctrl-root');
  const sync = (open) => setElementProps(root, { open });
  sync(false);
  root.addEventListener('openChange', (e) => sync(e.detail.open));
  document.querySelector('#brutalist-ctrl-open').addEventListener('click', () => sync(true));
</script>
    `),
    'demo-brutalist-popover-navigation': formatCode(`
<brutalist-popover-root>
  <brutalist-popover-trigger id="brutalist-nav-trigger">Menu</brutalist-popover-trigger>
  <brutalist-popover-content id="brutalist-nav-content">
    <brutalist-popover-title>Documentation navigation</brutalist-popover-title>
    <nav class="flex flex-col">
      <a href="#navigation-section-01">Navigation section 01</a>
      <a href="#navigation-section-02">Navigation section 02</a>
      <a href="#navigation-section-03">Navigation section 03</a>
    </nav>
  </brutalist-popover-content>
</brutalist-popover-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-nav-trigger'), { presentation: 'navigation' });
  setElementProps(document.querySelector('#brutalist-nav-content'), { presentation: 'navigation' });
</script>
    `),
    'demo-bootstrap-2-3-2-popover': formatCode(`
<bootstrap-2-3-2-popover-root>
  <bootstrap-2-3-2-popover-trigger>Click to toggle popover</bootstrap-2-3-2-popover-trigger>
  <bootstrap-2-3-2-popover-content>
    <bootstrap-2-3-2-popover-title>Dimensions</bootstrap-2-3-2-popover-title>
    <bootstrap-2-3-2-popover-description>Set the dimensions for the layer.</bootstrap-2-3-2-popover-description>
    <div class="grid gap-2 px-[14px] pb-[10px]">
      <label>Width <input value="100%" /></label>
      <label>Height <input value="25px" /></label>
      <bootstrap-2-3-2-popover-close>Close</bootstrap-2-3-2-popover-close>
    </div>
  </bootstrap-2-3-2-popover-content>
</bootstrap-2-3-2-popover-root>
    `),
    'demo-bootstrap-2-3-2-popover-basic': formatCode(`
<bootstrap-2-3-2-popover-root>
  <bootstrap-2-3-2-popover-trigger>Open Popover</bootstrap-2-3-2-popover-trigger>
  <bootstrap-2-3-2-popover-content>
    <bootstrap-2-3-2-popover-title>Popover title</bootstrap-2-3-2-popover-title>
    <bootstrap-2-3-2-popover-description>
      And here is some helpful contextual information anchored to the right.
    </bootstrap-2-3-2-popover-description>
  </bootstrap-2-3-2-popover-content>
</bootstrap-2-3-2-popover-root>
    `),
    'demo-bootstrap-2-3-2-popover-sides': formatCode(`
<div id="bs2-sides" class="flex flex-wrap gap-3">
  <bootstrap-2-3-2-popover-root>
    <bootstrap-2-3-2-popover-trigger>Popover on top</bootstrap-2-3-2-popover-trigger>
    <bootstrap-2-3-2-popover-content data-side="top">
      <bootstrap-2-3-2-popover-title>Popover on top</bootstrap-2-3-2-popover-title>
      <bootstrap-2-3-2-popover-description>Anchored to the top edge.</bootstrap-2-3-2-popover-description>
    </bootstrap-2-3-2-popover-content>
  </bootstrap-2-3-2-popover-root>
  <bootstrap-2-3-2-popover-root>
    <bootstrap-2-3-2-popover-trigger>Popover on right</bootstrap-2-3-2-popover-trigger>
    <bootstrap-2-3-2-popover-content data-side="right">
      <bootstrap-2-3-2-popover-title>Popover on right</bootstrap-2-3-2-popover-title>
      <bootstrap-2-3-2-popover-description>Anchored to the right edge.</bootstrap-2-3-2-popover-description>
    </bootstrap-2-3-2-popover-content>
  </bootstrap-2-3-2-popover-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  document.querySelectorAll('#bs2-sides bootstrap-2-3-2-popover-content').forEach((el) => {
    setElementProps(el, { side: el.getAttribute('data-side') });
  });
</script>
    `),
    'demo-bootstrap-2-3-2-popover-controlled': formatCode(`
<bootstrap-2-3-2-popover-root id="bs2-ctrl-root">
  <bootstrap-2-3-2-popover-trigger>Quick info</bootstrap-2-3-2-popover-trigger>
  <bootstrap-2-3-2-popover-content>
    <bootstrap-2-3-2-popover-title>Controlled state</bootstrap-2-3-2-popover-title>
    <bootstrap-2-3-2-popover-description>Open and close state is owned by parent props.</bootstrap-2-3-2-popover-description>
    <bootstrap-2-3-2-popover-close>Close</bootstrap-2-3-2-popover-close>
  </bootstrap-2-3-2-popover-content>
</bootstrap-2-3-2-popover-root>
<bootstrap-2-3-2-button id="bs2-ctrl-open">Open externally</bootstrap-2-3-2-button>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#bs2-ctrl-root');
  const sync = (open) => setElementProps(root, { open });
  sync(false);
  root.addEventListener('openChange', (e) => sync(e.detail.open));
  document.querySelector('#bs2-ctrl-open').addEventListener('click', () => sync(true));
</script>
    `),
    'demo-liquid-glass-popover': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <liquid-glass-popover-root>
    <liquid-glass-popover-trigger>Open popover</liquid-glass-popover-trigger>
    <liquid-glass-popover-content>
      <liquid-glass-popover-title>Dimensions</liquid-glass-popover-title>
      <liquid-glass-popover-description>Set the dimensions for the layer.</liquid-glass-popover-description>
      <div class="grid gap-2">
        <label>Width <input value="100%" /></label>
        <label>Height <input value="25px" /></label>
      </div>
      <liquid-glass-popover-close id="lg-hero-close">Done</liquid-glass-popover-close>
    </liquid-glass-popover-content>
  </liquid-glass-popover-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-hero-close'), { prominence: 'prominent' });
</script>
    `),
    'demo-liquid-glass-popover-basic': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <liquid-glass-popover-root>
    <liquid-glass-popover-trigger>Open Popover</liquid-glass-popover-trigger>
    <liquid-glass-popover-content id="lg-basic-content">
      <liquid-glass-popover-title>Dimensions</liquid-glass-popover-title>
      <liquid-glass-popover-description>Set the dimensions for the layer.</liquid-glass-popover-description>
    </liquid-glass-popover-content>
  </liquid-glass-popover-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-basic-content'), { align: 'start' });
</script>
    `),
    'demo-liquid-glass-popover-prominence': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-4">
  <liquid-glass-popover-root>
    <liquid-glass-popover-trigger>Regular glass</liquid-glass-popover-trigger>
    <liquid-glass-popover-content id="lg-regular">
      <liquid-glass-popover-title>Regular prominence</liquid-glass-popover-title>
      <liquid-glass-popover-description>Default floating Liquid Glass layer.</liquid-glass-popover-description>
    </liquid-glass-popover-content>
  </liquid-glass-popover-root>
  <liquid-glass-popover-root>
    <liquid-glass-popover-trigger id="lg-prominent-trigger">Prominent glass</liquid-glass-popover-trigger>
    <liquid-glass-popover-content id="lg-prominent">
      <liquid-glass-popover-title>Prominent emphasis</liquid-glass-popover-title>
      <liquid-glass-popover-description>Stronger elevation and edge definition.</liquid-glass-popover-description>
    </liquid-glass-popover-content>
  </liquid-glass-popover-root>
  <liquid-glass-popover-root>
    <liquid-glass-popover-trigger>Opaque surface</liquid-glass-popover-trigger>
    <liquid-glass-popover-content id="lg-opaque">
      <liquid-glass-popover-title>Opaque opt-out</liquid-glass-popover-title>
      <liquid-glass-popover-description>Solid high-contrast surface without translucency.</liquid-glass-popover-description>
    </liquid-glass-popover-content>
  </liquid-glass-popover-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-prominent-trigger'), { prominence: 'prominent' });
  setElementProps(document.querySelector('#lg-prominent'), { prominence: 'prominent' });
  setElementProps(document.querySelector('#lg-opaque'), { material: 'opaque' });
</script>
    `),
    'demo-liquid-glass-popover-align': formatCode(`
<div id="lg-align" class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-6">
  <liquid-glass-popover-root>
    <liquid-glass-popover-trigger>Start</liquid-glass-popover-trigger>
    <liquid-glass-popover-content data-align="start" class="w-48">Aligned to start.</liquid-glass-popover-content>
  </liquid-glass-popover-root>
  <liquid-glass-popover-root>
    <liquid-glass-popover-trigger>Center</liquid-glass-popover-trigger>
    <liquid-glass-popover-content data-align="center" class="w-48">Aligned to center.</liquid-glass-popover-content>
  </liquid-glass-popover-root>
  <liquid-glass-popover-root>
    <liquid-glass-popover-trigger>End</liquid-glass-popover-trigger>
    <liquid-glass-popover-content data-align="end" class="w-48">Aligned to end.</liquid-glass-popover-content>
  </liquid-glass-popover-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  document.querySelectorAll('#lg-align liquid-glass-popover-content').forEach((el) => {
    setElementProps(el, { align: el.getAttribute('data-align') });
  });
</script>
    `),
    'demo-liquid-glass-popover-controlled': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-3">
  <liquid-glass-popover-root id="lg-ctrl-root">
    <liquid-glass-popover-trigger>Quick settings</liquid-glass-popover-trigger>
    <liquid-glass-popover-content class="w-72">
      <liquid-glass-popover-title>Focus mode</liquid-glass-popover-title>
      <liquid-glass-popover-description>Controlled by parent state via open and openChange.</liquid-glass-popover-description>
      <liquid-glass-popover-close>Done</liquid-glass-popover-close>
    </liquid-glass-popover-content>
  </liquid-glass-popover-root>
  <liquid-glass-button id="lg-ctrl-open">Open externally</liquid-glass-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#lg-ctrl-root');
  const sync = (open) => setElementProps(root, { open });
  sync(false);
  root.addEventListener('openChange', (e) => sync(e.detail.open));
  document.querySelector('#lg-ctrl-open').addEventListener('click', () => sync(true));
</script>
    `),
  },
  react: {
    'demo-shadcn-popover': formatCode(`
import { AdaptToReact } from '@proto.ui/adapter-react';
import {
  popoverRoot,
  popoverTrigger,
  popoverContent,
  popoverTitle,
  popoverDescription,
  popoverClose,
} from '@proto.ui/prototypes-shadcn/popover';

const Popover = AdaptToReact(popoverRoot);
const PopoverTrigger = AdaptToReact(popoverTrigger);
const PopoverContent = AdaptToReact(popoverContent);
const PopoverTitle = AdaptToReact(popoverTitle);
const PopoverDescription = AdaptToReact(popoverDescription);
const PopoverClose = AdaptToReact(popoverClose);

export function PopoverDemo() {
  return (
    <Popover styleProfile="rhea" a11yLabel="Dimensions">
      <PopoverTrigger>Open popover</PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-1.5">
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-3 items-center gap-3">
            <label htmlFor="width">Width</label>
            <input id="width" defaultValue="100%" className="col-span-2 h-8" />
          </div>
          <div className="grid grid-cols-3 items-center gap-3">
            <label htmlFor="maxWidth">Max. width</label>
            <input id="maxWidth" defaultValue="300px" className="col-span-2 h-8" />
          </div>
          <div className="grid grid-cols-3 items-center gap-3">
            <label htmlFor="height">Height</label>
            <input id="height" defaultValue="25px" className="col-span-2 h-8" />
          </div>
          <div className="grid grid-cols-3 items-center gap-3">
            <label htmlFor="maxHeight">Max. height</label>
            <input id="maxHeight" defaultValue="none" className="col-span-2 h-8" />
          </div>
        </div>
        <div className="flex justify-end">
          <PopoverClose>Done</PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
    `),
    'demo-shadcn-popover-basic': formatCode(`
export function PopoverBasicDemo() {
  return (
    <Popover styleProfile="rhea">
      <PopoverTrigger>Open Popover</PopoverTrigger>
      <PopoverContent align="start">
        <PopoverTitle>Dimensions</PopoverTitle>
        <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
    `),
    'demo-shadcn-popover-align': formatCode(`
export function PopoverAlignDemo() {
  return (
    <div className="flex gap-6">
      <Popover styleProfile="rhea">
        <PopoverTrigger>Start</PopoverTrigger>
        <PopoverContent align="start" className="w-44">Aligned to start.</PopoverContent>
      </Popover>
      <Popover styleProfile="rhea">
        <PopoverTrigger>Center</PopoverTrigger>
        <PopoverContent align="center" className="w-44">Aligned to center.</PopoverContent>
      </Popover>
      <Popover styleProfile="rhea">
        <PopoverTrigger>End</PopoverTrigger>
        <PopoverContent align="end" className="w-44">Aligned to end.</PopoverContent>
      </Popover>
    </div>
  );
}
    `),
    'demo-shadcn-popover-sides': formatCode(`
const sides = ['top', 'right', 'bottom', 'left'] as const;

export function PopoverSidesDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      {sides.map((side) => (
        <Popover key={side} styleProfile="rhea">
          <PopoverTrigger>{side}</PopoverTrigger>
          <PopoverContent side={side} sideOffset={8} className="w-56">
            <PopoverTitle>Side: {side}</PopoverTitle>
            <PopoverDescription>Automatically flips when space is constrained.</PopoverDescription>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
    `),
    'demo-shadcn-popover-controlled': formatCode(`
import { useState } from 'react';

export function PopoverControlledDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <Popover styleProfile="rhea" open={open} onOpenChange={(detail) => setOpen(detail.open)}>
        <PopoverTrigger>Quick settings</PopoverTrigger>
        <PopoverContent className="w-72">
          <PopoverTitle>Notifications</PopoverTitle>
          <PopoverDescription>Controlled by parent state via open and openChange.</PopoverDescription>
          <PopoverClose>Dismiss</PopoverClose>
        </PopoverContent>
      </Popover>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Open externally
      </Button>
    </div>
  );
}
    `),
    'demo-shadcn-popover-navigation': formatCode(`
export function PopoverNavigationDemo() {
  return (
    <Popover styleProfile="rhea" a11yLabel="Documentation navigation">
      <PopoverTrigger presentation="navigation">Menu</PopoverTrigger>
      <PopoverContent presentation="navigation">
        <PopoverTitle>Documentation navigation</PopoverTitle>
        <nav className="flex flex-col">
          <a href="#navigation-section-01">Navigation section 01</a>
          <a href="#navigation-section-02">Navigation section 02</a>
          <a href="#navigation-section-03">Navigation section 03</a>
        </nav>
      </PopoverContent>
    </Popover>
  );
}
    `),
    'demo-brutalist-popover': formatCode(`
import { AdaptToReact } from '@proto.ui/adapter-react';
import {
  popoverRoot,
  popoverTrigger,
  popoverContent,
  popoverTitle,
  popoverDescription,
  popoverClose,
} from '@proto.ui/prototypes-brutalist/popover';

const Popover = AdaptToReact(popoverRoot);
const PopoverTrigger = AdaptToReact(popoverTrigger);
const PopoverContent = AdaptToReact(popoverContent);
const PopoverTitle = AdaptToReact(popoverTitle);
const PopoverDescription = AdaptToReact(popoverDescription);
const PopoverClose = AdaptToReact(popoverClose);

export function BrutalistPopoverDemo() {
  return (
    <Popover a11yLabel="Dimensions">
      <PopoverTrigger>Open popover</PopoverTrigger>
      <PopoverContent className="w-80">
        <PopoverTitle>Dimensions</PopoverTitle>
        <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
        <PopoverClose>Done</PopoverClose>
      </PopoverContent>
    </Popover>
  );
}
    `),
    'demo-brutalist-popover-basic': formatCode(`
export function BrutalistPopoverBasicDemo() {
  return (
    <Popover>
      <PopoverTrigger>Open Popover</PopoverTrigger>
      <PopoverContent align="start">
        <PopoverTitle>Dimensions</PopoverTitle>
        <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
    `),
    'demo-brutalist-popover-align': formatCode(`
export function BrutalistPopoverAlignDemo() {
  return (
    <div className="flex gap-6">
      <Popover>
        <PopoverTrigger>Start</PopoverTrigger>
        <PopoverContent align="start" className="w-44">Aligned to start.</PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>Center</PopoverTrigger>
        <PopoverContent align="center" className="w-44">Aligned to center.</PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>End</PopoverTrigger>
        <PopoverContent align="end" className="w-44">Aligned to end.</PopoverContent>
      </Popover>
    </div>
  );
}
    `),
    'demo-brutalist-popover-controlled': formatCode(`
import { useState } from 'react';

export function BrutalistPopoverControlledDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <Popover open={open} onOpenChange={(detail) => setOpen(detail.open)}>
        <PopoverTrigger>Quick settings</PopoverTrigger>
        <PopoverContent className="w-72">
          <PopoverTitle>Notifications</PopoverTitle>
          <PopoverDescription>Controlled by parent state via open and openChange.</PopoverDescription>
          <PopoverClose>Dismiss</PopoverClose>
        </PopoverContent>
      </Popover>
      <BrutalistButton onClick={() => setOpen(true)}>Open externally</BrutalistButton>
    </div>
  );
}
    `),
    'demo-brutalist-popover-navigation': formatCode(`
export function BrutalistPopoverNavigationDemo() {
  return (
    <Popover a11yLabel="Documentation navigation">
      <PopoverTrigger presentation="navigation">Menu</PopoverTrigger>
      <PopoverContent presentation="navigation">
        <PopoverTitle>Documentation navigation</PopoverTitle>
        <nav className="flex flex-col">
          <a href="#navigation-section-01">Navigation section 01</a>
          <a href="#navigation-section-02">Navigation section 02</a>
          <a href="#navigation-section-03">Navigation section 03</a>
        </nav>
      </PopoverContent>
    </Popover>
  );
}
    `),
    'demo-bootstrap-2-3-2-popover': formatCode(`
import { AdaptToReact } from '@proto.ui/adapter-react';
import {
  popoverRoot,
  popoverTrigger,
  popoverContent,
  popoverTitle,
  popoverDescription,
  popoverClose,
} from '@proto.ui/prototypes-bootstrap-2-3-2/popover';

const Popover = AdaptToReact(popoverRoot);
const PopoverTrigger = AdaptToReact(popoverTrigger);
const PopoverContent = AdaptToReact(popoverContent);
const PopoverTitle = AdaptToReact(popoverTitle);
const PopoverDescription = AdaptToReact(popoverDescription);
const PopoverClose = AdaptToReact(popoverClose);

export function BootstrapPopoverDemo() {
  return (
    <Popover a11yLabel="Dimensions">
      <PopoverTrigger>Click to toggle popover</PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>Dimensions</PopoverTitle>
        <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
        <PopoverClose>Close</PopoverClose>
      </PopoverContent>
    </Popover>
  );
}
    `),
    'demo-bootstrap-2-3-2-popover-basic': formatCode(`
export function BootstrapPopoverBasicDemo() {
  return (
    <Popover>
      <PopoverTrigger>Open Popover</PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>Popover title</PopoverTitle>
        <PopoverDescription>
          And here is some helpful contextual information anchored to the right.
        </PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
    `),
    'demo-bootstrap-2-3-2-popover-sides': formatCode(`
const sides = ['top', 'right', 'bottom', 'left'] as const;

export function BootstrapPopoverSidesDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      {sides.map((side) => (
        <Popover key={side}>
          <PopoverTrigger>Popover on {side}</PopoverTrigger>
          <PopoverContent side={side}>
            <PopoverTitle>Popover on {side}</PopoverTitle>
            <PopoverDescription>Anchored to the {side} edge with a 150ms linear fade.</PopoverDescription>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-popover-controlled': formatCode(`
import { useState } from 'react';

export function BootstrapPopoverControlledDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <Popover open={open} onOpenChange={(detail) => setOpen(detail.open)}>
        <PopoverTrigger>Quick info</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Controlled state</PopoverTitle>
          <PopoverDescription>Open and close state is owned by parent props.</PopoverDescription>
          <PopoverClose>Close</PopoverClose>
        </PopoverContent>
      </Popover>
      <BootstrapButton onClick={() => setOpen(true)}>Open externally</BootstrapButton>
    </div>
  );
}
    `),
    'demo-liquid-glass-popover': formatCode(`
import { AdaptToReact } from '@proto.ui/adapter-react';
import {
  popoverRoot,
  popoverTrigger,
  popoverContent,
  popoverTitle,
  popoverDescription,
  popoverClose,
} from '@proto.ui/prototypes-liquid-glass/popover';

const Popover = AdaptToReact(popoverRoot);
const PopoverTrigger = AdaptToReact(popoverTrigger);
const PopoverContent = AdaptToReact(popoverContent);
const PopoverTitle = AdaptToReact(popoverTitle);
const PopoverDescription = AdaptToReact(popoverDescription);
const PopoverClose = AdaptToReact(popoverClose);

export function LiquidGlassPopoverDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <Popover a11yLabel="Dimensions">
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
          <PopoverClose prominence="prominent">Done</PopoverClose>
        </PopoverContent>
      </Popover>
    </div>
  );
}
    `),
    'demo-liquid-glass-popover-basic': formatCode(`
export function LiquidGlassPopoverBasicDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent align="start">
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
        </PopoverContent>
      </Popover>
    </div>
  );
}
    `),
    'demo-liquid-glass-popover-prominence': formatCode(`
export function LiquidGlassPopoverProminenceDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-4">
      <Popover>
        <PopoverTrigger prominence="regular">Regular glass</PopoverTrigger>
        <PopoverContent material="auto" prominence="regular">
          <PopoverTitle>Regular prominence</PopoverTitle>
          <PopoverDescription>Default floating Liquid Glass layer.</PopoverDescription>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger prominence="prominent">Prominent glass</PopoverTrigger>
        <PopoverContent material="auto" prominence="prominent">
          <PopoverTitle>Prominent emphasis</PopoverTitle>
          <PopoverDescription>Stronger elevation and edge definition.</PopoverDescription>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>Opaque surface</PopoverTrigger>
        <PopoverContent material="opaque">
          <PopoverTitle>Opaque opt-out</PopoverTitle>
          <PopoverDescription>Solid high-contrast surface without translucency.</PopoverDescription>
        </PopoverContent>
      </Popover>
    </div>
  );
}
    `),
    'demo-liquid-glass-popover-align': formatCode(`
export function LiquidGlassPopoverAlignDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-6">
      <Popover>
        <PopoverTrigger>Start</PopoverTrigger>
        <PopoverContent align="start" className="w-48">Aligned to start.</PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>Center</PopoverTrigger>
        <PopoverContent align="center" className="w-48">Aligned to center.</PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>End</PopoverTrigger>
        <PopoverContent align="end" className="w-48">Aligned to end.</PopoverContent>
      </Popover>
    </div>
  );
}
    `),
    'demo-liquid-glass-popover-controlled': formatCode(`
import { useState } from 'react';

export function LiquidGlassPopoverControlledDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-3">
      <Popover open={open} onOpenChange={(detail) => setOpen(detail.open)}>
        <PopoverTrigger>Quick settings</PopoverTrigger>
        <PopoverContent className="w-72">
          <PopoverTitle>Focus mode</PopoverTitle>
          <PopoverDescription>Controlled by parent state via open and openChange.</PopoverDescription>
          <PopoverClose>Done</PopoverClose>
        </PopoverContent>
      </Popover>
      <LiquidGlassButton onClick={() => setOpen(true)}>Open externally</LiquidGlassButton>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-popover': formatCode(`
<script setup lang="ts">
import { AdaptToVue } from '@proto.ui/adapter-vue';
import {
  popoverRoot,
  popoverTrigger,
  popoverContent,
  popoverTitle,
  popoverDescription,
  popoverClose,
} from '@proto.ui/prototypes-shadcn/popover';

const Popover = AdaptToVue(popoverRoot);
const PopoverTrigger = AdaptToVue(popoverTrigger);
const PopoverContent = AdaptToVue(popoverContent);
const PopoverTitle = AdaptToVue(popoverTitle);
const PopoverDescription = AdaptToVue(popoverDescription);
const PopoverClose = AdaptToVue(popoverClose);
</script>

<template>
  <Popover styleProfile="rhea" a11yLabel="Dimensions">
    <PopoverTrigger>Open popover</PopoverTrigger>
    <PopoverContent class="w-80">
      <PopoverTitle>Dimensions</PopoverTitle>
      <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
      <PopoverClose>Done</PopoverClose>
    </PopoverContent>
  </Popover>
</template>
    `),
    'demo-shadcn-popover-basic': formatCode(`
<template>
  <Popover styleProfile="rhea">
    <PopoverTrigger>Open Popover</PopoverTrigger>
    <PopoverContent align="start">
      <PopoverTitle>Dimensions</PopoverTitle>
      <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
    </PopoverContent>
  </Popover>
</template>
    `),
    'demo-shadcn-popover-align': formatCode(`
<template>
  <div class="flex gap-6">
    <Popover styleProfile="rhea">
      <PopoverTrigger>Start</PopoverTrigger>
      <PopoverContent align="start" class="w-44">Aligned to start.</PopoverContent>
    </Popover>
    <Popover styleProfile="rhea">
      <PopoverTrigger>Center</PopoverTrigger>
      <PopoverContent align="center" class="w-44">Aligned to center.</PopoverContent>
    </Popover>
    <Popover styleProfile="rhea">
      <PopoverTrigger>End</PopoverTrigger>
      <PopoverContent align="end" class="w-44">Aligned to end.</PopoverContent>
    </Popover>
  </div>
</template>
    `),
    'demo-shadcn-popover-sides': formatCode(`
<template>
  <div class="flex flex-wrap gap-3">
    <Popover v-for="side in ['top', 'right', 'bottom', 'left']" :key="side" styleProfile="rhea">
      <PopoverTrigger>{{ side }}</PopoverTrigger>
      <PopoverContent :side="side" :sideOffset="8" class="w-56">
        <PopoverTitle>Side: {{ side }}</PopoverTitle>
        <PopoverDescription>Automatically flips when space is constrained.</PopoverDescription>
      </PopoverContent>
    </Popover>
  </div>
</template>
    `),
    'demo-shadcn-popover-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
const open = ref(false);
</script>

<template>
  <div class="flex items-center gap-3">
    <Popover styleProfile="rhea" :open="open" @openChange="(detail) => (open = detail.open)">
      <PopoverTrigger>Quick settings</PopoverTrigger>
      <PopoverContent class="w-72">
        <PopoverTitle>Notifications</PopoverTitle>
        <PopoverDescription>Controlled by parent state via open and openChange.</PopoverDescription>
        <PopoverClose>Dismiss</PopoverClose>
      </PopoverContent>
    </Popover>
    <ShadcnButton variant="secondary" size="sm" @click="open = true">Open externally</ShadcnButton>
  </div>
</template>
    `),
    'demo-shadcn-popover-navigation': formatCode(`
<template>
  <Popover styleProfile="rhea" a11yLabel="Documentation navigation">
    <PopoverTrigger presentation="navigation">Menu</PopoverTrigger>
    <PopoverContent presentation="navigation">
      <PopoverTitle>Documentation navigation</PopoverTitle>
      <nav class="flex flex-col">
        <a href="#navigation-section-01">Navigation section 01</a>
        <a href="#navigation-section-02">Navigation section 02</a>
        <a href="#navigation-section-03">Navigation section 03</a>
      </nav>
    </PopoverContent>
  </Popover>
</template>
    `),
    'demo-brutalist-popover': formatCode(`
<template>
  <BrutalistPopover a11yLabel="Dimensions">
    <BrutalistPopoverTrigger>Open popover</BrutalistPopoverTrigger>
    <BrutalistPopoverContent class="w-80">
      <BrutalistPopoverTitle>Dimensions</BrutalistPopoverTitle>
      <BrutalistPopoverDescription>Set the dimensions for the layer.</BrutalistPopoverDescription>
      <BrutalistPopoverClose>Done</BrutalistPopoverClose>
    </BrutalistPopoverContent>
  </BrutalistPopover>
</template>
    `),
    'demo-brutalist-popover-basic': formatCode(`
<template>
  <BrutalistPopover>
    <BrutalistPopoverTrigger>Open Popover</BrutalistPopoverTrigger>
    <BrutalistPopoverContent align="start">
      <BrutalistPopoverTitle>Dimensions</BrutalistPopoverTitle>
      <BrutalistPopoverDescription>Set the dimensions for the layer.</BrutalistPopoverDescription>
    </BrutalistPopoverContent>
  </BrutalistPopover>
</template>
    `),
    'demo-brutalist-popover-align': formatCode(`
<template>
  <div class="flex gap-6">
    <BrutalistPopover>
      <BrutalistPopoverTrigger>Start</BrutalistPopoverTrigger>
      <BrutalistPopoverContent align="start" class="w-44">Aligned to start.</BrutalistPopoverContent>
    </BrutalistPopover>
    <BrutalistPopover>
      <BrutalistPopoverTrigger>Center</BrutalistPopoverTrigger>
      <BrutalistPopoverContent align="center" class="w-44">Aligned to center.</BrutalistPopoverContent>
    </BrutalistPopover>
    <BrutalistPopover>
      <BrutalistPopoverTrigger>End</BrutalistPopoverTrigger>
      <BrutalistPopoverContent align="end" class="w-44">Aligned to end.</BrutalistPopoverContent>
    </BrutalistPopover>
  </div>
</template>
    `),
    'demo-brutalist-popover-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
const open = ref(false);
</script>

<template>
  <div class="flex items-center gap-3">
    <BrutalistPopover :open="open" @openChange="(detail) => (open = detail.open)">
      <BrutalistPopoverTrigger>Quick settings</BrutalistPopoverTrigger>
      <BrutalistPopoverContent class="w-72">
        <BrutalistPopoverTitle>Notifications</BrutalistPopoverTitle>
        <BrutalistPopoverDescription>Controlled by parent state via open and openChange.</BrutalistPopoverDescription>
        <BrutalistPopoverClose>Dismiss</BrutalistPopoverClose>
      </BrutalistPopoverContent>
    </BrutalistPopover>
    <BrutalistButton @click="open = true">Open externally</BrutalistButton>
  </div>
</template>
    `),
    'demo-brutalist-popover-navigation': formatCode(`
<template>
  <BrutalistPopover a11yLabel="Documentation navigation">
    <BrutalistPopoverTrigger presentation="navigation">Menu</BrutalistPopoverTrigger>
    <BrutalistPopoverContent presentation="navigation">
      <BrutalistPopoverTitle>Documentation navigation</BrutalistPopoverTitle>
      <nav class="flex flex-col">
        <a href="#navigation-section-01">Navigation section 01</a>
        <a href="#navigation-section-02">Navigation section 02</a>
        <a href="#navigation-section-03">Navigation section 03</a>
      </nav>
    </BrutalistPopoverContent>
  </BrutalistPopover>
</template>
    `),
    'demo-bootstrap-2-3-2-popover': formatCode(`
<template>
  <BootstrapPopover a11yLabel="Dimensions">
    <BootstrapPopoverTrigger>Click to toggle popover</BootstrapPopoverTrigger>
    <BootstrapPopoverContent>
      <BootstrapPopoverTitle>Dimensions</BootstrapPopoverTitle>
      <BootstrapPopoverDescription>Set the dimensions for the layer.</BootstrapPopoverDescription>
      <BootstrapPopoverClose>Close</BootstrapPopoverClose>
    </BootstrapPopoverContent>
  </BootstrapPopover>
</template>
    `),
    'demo-bootstrap-2-3-2-popover-basic': formatCode(`
<template>
  <BootstrapPopover>
    <BootstrapPopoverTrigger>Open Popover</BootstrapPopoverTrigger>
    <BootstrapPopoverContent>
      <BootstrapPopoverTitle>Popover title</BootstrapPopoverTitle>
      <BootstrapPopoverDescription>
        And here is some helpful contextual information anchored to the right.
      </BootstrapPopoverDescription>
    </BootstrapPopoverContent>
  </BootstrapPopover>
</template>
    `),
    'demo-bootstrap-2-3-2-popover-sides': formatCode(`
<template>
  <div class="flex flex-wrap gap-3">
    <BootstrapPopover v-for="side in ['top', 'right', 'bottom', 'left']" :key="side">
      <BootstrapPopoverTrigger>Popover on {{ side }}</BootstrapPopoverTrigger>
      <BootstrapPopoverContent :side="side">
        <BootstrapPopoverTitle>Popover on {{ side }}</BootstrapPopoverTitle>
        <BootstrapPopoverDescription>Anchored to the {{ side }} edge.</BootstrapPopoverDescription>
      </BootstrapPopoverContent>
    </BootstrapPopover>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-popover-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
const open = ref(false);
</script>

<template>
  <div class="flex items-center gap-3">
    <BootstrapPopover :open="open" @openChange="(detail) => (open = detail.open)">
      <BootstrapPopoverTrigger>Quick info</BootstrapPopoverTrigger>
      <BootstrapPopoverContent>
        <BootstrapPopoverTitle>Controlled state</BootstrapPopoverTitle>
        <BootstrapPopoverDescription>Open and close state is owned by parent props.</BootstrapPopoverDescription>
        <BootstrapPopoverClose>Close</BootstrapPopoverClose>
      </BootstrapPopoverContent>
    </BootstrapPopover>
    <BootstrapButton @click="open = true">Open externally</BootstrapButton>
  </div>
</template>
    `),
    'demo-liquid-glass-popover': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassPopover a11yLabel="Dimensions">
      <LiquidGlassPopoverTrigger>Open popover</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent>
        <LiquidGlassPopoverTitle>Dimensions</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Set the dimensions for the layer.</LiquidGlassPopoverDescription>
        <LiquidGlassPopoverClose prominence="prominent">Done</LiquidGlassPopoverClose>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
  </div>
</template>
    `),
    'demo-liquid-glass-popover-basic': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger>Open Popover</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent align="start">
        <LiquidGlassPopoverTitle>Dimensions</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Set the dimensions for the layer.</LiquidGlassPopoverDescription>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
  </div>
</template>
    `),
    'demo-liquid-glass-popover-prominence': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-4">
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger prominence="regular">Regular glass</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent material="auto" prominence="regular">
        <LiquidGlassPopoverTitle>Regular prominence</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Default floating Liquid Glass layer.</LiquidGlassPopoverDescription>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger prominence="prominent">Prominent glass</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent material="auto" prominence="prominent">
        <LiquidGlassPopoverTitle>Prominent emphasis</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Stronger elevation and edge definition.</LiquidGlassPopoverDescription>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger>Opaque surface</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent material="opaque">
        <LiquidGlassPopoverTitle>Opaque opt-out</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Solid high-contrast surface without translucency.</LiquidGlassPopoverDescription>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
  </div>
</template>
    `),
    'demo-liquid-glass-popover-align': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-6">
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger>Start</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent align="start" class="w-48">Aligned to start.</LiquidGlassPopoverContent>
    </LiquidGlassPopover>
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger>Center</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent align="center" class="w-48">Aligned to center.</LiquidGlassPopoverContent>
    </LiquidGlassPopover>
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger>End</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent align="end" class="w-48">Aligned to end.</LiquidGlassPopoverContent>
    </LiquidGlassPopover>
  </div>
</template>
    `),
    'demo-liquid-glass-popover-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
const open = ref(false);
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-3">
    <LiquidGlassPopover :open="open" @openChange="(detail) => (open = detail.open)">
      <LiquidGlassPopoverTrigger>Quick settings</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent class="w-72">
        <LiquidGlassPopoverTitle>Focus mode</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Controlled by parent state via open and openChange.</LiquidGlassPopoverDescription>
        <LiquidGlassPopoverClose>Done</LiquidGlassPopoverClose>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
    <LiquidGlassButton @click="open = true">Open externally</LiquidGlassButton>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-popover': formatCode(`
<template>
  <Popover styleProfile="rhea" a11yLabel="Dimensions">
    <PopoverTrigger>Open popover</PopoverTrigger>
    <PopoverContent class="w-80">
      <PopoverTitle>Dimensions</PopoverTitle>
      <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
      <PopoverClose>Done</PopoverClose>
    </PopoverContent>
  </Popover>
</template>
    `),
    'demo-shadcn-popover-basic': formatCode(`
<template>
  <Popover styleProfile="rhea">
    <PopoverTrigger>Open Popover</PopoverTrigger>
    <PopoverContent align="start">
      <PopoverTitle>Dimensions</PopoverTitle>
      <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
    </PopoverContent>
  </Popover>
</template>
    `),
    'demo-shadcn-popover-align': formatCode(`
<template>
  <div class="flex gap-6">
    <Popover styleProfile="rhea">
      <PopoverTrigger>Start</PopoverTrigger>
      <PopoverContent align="start" class="w-44">Aligned to start.</PopoverContent>
    </Popover>
    <Popover styleProfile="rhea">
      <PopoverTrigger>Center</PopoverTrigger>
      <PopoverContent align="center" class="w-44">Aligned to center.</PopoverContent>
    </Popover>
    <Popover styleProfile="rhea">
      <PopoverTrigger>End</PopoverTrigger>
      <PopoverContent align="end" class="w-44">Aligned to end.</PopoverContent>
    </Popover>
  </div>
</template>
    `),
    'demo-shadcn-popover-sides': formatCode(`
<template>
  <div class="flex flex-wrap gap-3">
    <Popover v-for="side in ['top', 'right', 'bottom', 'left']" :key="side" styleProfile="rhea">
      <PopoverTrigger>{{ side }}</PopoverTrigger>
      <PopoverContent :side="side" :sideOffset="8" class="w-56">
        <PopoverTitle>Side: {{ side }}</PopoverTitle>
        <PopoverDescription>Automatically flips when space is constrained.</PopoverDescription>
      </PopoverContent>
    </Popover>
  </div>
</template>
    `),
    'demo-shadcn-popover-controlled': formatCode(`
<template>
  <div class="flex items-center gap-3">
    <Popover styleProfile="rhea" :open="open" @openChange="open = $event.open">
      <PopoverTrigger>Quick settings</PopoverTrigger>
      <PopoverContent class="w-72">
        <PopoverTitle>Notifications</PopoverTitle>
        <PopoverDescription>Controlled by parent state via open and openChange.</PopoverDescription>
        <PopoverClose>Dismiss</PopoverClose>
      </PopoverContent>
    </Popover>
    <ShadcnButton variant="secondary" size="sm" @click="open = true">Open externally</ShadcnButton>
  </div>
</template>

<script>
export default {
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-shadcn-popover-navigation': formatCode(`
<template>
  <Popover styleProfile="rhea" a11yLabel="Documentation navigation">
    <PopoverTrigger presentation="navigation">Menu</PopoverTrigger>
    <PopoverContent presentation="navigation">
      <PopoverTitle>Documentation navigation</PopoverTitle>
      <nav class="flex flex-col">
        <a href="#navigation-section-01">Navigation section 01</a>
        <a href="#navigation-section-02">Navigation section 02</a>
        <a href="#navigation-section-03">Navigation section 03</a>
      </nav>
    </PopoverContent>
  </Popover>
</template>
    `),
    'demo-brutalist-popover': formatCode(`
<template>
  <BrutalistPopover a11yLabel="Dimensions">
    <BrutalistPopoverTrigger>Open popover</BrutalistPopoverTrigger>
    <BrutalistPopoverContent class="w-80">
      <BrutalistPopoverTitle>Dimensions</BrutalistPopoverTitle>
      <BrutalistPopoverDescription>Set the dimensions for the layer.</BrutalistPopoverDescription>
      <BrutalistPopoverClose>Done</BrutalistPopoverClose>
    </BrutalistPopoverContent>
  </BrutalistPopover>
</template>
    `),
    'demo-brutalist-popover-basic': formatCode(`
<template>
  <BrutalistPopover>
    <BrutalistPopoverTrigger>Open Popover</BrutalistPopoverTrigger>
    <BrutalistPopoverContent align="start">
      <BrutalistPopoverTitle>Dimensions</BrutalistPopoverTitle>
      <BrutalistPopoverDescription>Set the dimensions for the layer.</BrutalistPopoverDescription>
    </BrutalistPopoverContent>
  </BrutalistPopover>
</template>
    `),
    'demo-brutalist-popover-align': formatCode(`
<template>
  <div class="flex gap-6">
    <BrutalistPopover>
      <BrutalistPopoverTrigger>Start</BrutalistPopoverTrigger>
      <BrutalistPopoverContent align="start" class="w-44">Aligned to start.</BrutalistPopoverContent>
    </BrutalistPopover>
    <BrutalistPopover>
      <BrutalistPopoverTrigger>Center</BrutalistPopoverTrigger>
      <BrutalistPopoverContent align="center" class="w-44">Aligned to center.</BrutalistPopoverContent>
    </BrutalistPopover>
    <BrutalistPopover>
      <BrutalistPopoverTrigger>End</BrutalistPopoverTrigger>
      <BrutalistPopoverContent align="end" class="w-44">Aligned to end.</BrutalistPopoverContent>
    </BrutalistPopover>
  </div>
</template>
    `),
    'demo-brutalist-popover-controlled': formatCode(`
<template>
  <div class="flex items-center gap-3">
    <BrutalistPopover :open="open" @openChange="open = $event.open">
      <BrutalistPopoverTrigger>Quick settings</BrutalistPopoverTrigger>
      <BrutalistPopoverContent class="w-72">
        <BrutalistPopoverTitle>Notifications</BrutalistPopoverTitle>
        <BrutalistPopoverDescription>Controlled by parent state via open and openChange.</BrutalistPopoverDescription>
        <BrutalistPopoverClose>Dismiss</BrutalistPopoverClose>
      </BrutalistPopoverContent>
    </BrutalistPopover>
    <BrutalistButton @click="open = true">Open externally</BrutalistButton>
  </div>
</template>

<script>
export default {
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-brutalist-popover-navigation': formatCode(`
<template>
  <BrutalistPopover a11yLabel="Documentation navigation">
    <BrutalistPopoverTrigger presentation="navigation">Menu</BrutalistPopoverTrigger>
    <BrutalistPopoverContent presentation="navigation">
      <BrutalistPopoverTitle>Documentation navigation</BrutalistPopoverTitle>
      <nav class="flex flex-col">
        <a href="#navigation-section-01">Navigation section 01</a>
        <a href="#navigation-section-02">Navigation section 02</a>
        <a href="#navigation-section-03">Navigation section 03</a>
      </nav>
    </BrutalistPopoverContent>
  </BrutalistPopover>
</template>
    `),
    'demo-bootstrap-2-3-2-popover': formatCode(`
<template>
  <BootstrapPopover a11yLabel="Dimensions">
    <BootstrapPopoverTrigger>Click to toggle popover</BootstrapPopoverTrigger>
    <BootstrapPopoverContent>
      <BootstrapPopoverTitle>Dimensions</BootstrapPopoverTitle>
      <BootstrapPopoverDescription>Set the dimensions for the layer.</BootstrapPopoverDescription>
      <BootstrapPopoverClose>Close</BootstrapPopoverClose>
    </BootstrapPopoverContent>
  </BootstrapPopover>
</template>
    `),
    'demo-bootstrap-2-3-2-popover-basic': formatCode(`
<template>
  <BootstrapPopover>
    <BootstrapPopoverTrigger>Open Popover</BootstrapPopoverTrigger>
    <BootstrapPopoverContent>
      <BootstrapPopoverTitle>Popover title</BootstrapPopoverTitle>
      <BootstrapPopoverDescription>
        And here is some helpful contextual information anchored to the right.
      </BootstrapPopoverDescription>
    </BootstrapPopoverContent>
  </BootstrapPopover>
</template>
    `),
    'demo-bootstrap-2-3-2-popover-sides': formatCode(`
<template>
  <div class="flex flex-wrap gap-3">
    <BootstrapPopover v-for="side in ['top', 'right', 'bottom', 'left']" :key="side">
      <BootstrapPopoverTrigger>Popover on {{ side }}</BootstrapPopoverTrigger>
      <BootstrapPopoverContent :side="side">
        <BootstrapPopoverTitle>Popover on {{ side }}</BootstrapPopoverTitle>
        <BootstrapPopoverDescription>Anchored to the {{ side }} edge.</BootstrapPopoverDescription>
      </BootstrapPopoverContent>
    </BootstrapPopover>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-popover-controlled': formatCode(`
<template>
  <div class="flex items-center gap-3">
    <BootstrapPopover :open="open" @openChange="open = $event.open">
      <BootstrapPopoverTrigger>Quick info</BootstrapPopoverTrigger>
      <BootstrapPopoverContent>
        <BootstrapPopoverTitle>Controlled state</BootstrapPopoverTitle>
        <BootstrapPopoverDescription>Open and close state is owned by parent props.</BootstrapPopoverDescription>
        <BootstrapPopoverClose>Close</BootstrapPopoverClose>
      </BootstrapPopoverContent>
    </BootstrapPopover>
    <BootstrapButton @click="open = true">Open externally</BootstrapButton>
  </div>
</template>

<script>
export default {
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-liquid-glass-popover': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassPopover a11yLabel="Dimensions">
      <LiquidGlassPopoverTrigger>Open popover</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent>
        <LiquidGlassPopoverTitle>Dimensions</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Set the dimensions for the layer.</LiquidGlassPopoverDescription>
        <LiquidGlassPopoverClose prominence="prominent">Done</LiquidGlassPopoverClose>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
  </div>
</template>
    `),
    'demo-liquid-glass-popover-basic': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger>Open Popover</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent align="start">
        <LiquidGlassPopoverTitle>Dimensions</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Set the dimensions for the layer.</LiquidGlassPopoverDescription>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
  </div>
</template>
    `),
    'demo-liquid-glass-popover-prominence': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-4">
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger prominence="regular">Regular glass</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent material="auto" prominence="regular">
        <LiquidGlassPopoverTitle>Regular prominence</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Default floating Liquid Glass layer.</LiquidGlassPopoverDescription>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger prominence="prominent">Prominent glass</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent material="auto" prominence="prominent">
        <LiquidGlassPopoverTitle>Prominent emphasis</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Stronger elevation and edge definition.</LiquidGlassPopoverDescription>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger>Opaque surface</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent material="opaque">
        <LiquidGlassPopoverTitle>Opaque opt-out</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Solid high-contrast surface without translucency.</LiquidGlassPopoverDescription>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
  </div>
</template>
    `),
    'demo-liquid-glass-popover-align': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-6">
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger>Start</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent align="start" class="w-48">Aligned to start.</LiquidGlassPopoverContent>
    </LiquidGlassPopover>
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger>Center</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent align="center" class="w-48">Aligned to center.</LiquidGlassPopoverContent>
    </LiquidGlassPopover>
    <LiquidGlassPopover>
      <LiquidGlassPopoverTrigger>End</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent align="end" class="w-48">Aligned to end.</LiquidGlassPopoverContent>
    </LiquidGlassPopover>
  </div>
</template>
    `),
    'demo-liquid-glass-popover-controlled': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex gap-3">
    <LiquidGlassPopover :open="open" @openChange="open = $event.open">
      <LiquidGlassPopoverTrigger>Quick settings</LiquidGlassPopoverTrigger>
      <LiquidGlassPopoverContent class="w-72">
        <LiquidGlassPopoverTitle>Focus mode</LiquidGlassPopoverTitle>
        <LiquidGlassPopoverDescription>Controlled by parent state via open and openChange.</LiquidGlassPopoverDescription>
        <LiquidGlassPopoverClose>Done</LiquidGlassPopoverClose>
      </LiquidGlassPopoverContent>
    </LiquidGlassPopover>
    <LiquidGlassButton @click="open = true">Open externally</LiquidGlassButton>
  </div>
</template>

<script>
export default {
  data() {
    return { open: false };
  },
};
</script>
    `),
  },
};
