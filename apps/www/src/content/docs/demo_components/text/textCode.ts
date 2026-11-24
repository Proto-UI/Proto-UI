import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-text': formatCode(`
<article class="flex max-w-xl flex-col gap-5">
  <header class="flex flex-col gap-2">
    <h1>
      <proto-ui-shadcn-text size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">
        Taxing Laughter: The Joke Tax Chronicles
      </proto-ui-shadcn-text>
    </h1>
    <p>
      <proto-ui-shadcn-text size="xl" tone="muted" leading="relaxed">
        Once upon a time, in a far-off land, a restless court looked for a fairer way to fund the royal treasury.
      </proto-ui-shadcn-text>
    </p>
  </header>

  <h2 class="border-b border-border pb-2">
    <proto-ui-shadcn-text size="2xl" font="heading" weight="semibold" leading="tight" tracking="tight">
      The King's Plan
    </proto-ui-shadcn-text>
  </h2>

  <p>
    <proto-ui-shadcn-text leading="relaxed">
      The king thought long and hard, and finally proposed
    </proto-ui-shadcn-text>
    <a href="#examples">
      <proto-ui-shadcn-text weight="medium" decoration="underline">a brilliant plan</proto-ui-shadcn-text>
    </a>
    <proto-ui-shadcn-text leading="relaxed">
      : taxing every pun and one-liner told in the kingdom.
    </proto-ui-shadcn-text>
  </p>

  <blockquote class="border-s-2 border-border ps-4">
    <proto-ui-shadcn-text emphasis="italic" leading="relaxed">
      "After all, everyone enjoys a good joke, so it is only fair that they pay for the privilege."
    </proto-ui-shadcn-text>
  </blockquote>

  <div class="flex flex-wrap items-center gap-2">
    <code class="rounded bg-muted px-2 py-0.5">
      <proto-ui-shadcn-text size="sm" font="mono" weight="semibold" leading="size">
        @proto.ui/prototypes-shadcn/text
      </proto-ui-shadcn-text>
    </code>
    <proto-ui-shadcn-text size="sm" tone="muted">
      Shadcn Rhea · Geist &amp; CJK fallback ready
    </proto-ui-shadcn-text>
  </div>
</article>
    `),
    'demo-shadcn-text-scale': formatCode(`
<div class="flex max-w-xl flex-col gap-3">
  <h1><proto-ui-shadcn-text size="5xl" font="heading" weight="bold" leading="tighter" tracking="tighter">5xl · Display Title</proto-ui-shadcn-text></h1>
  <h1><proto-ui-shadcn-text size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">4xl · Page Heading</proto-ui-shadcn-text></h1>
  <h2><proto-ui-shadcn-text size="3xl" font="heading" weight="semibold" leading="tight" tracking="tight">3xl · Section Heading</proto-ui-shadcn-text></h2>
  <h3><proto-ui-shadcn-text size="2xl" font="heading" weight="semibold" leading="snug" tracking="tight">2xl · Subsection Heading</proto-ui-shadcn-text></h3>
  <h4><proto-ui-shadcn-text size="xl" font="heading" weight="semibold" leading="size">xl · Card Title</proto-ui-shadcn-text></h4>
  <p><proto-ui-shadcn-text size="lg" weight="semibold" leading="size">lg · Large Callout</proto-ui-shadcn-text></p>
  <p><proto-ui-shadcn-text size="base" weight="normal" leading="normal">base · Default body copy for paragraphs and descriptions.</proto-ui-shadcn-text></p>
  <small><proto-ui-shadcn-text size="sm" weight="medium" leading="size">sm · Compact control label &amp; metadata</proto-ui-shadcn-text></small>
  <small><proto-ui-shadcn-text size="xs" tone="muted" leading="size">xs · Caption, badge, and keyboard hint</proto-ui-shadcn-text></small>
</div>
    `),
    'demo-shadcn-text-editorial': formatCode(`
<div class="flex max-w-xl flex-col gap-4">
  <p>
    <proto-ui-shadcn-text size="xl" tone="muted" leading="relaxed">
      A modal dialog that interrupts the user with important content and expects a response.
    </proto-ui-shadcn-text>
  </p>
  <p>
    <proto-ui-shadcn-text size="lg" weight="semibold" leading="snug">
      Are you absolutely sure?
    </proto-ui-shadcn-text>
  </p>
  <blockquote class="border-s-2 border-border ps-4">
    <proto-ui-shadcn-text emphasis="italic" leading="relaxed">
      "Clear typography turns complex workflows into calm reading."
    </proto-ui-shadcn-text>
  </blockquote>
  <div class="flex flex-wrap items-center gap-3">
    <code class="rounded bg-muted px-2 py-0.5">
      <proto-ui-shadcn-text size="sm" font="mono" weight="semibold" leading="size">
        npx @proto.ui/cli add react shadcn-text
      </proto-ui-shadcn-text>
    </code>
    <a href="#api">
      <proto-ui-shadcn-text size="sm" weight="medium" decoration="underline">View API table</proto-ui-shadcn-text>
    </a>
    <del>
      <proto-ui-shadcn-text size="sm" tone="muted" decoration="line-through">Legacy 13px copy</proto-ui-shadcn-text>
    </del>
  </div>
  <div class="flex flex-col gap-1">
    <small><proto-ui-shadcn-text size="sm" weight="medium" leading="tight">Email address</proto-ui-shadcn-text></small>
    <p><proto-ui-shadcn-text size="sm" tone="muted">Enter your work email to receive release notifications.</proto-ui-shadcn-text></p>
  </div>
</div>
    `),
    'demo-shadcn-text-tones': formatCode(`
<div class="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
  <proto-ui-shadcn-surface variant="outline" radius="lg">
    <div class="flex flex-col gap-1 p-4">
      <proto-ui-shadcn-text size="sm" weight="semibold" tone="default">Default Ink</proto-ui-shadcn-text>
      <proto-ui-shadcn-text size="sm" tone="muted">Muted secondary copy on a neutral surface.</proto-ui-shadcn-text>
    </div>
  </proto-ui-shadcn-surface>
  <proto-ui-shadcn-surface variant="solid" radius="lg" border="none">
    <div class="flex flex-col gap-1 p-4">
      <proto-ui-shadcn-text size="sm" weight="semibold" tone="inherit">Solid Surface · tone="inherit"</proto-ui-shadcn-text>
      <proto-ui-shadcn-text size="sm" tone="inherit">Inherits primary-foreground ink automatically.</proto-ui-shadcn-text>
    </div>
  </proto-ui-shadcn-surface>
  <proto-ui-shadcn-surface variant="accent" radius="lg" border="none">
    <div class="flex flex-col gap-1 p-4">
      <proto-ui-shadcn-text size="sm" weight="semibold" tone="inherit">Accent Surface · tone="inherit"</proto-ui-shadcn-text>
      <proto-ui-shadcn-text size="sm" tone="inherit">Stays paired with accent-foreground in light and dark mode.</proto-ui-shadcn-text>
    </div>
  </proto-ui-shadcn-surface>
  <proto-ui-shadcn-surface variant="muted" radius="lg" border="none">
    <div class="flex flex-col gap-1 p-4">
      <proto-ui-shadcn-text size="sm" weight="semibold" tone="default">Muted Surface</proto-ui-shadcn-text>
      <proto-ui-shadcn-text size="sm" tone="muted">Supports default and muted hierarchy cleanly.</proto-ui-shadcn-text>
    </div>
  </proto-ui-shadcn-surface>
</div>
    `),
    'demo-shadcn-text-action-profiles': formatCode(`
<div id="text-action-profiles" class="flex flex-wrap items-center gap-3">
  <proto-ui-shadcn-surface variant="solid"><span class="block px-3 py-1.5"><proto-ui-shadcn-text size="sm" weight="medium" tone="inherit">Rhea · 1.25rem</proto-ui-shadcn-text></span></proto-ui-shadcn-surface>
  <proto-ui-shadcn-surface variant="secondary"><span class="block px-3 py-1.5"><proto-ui-shadcn-text size="sm" weight="medium" tone="inherit">Luma · 1.25rem</proto-ui-shadcn-text></span></proto-ui-shadcn-surface>
  <proto-ui-shadcn-surface variant="outline"><span class="block px-2.5 py-1.5"><proto-ui-shadcn-text size="xs" weight="medium" tone="inherit">Lyra · 1rem</proto-ui-shadcn-text></span></proto-ui-shadcn-surface>
  <proto-ui-shadcn-surface variant="secondary"><span class="block px-2.5 py-1"><proto-ui-shadcn-text size="xs" weight="medium" tone="inherit">Mira · relaxed</proto-ui-shadcn-text></span></proto-ui-shadcn-surface>
  <proto-ui-shadcn-surface variant="solid"><span class="block px-3 py-1.5"><proto-ui-shadcn-text size="xs" weight="semibold" tone="inherit">Sera · Uppercase</proto-ui-shadcn-text></span></proto-ui-shadcn-surface>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const profiles = ['rhea', 'luma', 'lyra', 'mira', 'sera'];
  const root = document.querySelector('#text-action-profiles');
  root?.querySelectorAll('proto-ui-shadcn-surface').forEach((el, i) => setElementProps(el, { actionProfile: profiles[i] }));
  root?.querySelectorAll('proto-ui-shadcn-text').forEach((el, i) => setElementProps(el, { actionProfile: profiles[i] }));
</script>
    `),
    'demo-shadcn-text-rtl': formatCode(`
<div class="flex max-w-xl flex-col gap-5">
  <section dir="rtl" lang="ar" class="flex flex-col gap-3 rounded-lg border border-border p-4 text-start">
    <h2>
      <proto-ui-shadcn-text size="2xl" font="heading" weight="bold" leading="tight">
        فرض الضرائب على الضحك: سجلات ضريبة النكتة
      </proto-ui-shadcn-text>
    </h2>
    <p>
      <proto-ui-shadcn-text tone="muted" leading="relaxed">
        تتبع النصوص اتجاه الحاوية المنطقي مع الحفاظ على تدرج الخطوط وارتفاع الأسطر عبر اللغات من اليمين إلى اليسار.
      </proto-ui-shadcn-text>
    </p>
    <blockquote class="border-s-2 border-border ps-4">
      <proto-ui-shadcn-text size="sm" emphasis="italic" leading="relaxed">
        «الجميع يستمتع بنكتة جيدة عندما تكون القراءة مريحة وواضحة.»
      </proto-ui-shadcn-text>
    </blockquote>
  </section>

  <section lang="zh-CN" class="flex flex-col gap-2 rounded-lg border border-border p-4 text-start">
    <h3>
      <proto-ui-shadcn-text size="xl" font="heading" weight="semibold" leading="snug">
        中英混排与 CJK 回退示例 · Geist + System CJK
      </proto-ui-shadcn-text>
    </h3>
    <p>
      <proto-ui-shadcn-text size="sm" tone="muted" leading="relaxed">
        搭配 SHADCN_TYPOGRAPHY 预设时，拉丁字符优先使用 Geist，中文字符平滑回退至系统无衬线字体。
      </proto-ui-shadcn-text>
    </p>
  </section>
</div>
    `),
    'demo-brutalist-text': formatCode(`
<article class="flex max-w-xl flex-col gap-4">
  <h1>
    <proto-ui-brutalist-text size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">
      Bold Print. Zero Ambiguity.
    </proto-ui-brutalist-text>
  </h1>
  <p>
    <proto-ui-brutalist-text size="base" font="body" weight="medium" leading="relaxed">
      Brutalist typography pairs DM Sans 700 headings with DM Sans 500 body copy while keeping text passive, shadowless, and effortlessly selectable.
    </proto-ui-brutalist-text>
  </p>
  <p>
    <proto-ui-brutalist-text size="sm" tone="muted" weight="medium" emphasis="italic">
      "Strong hierarchy comes from weight and scale, not decorative clutter."
    </proto-ui-brutalist-text>
  </p>
  <div class="flex flex-wrap items-center gap-3">
    <code>
      <proto-ui-brutalist-text size="sm" font="mono" weight="semibold" tracking="tight" decoration="underline">
        npx @proto.ui/cli add wc brutalist-text
      </proto-ui-brutalist-text>
    </code>
    <proto-ui-brutalist-text size="xs" tone="muted" weight="medium">DM Sans 500 / 700</proto-ui-brutalist-text>
  </div>
</article>
    `),
    'demo-brutalist-text-scale': formatCode(`
<div class="flex max-w-xl flex-col gap-3">
  <h1><proto-ui-brutalist-text size="5xl" font="heading" weight="bold" leading="tighter" tracking="tighter">5xl · Poster Headline</proto-ui-brutalist-text></h1>
  <h2><proto-ui-brutalist-text size="3xl" font="heading" weight="bold" leading="tight" tracking="tight">3xl · Section Title (DM Sans 700)</proto-ui-brutalist-text></h2>
  <h3><proto-ui-brutalist-text size="xl" font="heading" weight="bold" leading="snug">xl · Card Header</proto-ui-brutalist-text></h3>
  <p><proto-ui-brutalist-text size="base" font="body" weight="medium" leading="normal">base · Body &amp; control text (DM Sans 500)</proto-ui-brutalist-text></p>
  <small><proto-ui-brutalist-text size="sm" font="body" weight="medium" leading="size">sm · 14px / 20px standard control label</proto-ui-brutalist-text></small>
  <small><proto-ui-brutalist-text size="xs" font="body" tone="muted" weight="medium" leading="size">xs · 12px / 16px compact badge &amp; caption</proto-ui-brutalist-text></small>
</div>
    `),
    'demo-brutalist-text-editorial': formatCode(`
<div class="flex max-w-xl flex-col gap-4">
  <p>
    <proto-ui-brutalist-text size="xl" tone="muted" weight="medium" leading="relaxed">
      Lead summary copy sets expectations before the reader dives into detailed specs.
    </proto-ui-brutalist-text>
  </p>
  <blockquote class="border-s-4 border-border ps-4">
    <proto-ui-brutalist-text weight="medium" emphasis="italic" leading="relaxed">
      "Keep decorative borders on structural frames, never on passive text."
    </proto-ui-brutalist-text>
  </blockquote>
  <div class="flex flex-wrap items-center gap-3">
    <code class="rounded bg-muted px-2 py-0.5">
      <proto-ui-brutalist-text size="sm" font="mono" weight="semibold" leading="size">BRUTALIST_THEME</proto-ui-brutalist-text>
    </code>
    <a href="#api">
      <proto-ui-brutalist-text size="sm" weight="bold" decoration="underline">Read API props</proto-ui-brutalist-text>
    </a>
    <del>
      <proto-ui-brutalist-text size="sm" tone="muted" decoration="line-through">Deprecated label</proto-ui-brutalist-text>
    </del>
  </div>
</div>
    `),
    'demo-brutalist-text-surfaces': formatCode(`
<div class="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
  <proto-ui-brutalist-surface variant="solid" elevation="raised" border="all">
    <div class="flex flex-col gap-1 p-4">
      <proto-ui-brutalist-text size="base" font="heading" weight="bold" tone="inherit">Main Surface (#5294ff)</proto-ui-brutalist-text>
      <proto-ui-brutalist-text size="sm" weight="medium" tone="inherit">tone="inherit" keeps crisp black ink over accent fills.</proto-ui-brutalist-text>
    </div>
  </proto-ui-brutalist-surface>
  <proto-ui-brutalist-surface variant="secondary" elevation="raised" border="all">
    <div class="flex flex-col gap-1 p-4">
      <proto-ui-brutalist-text size="base" font="heading" weight="bold" tone="default">Secondary Card Surface</proto-ui-brutalist-text>
      <proto-ui-brutalist-text size="sm" weight="medium" tone="muted">Pairs default foreground headings with muted captions.</proto-ui-brutalist-text>
    </div>
  </proto-ui-brutalist-surface>
</div>
    `),
    'demo-bootstrap-2-3-2-text': formatCode(`
<article class="flex max-w-xl flex-col gap-3">
  <h2>
    <proto-ui-bootstrap-2-3-2-text size="2xl" font="heading" weight="bold" leading="relaxed" tracking="tight">
      Classic Bootstrap 2.3.2 Heading (24.5px / 40px)
    </proto-ui-bootstrap-2-3-2-text>
  </h2>
  <p>
    <proto-ui-bootstrap-2-3-2-text size="xl" font="body" leading="relaxed">
      A crisp lead paragraph introduces the page before settling into the classic 20/14 body line-height rhythm.
    </proto-ui-bootstrap-2-3-2-text>
  </p>
  <p>
    <proto-ui-bootstrap-2-3-2-text size="base" font="body" leading="normal">
      Body copy renders with Helvetica Neue, Helvetica, and Arial at the archived 1.4286 line-height ratio so dense forms and tables remain balanced.
    </proto-ui-bootstrap-2-3-2-text>
  </p>
  <div class="flex flex-wrap items-center gap-3 pt-1">
    <code>
      <proto-ui-bootstrap-2-3-2-text size="sm" font="mono" tracking="tight" decoration="underline">
        @proto.ui/prototypes-bootstrap-2-3-2/text
      </proto-ui-bootstrap-2-3-2-text>
    </code>
    <proto-ui-bootstrap-2-3-2-text size="sm" tone="muted" emphasis="italic">Muted helper copy · #666666</proto-ui-bootstrap-2-3-2-text>
  </div>
</article>
    `),
    'demo-bootstrap-2-3-2-text-scale': formatCode(`
<div class="flex max-w-xl flex-col gap-3">
  <h1><proto-ui-bootstrap-2-3-2-text size="4xl" font="heading" weight="bold" leading="tighter" tracking="tighter">4xl · Display Heading (leading="tighter")</proto-ui-bootstrap-2-3-2-text></h1>
  <h1><proto-ui-bootstrap-2-3-2-text size="3xl" font="heading" weight="bold" leading="tight">3xl · Page Title</proto-ui-bootstrap-2-3-2-text></h1>
  <h2><proto-ui-bootstrap-2-3-2-text size="2xl" font="heading" weight="bold" leading="relaxed">2xl · Archived 24.5px Scale with 40px Relaxed Line Box</proto-ui-bootstrap-2-3-2-text></h2>
  <h3><proto-ui-bootstrap-2-3-2-text size="xl" font="heading" weight="semibold" leading="size">xl · Section Subheading (leading="size")</proto-ui-bootstrap-2-3-2-text></h3>
  <p><proto-ui-bootstrap-2-3-2-text size="base" font="body" leading="normal">base · Body copy with classic 20/14 (1.4286) normal leading</proto-ui-bootstrap-2-3-2-text></p>
  <small><proto-ui-bootstrap-2-3-2-text size="sm" font="body" weight="medium" leading="size">sm · Compact form help &amp; table cell copy</proto-ui-bootstrap-2-3-2-text></small>
  <small><proto-ui-bootstrap-2-3-2-text size="xs" tone="muted" leading="size">xs · Footnote &amp; badge label</proto-ui-bootstrap-2-3-2-text></small>
</div>
    `),
    'demo-bootstrap-2-3-2-text-editorial': formatCode(`
<div class="flex max-w-xl flex-col gap-4">
  <p>
    <proto-ui-bootstrap-2-3-2-text size="xl" leading="relaxed">
      Lead copy makes an introductory paragraph stand out with generous line spacing.
    </proto-ui-bootstrap-2-3-2-text>
  </p>
  <blockquote class="border-s-4 border-border ps-4">
    <proto-ui-bootstrap-2-3-2-text emphasis="italic" leading="normal">
      "Simplicity and predictable typography keep web applications timeless."
    </proto-ui-bootstrap-2-3-2-text>
  </blockquote>
  <div class="flex flex-wrap items-center gap-3">
    <code class="rounded bg-muted px-2 py-0.5">
      <proto-ui-bootstrap-2-3-2-text size="sm" font="mono" leading="size">Bootstrap232TextRoot</proto-ui-bootstrap-2-3-2-text>
    </code>
    <a href="#api">
      <proto-ui-bootstrap-2-3-2-text size="sm" decoration="underline">Browse API reference</proto-ui-bootstrap-2-3-2-text>
    </a>
    <del>
      <proto-ui-bootstrap-2-3-2-text size="sm" tone="muted" decoration="line-through">Deprecated .muted class</proto-ui-bootstrap-2-3-2-text>
    </del>
  </div>
</div>
    `),
    'demo-bootstrap-2-3-2-text-tones': formatCode(`
<div class="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
  <proto-ui-bootstrap-2-3-2-surface variant="solid" elevation="raised" border="all">
    <div class="flex flex-col gap-1 p-3">
      <proto-ui-bootstrap-2-3-2-text size="sm" weight="bold" tone="inherit">Primary Gradient</proto-ui-bootstrap-2-3-2-text>
      <proto-ui-bootstrap-2-3-2-text size="xs" tone="inherit">tone="inherit" preserves white ink &amp; shadow.</proto-ui-bootstrap-2-3-2-text>
    </div>
  </proto-ui-bootstrap-2-3-2-surface>
  <proto-ui-bootstrap-2-3-2-surface variant="accent" border="all">
    <div class="flex flex-col gap-1 p-3">
      <proto-ui-bootstrap-2-3-2-text size="sm" weight="bold" tone="inherit">Info Accent</proto-ui-bootstrap-2-3-2-text>
      <proto-ui-bootstrap-2-3-2-text size="xs" tone="inherit">Follows classic #d9edf7 tint foreground.</proto-ui-bootstrap-2-3-2-text>
    </div>
  </proto-ui-bootstrap-2-3-2-surface>
  <proto-ui-bootstrap-2-3-2-surface variant="outline" elevation="raised" border="all">
    <div class="flex flex-col gap-1 p-3">
      <proto-ui-bootstrap-2-3-2-text size="sm" weight="bold" tone="default">Default Well</proto-ui-bootstrap-2-3-2-text>
      <proto-ui-bootstrap-2-3-2-text size="xs" tone="muted">Muted #666666 caption on white.</proto-ui-bootstrap-2-3-2-text>
    </div>
  </proto-ui-bootstrap-2-3-2-surface>
</div>
    `),
    'demo-liquid-glass-text': formatCode(`
<article class="flex max-w-xl flex-col gap-4">
  <h1>
    <proto-ui-liquid-glass-text size="3xl" font="heading" weight="semibold" leading="tight" tracking="tight">
      Spatial Clarity on Content Canvas
    </proto-ui-liquid-glass-text>
  </h1>
  <p>
    <proto-ui-liquid-glass-text size="base" font="body" leading="relaxed">
      In Liquid Glass interfaces, text stays crisp on the content layer or inherits high-contrast ink inside a single floating glass control—never stacking glass on glass.
    </proto-ui-liquid-glass-text>
  </p>
  <p>
    <proto-ui-liquid-glass-text size="sm" tone="muted" emphasis="italic">
      Optical system typography · SF-first sans &amp; monospace fallback
    </proto-ui-liquid-glass-text>
  </p>
  <code>
    <proto-ui-liquid-glass-text size="sm" font="mono" tracking="tight" decoration="underline">
      @proto.ui/prototypes-liquid-glass/text
    </proto-ui-liquid-glass-text>
  </code>
</article>
    `),
    'demo-liquid-glass-text-scale': formatCode(`
<div class="flex max-w-xl flex-col gap-3">
  <h1><proto-ui-liquid-glass-text size="4xl" font="heading" weight="bold" leading="tighter" tracking="tighter">4xl · Compact Display (leading="tighter")</proto-ui-liquid-glass-text></h1>
  <h2><proto-ui-liquid-glass-text size="2xl" font="heading" weight="semibold" leading="tight" tracking="tight">2xl · Window &amp; Sheet Heading</proto-ui-liquid-glass-text></h2>
  <h3><proto-ui-liquid-glass-text size="lg" font="heading" weight="semibold" leading="size">lg · Group Title (leading="size")</proto-ui-liquid-glass-text></h3>
  <p><proto-ui-liquid-glass-text size="base" font="body" leading="normal">base · System body copy for readable content canvases.</proto-ui-liquid-glass-text></p>
  <small><proto-ui-liquid-glass-text size="sm" font="body" weight="medium" leading="size">sm · Control label &amp; toolbar caption</proto-ui-liquid-glass-text></small>
  <small><proto-ui-liquid-glass-text size="xs" tone="muted" leading="size">xs · Footnote &amp; status timestamp</proto-ui-liquid-glass-text></small>
</div>
    `),
    'demo-liquid-glass-text-editorial': formatCode(`
<div class="flex max-w-xl flex-col gap-4">
  <p>
    <proto-ui-liquid-glass-text size="xl" tone="muted" leading="relaxed">
      Content-layer prose stays unobstructed and selectable beneath floating Liquid Glass navigation.
    </proto-ui-liquid-glass-text>
  </p>
  <blockquote class="border-s-2 border-border ps-4">
    <proto-ui-liquid-glass-text emphasis="italic" leading="relaxed">
      "Reserve translucency for controls; keep reading surfaces calm."
    </proto-ui-liquid-glass-text>
  </blockquote>
  <div class="flex flex-wrap items-center gap-3">
    <code class="rounded-md bg-muted px-2 py-0.5">
      <proto-ui-liquid-glass-text size="sm" font="mono" weight="medium" leading="size">LiquidGlassTextRoot</proto-ui-liquid-glass-text>
    </code>
    <a href="#api">
      <proto-ui-liquid-glass-text size="sm" weight="medium" decoration="underline">Inspect API</proto-ui-liquid-glass-text>
    </a>
    <del>
      <proto-ui-liquid-glass-text size="sm" tone="muted" decoration="line-through">Legacy blurred copy</proto-ui-liquid-glass-text>
    </del>
  </div>
</div>
    `),
    'demo-liquid-glass-text-surfaces': formatCode(`
<div class="grid max-w-xl grid-cols-1 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-3">
  <proto-ui-liquid-glass-surface variant="outline" material="auto" radius="xl">
    <div class="flex flex-col gap-1 p-4">
      <proto-ui-liquid-glass-text size="sm" weight="semibold" tone="inherit">Regular Glass</proto-ui-liquid-glass-text>
      <proto-ui-liquid-glass-text size="xs" tone="muted">Single glass layer with crisp inherited ink.</proto-ui-liquid-glass-text>
    </div>
  </proto-ui-liquid-glass-surface>
  <proto-ui-liquid-glass-surface variant="solid" radius="xl" border="none">
    <div class="flex flex-col gap-1 p-4">
      <proto-ui-liquid-glass-text size="sm" weight="semibold" tone="inherit">Prominent Tint</proto-ui-liquid-glass-text>
      <proto-ui-liquid-glass-text size="xs" tone="inherit">tone="inherit" preserves white primary ink.</proto-ui-liquid-glass-text>
    </div>
  </proto-ui-liquid-glass-surface>
  <proto-ui-liquid-glass-surface variant="secondary" material="opaque" radius="xl">
    <div class="flex flex-col gap-1 p-4">
      <proto-ui-liquid-glass-text size="sm" weight="semibold" tone="default">Opaque Canvas</proto-ui-liquid-glass-text>
      <proto-ui-liquid-glass-text size="xs" tone="muted">High-contrast fallback &amp; reading layer.</proto-ui-liquid-glass-text>
    </div>
  </proto-ui-liquid-glass-surface>
</div>
    `),
  },
  react: {
    'demo-shadcn-text': formatCode(`
import { ShadcnTextRoot } from '../proto-ui/components/react';

export function DemoShadcnText() {
  return (
    <article className="flex max-w-xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1>
          <ShadcnTextRoot size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">
            Taxing Laughter: The Joke Tax Chronicles
          </ShadcnTextRoot>
        </h1>
        <p>
          <ShadcnTextRoot size="xl" tone="muted" leading="relaxed">
            Once upon a time, in a far-off land, a restless court looked for a fairer way to fund the royal treasury.
          </ShadcnTextRoot>
        </p>
      </header>

      <h2 className="border-b border-border pb-2">
        <ShadcnTextRoot size="2xl" font="heading" weight="semibold" leading="tight" tracking="tight">
          The King&apos;s Plan
        </ShadcnTextRoot>
      </h2>

      <p>
        <ShadcnTextRoot leading="relaxed">
          The king thought long and hard, and finally proposed{' '}
        </ShadcnTextRoot>
        <a href="#examples">
          <ShadcnTextRoot weight="medium" decoration="underline">
            a brilliant plan
          </ShadcnTextRoot>
        </a>
        <ShadcnTextRoot leading="relaxed">
          : taxing every pun and one-liner told in the kingdom.
        </ShadcnTextRoot>
      </p>

      <blockquote className="border-s-2 border-border ps-4">
        <ShadcnTextRoot emphasis="italic" leading="relaxed">
          &ldquo;After all, everyone enjoys a good joke, so it is only fair that they pay for the privilege.&rdquo;
        </ShadcnTextRoot>
      </blockquote>

      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-muted px-2 py-0.5">
          <ShadcnTextRoot size="sm" font="mono" weight="semibold" leading="size">
            @proto.ui/prototypes-shadcn/text
          </ShadcnTextRoot>
        </code>
        <ShadcnTextRoot size="sm" tone="muted">
          Shadcn Rhea · Geist &amp; CJK fallback ready
        </ShadcnTextRoot>
      </div>
    </article>
  );
}
    `),
    'demo-shadcn-text-scale': formatCode(`
import { ShadcnTextRoot } from '../proto-ui/components/react';

export function DemoShadcnTextScale() {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1><ShadcnTextRoot size="5xl" font="heading" weight="bold" leading="tighter" tracking="tighter">5xl · Display Title</ShadcnTextRoot></h1>
      <h1><ShadcnTextRoot size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">4xl · Page Heading</ShadcnTextRoot></h1>
      <h2><ShadcnTextRoot size="3xl" font="heading" weight="semibold" leading="tight" tracking="tight">3xl · Section Heading</ShadcnTextRoot></h2>
      <h3><ShadcnTextRoot size="2xl" font="heading" weight="semibold" leading="snug" tracking="tight">2xl · Subsection Heading</ShadcnTextRoot></h3>
      <h4><ShadcnTextRoot size="xl" font="heading" weight="semibold" leading="size">xl · Card Title</ShadcnTextRoot></h4>
      <p><ShadcnTextRoot size="lg" weight="semibold" leading="size">lg · Large Callout</ShadcnTextRoot></p>
      <p><ShadcnTextRoot size="base" weight="normal" leading="normal">base · Default body copy for paragraphs and descriptions.</ShadcnTextRoot></p>
      <small><ShadcnTextRoot size="sm" weight="medium" leading="size">sm · Compact control label &amp; metadata</ShadcnTextRoot></small>
      <small><ShadcnTextRoot size="xs" tone="muted" leading="size">xs · Caption, badge, and keyboard hint</ShadcnTextRoot></small>
    </div>
  );
}
    `),
    'demo-shadcn-text-editorial': formatCode(`
import { ShadcnTextRoot } from '../proto-ui/components/react';

export function DemoShadcnTextEditorial() {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p>
        <ShadcnTextRoot size="xl" tone="muted" leading="relaxed">
          A modal dialog that interrupts the user with important content and expects a response.
        </ShadcnTextRoot>
      </p>
      <p>
        <ShadcnTextRoot size="lg" weight="semibold" leading="snug">
          Are you absolutely sure?
        </ShadcnTextRoot>
      </p>
      <blockquote className="border-s-2 border-border ps-4">
        <ShadcnTextRoot emphasis="italic" leading="relaxed">
          &ldquo;Clear typography turns complex workflows into calm reading.&rdquo;
        </ShadcnTextRoot>
      </blockquote>
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded bg-muted px-2 py-0.5">
          <ShadcnTextRoot size="sm" font="mono" weight="semibold" leading="size">
            npx @proto.ui/cli add react shadcn-text
          </ShadcnTextRoot>
        </code>
        <a href="#api">
          <ShadcnTextRoot size="sm" weight="medium" decoration="underline">View API table</ShadcnTextRoot>
        </a>
        <del>
          <ShadcnTextRoot size="sm" tone="muted" decoration="line-through">Legacy 13px copy</ShadcnTextRoot>
        </del>
      </div>
      <div className="flex flex-col gap-1">
        <small><ShadcnTextRoot size="sm" weight="medium" leading="tight">Email address</ShadcnTextRoot></small>
        <p><ShadcnTextRoot size="sm" tone="muted">Enter your work email to receive release notifications.</ShadcnTextRoot></p>
      </div>
    </div>
  );
}
    `),
    'demo-shadcn-text-tones': formatCode(`
import { ShadcnSurfaceRoot, ShadcnTextRoot } from '../proto-ui/components/react';

export function DemoShadcnTextTones() {
  return (
    <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
      <ShadcnSurfaceRoot variant="outline" radius="lg">
        <div className="flex flex-col gap-1 p-4">
          <ShadcnTextRoot size="sm" weight="semibold" tone="default">Default Ink</ShadcnTextRoot>
          <ShadcnTextRoot size="sm" tone="muted">Muted secondary copy on a neutral surface.</ShadcnTextRoot>
        </div>
      </ShadcnSurfaceRoot>
      <ShadcnSurfaceRoot variant="solid" radius="lg" border="none">
        <div className="flex flex-col gap-1 p-4">
          <ShadcnTextRoot size="sm" weight="semibold" tone="inherit">Solid Surface · tone=&quot;inherit&quot;</ShadcnTextRoot>
          <ShadcnTextRoot size="sm" tone="inherit">Inherits primary-foreground ink automatically.</ShadcnTextRoot>
        </div>
      </ShadcnSurfaceRoot>
      <ShadcnSurfaceRoot variant="accent" radius="lg" border="none">
        <div className="flex flex-col gap-1 p-4">
          <ShadcnTextRoot size="sm" weight="semibold" tone="inherit">Accent Surface · tone=&quot;inherit&quot;</ShadcnTextRoot>
          <ShadcnTextRoot size="sm" tone="inherit">Stays paired with accent-foreground in light and dark mode.</ShadcnTextRoot>
        </div>
      </ShadcnSurfaceRoot>
      <ShadcnSurfaceRoot variant="muted" radius="lg" border="none">
        <div className="flex flex-col gap-1 p-4">
          <ShadcnTextRoot size="sm" weight="semibold" tone="default">Muted Surface</ShadcnTextRoot>
          <ShadcnTextRoot size="sm" tone="muted">Supports default and muted hierarchy cleanly.</ShadcnTextRoot>
        </div>
      </ShadcnSurfaceRoot>
    </div>
  );
}
    `),
    'demo-shadcn-text-action-profiles': formatCode(`
import { ShadcnSurfaceRoot, ShadcnTextRoot } from '../proto-ui/components/react';

export function DemoShadcnTextActionProfiles() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShadcnSurfaceRoot variant="solid" actionProfile="rhea">
        <span className="block px-3 py-1.5">
          <ShadcnTextRoot size="sm" weight="medium" tone="inherit" actionProfile="rhea">Rhea · 1.25rem</ShadcnTextRoot>
        </span>
      </ShadcnSurfaceRoot>
      <ShadcnSurfaceRoot variant="secondary" actionProfile="luma">
        <span className="block px-3 py-1.5">
          <ShadcnTextRoot size="sm" weight="medium" tone="inherit" actionProfile="luma">Luma · 1.25rem</ShadcnTextRoot>
        </span>
      </ShadcnSurfaceRoot>
      <ShadcnSurfaceRoot variant="outline" actionProfile="lyra">
        <span className="block px-2.5 py-1.5">
          <ShadcnTextRoot size="xs" weight="medium" tone="inherit" actionProfile="lyra">Lyra · 1rem</ShadcnTextRoot>
        </span>
      </ShadcnSurfaceRoot>
      <ShadcnSurfaceRoot variant="secondary" actionProfile="mira">
        <span className="block px-2.5 py-1">
          <ShadcnTextRoot size="xs" weight="medium" tone="inherit" actionProfile="mira">Mira · relaxed</ShadcnTextRoot>
        </span>
      </ShadcnSurfaceRoot>
      <ShadcnSurfaceRoot variant="solid" actionProfile="sera">
        <span className="block px-3 py-1.5">
          <ShadcnTextRoot size="xs" weight="semibold" tone="inherit" actionProfile="sera">Sera · Uppercase</ShadcnTextRoot>
        </span>
      </ShadcnSurfaceRoot>
    </div>
  );
}
    `),
    'demo-shadcn-text-rtl': formatCode(`
import { ShadcnTextRoot } from '../proto-ui/components/react';

export function DemoShadcnTextRtl() {
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <section dir="rtl" lang="ar" className="flex flex-col gap-3 rounded-lg border border-border p-4 text-start">
        <h2>
          <ShadcnTextRoot size="2xl" font="heading" weight="bold" leading="tight">
            فرض الضرائب على الضحك: سجلات ضريبة النكتة
          </ShadcnTextRoot>
        </h2>
        <p>
          <ShadcnTextRoot tone="muted" leading="relaxed">
            تتبع النصوص اتجاه الحاوية المنطقي مع الحفاظ على تدرج الخطوط وارتفاع الأسطر عبر اللغات من اليمين إلى اليسار.
          </ShadcnTextRoot>
        </p>
        <blockquote className="border-s-2 border-border ps-4">
          <ShadcnTextRoot size="sm" emphasis="italic" leading="relaxed">
            «الجميع يستمتع بنكتة جيدة عندما تكون القراءة مريحة وواضحة.»
          </ShadcnTextRoot>
        </blockquote>
      </section>

      <section lang="zh-CN" className="flex flex-col gap-2 rounded-lg border border-border p-4 text-start">
        <h3>
          <ShadcnTextRoot size="xl" font="heading" weight="semibold" leading="snug">
            中英混排与 CJK 回退示例 · Geist + System CJK
          </ShadcnTextRoot>
        </h3>
        <p>
          <ShadcnTextRoot size="sm" tone="muted" leading="relaxed">
            搭配 SHADCN_TYPOGRAPHY 预设时，拉丁字符优先使用 Geist，中文字符平滑回退至系统无衬线字体。
          </ShadcnTextRoot>
        </p>
      </section>
    </div>
  );
}
    `),
    'demo-brutalist-text': formatCode(`
import { BrutalistTextRoot } from '../proto-ui/components/react';

export function DemoBrutalistText() {
  return (
    <article className="flex max-w-xl flex-col gap-4">
      <h1>
        <BrutalistTextRoot size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">
          Bold Print. Zero Ambiguity.
        </BrutalistTextRoot>
      </h1>
      <p>
        <BrutalistTextRoot size="base" font="body" weight="medium" leading="relaxed">
          Brutalist typography pairs DM Sans 700 headings with DM Sans 500 body copy while keeping text passive, shadowless, and effortlessly selectable.
        </BrutalistTextRoot>
      </p>
      <p>
        <BrutalistTextRoot size="sm" tone="muted" weight="medium" emphasis="italic">
          &ldquo;Strong hierarchy comes from weight and scale, not decorative clutter.&rdquo;
        </BrutalistTextRoot>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <code>
          <BrutalistTextRoot size="sm" font="mono" weight="semibold" tracking="tight" decoration="underline">
            npx @proto.ui/cli add wc brutalist-text
          </BrutalistTextRoot>
        </code>
        <BrutalistTextRoot size="xs" tone="muted" weight="medium">DM Sans 500 / 700</BrutalistTextRoot>
      </div>
    </article>
  );
}
    `),
    'demo-brutalist-text-scale': formatCode(`
import { BrutalistTextRoot } from '../proto-ui/components/react';

export function DemoBrutalistTextScale() {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1><BrutalistTextRoot size="5xl" font="heading" weight="bold" leading="tighter" tracking="tighter">5xl · Poster Headline</BrutalistTextRoot></h1>
      <h2><BrutalistTextRoot size="3xl" font="heading" weight="bold" leading="tight" tracking="tight">3xl · Section Title (DM Sans 700)</BrutalistTextRoot></h2>
      <h3><BrutalistTextRoot size="xl" font="heading" weight="bold" leading="snug">xl · Card Header</BrutalistTextRoot></h3>
      <p><BrutalistTextRoot size="base" font="body" weight="medium" leading="normal">base · Body &amp; control text (DM Sans 500)</BrutalistTextRoot></p>
      <small><BrutalistTextRoot size="sm" font="body" weight="medium" leading="size">sm · 14px / 20px standard control label</BrutalistTextRoot></small>
      <small><BrutalistTextRoot size="xs" font="body" tone="muted" weight="medium" leading="size">xs · 12px / 16px compact badge &amp; caption</BrutalistTextRoot></small>
    </div>
  );
}
    `),
    'demo-brutalist-text-editorial': formatCode(`
import { BrutalistTextRoot } from '../proto-ui/components/react';

export function DemoBrutalistTextEditorial() {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p>
        <BrutalistTextRoot size="xl" tone="muted" weight="medium" leading="relaxed">
          Lead summary copy sets expectations before the reader dives into detailed specs.
        </BrutalistTextRoot>
      </p>
      <blockquote className="border-s-4 border-border ps-4">
        <BrutalistTextRoot weight="medium" emphasis="italic" leading="relaxed">
          &ldquo;Keep decorative borders on structural frames, never on passive text.&rdquo;
        </BrutalistTextRoot>
      </blockquote>
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded bg-muted px-2 py-0.5">
          <BrutalistTextRoot size="sm" font="mono" weight="semibold" leading="size">BRUTALIST_THEME</BrutalistTextRoot>
        </code>
        <a href="#api">
          <BrutalistTextRoot size="sm" weight="bold" decoration="underline">Read API props</BrutalistTextRoot>
        </a>
        <del>
          <BrutalistTextRoot size="sm" tone="muted" decoration="line-through">Deprecated label</BrutalistTextRoot>
        </del>
      </div>
    </div>
  );
}
    `),
    'demo-brutalist-text-surfaces': formatCode(`
import { BrutalistSurfaceRoot, BrutalistTextRoot } from '../proto-ui/components/react';

export function DemoBrutalistTextSurfaces() {
  return (
    <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
      <BrutalistSurfaceRoot variant="solid" elevation="raised" border="all">
        <div className="flex flex-col gap-1 p-4">
          <BrutalistTextRoot size="base" font="heading" weight="bold" tone="inherit">Main Surface (#5294ff)</BrutalistTextRoot>
          <BrutalistTextRoot size="sm" weight="medium" tone="inherit">tone=&quot;inherit&quot; keeps crisp black ink over accent fills.</BrutalistTextRoot>
        </div>
      </BrutalistSurfaceRoot>
      <BrutalistSurfaceRoot variant="secondary" elevation="raised" border="all">
        <div className="flex flex-col gap-1 p-4">
          <BrutalistTextRoot size="base" font="heading" weight="bold" tone="default">Secondary Card Surface</BrutalistTextRoot>
          <BrutalistTextRoot size="sm" weight="medium" tone="muted">Pairs default foreground headings with muted captions.</BrutalistTextRoot>
        </div>
      </BrutalistSurfaceRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-text': formatCode(`
import { Bootstrap232TextRoot } from '../proto-ui/components/react';

export function DemoBootstrapText() {
  return (
    <article className="flex max-w-xl flex-col gap-3">
      <h2>
        <Bootstrap232TextRoot size="2xl" font="heading" weight="bold" leading="relaxed" tracking="tight">
          Classic Bootstrap 2.3.2 Heading (24.5px / 40px)
        </Bootstrap232TextRoot>
      </h2>
      <p>
        <Bootstrap232TextRoot size="xl" font="body" leading="relaxed">
          A crisp lead paragraph introduces the page before settling into the classic 20/14 body line-height rhythm.
        </Bootstrap232TextRoot>
      </p>
      <p>
        <Bootstrap232TextRoot size="base" font="body" leading="normal">
          Body copy renders with Helvetica Neue, Helvetica, and Arial at the archived 1.4286 line-height ratio so dense forms and tables remain balanced.
        </Bootstrap232TextRoot>
      </p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <code>
          <Bootstrap232TextRoot size="sm" font="mono" tracking="tight" decoration="underline">
            @proto.ui/prototypes-bootstrap-2-3-2/text
          </Bootstrap232TextRoot>
        </code>
        <Bootstrap232TextRoot size="sm" tone="muted" emphasis="italic">Muted helper copy · #666666</Bootstrap232TextRoot>
      </div>
    </article>
  );
}
    `),
    'demo-bootstrap-2-3-2-text-scale': formatCode(`
import { Bootstrap232TextRoot } from '../proto-ui/components/react';

export function DemoBootstrapTextScale() {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1><Bootstrap232TextRoot size="4xl" font="heading" weight="bold" leading="tighter" tracking="tighter">4xl · Display Heading (leading=&quot;tighter&quot;)</Bootstrap232TextRoot></h1>
      <h1><Bootstrap232TextRoot size="3xl" font="heading" weight="bold" leading="tight">3xl · Page Title</Bootstrap232TextRoot></h1>
      <h2><Bootstrap232TextRoot size="2xl" font="heading" weight="bold" leading="relaxed">2xl · Archived 24.5px Scale with 40px Relaxed Line Box</Bootstrap232TextRoot></h2>
      <h3><Bootstrap232TextRoot size="xl" font="heading" weight="semibold" leading="size">xl · Section Subheading (leading=&quot;size&quot;)</Bootstrap232TextRoot></h3>
      <p><Bootstrap232TextRoot size="base" font="body" leading="normal">base · Body copy with classic 20/14 (1.4286) normal leading</Bootstrap232TextRoot></p>
      <small><Bootstrap232TextRoot size="sm" font="body" weight="medium" leading="size">sm · Compact form help &amp; table cell copy</Bootstrap232TextRoot></small>
      <small><Bootstrap232TextRoot size="xs" tone="muted" leading="size">xs · Footnote &amp; badge label</Bootstrap232TextRoot></small>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-text-editorial': formatCode(`
import { Bootstrap232TextRoot } from '../proto-ui/components/react';

export function DemoBootstrapTextEditorial() {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p>
        <Bootstrap232TextRoot size="xl" leading="relaxed">
          Lead copy makes an introductory paragraph stand out with generous line spacing.
        </Bootstrap232TextRoot>
      </p>
      <blockquote className="border-s-4 border-border ps-4">
        <Bootstrap232TextRoot emphasis="italic" leading="normal">
          &ldquo;Simplicity and predictable typography keep web applications timeless.&rdquo;
        </Bootstrap232TextRoot>
      </blockquote>
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded bg-muted px-2 py-0.5">
          <Bootstrap232TextRoot size="sm" font="mono" leading="size">Bootstrap232TextRoot</Bootstrap232TextRoot>
        </code>
        <a href="#api">
          <Bootstrap232TextRoot size="sm" decoration="underline">Browse API reference</Bootstrap232TextRoot>
        </a>
        <del>
          <Bootstrap232TextRoot size="sm" tone="muted" decoration="line-through">Deprecated .muted class</Bootstrap232TextRoot>
        </del>
      </div>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-text-tones': formatCode(`
import { Bootstrap232SurfaceRoot, Bootstrap232TextRoot } from '../proto-ui/components/react';

export function DemoBootstrapTextTones() {
  return (
    <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
      <Bootstrap232SurfaceRoot variant="solid" elevation="raised" border="all">
        <div className="flex flex-col gap-1 p-3">
          <Bootstrap232TextRoot size="sm" weight="bold" tone="inherit">Primary Gradient</Bootstrap232TextRoot>
          <Bootstrap232TextRoot size="xs" tone="inherit">tone=&quot;inherit&quot; preserves white ink &amp; shadow.</Bootstrap232TextRoot>
        </div>
      </Bootstrap232SurfaceRoot>
      <Bootstrap232SurfaceRoot variant="accent" border="all">
        <div className="flex flex-col gap-1 p-3">
          <Bootstrap232TextRoot size="sm" weight="bold" tone="inherit">Info Accent</Bootstrap232TextRoot>
          <Bootstrap232TextRoot size="xs" tone="inherit">Follows classic #d9edf7 tint foreground.</Bootstrap232TextRoot>
        </div>
      </Bootstrap232SurfaceRoot>
      <Bootstrap232SurfaceRoot variant="outline" elevation="raised" border="all">
        <div className="flex flex-col gap-1 p-3">
          <Bootstrap232TextRoot size="sm" weight="bold" tone="default">Default Well</Bootstrap232TextRoot>
          <Bootstrap232TextRoot size="xs" tone="muted">Muted #666666 caption on white.</Bootstrap232TextRoot>
        </div>
      </Bootstrap232SurfaceRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-text': formatCode(`
import { LiquidGlassTextRoot } from '../proto-ui/components/react';

export function DemoLiquidGlassText() {
  return (
    <article className="flex max-w-xl flex-col gap-4">
      <h1>
        <LiquidGlassTextRoot size="3xl" font="heading" weight="semibold" leading="tight" tracking="tight">
          Spatial Clarity on Content Canvas
        </LiquidGlassTextRoot>
      </h1>
      <p>
        <LiquidGlassTextRoot size="base" font="body" leading="relaxed">
          In Liquid Glass interfaces, text stays crisp on the content layer or inherits high-contrast ink inside a single floating glass control—never stacking glass on glass.
        </LiquidGlassTextRoot>
      </p>
      <p>
        <LiquidGlassTextRoot size="sm" tone="muted" emphasis="italic">
          Optical system typography · SF-first sans &amp; monospace fallback
        </LiquidGlassTextRoot>
      </p>
      <code>
        <LiquidGlassTextRoot size="sm" font="mono" tracking="tight" decoration="underline">
          @proto.ui/prototypes-liquid-glass/text
        </LiquidGlassTextRoot>
      </code>
    </article>
  );
}
    `),
    'demo-liquid-glass-text-scale': formatCode(`
import { LiquidGlassTextRoot } from '../proto-ui/components/react';

export function DemoLiquidGlassTextScale() {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1><LiquidGlassTextRoot size="4xl" font="heading" weight="bold" leading="tighter" tracking="tighter">4xl · Compact Display (leading=&quot;tighter&quot;)</LiquidGlassTextRoot></h1>
      <h2><LiquidGlassTextRoot size="2xl" font="heading" weight="semibold" leading="tight" tracking="tight">2xl · Window &amp; Sheet Heading</LiquidGlassTextRoot></h2>
      <h3><LiquidGlassTextRoot size="lg" font="heading" weight="semibold" leading="size">lg · Group Title (leading=&quot;size&quot;)</LiquidGlassTextRoot></h3>
      <p><LiquidGlassTextRoot size="base" font="body" leading="normal">base · System body copy for readable content canvases.</LiquidGlassTextRoot></p>
      <small><LiquidGlassTextRoot size="sm" font="body" weight="medium" leading="size">sm · Control label &amp; toolbar caption</LiquidGlassTextRoot></small>
      <small><LiquidGlassTextRoot size="xs" tone="muted" leading="size">xs · Footnote &amp; status timestamp</LiquidGlassTextRoot></small>
    </div>
  );
}
    `),
    'demo-liquid-glass-text-editorial': formatCode(`
import { LiquidGlassTextRoot } from '../proto-ui/components/react';

export function DemoLiquidGlassTextEditorial() {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p>
        <LiquidGlassTextRoot size="xl" tone="muted" leading="relaxed">
          Content-layer prose stays unobstructed and selectable beneath floating Liquid Glass navigation.
        </LiquidGlassTextRoot>
      </p>
      <blockquote className="border-s-2 border-border ps-4">
        <LiquidGlassTextRoot emphasis="italic" leading="relaxed">
          &ldquo;Reserve translucency for controls; keep reading surfaces calm.&rdquo;
        </LiquidGlassTextRoot>
      </blockquote>
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded-md bg-muted px-2 py-0.5">
          <LiquidGlassTextRoot size="sm" font="mono" weight="medium" leading="size">LiquidGlassTextRoot</LiquidGlassTextRoot>
        </code>
        <a href="#api">
          <LiquidGlassTextRoot size="sm" weight="medium" decoration="underline">Inspect API</LiquidGlassTextRoot>
        </a>
        <del>
          <LiquidGlassTextRoot size="sm" tone="muted" decoration="line-through">Legacy blurred copy</LiquidGlassTextRoot>
        </del>
      </div>
    </div>
  );
}
    `),
    'demo-liquid-glass-text-surfaces': formatCode(`
import { LiquidGlassSurfaceRoot, LiquidGlassTextRoot } from '../proto-ui/components/react';

export function DemoLiquidGlassTextSurfaces() {
  return (
    <div className="grid max-w-xl grid-cols-1 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-3">
      <LiquidGlassSurfaceRoot variant="outline" material="auto" radius="xl">
        <div className="flex flex-col gap-1 p-4">
          <LiquidGlassTextRoot size="sm" weight="semibold" tone="inherit">Regular Glass</LiquidGlassTextRoot>
          <LiquidGlassTextRoot size="xs" tone="muted">Single glass layer with crisp inherited ink.</LiquidGlassTextRoot>
        </div>
      </LiquidGlassSurfaceRoot>
      <LiquidGlassSurfaceRoot variant="solid" radius="xl" border="none">
        <div className="flex flex-col gap-1 p-4">
          <LiquidGlassTextRoot size="sm" weight="semibold" tone="inherit">Prominent Tint</LiquidGlassTextRoot>
          <LiquidGlassTextRoot size="xs" tone="inherit">tone=&quot;inherit&quot; preserves white primary ink.</LiquidGlassTextRoot>
        </div>
      </LiquidGlassSurfaceRoot>
      <LiquidGlassSurfaceRoot variant="secondary" material="opaque" radius="xl">
        <div className="flex flex-col gap-1 p-4">
          <LiquidGlassTextRoot size="sm" weight="semibold" tone="default">Opaque Canvas</LiquidGlassTextRoot>
          <LiquidGlassTextRoot size="xs" tone="muted">High-contrast fallback &amp; reading layer.</LiquidGlassTextRoot>
        </div>
      </LiquidGlassSurfaceRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-text': formatCode(`
<script setup lang="ts">
import { ShadcnTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <article class="flex max-w-xl flex-col gap-5">
    <header class="flex flex-col gap-2">
      <h1>
        <ShadcnTextRoot size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">
          Taxing Laughter: The Joke Tax Chronicles
        </ShadcnTextRoot>
      </h1>
      <p>
        <ShadcnTextRoot size="xl" tone="muted" leading="relaxed">
          Once upon a time, in a far-off land, a restless court looked for a fairer way to fund the royal treasury.
        </ShadcnTextRoot>
      </p>
    </header>

    <h2 class="border-b border-border pb-2">
      <ShadcnTextRoot size="2xl" font="heading" weight="semibold" leading="tight" tracking="tight">
        The King's Plan
      </ShadcnTextRoot>
    </h2>

    <p>
      <ShadcnTextRoot leading="relaxed">The king thought long and hard, and finally proposed </ShadcnTextRoot>
      <a href="#examples"><ShadcnTextRoot weight="medium" decoration="underline">a brilliant plan</ShadcnTextRoot></a>
      <ShadcnTextRoot leading="relaxed">: taxing every pun and one-liner told in the kingdom.</ShadcnTextRoot>
    </p>

    <blockquote class="border-s-2 border-border ps-4">
      <ShadcnTextRoot emphasis="italic" leading="relaxed">
        "After all, everyone enjoys a good joke, so it is only fair that they pay for the privilege."
      </ShadcnTextRoot>
    </blockquote>

    <div class="flex flex-wrap items-center gap-2">
      <code class="rounded bg-muted px-2 py-0.5">
        <ShadcnTextRoot size="sm" font="mono" weight="semibold" leading="size">@proto.ui/prototypes-shadcn/text</ShadcnTextRoot>
      </code>
      <ShadcnTextRoot size="sm" tone="muted">Shadcn Rhea · Geist &amp; CJK fallback ready</ShadcnTextRoot>
    </div>
  </article>
</template>
    `),
    'demo-shadcn-text-scale': formatCode(`
<script setup lang="ts">
import { ShadcnTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex max-w-xl flex-col gap-3">
    <h1><ShadcnTextRoot size="5xl" font="heading" weight="bold" leading="tighter" tracking="tighter">5xl · Display Title</ShadcnTextRoot></h1>
    <h1><ShadcnTextRoot size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">4xl · Page Heading</ShadcnTextRoot></h1>
    <h2><ShadcnTextRoot size="3xl" font="heading" weight="semibold" leading="tight" tracking="tight">3xl · Section Heading</ShadcnTextRoot></h2>
    <h3><ShadcnTextRoot size="2xl" font="heading" weight="semibold" leading="snug" tracking="tight">2xl · Subsection Heading</ShadcnTextRoot></h3>
    <h4><ShadcnTextRoot size="xl" font="heading" weight="semibold" leading="size">xl · Card Title</ShadcnTextRoot></h4>
    <p><ShadcnTextRoot size="lg" weight="semibold" leading="size">lg · Large Callout</ShadcnTextRoot></p>
    <p><ShadcnTextRoot size="base" weight="normal" leading="normal">base · Default body copy for paragraphs and descriptions.</ShadcnTextRoot></p>
    <small><ShadcnTextRoot size="sm" weight="medium" leading="size">sm · Compact control label &amp; metadata</ShadcnTextRoot></small>
    <small><ShadcnTextRoot size="xs" tone="muted" leading="size">xs · Caption, badge, and keyboard hint</ShadcnTextRoot></small>
  </div>
</template>
    `),
    'demo-shadcn-text-editorial': formatCode(`
<script setup lang="ts">
import { ShadcnTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex max-w-xl flex-col gap-4">
    <p><ShadcnTextRoot size="xl" tone="muted" leading="relaxed">A modal dialog that interrupts the user with important content and expects a response.</ShadcnTextRoot></p>
    <p><ShadcnTextRoot size="lg" weight="semibold" leading="snug">Are you absolutely sure?</ShadcnTextRoot></p>
    <blockquote class="border-s-2 border-border ps-4">
      <ShadcnTextRoot emphasis="italic" leading="relaxed">"Clear typography turns complex workflows into calm reading."</ShadcnTextRoot>
    </blockquote>
    <div class="flex flex-wrap items-center gap-3">
      <code class="rounded bg-muted px-2 py-0.5"><ShadcnTextRoot size="sm" font="mono" weight="semibold" leading="size">npx @proto.ui/cli add vue shadcn-text</ShadcnTextRoot></code>
      <a href="#api"><ShadcnTextRoot size="sm" weight="medium" decoration="underline">View API table</ShadcnTextRoot></a>
      <del><ShadcnTextRoot size="sm" tone="muted" decoration="line-through">Legacy 13px copy</ShadcnTextRoot></del>
    </div>
    <div class="flex flex-col gap-1">
      <small><ShadcnTextRoot size="sm" weight="medium" leading="tight">Email address</ShadcnTextRoot></small>
      <p><ShadcnTextRoot size="sm" tone="muted">Enter your work email to receive release notifications.</ShadcnTextRoot></p>
    </div>
  </div>
</template>
    `),
    'demo-shadcn-text-tones': formatCode(`
<script setup lang="ts">
import { ShadcnSurfaceRoot, ShadcnTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
    <ShadcnSurfaceRoot variant="outline" radius="lg">
      <div class="flex flex-col gap-1 p-4">
        <ShadcnTextRoot size="sm" weight="semibold" tone="default">Default Ink</ShadcnTextRoot>
        <ShadcnTextRoot size="sm" tone="muted">Muted secondary copy on a neutral surface.</ShadcnTextRoot>
      </div>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="solid" radius="lg" border="none">
      <div class="flex flex-col gap-1 p-4">
        <ShadcnTextRoot size="sm" weight="semibold" tone="inherit">Solid Surface · tone="inherit"</ShadcnTextRoot>
        <ShadcnTextRoot size="sm" tone="inherit">Inherits primary-foreground ink automatically.</ShadcnTextRoot>
      </div>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="accent" radius="lg" border="none">
      <div class="flex flex-col gap-1 p-4">
        <ShadcnTextRoot size="sm" weight="semibold" tone="inherit">Accent Surface · tone="inherit"</ShadcnTextRoot>
        <ShadcnTextRoot size="sm" tone="inherit">Stays paired with accent-foreground in light and dark mode.</ShadcnTextRoot>
      </div>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="muted" radius="lg" border="none">
      <div class="flex flex-col gap-1 p-4">
        <ShadcnTextRoot size="sm" weight="semibold" tone="default">Muted Surface</ShadcnTextRoot>
        <ShadcnTextRoot size="sm" tone="muted">Supports default and muted hierarchy cleanly.</ShadcnTextRoot>
      </div>
    </ShadcnSurfaceRoot>
  </div>
</template>
    `),
    'demo-shadcn-text-action-profiles': formatCode(`
<script setup lang="ts">
import { ShadcnSurfaceRoot, ShadcnTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnSurfaceRoot variant="solid" actionProfile="rhea">
      <span class="block px-3 py-1.5"><ShadcnTextRoot size="sm" weight="medium" tone="inherit" actionProfile="rhea">Rhea · 1.25rem</ShadcnTextRoot></span>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="secondary" actionProfile="luma">
      <span class="block px-3 py-1.5"><ShadcnTextRoot size="sm" weight="medium" tone="inherit" actionProfile="luma">Luma · 1.25rem</ShadcnTextRoot></span>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="outline" actionProfile="lyra">
      <span class="block px-2.5 py-1.5"><ShadcnTextRoot size="xs" weight="medium" tone="inherit" actionProfile="lyra">Lyra · 1rem</ShadcnTextRoot></span>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="secondary" actionProfile="mira">
      <span class="block px-2.5 py-1"><ShadcnTextRoot size="xs" weight="medium" tone="inherit" actionProfile="mira">Mira · relaxed</ShadcnTextRoot></span>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="solid" actionProfile="sera">
      <span class="block px-3 py-1.5"><ShadcnTextRoot size="xs" weight="semibold" tone="inherit" actionProfile="sera">Sera · Uppercase</ShadcnTextRoot></span>
    </ShadcnSurfaceRoot>
  </div>
</template>
    `),
    'demo-shadcn-text-rtl': formatCode(`
<script setup lang="ts">
import { ShadcnTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex max-w-xl flex-col gap-5">
    <section dir="rtl" lang="ar" class="flex flex-col gap-3 rounded-lg border border-border p-4 text-start">
      <h2><ShadcnTextRoot size="2xl" font="heading" weight="bold" leading="tight">فرض الضرائب على الضحك: سجلات ضريبة النكتة</ShadcnTextRoot></h2>
      <p><ShadcnTextRoot tone="muted" leading="relaxed">تتبع النصوص اتجاه الحاوية المنطقي مع الحفاظ على تدرج الخطوط وارتفاع الأسطر عبر اللغات من اليمين إلى اليسار.</ShadcnTextRoot></p>
      <blockquote class="border-s-2 border-border ps-4">
        <ShadcnTextRoot size="sm" emphasis="italic" leading="relaxed">«الجميع يستمتع بنكتة جيدة عندما تكون القراءة مريحة وواضحة.»</ShadcnTextRoot>
      </blockquote>
    </section>

    <section lang="zh-CN" class="flex flex-col gap-2 rounded-lg border border-border p-4 text-start">
      <h3><ShadcnTextRoot size="xl" font="heading" weight="semibold" leading="snug">中英混排与 CJK 回退示例 · Geist + System CJK</ShadcnTextRoot></h3>
      <p><ShadcnTextRoot size="sm" tone="muted" leading="relaxed">搭配 SHADCN_TYPOGRAPHY 预设时，拉丁字符优先使用 Geist，中文字符平滑回退至系统无衬线字体。</ShadcnTextRoot></p>
    </section>
  </div>
</template>
    `),
    'demo-brutalist-text': formatCode(`
<script setup lang="ts">
import { BrutalistTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <article class="flex max-w-xl flex-col gap-4">
    <h1><BrutalistTextRoot size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">Bold Print. Zero Ambiguity.</BrutalistTextRoot></h1>
    <p><BrutalistTextRoot size="base" font="body" weight="medium" leading="relaxed">Brutalist typography pairs DM Sans 700 headings with DM Sans 500 body copy while keeping text passive, shadowless, and effortlessly selectable.</BrutalistTextRoot></p>
    <p><BrutalistTextRoot size="sm" tone="muted" weight="medium" emphasis="italic">"Strong hierarchy comes from weight and scale, not decorative clutter."</BrutalistTextRoot></p>
    <div class="flex flex-wrap items-center gap-3">
      <code><BrutalistTextRoot size="sm" font="mono" weight="semibold" tracking="tight" decoration="underline">npx @proto.ui/cli add vue brutalist-text</BrutalistTextRoot></code>
      <BrutalistTextRoot size="xs" tone="muted" weight="medium">DM Sans 500 / 700</BrutalistTextRoot>
    </div>
  </article>
</template>
    `),
    'demo-brutalist-text-scale': formatCode(`
<script setup lang="ts">
import { BrutalistTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex max-w-xl flex-col gap-3">
    <h1><BrutalistTextRoot size="5xl" font="heading" weight="bold" leading="tighter" tracking="tighter">5xl · Poster Headline</BrutalistTextRoot></h1>
    <h2><BrutalistTextRoot size="3xl" font="heading" weight="bold" leading="tight" tracking="tight">3xl · Section Title (DM Sans 700)</BrutalistTextRoot></h2>
    <h3><BrutalistTextRoot size="xl" font="heading" weight="bold" leading="snug">xl · Card Header</BrutalistTextRoot></h3>
    <p><BrutalistTextRoot size="base" font="body" weight="medium" leading="normal">base · Body &amp; control text (DM Sans 500)</BrutalistTextRoot></p>
    <small><BrutalistTextRoot size="sm" font="body" weight="medium" leading="size">sm · 14px / 20px standard control label</BrutalistTextRoot></small>
    <small><BrutalistTextRoot size="xs" font="body" tone="muted" weight="medium" leading="size">xs · 12px / 16px compact badge &amp; caption</BrutalistTextRoot></small>
  </div>
</template>
    `),
    'demo-brutalist-text-editorial': formatCode(`
<script setup lang="ts">
import { BrutalistTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex max-w-xl flex-col gap-4">
    <p><BrutalistTextRoot size="xl" tone="muted" weight="medium" leading="relaxed">Lead summary copy sets expectations before the reader dives into detailed specs.</BrutalistTextRoot></p>
    <blockquote class="border-s-4 border-border ps-4">
      <BrutalistTextRoot weight="medium" emphasis="italic" leading="relaxed">"Keep decorative borders on structural frames, never on passive text."</BrutalistTextRoot>
    </blockquote>
    <div class="flex flex-wrap items-center gap-3">
      <code class="rounded bg-muted px-2 py-0.5"><BrutalistTextRoot size="sm" font="mono" weight="semibold" leading="size">BRUTALIST_THEME</BrutalistTextRoot></code>
      <a href="#api"><BrutalistTextRoot size="sm" weight="bold" decoration="underline">Read API props</BrutalistTextRoot></a>
      <del><BrutalistTextRoot size="sm" tone="muted" decoration="line-through">Deprecated label</BrutalistTextRoot></del>
    </div>
  </div>
</template>
    `),
    'demo-brutalist-text-surfaces': formatCode(`
<script setup lang="ts">
import { BrutalistSurfaceRoot, BrutalistTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
    <BrutalistSurfaceRoot variant="solid" elevation="raised" border="all">
      <div class="flex flex-col gap-1 p-4">
        <BrutalistTextRoot size="base" font="heading" weight="bold" tone="inherit">Main Surface (#5294ff)</BrutalistTextRoot>
        <BrutalistTextRoot size="sm" weight="medium" tone="inherit">tone="inherit" keeps crisp black ink over accent fills.</BrutalistTextRoot>
      </div>
    </BrutalistSurfaceRoot>
    <BrutalistSurfaceRoot variant="secondary" elevation="raised" border="all">
      <div class="flex flex-col gap-1 p-4">
        <BrutalistTextRoot size="base" font="heading" weight="bold" tone="default">Secondary Card Surface</BrutalistTextRoot>
        <BrutalistTextRoot size="sm" weight="medium" tone="muted">Pairs default foreground headings with muted captions.</BrutalistTextRoot>
      </div>
    </BrutalistSurfaceRoot>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-text': formatCode(`
<script setup lang="ts">
import { Bootstrap232TextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <article class="flex max-w-xl flex-col gap-3">
    <h2><Bootstrap232TextRoot size="2xl" font="heading" weight="bold" leading="relaxed" tracking="tight">Classic Bootstrap 2.3.2 Heading (24.5px / 40px)</Bootstrap232TextRoot></h2>
    <p><Bootstrap232TextRoot size="xl" font="body" leading="relaxed">A crisp lead paragraph introduces the page before settling into the classic 20/14 body line-height rhythm.</Bootstrap232TextRoot></p>
    <p><Bootstrap232TextRoot size="base" font="body" leading="normal">Body copy renders with Helvetica Neue, Helvetica, and Arial at the archived 1.4286 line-height ratio so dense forms and tables remain balanced.</Bootstrap232TextRoot></p>
    <div class="flex flex-wrap items-center gap-3 pt-1">
      <code><Bootstrap232TextRoot size="sm" font="mono" tracking="tight" decoration="underline">@proto.ui/prototypes-bootstrap-2-3-2/text</Bootstrap232TextRoot></code>
      <Bootstrap232TextRoot size="sm" tone="muted" emphasis="italic">Muted helper copy · #666666</Bootstrap232TextRoot>
    </div>
  </article>
</template>
    `),
    'demo-bootstrap-2-3-2-text-scale': formatCode(`
<script setup lang="ts">
import { Bootstrap232TextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex max-w-xl flex-col gap-3">
    <h1><Bootstrap232TextRoot size="4xl" font="heading" weight="bold" leading="tighter" tracking="tighter">4xl · Display Heading (leading="tighter")</Bootstrap232TextRoot></h1>
    <h1><Bootstrap232TextRoot size="3xl" font="heading" weight="bold" leading="tight">3xl · Page Title</Bootstrap232TextRoot></h1>
    <h2><Bootstrap232TextRoot size="2xl" font="heading" weight="bold" leading="relaxed">2xl · Archived 24.5px Scale with 40px Relaxed Line Box</Bootstrap232TextRoot></h2>
    <h3><Bootstrap232TextRoot size="xl" font="heading" weight="semibold" leading="size">xl · Section Subheading (leading="size")</Bootstrap232TextRoot></h3>
    <p><Bootstrap232TextRoot size="base" font="body" leading="normal">base · Body copy with classic 20/14 (1.4286) normal leading</Bootstrap232TextRoot></p>
    <small><Bootstrap232TextRoot size="sm" font="body" weight="medium" leading="size">sm · Compact form help &amp; table cell copy</Bootstrap232TextRoot></small>
    <small><Bootstrap232TextRoot size="xs" tone="muted" leading="size">xs · Footnote &amp; badge label</Bootstrap232TextRoot></small>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-text-editorial': formatCode(`
<script setup lang="ts">
import { Bootstrap232TextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex max-w-xl flex-col gap-4">
    <p><Bootstrap232TextRoot size="xl" leading="relaxed">Lead copy makes an introductory paragraph stand out with generous line spacing.</Bootstrap232TextRoot></p>
    <blockquote class="border-s-4 border-border ps-4">
      <Bootstrap232TextRoot emphasis="italic" leading="normal">"Simplicity and predictable typography keep web applications timeless."</Bootstrap232TextRoot>
    </blockquote>
    <div class="flex flex-wrap items-center gap-3">
      <code class="rounded bg-muted px-2 py-0.5"><Bootstrap232TextRoot size="sm" font="mono" leading="size">Bootstrap232TextRoot</Bootstrap232TextRoot></code>
      <a href="#api"><Bootstrap232TextRoot size="sm" decoration="underline">Browse API reference</Bootstrap232TextRoot></a>
      <del><Bootstrap232TextRoot size="sm" tone="muted" decoration="line-through">Deprecated .muted class</Bootstrap232TextRoot></del>
    </div>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-text-tones': formatCode(`
<script setup lang="ts">
import { Bootstrap232SurfaceRoot, Bootstrap232TextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
    <Bootstrap232SurfaceRoot variant="solid" elevation="raised" border="all">
      <div class="flex flex-col gap-1 p-3">
        <Bootstrap232TextRoot size="sm" weight="bold" tone="inherit">Primary Gradient</Bootstrap232TextRoot>
        <Bootstrap232TextRoot size="xs" tone="inherit">tone="inherit" preserves white ink &amp; shadow.</Bootstrap232TextRoot>
      </div>
    </Bootstrap232SurfaceRoot>
    <Bootstrap232SurfaceRoot variant="accent" border="all">
      <div class="flex flex-col gap-1 p-3">
        <Bootstrap232TextRoot size="sm" weight="bold" tone="inherit">Info Accent</Bootstrap232TextRoot>
        <Bootstrap232TextRoot size="xs" tone="inherit">Follows classic #d9edf7 tint foreground.</Bootstrap232TextRoot>
      </div>
    </Bootstrap232SurfaceRoot>
    <Bootstrap232SurfaceRoot variant="outline" elevation="raised" border="all">
      <div class="flex flex-col gap-1 p-3">
        <Bootstrap232TextRoot size="sm" weight="bold" tone="default">Default Well</Bootstrap232TextRoot>
        <Bootstrap232TextRoot size="xs" tone="muted">Muted #666666 caption on white.</Bootstrap232TextRoot>
      </div>
    </Bootstrap232SurfaceRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-text': formatCode(`
<script setup lang="ts">
import { LiquidGlassTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <article class="flex max-w-xl flex-col gap-4">
    <h1><LiquidGlassTextRoot size="3xl" font="heading" weight="semibold" leading="tight" tracking="tight">Spatial Clarity on Content Canvas</LiquidGlassTextRoot></h1>
    <p><LiquidGlassTextRoot size="base" font="body" leading="relaxed">In Liquid Glass interfaces, text stays crisp on the content layer or inherits high-contrast ink inside a single floating glass control—never stacking glass on glass.</LiquidGlassTextRoot></p>
    <p><LiquidGlassTextRoot size="sm" tone="muted" emphasis="italic">Optical system typography · SF-first sans &amp; monospace fallback</LiquidGlassTextRoot></p>
    <code><LiquidGlassTextRoot size="sm" font="mono" tracking="tight" decoration="underline">@proto.ui/prototypes-liquid-glass/text</LiquidGlassTextRoot></code>
  </article>
</template>
    `),
    'demo-liquid-glass-text-scale': formatCode(`
<script setup lang="ts">
import { LiquidGlassTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex max-w-xl flex-col gap-3">
    <h1><LiquidGlassTextRoot size="4xl" font="heading" weight="bold" leading="tighter" tracking="tighter">4xl · Compact Display (leading="tighter")</LiquidGlassTextRoot></h1>
    <h2><LiquidGlassTextRoot size="2xl" font="heading" weight="semibold" leading="tight" tracking="tight">2xl · Window &amp; Sheet Heading</LiquidGlassTextRoot></h2>
    <h3><LiquidGlassTextRoot size="lg" font="heading" weight="semibold" leading="size">lg · Group Title (leading="size")</LiquidGlassTextRoot></h3>
    <p><LiquidGlassTextRoot size="base" font="body" leading="normal">base · System body copy for readable content canvases.</LiquidGlassTextRoot></p>
    <small><LiquidGlassTextRoot size="sm" font="body" weight="medium" leading="size">sm · Control label &amp; toolbar caption</LiquidGlassTextRoot></small>
    <small><LiquidGlassTextRoot size="xs" tone="muted" leading="size">xs · Footnote &amp; status timestamp</LiquidGlassTextRoot></small>
  </div>
</template>
    `),
    'demo-liquid-glass-text-editorial': formatCode(`
<script setup lang="ts">
import { LiquidGlassTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex max-w-xl flex-col gap-4">
    <p><LiquidGlassTextRoot size="xl" tone="muted" leading="relaxed">Content-layer prose stays unobstructed and selectable beneath floating Liquid Glass navigation.</LiquidGlassTextRoot></p>
    <blockquote class="border-s-2 border-border ps-4">
      <LiquidGlassTextRoot emphasis="italic" leading="relaxed">"Reserve translucency for controls; keep reading surfaces calm."</LiquidGlassTextRoot>
    </blockquote>
    <div class="flex flex-wrap items-center gap-3">
      <code class="rounded-md bg-muted px-2 py-0.5"><LiquidGlassTextRoot size="sm" font="mono" weight="medium" leading="size">LiquidGlassTextRoot</LiquidGlassTextRoot></code>
      <a href="#api"><LiquidGlassTextRoot size="sm" weight="medium" decoration="underline">Inspect API</LiquidGlassTextRoot></a>
      <del><LiquidGlassTextRoot size="sm" tone="muted" decoration="line-through">Legacy blurred copy</LiquidGlassTextRoot></del>
    </div>
  </div>
</template>
    `),
    'demo-liquid-glass-text-surfaces': formatCode(`
<script setup lang="ts">
import { LiquidGlassSurfaceRoot, LiquidGlassTextRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid max-w-xl grid-cols-1 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-3">
    <LiquidGlassSurfaceRoot variant="outline" material="auto" radius="xl">
      <div class="flex flex-col gap-1 p-4">
        <LiquidGlassTextRoot size="sm" weight="semibold" tone="inherit">Regular Glass</LiquidGlassTextRoot>
        <LiquidGlassTextRoot size="xs" tone="muted">Single glass layer with crisp inherited ink.</LiquidGlassTextRoot>
      </div>
    </LiquidGlassSurfaceRoot>
    <LiquidGlassSurfaceRoot variant="solid" radius="xl" border="none">
      <div class="flex flex-col gap-1 p-4">
        <LiquidGlassTextRoot size="sm" weight="semibold" tone="inherit">Prominent Tint</LiquidGlassTextRoot>
        <LiquidGlassTextRoot size="xs" tone="inherit">tone="inherit" preserves white primary ink.</LiquidGlassTextRoot>
      </div>
    </LiquidGlassSurfaceRoot>
    <LiquidGlassSurfaceRoot variant="secondary" material="opaque" radius="xl">
      <div class="flex flex-col gap-1 p-4">
        <LiquidGlassTextRoot size="sm" weight="semibold" tone="default">Opaque Canvas</LiquidGlassTextRoot>
        <LiquidGlassTextRoot size="xs" tone="muted">High-contrast fallback &amp; reading layer.</LiquidGlassTextRoot>
      </div>
    </LiquidGlassSurfaceRoot>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-text': formatCode(`
<template>
  <article class="flex max-w-xl flex-col gap-5">
    <header class="flex flex-col gap-2">
      <h1>
        <ShadcnTextRoot size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">
          Taxing Laughter: The Joke Tax Chronicles
        </ShadcnTextRoot>
      </h1>
      <p>
        <ShadcnTextRoot size="xl" tone="muted" leading="relaxed">
          Once upon a time, in a far-off land, a restless court looked for a fairer way to fund the royal treasury.
        </ShadcnTextRoot>
      </p>
    </header>

    <h2 class="border-b border-border pb-2">
      <ShadcnTextRoot size="2xl" font="heading" weight="semibold" leading="tight" tracking="tight">
        The King's Plan
      </ShadcnTextRoot>
    </h2>

    <p>
      <ShadcnTextRoot leading="relaxed">The king thought long and hard, and finally proposed </ShadcnTextRoot>
      <a href="#examples"><ShadcnTextRoot weight="medium" decoration="underline">a brilliant plan</ShadcnTextRoot></a>
      <ShadcnTextRoot leading="relaxed">: taxing every pun and one-liner told in the kingdom.</ShadcnTextRoot>
    </p>

    <blockquote class="border-s-2 border-border ps-4">
      <ShadcnTextRoot emphasis="italic" leading="relaxed">
        "After all, everyone enjoys a good joke, so it is only fair that they pay for the privilege."
      </ShadcnTextRoot>
    </blockquote>

    <div class="flex flex-wrap items-center gap-2">
      <code class="rounded bg-muted px-2 py-0.5">
        <ShadcnTextRoot size="sm" font="mono" weight="semibold" leading="size">@proto.ui/prototypes-shadcn/text</ShadcnTextRoot>
      </code>
      <ShadcnTextRoot size="sm" tone="muted">Shadcn Rhea · Geist &amp; CJK fallback ready</ShadcnTextRoot>
    </div>
  </article>
</template>

<script>
import { ShadcnTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnTextRoot },
};
</script>
    `),
    'demo-shadcn-text-scale': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-3">
    <h1><ShadcnTextRoot size="5xl" font="heading" weight="bold" leading="tighter" tracking="tighter">5xl · Display Title</ShadcnTextRoot></h1>
    <h1><ShadcnTextRoot size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">4xl · Page Heading</ShadcnTextRoot></h1>
    <h2><ShadcnTextRoot size="3xl" font="heading" weight="semibold" leading="tight" tracking="tight">3xl · Section Heading</ShadcnTextRoot></h2>
    <h3><ShadcnTextRoot size="2xl" font="heading" weight="semibold" leading="snug" tracking="tight">2xl · Subsection Heading</ShadcnTextRoot></h3>
    <h4><ShadcnTextRoot size="xl" font="heading" weight="semibold" leading="size">xl · Card Title</ShadcnTextRoot></h4>
    <p><ShadcnTextRoot size="lg" weight="semibold" leading="size">lg · Large Callout</ShadcnTextRoot></p>
    <p><ShadcnTextRoot size="base" weight="normal" leading="normal">base · Default body copy for paragraphs and descriptions.</ShadcnTextRoot></p>
    <small><ShadcnTextRoot size="sm" weight="medium" leading="size">sm · Compact control label &amp; metadata</ShadcnTextRoot></small>
    <small><ShadcnTextRoot size="xs" tone="muted" leading="size">xs · Caption, badge, and keyboard hint</ShadcnTextRoot></small>
  </div>
</template>

<script>
import { ShadcnTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnTextRoot },
};
</script>
    `),
    'demo-shadcn-text-editorial': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-4">
    <p><ShadcnTextRoot size="xl" tone="muted" leading="relaxed">A modal dialog that interrupts the user with important content and expects a response.</ShadcnTextRoot></p>
    <p><ShadcnTextRoot size="lg" weight="semibold" leading="snug">Are you absolutely sure?</ShadcnTextRoot></p>
    <blockquote class="border-s-2 border-border ps-4">
      <ShadcnTextRoot emphasis="italic" leading="relaxed">"Clear typography turns complex workflows into calm reading."</ShadcnTextRoot>
    </blockquote>
    <div class="flex flex-wrap items-center gap-3">
      <code class="rounded bg-muted px-2 py-0.5"><ShadcnTextRoot size="sm" font="mono" weight="semibold" leading="size">npx @proto.ui/cli add vue2 shadcn-text</ShadcnTextRoot></code>
      <a href="#api"><ShadcnTextRoot size="sm" weight="medium" decoration="underline">View API table</ShadcnTextRoot></a>
      <del><ShadcnTextRoot size="sm" tone="muted" decoration="line-through">Legacy 13px copy</ShadcnTextRoot></del>
    </div>
    <div class="flex flex-col gap-1">
      <small><ShadcnTextRoot size="sm" weight="medium" leading="tight">Email address</ShadcnTextRoot></small>
      <p><ShadcnTextRoot size="sm" tone="muted">Enter your work email to receive release notifications.</ShadcnTextRoot></p>
    </div>
  </div>
</template>

<script>
import { ShadcnTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnTextRoot },
};
</script>
    `),
    'demo-shadcn-text-tones': formatCode(`
<template>
  <div class="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
    <ShadcnSurfaceRoot variant="outline" radius="lg">
      <div class="flex flex-col gap-1 p-4">
        <ShadcnTextRoot size="sm" weight="semibold" tone="default">Default Ink</ShadcnTextRoot>
        <ShadcnTextRoot size="sm" tone="muted">Muted secondary copy on a neutral surface.</ShadcnTextRoot>
      </div>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="solid" radius="lg" border="none">
      <div class="flex flex-col gap-1 p-4">
        <ShadcnTextRoot size="sm" weight="semibold" tone="inherit">Solid Surface · tone="inherit"</ShadcnTextRoot>
        <ShadcnTextRoot size="sm" tone="inherit">Inherits primary-foreground ink automatically.</ShadcnTextRoot>
      </div>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="accent" radius="lg" border="none">
      <div class="flex flex-col gap-1 p-4">
        <ShadcnTextRoot size="sm" weight="semibold" tone="inherit">Accent Surface · tone="inherit"</ShadcnTextRoot>
        <ShadcnTextRoot size="sm" tone="inherit">Stays paired with accent-foreground in light and dark mode.</ShadcnTextRoot>
      </div>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="muted" radius="lg" border="none">
      <div class="flex flex-col gap-1 p-4">
        <ShadcnTextRoot size="sm" weight="semibold" tone="default">Muted Surface</ShadcnTextRoot>
        <ShadcnTextRoot size="sm" tone="muted">Supports default and muted hierarchy cleanly.</ShadcnTextRoot>
      </div>
    </ShadcnSurfaceRoot>
  </div>
</template>

<script>
import { ShadcnSurfaceRoot, ShadcnTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnSurfaceRoot, ShadcnTextRoot },
};
</script>
    `),
    'demo-shadcn-text-action-profiles': formatCode(`
<template>
  <div class="flex flex-wrap items-center gap-3">
    <ShadcnSurfaceRoot variant="solid" actionProfile="rhea">
      <span class="block px-3 py-1.5"><ShadcnTextRoot size="sm" weight="medium" tone="inherit" actionProfile="rhea">Rhea · 1.25rem</ShadcnTextRoot></span>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="secondary" actionProfile="luma">
      <span class="block px-3 py-1.5"><ShadcnTextRoot size="sm" weight="medium" tone="inherit" actionProfile="luma">Luma · 1.25rem</ShadcnTextRoot></span>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="outline" actionProfile="lyra">
      <span class="block px-2.5 py-1.5"><ShadcnTextRoot size="xs" weight="medium" tone="inherit" actionProfile="lyra">Lyra · 1rem</ShadcnTextRoot></span>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="secondary" actionProfile="mira">
      <span class="block px-2.5 py-1"><ShadcnTextRoot size="xs" weight="medium" tone="inherit" actionProfile="mira">Mira · relaxed</ShadcnTextRoot></span>
    </ShadcnSurfaceRoot>
    <ShadcnSurfaceRoot variant="solid" actionProfile="sera">
      <span class="block px-3 py-1.5"><ShadcnTextRoot size="xs" weight="semibold" tone="inherit" actionProfile="sera">Sera · Uppercase</ShadcnTextRoot></span>
    </ShadcnSurfaceRoot>
  </div>
</template>

<script>
import { ShadcnSurfaceRoot, ShadcnTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnSurfaceRoot, ShadcnTextRoot },
};
</script>
    `),
    'demo-shadcn-text-rtl': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-5">
    <section dir="rtl" lang="ar" class="flex flex-col gap-3 rounded-lg border border-border p-4 text-start">
      <h2><ShadcnTextRoot size="2xl" font="heading" weight="bold" leading="tight">فرض الضرائب على الضحك: سجلات ضريبة النكتة</ShadcnTextRoot></h2>
      <p><ShadcnTextRoot tone="muted" leading="relaxed">تتبع النصوص اتجاه الحاوية المنطقي مع الحفاظ على تدرج الخطوط وارتفاع الأسطر عبر اللغات من اليمين إلى اليسار.</ShadcnTextRoot></p>
      <blockquote class="border-s-2 border-border ps-4">
        <ShadcnTextRoot size="sm" emphasis="italic" leading="relaxed">«الجميع يستمتع بنكتة جيدة عندما تكون القراءة مريحة وواضحة.»</ShadcnTextRoot>
      </blockquote>
    </section>

    <section lang="zh-CN" class="flex flex-col gap-2 rounded-lg border border-border p-4 text-start">
      <h3><ShadcnTextRoot size="xl" font="heading" weight="semibold" leading="snug">中英混排与 CJK 回退示例 · Geist + System CJK</ShadcnTextRoot></h3>
      <p><ShadcnTextRoot size="sm" tone="muted" leading="relaxed">搭配 SHADCN_TYPOGRAPHY 预设时，拉丁字符优先使用 Geist，中文字符平滑回退至系统无衬线字体。</ShadcnTextRoot></p>
    </section>
  </div>
</template>

<script>
import { ShadcnTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnTextRoot },
};
</script>
    `),
    'demo-brutalist-text': formatCode(`
<template>
  <article class="flex max-w-xl flex-col gap-4">
    <h1><BrutalistTextRoot size="4xl" font="heading" weight="bold" leading="tight" tracking="tight">Bold Print. Zero Ambiguity.</BrutalistTextRoot></h1>
    <p><BrutalistTextRoot size="base" font="body" weight="medium" leading="relaxed">Brutalist typography pairs DM Sans 700 headings with DM Sans 500 body copy while keeping text passive, shadowless, and effortlessly selectable.</BrutalistTextRoot></p>
    <p><BrutalistTextRoot size="sm" tone="muted" weight="medium" emphasis="italic">"Strong hierarchy comes from weight and scale, not decorative clutter."</BrutalistTextRoot></p>
    <div class="flex flex-wrap items-center gap-3">
      <code><BrutalistTextRoot size="sm" font="mono" weight="semibold" tracking="tight" decoration="underline">npx @proto.ui/cli add vue2 brutalist-text</BrutalistTextRoot></code>
      <BrutalistTextRoot size="xs" tone="muted" weight="medium">DM Sans 500 / 700</BrutalistTextRoot>
    </div>
  </article>
</template>

<script>
import { BrutalistTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistTextRoot },
};
</script>
    `),
    'demo-brutalist-text-scale': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-3">
    <h1><BrutalistTextRoot size="5xl" font="heading" weight="bold" leading="tighter" tracking="tighter">5xl · Poster Headline</BrutalistTextRoot></h1>
    <h2><BrutalistTextRoot size="3xl" font="heading" weight="bold" leading="tight" tracking="tight">3xl · Section Title (DM Sans 700)</BrutalistTextRoot></h2>
    <h3><BrutalistTextRoot size="xl" font="heading" weight="bold" leading="snug">xl · Card Header</BrutalistTextRoot></h3>
    <p><BrutalistTextRoot size="base" font="body" weight="medium" leading="normal">base · Body &amp; control text (DM Sans 500)</BrutalistTextRoot></p>
    <small><BrutalistTextRoot size="sm" font="body" weight="medium" leading="size">sm · 14px / 20px standard control label</BrutalistTextRoot></small>
    <small><BrutalistTextRoot size="xs" font="body" tone="muted" weight="medium" leading="size">xs · 12px / 16px compact badge &amp; caption</BrutalistTextRoot></small>
  </div>
</template>

<script>
import { BrutalistTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistTextRoot },
};
</script>
    `),
    'demo-brutalist-text-editorial': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-4">
    <p><BrutalistTextRoot size="xl" tone="muted" weight="medium" leading="relaxed">Lead summary copy sets expectations before the reader dives into detailed specs.</BrutalistTextRoot></p>
    <blockquote class="border-s-4 border-border ps-4">
      <BrutalistTextRoot weight="medium" emphasis="italic" leading="relaxed">"Keep decorative borders on structural frames, never on passive text."</BrutalistTextRoot>
    </blockquote>
    <div class="flex flex-wrap items-center gap-3">
      <code class="rounded bg-muted px-2 py-0.5"><BrutalistTextRoot size="sm" font="mono" weight="semibold" leading="size">BRUTALIST_THEME</BrutalistTextRoot></code>
      <a href="#api"><BrutalistTextRoot size="sm" weight="bold" decoration="underline">Read API props</BrutalistTextRoot></a>
      <del><BrutalistTextRoot size="sm" tone="muted" decoration="line-through">Deprecated label</BrutalistTextRoot></del>
    </div>
  </div>
</template>

<script>
import { BrutalistTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistTextRoot },
};
</script>
    `),
    'demo-brutalist-text-surfaces': formatCode(`
<template>
  <div class="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
    <BrutalistSurfaceRoot variant="solid" elevation="raised" border="all">
      <div class="flex flex-col gap-1 p-4">
        <BrutalistTextRoot size="base" font="heading" weight="bold" tone="inherit">Main Surface (#5294ff)</BrutalistTextRoot>
        <BrutalistTextRoot size="sm" weight="medium" tone="inherit">tone="inherit" keeps crisp black ink over accent fills.</BrutalistTextRoot>
      </div>
    </BrutalistSurfaceRoot>
    <BrutalistSurfaceRoot variant="secondary" elevation="raised" border="all">
      <div class="flex flex-col gap-1 p-4">
        <BrutalistTextRoot size="base" font="heading" weight="bold" tone="default">Secondary Card Surface</BrutalistTextRoot>
        <BrutalistTextRoot size="sm" weight="medium" tone="muted">Pairs default foreground headings with muted captions.</BrutalistTextRoot>
      </div>
    </BrutalistSurfaceRoot>
  </div>
</template>

<script>
import { BrutalistSurfaceRoot, BrutalistTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistSurfaceRoot, BrutalistTextRoot },
};
</script>
    `),
    'demo-bootstrap-2-3-2-text': formatCode(`
<template>
  <article class="flex max-w-xl flex-col gap-3">
    <h2><Bootstrap232TextRoot size="2xl" font="heading" weight="bold" leading="relaxed" tracking="tight">Classic Bootstrap 2.3.2 Heading (24.5px / 40px)</Bootstrap232TextRoot></h2>
    <p><Bootstrap232TextRoot size="xl" font="body" leading="relaxed">A crisp lead paragraph introduces the page before settling into the classic 20/14 body line-height rhythm.</Bootstrap232TextRoot></p>
    <p><Bootstrap232TextRoot size="base" font="body" leading="normal">Body copy renders with Helvetica Neue, Helvetica, and Arial at the archived 1.4286 line-height ratio so dense forms and tables remain balanced.</Bootstrap232TextRoot></p>
    <div class="flex flex-wrap items-center gap-3 pt-1">
      <code><Bootstrap232TextRoot size="sm" font="mono" tracking="tight" decoration="underline">@proto.ui/prototypes-bootstrap-2-3-2/text</Bootstrap232TextRoot></code>
      <Bootstrap232TextRoot size="sm" tone="muted" emphasis="italic">Muted helper copy · #666666</Bootstrap232TextRoot>
    </div>
  </article>
</template>

<script>
import { Bootstrap232TextRoot } from '../proto-ui/components/vue2';

export default {
  components: { Bootstrap232TextRoot },
};
</script>
    `),
    'demo-bootstrap-2-3-2-text-scale': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-3">
    <h1><Bootstrap232TextRoot size="4xl" font="heading" weight="bold" leading="tighter" tracking="tighter">4xl · Display Heading (leading="tighter")</Bootstrap232TextRoot></h1>
    <h1><Bootstrap232TextRoot size="3xl" font="heading" weight="bold" leading="tight">3xl · Page Title</Bootstrap232TextRoot></h1>
    <h2><Bootstrap232TextRoot size="2xl" font="heading" weight="bold" leading="relaxed">2xl · Archived 24.5px Scale with 40px Relaxed Line Box</Bootstrap232TextRoot></h2>
    <h3><Bootstrap232TextRoot size="xl" font="heading" weight="semibold" leading="size">xl · Section Subheading (leading="size")</Bootstrap232TextRoot></h3>
    <p><Bootstrap232TextRoot size="base" font="body" leading="normal">base · Body copy with classic 20/14 (1.4286) normal leading</Bootstrap232TextRoot></p>
    <small><Bootstrap232TextRoot size="sm" font="body" weight="medium" leading="size">sm · Compact form help &amp; table cell copy</Bootstrap232TextRoot></small>
    <small><Bootstrap232TextRoot size="xs" tone="muted" leading="size">xs · Footnote &amp; badge label</Bootstrap232TextRoot></small>
  </div>
</template>

<script>
import { Bootstrap232TextRoot } from '../proto-ui/components/vue2';

export default {
  components: { Bootstrap232TextRoot },
};
</script>
    `),
    'demo-bootstrap-2-3-2-text-editorial': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-4">
    <p><Bootstrap232TextRoot size="xl" leading="relaxed">Lead copy makes an introductory paragraph stand out with generous line spacing.</Bootstrap232TextRoot></p>
    <blockquote class="border-s-4 border-border ps-4">
      <Bootstrap232TextRoot emphasis="italic" leading="normal">"Simplicity and predictable typography keep web applications timeless."</Bootstrap232TextRoot>
    </blockquote>
    <div class="flex flex-wrap items-center gap-3">
      <code class="rounded bg-muted px-2 py-0.5"><Bootstrap232TextRoot size="sm" font="mono" leading="size">Bootstrap232TextRoot</Bootstrap232TextRoot></code>
      <a href="#api"><Bootstrap232TextRoot size="sm" decoration="underline">Browse API reference</Bootstrap232TextRoot></a>
      <del><Bootstrap232TextRoot size="sm" tone="muted" decoration="line-through">Deprecated .muted class</Bootstrap232TextRoot></del>
    </div>
  </div>
</template>

<script>
import { Bootstrap232TextRoot } from '../proto-ui/components/vue2';

export default {
  components: { Bootstrap232TextRoot },
};
</script>
    `),
    'demo-bootstrap-2-3-2-text-tones': formatCode(`
<template>
  <div class="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
    <Bootstrap232SurfaceRoot variant="solid" elevation="raised" border="all">
      <div class="flex flex-col gap-1 p-3">
        <Bootstrap232TextRoot size="sm" weight="bold" tone="inherit">Primary Gradient</Bootstrap232TextRoot>
        <Bootstrap232TextRoot size="xs" tone="inherit">tone="inherit" preserves white ink &amp; shadow.</Bootstrap232TextRoot>
      </div>
    </Bootstrap232SurfaceRoot>
    <Bootstrap232SurfaceRoot variant="accent" border="all">
      <div class="flex flex-col gap-1 p-3">
        <Bootstrap232TextRoot size="sm" weight="bold" tone="inherit">Info Accent</Bootstrap232TextRoot>
        <Bootstrap232TextRoot size="xs" tone="inherit">Follows classic #d9edf7 tint foreground.</Bootstrap232TextRoot>
      </div>
    </Bootstrap232SurfaceRoot>
    <Bootstrap232SurfaceRoot variant="outline" elevation="raised" border="all">
      <div class="flex flex-col gap-1 p-3">
        <Bootstrap232TextRoot size="sm" weight="bold" tone="default">Default Well</Bootstrap232TextRoot>
        <Bootstrap232TextRoot size="xs" tone="muted">Muted #666666 caption on white.</Bootstrap232TextRoot>
      </div>
    </Bootstrap232SurfaceRoot>
  </div>
</template>

<script>
import { Bootstrap232SurfaceRoot, Bootstrap232TextRoot } from '../proto-ui/components/vue2';

export default {
  components: { Bootstrap232SurfaceRoot, Bootstrap232TextRoot },
};
</script>
    `),
    'demo-liquid-glass-text': formatCode(`
<template>
  <article class="flex max-w-xl flex-col gap-4">
    <h1><LiquidGlassTextRoot size="3xl" font="heading" weight="semibold" leading="tight" tracking="tight">Spatial Clarity on Content Canvas</LiquidGlassTextRoot></h1>
    <p><LiquidGlassTextRoot size="base" font="body" leading="relaxed">In Liquid Glass interfaces, text stays crisp on the content layer or inherits high-contrast ink inside a single floating glass control—never stacking glass on glass.</LiquidGlassTextRoot></p>
    <p><LiquidGlassTextRoot size="sm" tone="muted" emphasis="italic">Optical system typography · SF-first sans &amp; monospace fallback</LiquidGlassTextRoot></p>
    <code><LiquidGlassTextRoot size="sm" font="mono" tracking="tight" decoration="underline">@proto.ui/prototypes-liquid-glass/text</LiquidGlassTextRoot></code>
  </article>
</template>

<script>
import { LiquidGlassTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassTextRoot },
};
</script>
    `),
    'demo-liquid-glass-text-scale': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-3">
    <h1><LiquidGlassTextRoot size="4xl" font="heading" weight="bold" leading="tighter" tracking="tighter">4xl · Compact Display (leading="tighter")</LiquidGlassTextRoot></h1>
    <h2><LiquidGlassTextRoot size="2xl" font="heading" weight="semibold" leading="tight" tracking="tight">2xl · Window &amp; Sheet Heading</LiquidGlassTextRoot></h2>
    <h3><LiquidGlassTextRoot size="lg" font="heading" weight="semibold" leading="size">lg · Group Title (leading="size")</LiquidGlassTextRoot></h3>
    <p><LiquidGlassTextRoot size="base" font="body" leading="normal">base · System body copy for readable content canvases.</LiquidGlassTextRoot></p>
    <small><LiquidGlassTextRoot size="sm" font="body" weight="medium" leading="size">sm · Control label &amp; toolbar caption</LiquidGlassTextRoot></small>
    <small><LiquidGlassTextRoot size="xs" tone="muted" leading="size">xs · Footnote &amp; status timestamp</LiquidGlassTextRoot></small>
  </div>
</template>

<script>
import { LiquidGlassTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassTextRoot },
};
</script>
    `),
    'demo-liquid-glass-text-editorial': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-4">
    <p><LiquidGlassTextRoot size="xl" tone="muted" leading="relaxed">Content-layer prose stays unobstructed and selectable beneath floating Liquid Glass navigation.</LiquidGlassTextRoot></p>
    <blockquote class="border-s-2 border-border ps-4">
      <LiquidGlassTextRoot emphasis="italic" leading="relaxed">"Reserve translucency for controls; keep reading surfaces calm."</LiquidGlassTextRoot>
    </blockquote>
    <div class="flex flex-wrap items-center gap-3">
      <code class="rounded-md bg-muted px-2 py-0.5"><LiquidGlassTextRoot size="sm" font="mono" weight="medium" leading="size">LiquidGlassTextRoot</LiquidGlassTextRoot></code>
      <a href="#api"><LiquidGlassTextRoot size="sm" weight="medium" decoration="underline">Inspect API</LiquidGlassTextRoot></a>
      <del><LiquidGlassTextRoot size="sm" tone="muted" decoration="line-through">Legacy blurred copy</LiquidGlassTextRoot></del>
    </div>
  </div>
</template>

<script>
import { LiquidGlassTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassTextRoot },
};
</script>
    `),
    'demo-liquid-glass-text-surfaces': formatCode(`
<template>
  <div class="grid max-w-xl grid-cols-1 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-3">
    <LiquidGlassSurfaceRoot variant="outline" material="auto" radius="xl">
      <div class="flex flex-col gap-1 p-4">
        <LiquidGlassTextRoot size="sm" weight="semibold" tone="inherit">Regular Glass</LiquidGlassTextRoot>
        <LiquidGlassTextRoot size="xs" tone="muted">Single glass layer with crisp inherited ink.</LiquidGlassTextRoot>
      </div>
    </LiquidGlassSurfaceRoot>
    <LiquidGlassSurfaceRoot variant="solid" radius="xl" border="none">
      <div class="flex flex-col gap-1 p-4">
        <LiquidGlassTextRoot size="sm" weight="semibold" tone="inherit">Prominent Tint</LiquidGlassTextRoot>
        <LiquidGlassTextRoot size="xs" tone="inherit">tone="inherit" preserves white primary ink.</LiquidGlassTextRoot>
      </div>
    </LiquidGlassSurfaceRoot>
    <LiquidGlassSurfaceRoot variant="secondary" material="opaque" radius="xl">
      <div class="flex flex-col gap-1 p-4">
        <LiquidGlassTextRoot size="sm" weight="semibold" tone="default">Opaque Canvas</LiquidGlassTextRoot>
        <LiquidGlassTextRoot size="xs" tone="muted">High-contrast fallback &amp; reading layer.</LiquidGlassTextRoot>
      </div>
    </LiquidGlassSurfaceRoot>
  </div>
</template>

<script>
import { LiquidGlassSurfaceRoot, LiquidGlassTextRoot } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassSurfaceRoot, LiquidGlassTextRoot },
};
</script>
    `),
  },
};
