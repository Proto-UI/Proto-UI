import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-scroll-area': formatCode(`
<proto-ui-shadcn-scroll-area-root class="h-72 w-full max-w-80 rounded-md border bg-background">
  <proto-ui-shadcn-scroll-area-viewport>
    <div class="flex w-[440px] flex-col p-4 text-sm">
      <div class="mb-3 font-medium">Tags</div>
      <div class="flex justify-between gap-4 whitespace-nowrap">
        <span class="font-mono text-xs font-medium">v1.2.0-beta.50</span>
        <span class="text-xs text-muted-foreground">Refine keyboard focus ring and viewport scroll inertia</span>
      </div>
      <!-- ...additional release entries -->
    </div>
  </proto-ui-shadcn-scroll-area-viewport>
  <proto-ui-shadcn-scroll-area-scrollbar orientation="vertical">
    <proto-ui-shadcn-scroll-area-thumb></proto-ui-shadcn-scroll-area-thumb>
  </proto-ui-shadcn-scroll-area-scrollbar>
  <proto-ui-shadcn-scroll-area-scrollbar orientation="horizontal">
    <proto-ui-shadcn-scroll-area-thumb></proto-ui-shadcn-scroll-area-thumb>
  </proto-ui-shadcn-scroll-area-scrollbar>
</proto-ui-shadcn-scroll-area-root>
    `),
    'demo-shadcn-scroll-area-tags': formatCode(`
<proto-ui-shadcn-scroll-area-root class="h-72 w-48 rounded-md border bg-background">
  <proto-ui-shadcn-scroll-area-viewport>
    <div class="p-4">
      <h4 class="mb-4 text-sm leading-none font-medium">Tags</h4>
      <div class="text-sm">v1.2.0-beta.50</div>
      <div class="my-2 h-px w-full bg-border"></div>
      <div class="text-sm">v1.2.0-beta.49</div>
      <!-- ...more version tags -->
    </div>
  </proto-ui-shadcn-scroll-area-viewport>
  <proto-ui-shadcn-scroll-area-scrollbar orientation="vertical">
    <proto-ui-shadcn-scroll-area-thumb></proto-ui-shadcn-scroll-area-thumb>
  </proto-ui-shadcn-scroll-area-scrollbar>
</proto-ui-shadcn-scroll-area-root>
    `),
    'demo-shadcn-scroll-area-horizontal': formatCode(`
<proto-ui-shadcn-scroll-area-root class="w-full max-w-96 rounded-md border bg-background whitespace-nowrap">
  <proto-ui-shadcn-scroll-area-viewport>
    <div class="flex w-max gap-4 p-4">
      <figure class="shrink-0">
        <div class="h-40 w-32 rounded-md bg-gradient-to-br from-amber-200 via-rose-200 to-indigo-300 p-3">
          Alpine Dawn
        </div>
        <figcaption class="pt-2 text-xs text-muted-foreground">
          Photo by <span class="font-semibold text-foreground">Ornella Binni</span>
        </figcaption>
      </figure>
      <!-- ...more artwork cards -->
    </div>
  </proto-ui-shadcn-scroll-area-viewport>
  <proto-ui-shadcn-scroll-area-scrollbar orientation="horizontal">
    <proto-ui-shadcn-scroll-area-thumb></proto-ui-shadcn-scroll-area-thumb>
  </proto-ui-shadcn-scroll-area-scrollbar>
</proto-ui-shadcn-scroll-area-root>
    `),
    'demo-shadcn-scroll-area-both-axes': formatCode(`
<proto-ui-shadcn-scroll-area-root class="h-56 w-full max-w-96 rounded-md border bg-background">
  <proto-ui-shadcn-scroll-area-viewport>
    <div class="flex w-[540px] flex-col p-4 text-xs">
      <div class="grid grid-cols-5 gap-3 border-b pb-2 font-medium text-muted-foreground">
        <span>Region</span><span>Location</span><span>Build</span><span>Latency</span><span>Status</span>
      </div>
      <!-- ...region deployment rows -->
    </div>
  </proto-ui-shadcn-scroll-area-viewport>
  <proto-ui-shadcn-scroll-area-scrollbar orientation="vertical">
    <proto-ui-shadcn-scroll-area-thumb></proto-ui-shadcn-scroll-area-thumb>
  </proto-ui-shadcn-scroll-area-scrollbar>
  <proto-ui-shadcn-scroll-area-scrollbar orientation="horizontal">
    <proto-ui-shadcn-scroll-area-thumb></proto-ui-shadcn-scroll-area-thumb>
  </proto-ui-shadcn-scroll-area-scrollbar>
</proto-ui-shadcn-scroll-area-root>
    `),
    'demo-shadcn-scroll-area-rtl': formatCode(`
<div dir="rtl">
  <proto-ui-shadcn-scroll-area-root class="h-72 w-48 rounded-md border bg-background">
    <proto-ui-shadcn-scroll-area-viewport>
      <div class="p-4 text-right">
        <h4 class="mb-4 text-sm leading-none font-medium">العلامات</h4>
        <div class="text-sm">v1.2.0-beta.50</div>
        <div class="my-2 h-px w-full bg-border"></div>
        <!-- ...more RTL entries -->
      </div>
    </proto-ui-shadcn-scroll-area-viewport>
    <proto-ui-shadcn-scroll-area-scrollbar orientation="vertical">
      <proto-ui-shadcn-scroll-area-thumb></proto-ui-shadcn-scroll-area-thumb>
    </proto-ui-shadcn-scroll-area-scrollbar>
  </proto-ui-shadcn-scroll-area-root>
</div>
    `),
    'demo-brutalist-scroll-area': formatCode(`
<div class="w-full max-w-80">
  <brutalist-scroll-area-root class="h-48 w-full">
    <brutalist-scroll-area-viewport>
      <div class="flex w-[460px] flex-col gap-2 p-3 text-sm">
        <div class="font-heading font-bold">Issue Feed — Brutalist Kit</div>
        <div class="whitespace-nowrap">#142 Shipped high-contrast focus ring tokens for dark surfaces</div>
        <!-- ...additional feed rows -->
      </div>
    </brutalist-scroll-area-viewport>
    <brutalist-scroll-area-scrollbar orientation="vertical">
      <brutalist-scroll-area-thumb></brutalist-scroll-area-thumb>
    </brutalist-scroll-area-scrollbar>
    <brutalist-scroll-area-scrollbar orientation="horizontal">
      <brutalist-scroll-area-thumb></brutalist-scroll-area-thumb>
    </brutalist-scroll-area-scrollbar>
  </brutalist-scroll-area-root>
</div>
    `),
    'demo-brutalist-scroll-area-prose': formatCode(`
<div class="w-full max-w-80">
  <brutalist-scroll-area-root class="h-48 w-full">
    <brutalist-scroll-area-viewport>
      <div class="flex flex-col gap-3 p-4 pr-7 text-sm leading-relaxed">
        <div class="font-heading text-base font-bold">The Castle Chronicle</div>
        <p>Jokester began sneaking into the castle in the middle of the night...</p>
      </div>
    </brutalist-scroll-area-viewport>
    <brutalist-scroll-area-scrollbar orientation="vertical">
      <brutalist-scroll-area-thumb></brutalist-scroll-area-thumb>
    </brutalist-scroll-area-scrollbar>
  </brutalist-scroll-area-root>
</div>
    `),
    'demo-brutalist-scroll-area-horizontal': formatCode(`
<div class="w-full max-w-96">
  <brutalist-scroll-area-root class="w-full">
    <brutalist-scroll-area-viewport>
      <div class="flex w-max gap-4 p-4 pb-7">
        <div class="shrink-0">
          <div class="flex h-36 w-32 flex-col justify-between rounded-[5px] border-2 border-black bg-[#5294ff] p-3 text-black">
            <span class="font-mono text-xs font-bold">Print 01</span>
            <span class="text-sm font-bold">Ornella Binni</span>
          </div>
          <div class="pt-2 text-xs">Photo by Ornella Binni</div>
        </div>
        <!-- ...more prints -->
      </div>
    </brutalist-scroll-area-viewport>
    <brutalist-scroll-area-scrollbar orientation="horizontal">
      <brutalist-scroll-area-thumb></brutalist-scroll-area-thumb>
    </brutalist-scroll-area-scrollbar>
  </brutalist-scroll-area-root>
</div>
    `),
    'demo-bootstrap-2-3-2-scroll-area': formatCode(`
<div class="w-full max-w-80">
  <bootstrap-2-3-2-scroll-area-root class="h-48 w-full">
    <bootstrap-2-3-2-scroll-area-viewport>
      <div class="flex w-[500px] flex-col p-3 text-xs leading-5">
        <div class="mb-2 border-b border-[#e5e5e5] pb-1.5 text-sm font-bold">Operations Log</div>
        <!-- ...server event lines -->
      </div>
    </bootstrap-2-3-2-scroll-area-viewport>
    <bootstrap-2-3-2-scroll-area-scrollbar orientation="vertical">
      <bootstrap-2-3-2-scroll-area-thumb></bootstrap-2-3-2-scroll-area-thumb>
    </bootstrap-2-3-2-scroll-area-scrollbar>
    <bootstrap-2-3-2-scroll-area-scrollbar orientation="horizontal">
      <bootstrap-2-3-2-scroll-area-thumb></bootstrap-2-3-2-scroll-area-thumb>
    </bootstrap-2-3-2-scroll-area-scrollbar>
  </bootstrap-2-3-2-scroll-area-root>
</div>
    `),
    'demo-bootstrap-2-3-2-scroll-area-tags': formatCode(`
<bootstrap-2-3-2-scroll-area-root class="h-60 w-64">
  <bootstrap-2-3-2-scroll-area-viewport>
    <div class="p-3 pr-5 text-xs leading-5">
      <div class="mb-2 border-b border-[#ddd] pb-1.5 text-sm font-bold">Release Archive</div>
      <div class="border-b border-[#eee] py-1.5">v2.3.2 — Final 2.x maintenance release</div>
      <!-- ...more releases -->
    </div>
  </bootstrap-2-3-2-scroll-area-viewport>
  <bootstrap-2-3-2-scroll-area-scrollbar orientation="vertical">
    <bootstrap-2-3-2-scroll-area-thumb></bootstrap-2-3-2-scroll-area-thumb>
  </bootstrap-2-3-2-scroll-area-scrollbar>
</bootstrap-2-3-2-scroll-area-root>
    `),
    'demo-bootstrap-2-3-2-scroll-area-horizontal': formatCode(`
<bootstrap-2-3-2-scroll-area-root class="w-full max-w-96">
  <bootstrap-2-3-2-scroll-area-viewport>
    <div class="flex w-max gap-3 p-3 pb-5">
      <div class="w-36 shrink-0 rounded-[4px] border border-[#ddd] bg-[#fff] p-1.5">
        <div class="flex h-24 items-center justify-center rounded-[3px] bg-[#d9edf7] text-xs font-bold text-[#3a87ad]">
          Grid Layout
        </div>
        <div class="px-1 pt-2 text-xs text-[#555]">12-column classic</div>
      </div>
      <!-- ...more thumbnail cards -->
    </div>
  </bootstrap-2-3-2-scroll-area-viewport>
  <bootstrap-2-3-2-scroll-area-scrollbar orientation="horizontal">
    <bootstrap-2-3-2-scroll-area-thumb></bootstrap-2-3-2-scroll-area-thumb>
  </bootstrap-2-3-2-scroll-area-scrollbar>
</bootstrap-2-3-2-scroll-area-root>
    `),
    'demo-liquid-glass-scroll-area': formatCode(`
<div class="w-full max-w-96 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
  <liquid-glass-scroll-area-root class="h-56 w-full rounded-xl border border-border/60 bg-background/90 shadow-sm">
    <liquid-glass-scroll-area-viewport>
      <div class="flex w-[480px] flex-col p-4 text-sm">
        <div class="mb-3 font-semibold">Release Highlights</div>
        <!-- ...scrollable feed items -->
      </div>
    </liquid-glass-scroll-area-viewport>
    <liquid-glass-scroll-area-scrollbar orientation="vertical">
      <liquid-glass-scroll-area-thumb></liquid-glass-scroll-area-thumb>
    </liquid-glass-scroll-area-scrollbar>
    <liquid-glass-scroll-area-scrollbar orientation="horizontal">
      <liquid-glass-scroll-area-thumb></liquid-glass-scroll-area-thumb>
    </liquid-glass-scroll-area-scrollbar>
  </liquid-glass-scroll-area-root>
</div>
    `),
    'demo-liquid-glass-scroll-area-tags': formatCode(`
<div class="flex justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <liquid-glass-scroll-area-root class="h-64 w-52 rounded-xl border border-border/60 bg-background/90 shadow-sm">
    <liquid-glass-scroll-area-viewport>
      <div class="p-4">
        <div class="mb-3 text-sm font-semibold">Builds</div>
        <div class="text-sm">26.0 Beta 24</div>
        <!-- ...more builds -->
      </div>
    </liquid-glass-scroll-area-viewport>
    <liquid-glass-scroll-area-scrollbar orientation="vertical">
      <liquid-glass-scroll-area-thumb></liquid-glass-scroll-area-thumb>
    </liquid-glass-scroll-area-scrollbar>
  </liquid-glass-scroll-area-root>
</div>
    `),
    'demo-liquid-glass-scroll-area-horizontal': formatCode(`
<div class="w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
  <liquid-glass-scroll-area-root class="w-full rounded-xl border border-border/60 bg-background/90 shadow-sm">
    <liquid-glass-scroll-area-viewport>
      <div class="flex w-max gap-3.5 p-4">
        <div class="shrink-0">
          <div class="flex h-36 w-32 flex-col justify-end rounded-lg bg-gradient-to-br from-sky-400/70 to-indigo-500/70 p-3 text-white">
            Big Sur Mist
          </div>
          <div class="pt-2 text-xs text-muted-foreground">Ornella Binni</div>
        </div>
        <!-- ...more scenes -->
      </div>
    </liquid-glass-scroll-area-viewport>
    <liquid-glass-scroll-area-scrollbar orientation="horizontal">
      <liquid-glass-scroll-area-thumb></liquid-glass-scroll-area-thumb>
    </liquid-glass-scroll-area-scrollbar>
  </liquid-glass-scroll-area-root>
</div>
    `),
    'demo-liquid-glass-scroll-area-floating-bar': formatCode(`
<div class="w-full max-w-96 rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-5">
  <div class="overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-sm">
    <div class="flex items-center justify-between gap-2 border-b border-border/60 bg-background/70 px-3 py-2.5 backdrop-blur-xs">
      <liquid-glass-button variant="regular">Library</liquid-glass-button>
      <liquid-glass-button variant="prominent">Play All</liquid-glass-button>
    </div>
    <liquid-glass-scroll-area-root class="h-48 w-full">
      <liquid-glass-scroll-area-viewport>
        <div class="flex flex-col p-3.5 text-sm">
          <!-- ...scrollable playlist rows -->
        </div>
      </liquid-glass-scroll-area-viewport>
      <liquid-glass-scroll-area-scrollbar orientation="vertical">
        <liquid-glass-scroll-area-thumb></liquid-glass-scroll-area-thumb>
      </liquid-glass-scroll-area-scrollbar>
    </liquid-glass-scroll-area-root>
  </div>
</div>
    `),
  },
  react: {
    'demo-shadcn-scroll-area': formatCode(`
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/react';

export function ScrollAreaDemo() {
  return (
    <ShadcnScrollAreaRoot styleProfile="rhea" className="h-72 w-full max-w-80 rounded-md border bg-background">
      <ShadcnScrollAreaViewport>
        <div className="flex w-[440px] flex-col p-4 text-sm">
          <div className="mb-3 font-medium">Tags</div>
          {/* Release entries */}
        </div>
      </ShadcnScrollAreaViewport>
      <ShadcnScrollAreaScrollbar orientation="vertical">
        <ShadcnScrollAreaThumb />
      </ShadcnScrollAreaScrollbar>
      <ShadcnScrollAreaScrollbar orientation="horizontal">
        <ShadcnScrollAreaThumb />
      </ShadcnScrollAreaScrollbar>
    </ShadcnScrollAreaRoot>
  );
}
    `),
    'demo-shadcn-scroll-area-tags': formatCode(`
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/react';

const tags = Array.from({ length: 30 }, (_, i) => \`v1.2.0-beta.\${50 - i}\`);

export function ScrollAreaTagsDemo() {
  return (
    <ShadcnScrollAreaRoot styleProfile="rhea" className="h-72 w-48 rounded-md border bg-background">
      <ShadcnScrollAreaViewport>
        <div className="p-4">
          <h4 className="mb-4 text-sm leading-none font-medium">Tags</h4>
          {tags.map((tag) => (
            <div key={tag}>
              <div className="text-sm">{tag}</div>
              <div className="my-2 h-px w-full bg-border" />
            </div>
          ))}
        </div>
      </ShadcnScrollAreaViewport>
      <ShadcnScrollAreaScrollbar orientation="vertical">
        <ShadcnScrollAreaThumb />
      </ShadcnScrollAreaScrollbar>
    </ShadcnScrollAreaRoot>
  );
}
    `),
    'demo-shadcn-scroll-area-horizontal': formatCode(`
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/react';

export function ScrollAreaHorizontalDemo() {
  return (
    <ShadcnScrollAreaRoot styleProfile="rhea" className="w-full max-w-96 rounded-md border bg-background whitespace-nowrap">
      <ShadcnScrollAreaViewport>
        <div className="flex w-max gap-4 p-4">
          {/* Artwork cards */}
        </div>
      </ShadcnScrollAreaViewport>
      <ShadcnScrollAreaScrollbar orientation="horizontal">
        <ShadcnScrollAreaThumb />
      </ShadcnScrollAreaScrollbar>
    </ShadcnScrollAreaRoot>
  );
}
    `),
    'demo-shadcn-scroll-area-both-axes': formatCode(`
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/react';

export function ScrollAreaBothAxesDemo() {
  return (
    <ShadcnScrollAreaRoot styleProfile="rhea" className="h-56 w-full max-w-96 rounded-md border bg-background">
      <ShadcnScrollAreaViewport>
        <div className="flex w-[540px] flex-col p-4 text-xs">
          {/* Region deployment table */}
        </div>
      </ShadcnScrollAreaViewport>
      <ShadcnScrollAreaScrollbar orientation="vertical">
        <ShadcnScrollAreaThumb />
      </ShadcnScrollAreaScrollbar>
      <ShadcnScrollAreaScrollbar orientation="horizontal">
        <ShadcnScrollAreaThumb />
      </ShadcnScrollAreaScrollbar>
    </ShadcnScrollAreaRoot>
  );
}
    `),
    'demo-shadcn-scroll-area-rtl': formatCode(`
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/react';

export function ScrollAreaRtlDemo() {
  return (
    <div dir="rtl">
      <ShadcnScrollAreaRoot styleProfile="rhea" className="h-72 w-48 rounded-md border bg-background">
        <ShadcnScrollAreaViewport>
          <div className="p-4 text-right">
            <h4 className="mb-4 text-sm leading-none font-medium">العلامات</h4>
            {/* RTL tag rows */}
          </div>
        </ShadcnScrollAreaViewport>
        <ShadcnScrollAreaScrollbar orientation="vertical">
          <ShadcnScrollAreaThumb />
        </ShadcnScrollAreaScrollbar>
      </ShadcnScrollAreaRoot>
    </div>
  );
}
    `),
    'demo-brutalist-scroll-area': formatCode(`
import {
  BrutalistScrollAreaRoot,
  BrutalistScrollAreaViewport,
  BrutalistScrollAreaScrollbar,
  BrutalistScrollAreaThumb,
} from '../proto-ui/components/react';

export function BrutalistScrollAreaDemo() {
  return (
    <div className="w-full max-w-80">
      <BrutalistScrollAreaRoot className="h-48 w-full">
        <BrutalistScrollAreaViewport>
          <div className="flex w-[460px] flex-col gap-2 p-3 text-sm">
            <div className="font-heading font-bold">Issue Feed — Brutalist Kit</div>
            {/* Feed rows */}
          </div>
        </BrutalistScrollAreaViewport>
        <BrutalistScrollAreaScrollbar orientation="vertical">
          <BrutalistScrollAreaThumb />
        </BrutalistScrollAreaScrollbar>
        <BrutalistScrollAreaScrollbar orientation="horizontal">
          <BrutalistScrollAreaThumb />
        </BrutalistScrollAreaScrollbar>
      </BrutalistScrollAreaRoot>
    </div>
  );
}
    `),
    'demo-brutalist-scroll-area-prose': formatCode(`
import {
  BrutalistScrollAreaRoot,
  BrutalistScrollAreaViewport,
  BrutalistScrollAreaScrollbar,
  BrutalistScrollAreaThumb,
} from '../proto-ui/components/react';

export function BrutalistScrollAreaProseDemo() {
  return (
    <div className="w-full max-w-80">
      <BrutalistScrollAreaRoot className="h-48 w-full">
        <BrutalistScrollAreaViewport>
          <div className="flex flex-col gap-3 p-4 pr-7 text-sm leading-relaxed">
            <div className="font-heading text-base font-bold">The Castle Chronicle</div>
            <p>Jokester began sneaking into the castle in the middle of the night...</p>
          </div>
        </BrutalistScrollAreaViewport>
        <BrutalistScrollAreaScrollbar orientation="vertical">
          <BrutalistScrollAreaThumb />
        </BrutalistScrollAreaScrollbar>
      </BrutalistScrollAreaRoot>
    </div>
  );
}
    `),
    'demo-brutalist-scroll-area-horizontal': formatCode(`
import {
  BrutalistScrollAreaRoot,
  BrutalistScrollAreaViewport,
  BrutalistScrollAreaScrollbar,
  BrutalistScrollAreaThumb,
} from '../proto-ui/components/react';

export function BrutalistScrollAreaHorizontalDemo() {
  return (
    <div className="w-full max-w-96">
      <BrutalistScrollAreaRoot className="w-full">
        <BrutalistScrollAreaViewport>
          <div className="flex w-max gap-4 p-4 pb-7">
            {/* Brutalist print cards */}
          </div>
        </BrutalistScrollAreaViewport>
        <BrutalistScrollAreaScrollbar orientation="horizontal">
          <BrutalistScrollAreaThumb />
        </BrutalistScrollAreaScrollbar>
      </BrutalistScrollAreaRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-scroll-area': formatCode(`
import {
  BootstrapScrollAreaRoot,
  BootstrapScrollAreaViewport,
  BootstrapScrollAreaScrollbar,
  BootstrapScrollAreaThumb,
} from '../proto-ui/components/react';

export function BootstrapScrollAreaDemo() {
  return (
    <div className="w-full max-w-80">
      <BootstrapScrollAreaRoot className="h-48 w-full">
        <BootstrapScrollAreaViewport>
          <div className="flex w-[500px] flex-col p-3 text-xs leading-5">
            <div className="mb-2 border-b border-[#e5e5e5] pb-1.5 text-sm font-bold">Operations Log</div>
            {/* Server events */}
          </div>
        </BootstrapScrollAreaViewport>
        <BootstrapScrollAreaScrollbar orientation="vertical">
          <BootstrapScrollAreaThumb />
        </BootstrapScrollAreaScrollbar>
        <BootstrapScrollAreaScrollbar orientation="horizontal">
          <BootstrapScrollAreaThumb />
        </BootstrapScrollAreaScrollbar>
      </BootstrapScrollAreaRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-scroll-area-tags': formatCode(`
import {
  BootstrapScrollAreaRoot,
  BootstrapScrollAreaViewport,
  BootstrapScrollAreaScrollbar,
  BootstrapScrollAreaThumb,
} from '../proto-ui/components/react';

export function BootstrapScrollAreaTagsDemo() {
  return (
    <BootstrapScrollAreaRoot className="h-60 w-64">
      <BootstrapScrollAreaViewport>
        <div className="p-3 pr-5 text-xs leading-5">
          <div className="mb-2 border-b border-[#ddd] pb-1.5 text-sm font-bold">Release Archive</div>
          {/* Archive rows */}
        </div>
      </BootstrapScrollAreaViewport>
      <BootstrapScrollAreaScrollbar orientation="vertical">
        <BootstrapScrollAreaThumb />
      </BootstrapScrollAreaScrollbar>
    </BootstrapScrollAreaRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-scroll-area-horizontal': formatCode(`
import {
  BootstrapScrollAreaRoot,
  BootstrapScrollAreaViewport,
  BootstrapScrollAreaScrollbar,
  BootstrapScrollAreaThumb,
} from '../proto-ui/components/react';

export function BootstrapScrollAreaHorizontalDemo() {
  return (
    <BootstrapScrollAreaRoot className="w-full max-w-96">
      <BootstrapScrollAreaViewport>
        <div className="flex w-max gap-3 p-3 pb-5">
          {/* Thumbnail cards */}
        </div>
      </BootstrapScrollAreaViewport>
      <BootstrapScrollAreaScrollbar orientation="horizontal">
        <BootstrapScrollAreaThumb />
      </BootstrapScrollAreaScrollbar>
    </BootstrapScrollAreaRoot>
  );
}
    `),
    'demo-liquid-glass-scroll-area': formatCode(`
import {
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/react';

export function LiquidGlassScrollAreaDemo() {
  return (
    <div className="w-full max-w-96 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
      <LiquidGlassScrollAreaRoot className="h-56 w-full rounded-xl border border-border/60 bg-background/90 shadow-sm">
        <LiquidGlassScrollAreaViewport>
          <div className="flex w-[480px] flex-col p-4 text-sm">
            <div className="mb-3 font-semibold">Release Highlights</div>
            {/* Feed rows */}
          </div>
        </LiquidGlassScrollAreaViewport>
        <LiquidGlassScrollAreaScrollbar orientation="vertical">
          <LiquidGlassScrollAreaThumb />
        </LiquidGlassScrollAreaScrollbar>
        <LiquidGlassScrollAreaScrollbar orientation="horizontal">
          <LiquidGlassScrollAreaThumb />
        </LiquidGlassScrollAreaScrollbar>
      </LiquidGlassScrollAreaRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-scroll-area-tags': formatCode(`
import {
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/react';

export function LiquidGlassScrollAreaTagsDemo() {
  return (
    <div className="flex justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassScrollAreaRoot className="h-64 w-52 rounded-xl border border-border/60 bg-background/90 shadow-sm">
        <LiquidGlassScrollAreaViewport>
          <div className="p-4">
            <div className="mb-3 text-sm font-semibold">Builds</div>
            {/* Build tags */}
          </div>
        </LiquidGlassScrollAreaViewport>
        <LiquidGlassScrollAreaScrollbar orientation="vertical">
          <LiquidGlassScrollAreaThumb />
        </LiquidGlassScrollAreaScrollbar>
      </LiquidGlassScrollAreaRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-scroll-area-horizontal': formatCode(`
import {
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/react';

export function LiquidGlassScrollAreaHorizontalDemo() {
  return (
    <div className="w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
      <LiquidGlassScrollAreaRoot className="w-full rounded-xl border border-border/60 bg-background/90 shadow-sm">
        <LiquidGlassScrollAreaViewport>
          <div className="flex w-max gap-3.5 p-4">
            {/* Scene cards */}
          </div>
        </LiquidGlassScrollAreaViewport>
        <LiquidGlassScrollAreaScrollbar orientation="horizontal">
          <LiquidGlassScrollAreaThumb />
        </LiquidGlassScrollAreaScrollbar>
      </LiquidGlassScrollAreaRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-scroll-area-floating-bar': formatCode(`
import {
  LiquidGlassButton,
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/react';

export function LiquidGlassFloatingBarDemo() {
  return (
    <div className="w-full max-w-96 rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-5">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-background/70 px-3 py-2.5 backdrop-blur-xs">
          <LiquidGlassButton variant="regular">Library</LiquidGlassButton>
          <LiquidGlassButton variant="prominent">Play All</LiquidGlassButton>
        </div>
        <LiquidGlassScrollAreaRoot className="h-48 w-full">
          <LiquidGlassScrollAreaViewport>
            <div className="flex flex-col p-3.5 text-sm">{/* Playlist tracks */}</div>
          </LiquidGlassScrollAreaViewport>
          <LiquidGlassScrollAreaScrollbar orientation="vertical">
            <LiquidGlassScrollAreaThumb />
          </LiquidGlassScrollAreaScrollbar>
        </LiquidGlassScrollAreaRoot>
      </div>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-scroll-area': formatCode(`
<template>
  <ShadcnScrollAreaRoot style-profile="rhea" class="h-72 w-full max-w-80 rounded-md border bg-background">
    <ShadcnScrollAreaViewport>
      <div class="flex w-[440px] flex-col p-4 text-sm">
        <div class="mb-3 font-medium">Tags</div>
        <!-- Release entries -->
      </div>
    </ShadcnScrollAreaViewport>
    <ShadcnScrollAreaScrollbar orientation="vertical">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
    <ShadcnScrollAreaScrollbar orientation="horizontal">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
  </ShadcnScrollAreaRoot>
</template>

<script setup>
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-shadcn-scroll-area-tags': formatCode(`
<template>
  <ShadcnScrollAreaRoot style-profile="rhea" class="h-72 w-48 rounded-md border bg-background">
    <ShadcnScrollAreaViewport>
      <div class="p-4">
        <h4 class="mb-4 text-sm leading-none font-medium">Tags</h4>
        <div v-for="tag in tags" :key="tag">
          <div class="text-sm">{{ tag }}</div>
          <div class="my-2 h-px w-full bg-border" />
        </div>
      </div>
    </ShadcnScrollAreaViewport>
    <ShadcnScrollAreaScrollbar orientation="vertical">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
  </ShadcnScrollAreaRoot>
</template>

<script setup>
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/vue';

const tags = Array.from({ length: 30 }, (_, i) => \`v1.2.0-beta.\${50 - i}\`);
</script>
    `),
    'demo-shadcn-scroll-area-horizontal': formatCode(`
<template>
  <ShadcnScrollAreaRoot style-profile="rhea" class="w-full max-w-96 rounded-md border bg-background whitespace-nowrap">
    <ShadcnScrollAreaViewport>
      <div class="flex w-max gap-4 p-4">
        <!-- Artwork cards -->
      </div>
    </ShadcnScrollAreaViewport>
    <ShadcnScrollAreaScrollbar orientation="horizontal">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
  </ShadcnScrollAreaRoot>
</template>

<script setup>
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-shadcn-scroll-area-both-axes': formatCode(`
<template>
  <ShadcnScrollAreaRoot style-profile="rhea" class="h-56 w-full max-w-96 rounded-md border bg-background">
    <ShadcnScrollAreaViewport>
      <div class="flex w-[540px] flex-col p-4 text-xs">
        <!-- Region deployment matrix -->
      </div>
    </ShadcnScrollAreaViewport>
    <ShadcnScrollAreaScrollbar orientation="vertical">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
    <ShadcnScrollAreaScrollbar orientation="horizontal">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
  </ShadcnScrollAreaRoot>
</template>

<script setup>
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-shadcn-scroll-area-rtl': formatCode(`
<template>
  <div dir="rtl">
    <ShadcnScrollAreaRoot style-profile="rhea" class="h-72 w-48 rounded-md border bg-background">
      <ShadcnScrollAreaViewport>
        <div class="p-4 text-right">
          <h4 class="mb-4 text-sm leading-none font-medium">العلامات</h4>
          <!-- RTL tag rows -->
        </div>
      </ShadcnScrollAreaViewport>
      <ShadcnScrollAreaScrollbar orientation="vertical">
        <ShadcnScrollAreaThumb />
      </ShadcnScrollAreaScrollbar>
    </ShadcnScrollAreaRoot>
  </div>
</template>

<script setup>
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-brutalist-scroll-area': formatCode(`
<template>
  <div class="w-full max-w-80">
    <BrutalistScrollAreaRoot class="h-48 w-full">
      <BrutalistScrollAreaViewport>
        <div class="flex w-[460px] flex-col gap-2 p-3 text-sm">
          <div class="font-heading font-bold">Issue Feed — Brutalist Kit</div>
          <!-- Feed rows -->
        </div>
      </BrutalistScrollAreaViewport>
      <BrutalistScrollAreaScrollbar orientation="vertical">
        <BrutalistScrollAreaThumb />
      </BrutalistScrollAreaScrollbar>
      <BrutalistScrollAreaScrollbar orientation="horizontal">
        <BrutalistScrollAreaThumb />
      </BrutalistScrollAreaScrollbar>
    </BrutalistScrollAreaRoot>
  </div>
</template>

<script setup>
import {
  BrutalistScrollAreaRoot,
  BrutalistScrollAreaViewport,
  BrutalistScrollAreaScrollbar,
  BrutalistScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-brutalist-scroll-area-prose': formatCode(`
<template>
  <div class="w-full max-w-80">
    <BrutalistScrollAreaRoot class="h-48 w-full">
      <BrutalistScrollAreaViewport>
        <div class="flex flex-col gap-3 p-4 pr-7 text-sm leading-relaxed">
          <div class="font-heading text-base font-bold">The Castle Chronicle</div>
          <p>Jokester began sneaking into the castle in the middle of the night...</p>
        </div>
      </BrutalistScrollAreaViewport>
      <BrutalistScrollAreaScrollbar orientation="vertical">
        <BrutalistScrollAreaThumb />
      </BrutalistScrollAreaScrollbar>
    </BrutalistScrollAreaRoot>
  </div>
</template>

<script setup>
import {
  BrutalistScrollAreaRoot,
  BrutalistScrollAreaViewport,
  BrutalistScrollAreaScrollbar,
  BrutalistScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-brutalist-scroll-area-horizontal': formatCode(`
<template>
  <div class="w-full max-w-96">
    <BrutalistScrollAreaRoot class="w-full">
      <BrutalistScrollAreaViewport>
        <div class="flex w-max gap-4 p-4 pb-7">
          <!-- Brutalist print cards -->
        </div>
      </BrutalistScrollAreaViewport>
      <BrutalistScrollAreaScrollbar orientation="horizontal">
        <BrutalistScrollAreaThumb />
      </BrutalistScrollAreaScrollbar>
    </BrutalistScrollAreaRoot>
  </div>
</template>

<script setup>
import {
  BrutalistScrollAreaRoot,
  BrutalistScrollAreaViewport,
  BrutalistScrollAreaScrollbar,
  BrutalistScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-bootstrap-2-3-2-scroll-area': formatCode(`
<template>
  <div class="w-full max-w-80">
    <BootstrapScrollAreaRoot class="h-48 w-full">
      <BootstrapScrollAreaViewport>
        <div class="flex w-[500px] flex-col p-3 text-xs leading-5">
          <div class="mb-2 border-b border-[#e5e5e5] pb-1.5 text-sm font-bold">Operations Log</div>
          <!-- Server events -->
        </div>
      </BootstrapScrollAreaViewport>
      <BootstrapScrollAreaScrollbar orientation="vertical">
        <BootstrapScrollAreaThumb />
      </BootstrapScrollAreaScrollbar>
      <BootstrapScrollAreaScrollbar orientation="horizontal">
        <BootstrapScrollAreaThumb />
      </BootstrapScrollAreaScrollbar>
    </BootstrapScrollAreaRoot>
  </div>
</template>

<script setup>
import {
  BootstrapScrollAreaRoot,
  BootstrapScrollAreaViewport,
  BootstrapScrollAreaScrollbar,
  BootstrapScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-bootstrap-2-3-2-scroll-area-tags': formatCode(`
<template>
  <BootstrapScrollAreaRoot class="h-60 w-64">
    <BootstrapScrollAreaViewport>
      <div class="p-3 pr-5 text-xs leading-5">
        <div class="mb-2 border-b border-[#ddd] pb-1.5 text-sm font-bold">Release Archive</div>
        <!-- Release rows -->
      </div>
    </BootstrapScrollAreaViewport>
    <BootstrapScrollAreaScrollbar orientation="vertical">
      <BootstrapScrollAreaThumb />
    </BootstrapScrollAreaScrollbar>
  </BootstrapScrollAreaRoot>
</template>

<script setup>
import {
  BootstrapScrollAreaRoot,
  BootstrapScrollAreaViewport,
  BootstrapScrollAreaScrollbar,
  BootstrapScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-bootstrap-2-3-2-scroll-area-horizontal': formatCode(`
<template>
  <BootstrapScrollAreaRoot class="w-full max-w-96">
    <BootstrapScrollAreaViewport>
      <div class="flex w-max gap-3 p-3 pb-5">
        <!-- Classic thumbnail cards -->
      </div>
    </BootstrapScrollAreaViewport>
    <BootstrapScrollAreaScrollbar orientation="horizontal">
      <BootstrapScrollAreaThumb />
    </BootstrapScrollAreaScrollbar>
  </BootstrapScrollAreaRoot>
</template>

<script setup>
import {
  BootstrapScrollAreaRoot,
  BootstrapScrollAreaViewport,
  BootstrapScrollAreaScrollbar,
  BootstrapScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-liquid-glass-scroll-area': formatCode(`
<template>
  <div class="w-full max-w-96 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassScrollAreaRoot class="h-56 w-full rounded-xl border border-border/60 bg-background/90 shadow-sm">
      <LiquidGlassScrollAreaViewport>
        <div class="flex w-[480px] flex-col p-4 text-sm">
          <div class="mb-3 font-semibold">Release Highlights</div>
          <!-- Feed items -->
        </div>
      </LiquidGlassScrollAreaViewport>
      <LiquidGlassScrollAreaScrollbar orientation="vertical">
        <LiquidGlassScrollAreaThumb />
      </LiquidGlassScrollAreaScrollbar>
      <LiquidGlassScrollAreaScrollbar orientation="horizontal">
        <LiquidGlassScrollAreaThumb />
      </LiquidGlassScrollAreaScrollbar>
    </LiquidGlassScrollAreaRoot>
  </div>
</template>

<script setup>
import {
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-liquid-glass-scroll-area-tags': formatCode(`
<template>
  <div class="flex justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassScrollAreaRoot class="h-64 w-52 rounded-xl border border-border/60 bg-background/90 shadow-sm">
      <LiquidGlassScrollAreaViewport>
        <div class="p-4">
          <div class="mb-3 text-sm font-semibold">Builds</div>
          <!-- Build tags -->
        </div>
      </LiquidGlassScrollAreaViewport>
      <LiquidGlassScrollAreaScrollbar orientation="vertical">
        <LiquidGlassScrollAreaThumb />
      </LiquidGlassScrollAreaScrollbar>
    </LiquidGlassScrollAreaRoot>
  </div>
</template>

<script setup>
import {
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-liquid-glass-scroll-area-horizontal': formatCode(`
<template>
  <div class="w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassScrollAreaRoot class="w-full rounded-xl border border-border/60 bg-background/90 shadow-sm">
      <LiquidGlassScrollAreaViewport>
        <div class="flex w-max gap-3.5 p-4">
          <!-- Scene cards -->
        </div>
      </LiquidGlassScrollAreaViewport>
      <LiquidGlassScrollAreaScrollbar orientation="horizontal">
        <LiquidGlassScrollAreaThumb />
      </LiquidGlassScrollAreaScrollbar>
    </LiquidGlassScrollAreaRoot>
  </div>
</template>

<script setup>
import {
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
    'demo-liquid-glass-scroll-area-floating-bar': formatCode(`
<template>
  <div class="w-full max-w-96 rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-5">
    <div class="overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-sm">
      <div class="flex items-center justify-between gap-2 border-b border-border/60 bg-background/70 px-3 py-2.5 backdrop-blur-xs">
        <LiquidGlassButton variant="regular">Library</LiquidGlassButton>
        <LiquidGlassButton variant="prominent">Play All</LiquidGlassButton>
      </div>
      <LiquidGlassScrollAreaRoot class="h-48 w-full">
        <LiquidGlassScrollAreaViewport>
          <div class="flex flex-col p-3.5 text-sm"><!-- Playlist tracks --></div>
        </LiquidGlassScrollAreaViewport>
        <LiquidGlassScrollAreaScrollbar orientation="vertical">
          <LiquidGlassScrollAreaThumb />
        </LiquidGlassScrollAreaScrollbar>
      </LiquidGlassScrollAreaRoot>
    </div>
  </div>
</template>

<script setup>
import {
  LiquidGlassButton,
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/vue';
</script>
    `),
  },
  vue2: {
    'demo-shadcn-scroll-area': formatCode(`
<template>
  <ShadcnScrollAreaRoot style-profile="rhea" class="h-72 w-full max-w-80 rounded-md border bg-background">
    <ShadcnScrollAreaViewport>
      <div class="flex w-[440px] flex-col p-4 text-sm">
        <div class="mb-3 font-medium">Tags</div>
        <!-- Release entries -->
      </div>
    </ShadcnScrollAreaViewport>
    <ShadcnScrollAreaScrollbar orientation="vertical">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
    <ShadcnScrollAreaScrollbar orientation="horizontal">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
  </ShadcnScrollAreaRoot>
</template>

<script>
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnScrollAreaRoot,
    ShadcnScrollAreaViewport,
    ShadcnScrollAreaScrollbar,
    ShadcnScrollAreaThumb,
  },
};
</script>
    `),
    'demo-shadcn-scroll-area-tags': formatCode(`
<template>
  <ShadcnScrollAreaRoot style-profile="rhea" class="h-72 w-48 rounded-md border bg-background">
    <ShadcnScrollAreaViewport>
      <div class="p-4">
        <h4 class="mb-4 text-sm leading-none font-medium">Tags</h4>
        <div v-for="tag in tags" :key="tag">
          <div class="text-sm">{{ tag }}</div>
          <div class="my-2 h-px w-full bg-border" />
        </div>
      </div>
    </ShadcnScrollAreaViewport>
    <ShadcnScrollAreaScrollbar orientation="vertical">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
  </ShadcnScrollAreaRoot>
</template>

<script>
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnScrollAreaRoot,
    ShadcnScrollAreaViewport,
    ShadcnScrollAreaScrollbar,
    ShadcnScrollAreaThumb,
  },
  data() {
    return {
      tags: Array.from({ length: 30 }, (_, i) => \`v1.2.0-beta.\${50 - i}\`),
    };
  },
};
</script>
    `),
    'demo-shadcn-scroll-area-horizontal': formatCode(`
<template>
  <ShadcnScrollAreaRoot style-profile="rhea" class="w-full max-w-96 rounded-md border bg-background whitespace-nowrap">
    <ShadcnScrollAreaViewport>
      <div class="flex w-max gap-4 p-4"><!-- Artwork cards --></div>
    </ShadcnScrollAreaViewport>
    <ShadcnScrollAreaScrollbar orientation="horizontal">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
  </ShadcnScrollAreaRoot>
</template>

<script>
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnScrollAreaRoot,
    ShadcnScrollAreaViewport,
    ShadcnScrollAreaScrollbar,
    ShadcnScrollAreaThumb,
  },
};
</script>
    `),
    'demo-shadcn-scroll-area-both-axes': formatCode(`
<template>
  <ShadcnScrollAreaRoot style-profile="rhea" class="h-56 w-full max-w-96 rounded-md border bg-background">
    <ShadcnScrollAreaViewport>
      <div class="flex w-[540px] flex-col p-4 text-xs"><!-- Region deployment matrix --></div>
    </ShadcnScrollAreaViewport>
    <ShadcnScrollAreaScrollbar orientation="vertical">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
    <ShadcnScrollAreaScrollbar orientation="horizontal">
      <ShadcnScrollAreaThumb />
    </ShadcnScrollAreaScrollbar>
  </ShadcnScrollAreaRoot>
</template>

<script>
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnScrollAreaRoot,
    ShadcnScrollAreaViewport,
    ShadcnScrollAreaScrollbar,
    ShadcnScrollAreaThumb,
  },
};
</script>
    `),
    'demo-shadcn-scroll-area-rtl': formatCode(`
<template>
  <div dir="rtl">
    <ShadcnScrollAreaRoot style-profile="rhea" class="h-72 w-48 rounded-md border bg-background">
      <ShadcnScrollAreaViewport>
        <div class="p-4 text-right">
          <h4 class="mb-4 text-sm leading-none font-medium">العلامات</h4>
          <!-- RTL tag rows -->
        </div>
      </ShadcnScrollAreaViewport>
      <ShadcnScrollAreaScrollbar orientation="vertical">
        <ShadcnScrollAreaThumb />
      </ShadcnScrollAreaScrollbar>
    </ShadcnScrollAreaRoot>
  </div>
</template>

<script>
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnScrollAreaRoot,
    ShadcnScrollAreaViewport,
    ShadcnScrollAreaScrollbar,
    ShadcnScrollAreaThumb,
  },
};
</script>
    `),
    'demo-brutalist-scroll-area': formatCode(`
<template>
  <div class="w-full max-w-80">
    <BrutalistScrollAreaRoot class="h-48 w-full">
      <BrutalistScrollAreaViewport>
        <div class="flex w-[460px] flex-col gap-2 p-3 text-sm">
          <div class="font-heading font-bold">Issue Feed — Brutalist Kit</div>
          <!-- Feed rows -->
        </div>
      </BrutalistScrollAreaViewport>
      <BrutalistScrollAreaScrollbar orientation="vertical">
        <BrutalistScrollAreaThumb />
      </BrutalistScrollAreaScrollbar>
      <BrutalistScrollAreaScrollbar orientation="horizontal">
        <BrutalistScrollAreaThumb />
      </BrutalistScrollAreaScrollbar>
    </BrutalistScrollAreaRoot>
  </div>
</template>

<script>
import {
  BrutalistScrollAreaRoot,
  BrutalistScrollAreaViewport,
  BrutalistScrollAreaScrollbar,
  BrutalistScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistScrollAreaRoot,
    BrutalistScrollAreaViewport,
    BrutalistScrollAreaScrollbar,
    BrutalistScrollAreaThumb,
  },
};
</script>
    `),
    'demo-brutalist-scroll-area-prose': formatCode(`
<template>
  <div class="w-full max-w-80">
    <BrutalistScrollAreaRoot class="h-48 w-full">
      <BrutalistScrollAreaViewport>
        <div class="flex flex-col gap-3 p-4 pr-7 text-sm leading-relaxed">
          <div class="font-heading text-base font-bold">The Castle Chronicle</div>
          <p>Jokester began sneaking into the castle in the middle of the night...</p>
        </div>
      </BrutalistScrollAreaViewport>
      <BrutalistScrollAreaScrollbar orientation="vertical">
        <BrutalistScrollAreaThumb />
      </BrutalistScrollAreaScrollbar>
    </BrutalistScrollAreaRoot>
  </div>
</template>

<script>
import {
  BrutalistScrollAreaRoot,
  BrutalistScrollAreaViewport,
  BrutalistScrollAreaScrollbar,
  BrutalistScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistScrollAreaRoot,
    BrutalistScrollAreaViewport,
    BrutalistScrollAreaScrollbar,
    BrutalistScrollAreaThumb,
  },
};
</script>
    `),
    'demo-brutalist-scroll-area-horizontal': formatCode(`
<template>
  <div class="w-full max-w-96">
    <BrutalistScrollAreaRoot class="w-full">
      <BrutalistScrollAreaViewport>
        <div class="flex w-max gap-4 p-4 pb-7"><!-- Brutalist print cards --></div>
      </BrutalistScrollAreaViewport>
      <BrutalistScrollAreaScrollbar orientation="horizontal">
        <BrutalistScrollAreaThumb />
      </BrutalistScrollAreaScrollbar>
    </BrutalistScrollAreaRoot>
  </div>
</template>

<script>
import {
  BrutalistScrollAreaRoot,
  BrutalistScrollAreaViewport,
  BrutalistScrollAreaScrollbar,
  BrutalistScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistScrollAreaRoot,
    BrutalistScrollAreaViewport,
    BrutalistScrollAreaScrollbar,
    BrutalistScrollAreaThumb,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-scroll-area': formatCode(`
<template>
  <div class="w-full max-w-80">
    <BootstrapScrollAreaRoot class="h-48 w-full">
      <BootstrapScrollAreaViewport>
        <div class="flex w-[500px] flex-col p-3 text-xs leading-5">
          <div class="mb-2 border-b border-[#e5e5e5] pb-1.5 text-sm font-bold">Operations Log</div>
          <!-- Server events -->
        </div>
      </BootstrapScrollAreaViewport>
      <BootstrapScrollAreaScrollbar orientation="vertical">
        <BootstrapScrollAreaThumb />
      </BootstrapScrollAreaScrollbar>
      <BootstrapScrollAreaScrollbar orientation="horizontal">
        <BootstrapScrollAreaThumb />
      </BootstrapScrollAreaScrollbar>
    </BootstrapScrollAreaRoot>
  </div>
</template>

<script>
import {
  BootstrapScrollAreaRoot,
  BootstrapScrollAreaViewport,
  BootstrapScrollAreaScrollbar,
  BootstrapScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapScrollAreaRoot,
    BootstrapScrollAreaViewport,
    BootstrapScrollAreaScrollbar,
    BootstrapScrollAreaThumb,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-scroll-area-tags': formatCode(`
<template>
  <BootstrapScrollAreaRoot class="h-60 w-64">
    <BootstrapScrollAreaViewport>
      <div class="p-3 pr-5 text-xs leading-5">
        <div class="mb-2 border-b border-[#ddd] pb-1.5 text-sm font-bold">Release Archive</div>
        <!-- Release rows -->
      </div>
    </BootstrapScrollAreaViewport>
    <BootstrapScrollAreaScrollbar orientation="vertical">
      <BootstrapScrollAreaThumb />
    </BootstrapScrollAreaScrollbar>
  </BootstrapScrollAreaRoot>
</template>

<script>
import {
  BootstrapScrollAreaRoot,
  BootstrapScrollAreaViewport,
  BootstrapScrollAreaScrollbar,
  BootstrapScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapScrollAreaRoot,
    BootstrapScrollAreaViewport,
    BootstrapScrollAreaScrollbar,
    BootstrapScrollAreaThumb,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-scroll-area-horizontal': formatCode(`
<template>
  <BootstrapScrollAreaRoot class="w-full max-w-96">
    <BootstrapScrollAreaViewport>
      <div class="flex w-max gap-3 p-3 pb-5"><!-- Thumbnail cards --></div>
    </BootstrapScrollAreaViewport>
    <BootstrapScrollAreaScrollbar orientation="horizontal">
      <BootstrapScrollAreaThumb />
    </BootstrapScrollAreaScrollbar>
  </BootstrapScrollAreaRoot>
</template>

<script>
import {
  BootstrapScrollAreaRoot,
  BootstrapScrollAreaViewport,
  BootstrapScrollAreaScrollbar,
  BootstrapScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapScrollAreaRoot,
    BootstrapScrollAreaViewport,
    BootstrapScrollAreaScrollbar,
    BootstrapScrollAreaThumb,
  },
};
</script>
    `),
    'demo-liquid-glass-scroll-area': formatCode(`
<template>
  <div class="w-full max-w-96 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassScrollAreaRoot class="h-56 w-full rounded-xl border border-border/60 bg-background/90 shadow-sm">
      <LiquidGlassScrollAreaViewport>
        <div class="flex w-[480px] flex-col p-4 text-sm">
          <div class="mb-3 font-semibold">Release Highlights</div>
          <!-- Feed rows -->
        </div>
      </LiquidGlassScrollAreaViewport>
      <LiquidGlassScrollAreaScrollbar orientation="vertical">
        <LiquidGlassScrollAreaThumb />
      </LiquidGlassScrollAreaScrollbar>
      <LiquidGlassScrollAreaScrollbar orientation="horizontal">
        <LiquidGlassScrollAreaThumb />
      </LiquidGlassScrollAreaScrollbar>
    </LiquidGlassScrollAreaRoot>
  </div>
</template>

<script>
import {
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassScrollAreaRoot,
    LiquidGlassScrollAreaViewport,
    LiquidGlassScrollAreaScrollbar,
    LiquidGlassScrollAreaThumb,
  },
};
</script>
    `),
    'demo-liquid-glass-scroll-area-tags': formatCode(`
<template>
  <div class="flex justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassScrollAreaRoot class="h-64 w-52 rounded-xl border border-border/60 bg-background/90 shadow-sm">
      <LiquidGlassScrollAreaViewport>
        <div class="p-4">
          <div class="mb-3 text-sm font-semibold">Builds</div>
          <!-- Build tags -->
        </div>
      </LiquidGlassScrollAreaViewport>
      <LiquidGlassScrollAreaScrollbar orientation="vertical">
        <LiquidGlassScrollAreaThumb />
      </LiquidGlassScrollAreaScrollbar>
    </LiquidGlassScrollAreaRoot>
  </div>
</template>

<script>
import {
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassScrollAreaRoot,
    LiquidGlassScrollAreaViewport,
    LiquidGlassScrollAreaScrollbar,
    LiquidGlassScrollAreaThumb,
  },
};
</script>
    `),
    'demo-liquid-glass-scroll-area-horizontal': formatCode(`
<template>
  <div class="w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5">
    <LiquidGlassScrollAreaRoot class="w-full rounded-xl border border-border/60 bg-background/90 shadow-sm">
      <LiquidGlassScrollAreaViewport>
        <div class="flex w-max gap-3.5 p-4"><!-- Scene cards --></div>
      </LiquidGlassScrollAreaViewport>
      <LiquidGlassScrollAreaScrollbar orientation="horizontal">
        <LiquidGlassScrollAreaThumb />
      </LiquidGlassScrollAreaScrollbar>
    </LiquidGlassScrollAreaRoot>
  </div>
</template>

<script>
import {
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassScrollAreaRoot,
    LiquidGlassScrollAreaViewport,
    LiquidGlassScrollAreaScrollbar,
    LiquidGlassScrollAreaThumb,
  },
};
</script>
    `),
    'demo-liquid-glass-scroll-area-floating-bar': formatCode(`
<template>
  <div class="w-full max-w-96 rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-5">
    <div class="overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-sm">
      <div class="flex items-center justify-between gap-2 border-b border-border/60 bg-background/70 px-3 py-2.5 backdrop-blur-xs">
        <LiquidGlassButton variant="regular">Library</LiquidGlassButton>
        <LiquidGlassButton variant="prominent">Play All</LiquidGlassButton>
      </div>
      <LiquidGlassScrollAreaRoot class="h-48 w-full">
        <LiquidGlassScrollAreaViewport>
          <div class="flex flex-col p-3.5 text-sm"><!-- Playlist tracks --></div>
        </LiquidGlassScrollAreaViewport>
        <LiquidGlassScrollAreaScrollbar orientation="vertical">
          <LiquidGlassScrollAreaThumb />
        </LiquidGlassScrollAreaScrollbar>
      </LiquidGlassScrollAreaRoot>
    </div>
  </div>
</template>

<script>
import {
  LiquidGlassButton,
  LiquidGlassScrollAreaRoot,
  LiquidGlassScrollAreaViewport,
  LiquidGlassScrollAreaScrollbar,
  LiquidGlassScrollAreaThumb,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassButton,
    LiquidGlassScrollAreaRoot,
    LiquidGlassScrollAreaViewport,
    LiquidGlassScrollAreaScrollbar,
    LiquidGlassScrollAreaThumb,
  },
};
</script>
    `),
  },
};
