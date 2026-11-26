import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-card': formatCode(`
<wc-shadcn-card-root style-profile="rhea" class="w-full max-w-sm">
  <wc-shadcn-card-header style-profile="rhea">
    <h3 class="text-base font-medium">Deployment summary</h3>
    <p class="text-sm text-muted-foreground">
      Production release v2.4 is live across all regions.
    </p>
  </wc-shadcn-card-header>
  <wc-shadcn-card-content style-profile="rhea">
    <p class="text-sm">
      All 12 edge workers passed health checks with 99.98% uptime over the last 24 hours.
    </p>
  </wc-shadcn-card-content>
  <wc-shadcn-card-footer style-profile="rhea">
    <a href="#card-contract" class="text-sm font-medium underline underline-offset-4 hover:opacity-80">
      View usage guide
    </a>
  </wc-shadcn-card-footer>
</wc-shadcn-card-root>
    `),
    'demo-shadcn-card-login': formatCode(`
<wc-shadcn-card-root style-profile="rhea" class="w-full max-w-sm">
  <wc-shadcn-card-header style-profile="rhea">
    <div class="flex items-start justify-between gap-2">
      <div class="grid gap-1">
        <h3 class="text-base font-medium">Login to your account</h3>
        <p class="text-sm text-muted-foreground">
          Enter your email below to login to your account
        </p>
      </div>
      <wc-shadcn-button style-profile="rhea" variant="link" size="sm">Sign Up</wc-shadcn-button>
    </div>
  </wc-shadcn-card-header>
  <wc-shadcn-card-content style-profile="rhea">
    <div class="flex flex-col gap-5">
      <div class="grid gap-2">
        <label for="card-login-email" class="text-sm font-medium">Email</label>
        <wc-shadcn-input-root style-profile="rhea" id="card-login-email" placeholder="m@example.com"></wc-shadcn-input-root>
      </div>
      <div class="grid gap-2">
        <div class="flex items-center">
          <label for="card-login-password" class="text-sm font-medium">Password</label>
          <a href="#card-contract" class="ms-auto text-sm underline-offset-4 hover:underline">
            Forgot your password?
          </a>
        </div>
        <wc-shadcn-input-root style-profile="rhea" id="card-login-password" placeholder="Enter your password"></wc-shadcn-input-root>
      </div>
    </div>
  </wc-shadcn-card-content>
  <wc-shadcn-card-footer style-profile="rhea" class="flex-col gap-2">
    <wc-shadcn-button style-profile="rhea" class="w-full">Login</wc-shadcn-button>
    <wc-shadcn-button style-profile="rhea" variant="outline" class="w-full">Login with Google</wc-shadcn-button>
  </wc-shadcn-card-footer>
</wc-shadcn-card-root>
    `),
    'demo-shadcn-card-small': formatCode(`
<wc-shadcn-card-root style-profile="rhea" size="sm" class="w-full max-w-xs">
  <wc-shadcn-card-header style-profile="rhea">
    <h3 class="text-base font-medium">Scheduled reports</h3>
    <p class="text-sm text-muted-foreground">Weekly snapshots. No more manual exports.</p>
  </wc-shadcn-card-header>
  <wc-shadcn-card-content style-profile="rhea">
    <ul class="grid gap-2 py-1 text-sm">
      <li>Choose a schedule (daily, or weekly).</li>
      <li>Send to channels or specific teammates.</li>
      <li>Include charts, tables, and key metrics.</li>
    </ul>
  </wc-shadcn-card-content>
  <wc-shadcn-card-footer style-profile="rhea" class="flex-col gap-2">
    <wc-shadcn-button style-profile="rhea" size="sm" class="w-full">Set up scheduled reports</wc-shadcn-button>
    <wc-shadcn-button style-profile="rhea" variant="outline" size="sm" class="w-full">See what's new</wc-shadcn-button>
  </wc-shadcn-card-footer>
</wc-shadcn-card-root>
    `),
    'demo-shadcn-card-dividers': formatCode(`
<wc-shadcn-card-root style-profile="rhea" class="w-full max-w-sm">
  <wc-shadcn-card-header style-profile="rhea" divider>
    <h3 class="text-base font-medium">Terms of Service</h3>
    <p class="text-sm text-muted-foreground">Review the terms before accepting the agreement.</p>
  </wc-shadcn-card-header>
  <wc-shadcn-card-content style-profile="rhea">
    <div class="max-h-40 space-y-3 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
      <p>These terms govern your use of the workspace, including access to shared documents and collaboration tools.</p>
      <p>By continuing, you agree to keep your account credentials secure.</p>
    </div>
  </wc-shadcn-card-content>
  <wc-shadcn-card-footer style-profile="rhea" divider class="justify-end gap-2">
    <wc-shadcn-button style-profile="rhea" variant="outline" size="sm">Decline</wc-shadcn-button>
    <wc-shadcn-button style-profile="rhea" size="sm">Accept</wc-shadcn-button>
  </wc-shadcn-card-footer>
</wc-shadcn-card-root>
    `),
    'demo-shadcn-card-image': formatCode(`
<wc-shadcn-card-root style-profile="rhea" class="w-full max-w-sm pt-0">
  <img src="/images/base-image/landscape.svg" alt="Design systems meetup cover" class="aspect-video w-full object-cover" />
  <wc-shadcn-card-header style-profile="rhea">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-base font-medium">Design systems meetup</h3>
      <span class="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">Featured</span>
    </div>
    <p class="text-sm text-muted-foreground">
      A practical talk on component APIs, accessibility, and shipping faster.
    </p>
  </wc-shadcn-card-header>
  <wc-shadcn-card-footer style-profile="rhea">
    <wc-shadcn-button style-profile="rhea" class="w-full">View Event</wc-shadcn-button>
  </wc-shadcn-card-footer>
</wc-shadcn-card-root>
    `),
    'demo-shadcn-card-density': formatCode(`
<div class="grid w-full max-w-2xl items-start gap-5 md:grid-cols-2">
  <wc-shadcn-card-root style-profile="rhea" size="default">
    <wc-shadcn-card-header style-profile="rhea" divider>
      <h3 class="text-base font-medium">Default density</h3>
      <p class="text-sm text-muted-foreground">size="default" · 20px section inset &amp; gap</p>
    </wc-shadcn-card-header>
    <wc-shadcn-card-content style-profile="rhea">
      <p class="text-sm">Balanced rhythm for primary feature cards, forms, and editorial summaries.</p>
    </wc-shadcn-card-content>
    <wc-shadcn-card-footer style-profile="rhea" divider>
      <wc-shadcn-button style-profile="rhea" variant="outline" size="sm">Open details</wc-shadcn-button>
    </wc-shadcn-card-footer>
  </wc-shadcn-card-root>

  <wc-shadcn-card-root style-profile="rhea" size="sm">
    <wc-shadcn-card-header style-profile="rhea" divider>
      <h3 class="text-base font-medium">Compact density</h3>
      <p class="text-sm text-muted-foreground">size="sm" · 16px section inset &amp; gap</p>
    </wc-shadcn-card-header>
    <wc-shadcn-card-content style-profile="rhea">
      <p class="text-sm">Tighter spacing for sidebar widgets, checklists, and high-density dashboards.</p>
    </wc-shadcn-card-content>
    <wc-shadcn-card-footer style-profile="rhea" divider>
      <wc-shadcn-button style-profile="rhea" variant="outline" size="sm">Open details</wc-shadcn-button>
    </wc-shadcn-card-footer>
  </wc-shadcn-card-root>
</div>
    `),
    'demo-shadcn-card-rtl': formatCode(`
<div dir="rtl" class="w-full max-w-sm">
  <wc-shadcn-card-root style-profile="rhea" class="w-full">
    <wc-shadcn-card-header style-profile="rhea">
      <div class="flex items-start justify-between gap-2">
        <div class="grid gap-1">
          <h3 class="text-base font-medium">تسجيل الدخول إلى حسابك</h3>
          <p class="text-sm text-muted-foreground">أدخل بريدك الإلكتروني أدناه لتسجيل الدخول إلى حسابك</p>
        </div>
        <wc-shadcn-button style-profile="rhea" variant="link" size="sm">إنشاء حساب</wc-shadcn-button>
      </div>
    </wc-shadcn-card-header>
    <wc-shadcn-card-content style-profile="rhea">
      <div class="grid gap-2">
        <label for="rtl-email" class="text-sm font-medium">البريد الإلكتروني</label>
        <wc-shadcn-input-root style-profile="rhea" id="rtl-email" placeholder="m@example.com"></wc-shadcn-input-root>
      </div>
    </wc-shadcn-card-content>
    <wc-shadcn-card-footer style-profile="rhea" class="flex-col gap-2">
      <wc-shadcn-button style-profile="rhea" class="w-full">تسجيل الدخول</wc-shadcn-button>
      <wc-shadcn-button style-profile="rhea" variant="outline" class="w-full">تسجيل الدخول باستخدام Google</wc-shadcn-button>
    </wc-shadcn-card-footer>
  </wc-shadcn-card-root>
</div>
    `),
    'demo-brutalist-card': formatCode(`
<wc-brutalist-card-root class="w-full max-w-sm">
  <wc-brutalist-card-header>
    <div class="flex flex-col gap-1">
      <h3 class="font-heading text-base font-bold">Weekly deployment</h3>
      <p class="text-sm text-muted-foreground">Release v2.4 is ready to publish to production.</p>
    </div>
  </wc-brutalist-card-header>
  <wc-brutalist-card-content>
    <p class="text-sm">12 automated checks passed across all edge regions with zero regressions.</p>
  </wc-brutalist-card-content>
  <wc-brutalist-card-footer class="flex-wrap">
    <span class="text-xs text-muted-foreground">Updated 2m ago</span>
    <wc-brutalist-button size="sm">Publish release</wc-brutalist-button>
  </wc-brutalist-card-footer>
</wc-brutalist-card-root>
    `),
    'demo-brutalist-card-login': formatCode(`
<wc-brutalist-card-root class="w-full max-w-sm">
  <wc-brutalist-card-header>
    <div class="flex flex-col gap-1">
      <h3 class="font-heading text-base font-bold">Login to your account</h3>
      <p class="text-sm text-muted-foreground">Enter your email below to login to your account</p>
    </div>
  </wc-brutalist-card-header>
  <wc-brutalist-card-content>
    <div class="flex flex-col gap-5">
      <div class="grid gap-2">
        <label for="b-email" class="text-sm font-medium">Email</label>
        <wc-brutalist-input-root id="b-email" placeholder="m@example.com"></wc-brutalist-input-root>
      </div>
      <div class="grid gap-2">
        <div class="flex items-center">
          <label for="b-password" class="text-sm font-medium">Password</label>
          <a href="#usage" class="ms-auto text-sm underline-offset-4 hover:underline">Forgot your password?</a>
        </div>
        <wc-brutalist-input-root id="b-password" placeholder="Enter your password"></wc-brutalist-input-root>
      </div>
    </div>
  </wc-brutalist-card-content>
  <wc-brutalist-card-footer class="flex-col items-stretch gap-2">
    <wc-brutalist-button variant="solid" class="w-full">Login</wc-brutalist-button>
    <wc-brutalist-button variant="surface" class="w-full">Login with Google</wc-brutalist-button>
  </wc-brutalist-card-footer>
</wc-brutalist-card-root>
    `),
    'demo-brutalist-card-small': formatCode(`
<wc-brutalist-card-root size="sm" class="w-full max-w-xs">
  <wc-brutalist-card-header>
    <div class="flex flex-col gap-1">
      <h3 class="font-heading text-base font-bold">Scheduled reports</h3>
      <p class="text-sm text-muted-foreground">Weekly snapshots. No more manual exports.</p>
    </div>
  </wc-brutalist-card-header>
  <wc-brutalist-card-content>
    <ul class="grid gap-2 py-1 text-sm">
      <li>Choose a schedule (daily, or weekly).</li>
      <li>Send to channels or specific teammates.</li>
      <li>Include charts, tables, and key metrics.</li>
    </ul>
  </wc-brutalist-card-content>
  <wc-brutalist-card-footer class="flex-col items-stretch gap-2">
    <wc-brutalist-button variant="solid" size="sm" class="w-full">Set up scheduled reports</wc-brutalist-button>
    <wc-brutalist-button variant="surface" size="sm" class="w-full">See what's new</wc-brutalist-button>
  </wc-brutalist-card-footer>
</wc-brutalist-card-root>
    `),
    'demo-brutalist-card-dividers': formatCode(`
<wc-brutalist-card-root class="w-full max-w-sm">
  <wc-brutalist-card-header divider>
    <div class="flex flex-col gap-1">
      <h3 class="font-heading text-base font-bold">Terms of Service</h3>
      <p class="text-sm text-muted-foreground">Review the terms before accepting the agreement.</p>
    </div>
  </wc-brutalist-card-header>
  <wc-brutalist-card-content>
    <div class="max-h-40 space-y-3 overflow-y-auto text-sm leading-relaxed">
      <p>These terms govern your use of the workspace, including access to shared documents and collaboration tools.</p>
      <p>By continuing, you agree to keep your account credentials secure.</p>
    </div>
  </wc-brutalist-card-content>
  <wc-brutalist-card-footer divider class="justify-end gap-2">
    <wc-brutalist-button variant="surface" size="sm">Decline</wc-brutalist-button>
    <wc-brutalist-button variant="solid" size="sm">Accept</wc-brutalist-button>
  </wc-brutalist-card-footer>
</wc-brutalist-card-root>
    `),
    'demo-brutalist-card-image': formatCode(`
<wc-brutalist-card-root class="w-full max-w-sm overflow-hidden pt-0">
  <img src="/images/base-image/landscape.svg" alt="Design systems meetup cover" class="aspect-video w-full border-b-2 border-black object-cover" />
  <wc-brutalist-card-header>
    <div class="flex flex-col gap-1">
      <h3 class="font-heading text-base font-bold">Design systems meetup</h3>
      <p class="text-sm text-muted-foreground">A practical talk on component APIs, accessibility, and shipping faster.</p>
    </div>
    <wc-brutalist-badge-root tone="accent">Featured</wc-brutalist-badge-root>
  </wc-brutalist-card-header>
  <wc-brutalist-card-footer>
    <wc-brutalist-button variant="solid" class="w-full">View Event</wc-brutalist-button>
  </wc-brutalist-card-footer>
</wc-brutalist-card-root>
    `),
  },
  react: {
    'demo-shadcn-card': formatCode(`
import {
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '@prototype-libs/shadcn';

export function CardDemo() {
  return (
    <ShadcnCardRoot styleProfile="rhea" className="w-full max-w-sm">
      <ShadcnCardHeader styleProfile="rhea">
        <h3 className="text-base font-medium">Deployment summary</h3>
        <p className="text-sm text-muted-foreground">
          Production release v2.4 is live across all regions.
        </p>
      </ShadcnCardHeader>
      <ShadcnCardContent styleProfile="rhea">
        <p className="text-sm">
          All 12 edge workers passed health checks with 99.98% uptime over the last 24 hours.
        </p>
      </ShadcnCardContent>
      <ShadcnCardFooter styleProfile="rhea">
        <a
          href="#card-contract"
          className="text-sm font-medium underline underline-offset-4 hover:opacity-80"
        >
          View usage guide
        </a>
      </ShadcnCardFooter>
    </ShadcnCardRoot>
  );
}
    `),
    'demo-shadcn-card-login': formatCode(`
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
  ShadcnInputRoot,
} from '@prototype-libs/shadcn';

export function CardLoginDemo() {
  return (
    <ShadcnCardRoot styleProfile="rhea" className="w-full max-w-sm">
      <ShadcnCardHeader styleProfile="rhea">
        <div className="flex items-start justify-between gap-2">
          <div className="grid gap-1">
            <h3 className="text-base font-medium">Login to your account</h3>
            <p className="text-sm text-muted-foreground">
              Enter your email below to login to your account
            </p>
          </div>
          <ShadcnButton styleProfile="rhea" variant="link" size="sm">
            Sign Up
          </ShadcnButton>
        </div>
      </ShadcnCardHeader>
      <ShadcnCardContent styleProfile="rhea">
        <div className="flex flex-col gap-5">
          <div className="grid gap-2">
            <label htmlFor="card-login-email" className="text-sm font-medium">
              Email
            </label>
            <ShadcnInputRoot
              styleProfile="rhea"
              placeholder="m@example.com"
              inputMode="email"
              required
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center">
              <label htmlFor="card-login-password" className="text-sm font-medium">
                Password
              </label>
              <a
                href="#card-contract"
                className="ms-auto text-sm underline-offset-4 hover:underline"
              >
                Forgot your password?
              </a>
            </div>
            <ShadcnInputRoot
              styleProfile="rhea"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>
        </div>
      </ShadcnCardContent>
      <ShadcnCardFooter styleProfile="rhea" className="flex-col gap-2">
        <ShadcnButton styleProfile="rhea" className="w-full">
          Login
        </ShadcnButton>
        <ShadcnButton styleProfile="rhea" variant="outline" className="w-full">
          Login with Google
        </ShadcnButton>
      </ShadcnCardFooter>
    </ShadcnCardRoot>
  );
}
    `),
    'demo-shadcn-card-small': formatCode(`
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '@prototype-libs/shadcn';

export function CardSmallDemo() {
  return (
    <ShadcnCardRoot styleProfile="rhea" size="sm" className="w-full max-w-xs">
      <ShadcnCardHeader styleProfile="rhea">
        <h3 className="text-base font-medium">Scheduled reports</h3>
        <p className="text-sm text-muted-foreground">
          Weekly snapshots. No more manual exports.
        </p>
      </ShadcnCardHeader>
      <ShadcnCardContent styleProfile="rhea">
        <ul className="grid gap-2 py-1 text-sm">
          <li>Choose a schedule (daily, or weekly).</li>
          <li>Send to channels or specific teammates.</li>
          <li>Include charts, tables, and key metrics.</li>
        </ul>
      </ShadcnCardContent>
      <ShadcnCardFooter styleProfile="rhea" className="flex-col gap-2">
        <ShadcnButton styleProfile="rhea" size="sm" className="w-full">
          Set up scheduled reports
        </ShadcnButton>
        <ShadcnButton styleProfile="rhea" variant="outline" size="sm" className="w-full">
          See what&apos;s new
        </ShadcnButton>
      </ShadcnCardFooter>
    </ShadcnCardRoot>
  );
}
    `),
    'demo-shadcn-card-dividers': formatCode(`
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '@prototype-libs/shadcn';

export function CardDividersDemo() {
  return (
    <ShadcnCardRoot styleProfile="rhea" className="w-full max-w-sm">
      <ShadcnCardHeader styleProfile="rhea" divider>
        <h3 className="text-base font-medium">Terms of Service</h3>
        <p className="text-sm text-muted-foreground">
          Review the terms before accepting the agreement.
        </p>
      </ShadcnCardHeader>
      <ShadcnCardContent styleProfile="rhea">
        <div className="max-h-40 space-y-3 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
          <p>
            These terms govern your use of the workspace, including access to shared documents and
            collaboration tools.
          </p>
          <p>By continuing, you agree to keep your account credentials secure.</p>
        </div>
      </ShadcnCardContent>
      <ShadcnCardFooter styleProfile="rhea" divider className="justify-end gap-2">
        <ShadcnButton styleProfile="rhea" variant="outline" size="sm">
          Decline
        </ShadcnButton>
        <ShadcnButton styleProfile="rhea" size="sm">
          Accept
        </ShadcnButton>
      </ShadcnCardFooter>
    </ShadcnCardRoot>
  );
}
    `),
    'demo-shadcn-card-image': formatCode(`
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardFooter,
} from '@prototype-libs/shadcn';

export function CardImageDemo() {
  return (
    <ShadcnCardRoot styleProfile="rhea" className="w-full max-w-sm pt-0">
      <img
        src="/images/base-image/landscape.svg"
        alt="Design systems meetup cover"
        className="aspect-video w-full object-cover"
      />
      <ShadcnCardHeader styleProfile="rhea">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-medium">Design systems meetup</h3>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
            Featured
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          A practical talk on component APIs, accessibility, and shipping faster.
        </p>
      </ShadcnCardHeader>
      <ShadcnCardFooter styleProfile="rhea">
        <ShadcnButton styleProfile="rhea" className="w-full">
          View Event
        </ShadcnButton>
      </ShadcnCardFooter>
    </ShadcnCardRoot>
  );
}
    `),
    'demo-shadcn-card-density': formatCode(`
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '@prototype-libs/shadcn';

export function CardDensityDemo() {
  return (
    <div className="grid w-full max-w-2xl items-start gap-5 md:grid-cols-2">
      <ShadcnCardRoot styleProfile="rhea" size="default">
        <ShadcnCardHeader styleProfile="rhea" divider>
          <h3 className="text-base font-medium">Default density</h3>
          <p className="text-sm text-muted-foreground">
            size=&quot;default&quot; · 20px section inset &amp; gap
          </p>
        </ShadcnCardHeader>
        <ShadcnCardContent styleProfile="rhea">
          <p className="text-sm">
            Balanced rhythm for primary feature cards, forms, and editorial summaries.
          </p>
        </ShadcnCardContent>
        <ShadcnCardFooter styleProfile="rhea" divider>
          <ShadcnButton styleProfile="rhea" variant="outline" size="sm">
            Open details
          </ShadcnButton>
        </ShadcnCardFooter>
      </ShadcnCardRoot>

      <ShadcnCardRoot styleProfile="rhea" size="sm">
        <ShadcnCardHeader styleProfile="rhea" divider>
          <h3 className="text-base font-medium">Compact density</h3>
          <p className="text-sm text-muted-foreground">
            size=&quot;sm&quot; · 16px section inset &amp; gap
          </p>
        </ShadcnCardHeader>
        <ShadcnCardContent styleProfile="rhea">
          <p className="text-sm">
            Tighter spacing for sidebar widgets, checklists, and high-density dashboards.
          </p>
        </ShadcnCardContent>
        <ShadcnCardFooter styleProfile="rhea" divider>
          <ShadcnButton styleProfile="rhea" variant="outline" size="sm">
            Open details
          </ShadcnButton>
        </ShadcnCardFooter>
      </ShadcnCardRoot>
    </div>
  );
}
    `),
    'demo-shadcn-card-rtl': formatCode(`
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
  ShadcnInputRoot,
} from '@prototype-libs/shadcn';

export function CardRtlDemo() {
  return (
    <div dir="rtl" className="w-full max-w-sm">
      <ShadcnCardRoot styleProfile="rhea" className="w-full">
        <ShadcnCardHeader styleProfile="rhea">
          <div className="flex items-start justify-between gap-2">
            <div className="grid gap-1">
              <h3 className="text-base font-medium">تسجيل الدخول إلى حسابك</h3>
              <p className="text-sm text-muted-foreground">
                أدخل بريدك الإلكتروني أدناه لتسجيل الدخول إلى حسابك
              </p>
            </div>
            <ShadcnButton styleProfile="rhea" variant="link" size="sm">
              إنشاء حساب
            </ShadcnButton>
          </div>
        </ShadcnCardHeader>
        <ShadcnCardContent styleProfile="rhea">
          <div className="grid gap-2">
            <label htmlFor="rtl-email" className="text-sm font-medium">
              البريد الإلكتروني
            </label>
            <ShadcnInputRoot styleProfile="rhea" placeholder="m@example.com" inputMode="email" />
          </div>
        </ShadcnCardContent>
        <ShadcnCardFooter styleProfile="rhea" className="flex-col gap-2">
          <ShadcnButton styleProfile="rhea" className="w-full">
            تسجيل الدخول
          </ShadcnButton>
          <ShadcnButton styleProfile="rhea" variant="outline" className="w-full">
            تسجيل الدخول باستخدام Google
          </ShadcnButton>
        </ShadcnCardFooter>
      </ShadcnCardRoot>
    </div>
  );
}
    `),
    'demo-brutalist-card': formatCode(`
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
} from '../proto-ui/components/react';

export function BrutalistCardDemo() {
  return (
    <BrutalistCardRoot className="w-full max-w-sm">
      <BrutalistCardHeader>
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-base font-bold">Weekly deployment</h3>
          <p className="text-sm text-muted-foreground">
            Release v2.4 is ready to publish to production.
          </p>
        </div>
      </BrutalistCardHeader>
      <BrutalistCardContent>
        <p className="text-sm">
          12 automated checks passed across all edge regions with zero regressions.
        </p>
      </BrutalistCardContent>
      <BrutalistCardFooter className="flex-wrap">
        <span className="text-xs text-muted-foreground">Updated 2m ago</span>
        <BrutalistButton size="sm">Publish release</BrutalistButton>
      </BrutalistCardFooter>
    </BrutalistCardRoot>
  );
}
    `),
    'demo-brutalist-card-login': formatCode(`
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
  BrutalistInputRoot,
} from '../proto-ui/components/react';

export function BrutalistCardLoginDemo() {
  return (
    <BrutalistCardRoot className="w-full max-w-sm">
      <BrutalistCardHeader>
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-base font-bold">Login to your account</h3>
          <p className="text-sm text-muted-foreground">
            Enter your email below to login to your account
          </p>
        </div>
      </BrutalistCardHeader>
      <BrutalistCardContent>
        <div className="flex flex-col gap-5">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Email</label>
            <BrutalistInputRoot placeholder="m@example.com" inputMode="email" required />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center">
              <label className="text-sm font-medium">Password</label>
              <a href="#usage" className="ms-auto text-sm underline-offset-4 hover:underline">
                Forgot your password?
              </a>
            </div>
            <BrutalistInputRoot placeholder="Enter your password" required />
          </div>
        </div>
      </BrutalistCardContent>
      <BrutalistCardFooter className="flex-col items-stretch gap-2">
        <BrutalistButton variant="solid" className="w-full">
          Login
        </BrutalistButton>
        <BrutalistButton variant="surface" className="w-full">
          Login with Google
        </BrutalistButton>
      </BrutalistCardFooter>
    </BrutalistCardRoot>
  );
}
    `),
    'demo-brutalist-card-small': formatCode(`
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
} from '../proto-ui/components/react';

export function BrutalistCardSmallDemo() {
  return (
    <BrutalistCardRoot size="sm" className="w-full max-w-xs">
      <BrutalistCardHeader>
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-base font-bold">Scheduled reports</h3>
          <p className="text-sm text-muted-foreground">
            Weekly snapshots. No more manual exports.
          </p>
        </div>
      </BrutalistCardHeader>
      <BrutalistCardContent>
        <ul className="grid gap-2 py-1 text-sm">
          <li>Choose a schedule (daily, or weekly).</li>
          <li>Send to channels or specific teammates.</li>
          <li>Include charts, tables, and key metrics.</li>
        </ul>
      </BrutalistCardContent>
      <BrutalistCardFooter className="flex-col items-stretch gap-2">
        <BrutalistButton variant="solid" size="sm" className="w-full">
          Set up scheduled reports
        </BrutalistButton>
        <BrutalistButton variant="surface" size="sm" className="w-full">
          See what&apos;s new
        </BrutalistButton>
      </BrutalistCardFooter>
    </BrutalistCardRoot>
  );
}
    `),
    'demo-brutalist-card-dividers': formatCode(`
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
} from '../proto-ui/components/react';

export function BrutalistCardDividersDemo() {
  return (
    <BrutalistCardRoot className="w-full max-w-sm">
      <BrutalistCardHeader divider>
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-base font-bold">Terms of Service</h3>
          <p className="text-sm text-muted-foreground">
            Review the terms before accepting the agreement.
          </p>
        </div>
      </BrutalistCardHeader>
      <BrutalistCardContent>
        <div className="max-h-40 space-y-3 overflow-y-auto text-sm leading-relaxed">
          <p>
            These terms govern your use of the workspace, including access to shared documents and
            collaboration tools.
          </p>
          <p>By continuing, you agree to keep your account credentials secure.</p>
        </div>
      </BrutalistCardContent>
      <BrutalistCardFooter divider className="justify-end gap-2">
        <BrutalistButton variant="surface" size="sm">
          Decline
        </BrutalistButton>
        <BrutalistButton variant="solid" size="sm">
          Accept
        </BrutalistButton>
      </BrutalistCardFooter>
    </BrutalistCardRoot>
  );
}
    `),
    'demo-brutalist-card-image': formatCode(`
import {
  BrutalistBadgeRoot,
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardFooter,
} from '../proto-ui/components/react';

export function BrutalistCardImageDemo() {
  return (
    <BrutalistCardRoot className="w-full max-w-sm overflow-hidden pt-0">
      <img
        src="/images/base-image/landscape.svg"
        alt="Design systems meetup cover"
        className="aspect-video w-full border-b-2 border-black object-cover"
      />
      <BrutalistCardHeader>
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-base font-bold">Design systems meetup</h3>
          <p className="text-sm text-muted-foreground">
            A practical talk on component APIs, accessibility, and shipping faster.
          </p>
        </div>
        <BrutalistBadgeRoot tone="accent">Featured</BrutalistBadgeRoot>
      </BrutalistCardHeader>
      <BrutalistCardFooter>
        <BrutalistButton variant="solid" className="w-full">
          View Event
        </BrutalistButton>
      </BrutalistCardFooter>
    </BrutalistCardRoot>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-card': formatCode(`
<script setup lang="ts">
import {
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '@prototype-libs/shadcn';
</script>

<template>
  <ShadcnCardRoot styleProfile="rhea" class="w-full max-w-sm">
    <ShadcnCardHeader styleProfile="rhea">
      <h3 class="text-base font-medium">Deployment summary</h3>
      <p class="text-sm text-muted-foreground">
        Production release v2.4 is live across all regions.
      </p>
    </ShadcnCardHeader>
    <ShadcnCardContent styleProfile="rhea">
      <p class="text-sm">
        All 12 edge workers passed health checks with 99.98% uptime over the last 24 hours.
      </p>
    </ShadcnCardContent>
    <ShadcnCardFooter styleProfile="rhea">
      <a href="#card-contract" class="text-sm font-medium underline underline-offset-4 hover:opacity-80">
        View usage guide
      </a>
    </ShadcnCardFooter>
  </ShadcnCardRoot>
</template>
    `),
    'demo-shadcn-card-login': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
  ShadcnInputRoot,
} from '@prototype-libs/shadcn';
</script>

<template>
  <ShadcnCardRoot styleProfile="rhea" class="w-full max-w-sm">
    <ShadcnCardHeader styleProfile="rhea">
      <div class="flex items-start justify-between gap-2">
        <div class="grid gap-1">
          <h3 class="text-base font-medium">Login to your account</h3>
          <p class="text-sm text-muted-foreground">
            Enter your email below to login to your account
          </p>
        </div>
        <ShadcnButton styleProfile="rhea" variant="link" size="sm">Sign Up</ShadcnButton>
      </div>
    </ShadcnCardHeader>
    <ShadcnCardContent styleProfile="rhea">
      <div class="flex flex-col gap-5">
        <div class="grid gap-2">
          <label class="text-sm font-medium">Email</label>
          <ShadcnInputRoot styleProfile="rhea" placeholder="m@example.com" inputMode="email" required />
        </div>
        <div class="grid gap-2">
          <div class="flex items-center">
            <label class="text-sm font-medium">Password</label>
            <a href="#card-contract" class="ms-auto text-sm underline-offset-4 hover:underline">
              Forgot your password?
            </a>
          </div>
          <ShadcnInputRoot styleProfile="rhea" placeholder="Enter your password" required />
        </div>
      </div>
    </ShadcnCardContent>
    <ShadcnCardFooter styleProfile="rhea" class="flex-col gap-2">
      <ShadcnButton styleProfile="rhea" class="w-full">Login</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="outline" class="w-full">Login with Google</ShadcnButton>
    </ShadcnCardFooter>
  </ShadcnCardRoot>
</template>
    `),
    'demo-shadcn-card-small': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '@prototype-libs/shadcn';
</script>

<template>
  <ShadcnCardRoot styleProfile="rhea" size="sm" class="w-full max-w-xs">
    <ShadcnCardHeader styleProfile="rhea">
      <h3 class="text-base font-medium">Scheduled reports</h3>
      <p class="text-sm text-muted-foreground">Weekly snapshots. No more manual exports.</p>
    </ShadcnCardHeader>
    <ShadcnCardContent styleProfile="rhea">
      <ul class="grid gap-2 py-1 text-sm">
        <li>Choose a schedule (daily, or weekly).</li>
        <li>Send to channels or specific teammates.</li>
        <li>Include charts, tables, and key metrics.</li>
      </ul>
    </ShadcnCardContent>
    <ShadcnCardFooter styleProfile="rhea" class="flex-col gap-2">
      <ShadcnButton styleProfile="rhea" size="sm" class="w-full">Set up scheduled reports</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="outline" size="sm" class="w-full">See what's new</ShadcnButton>
    </ShadcnCardFooter>
  </ShadcnCardRoot>
</template>
    `),
    'demo-shadcn-card-dividers': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '@prototype-libs/shadcn';
</script>

<template>
  <ShadcnCardRoot styleProfile="rhea" class="w-full max-w-sm">
    <ShadcnCardHeader styleProfile="rhea" :divider="true">
      <h3 class="text-base font-medium">Terms of Service</h3>
      <p class="text-sm text-muted-foreground">Review the terms before accepting the agreement.</p>
    </ShadcnCardHeader>
    <ShadcnCardContent styleProfile="rhea">
      <div class="max-h-40 space-y-3 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
        <p>These terms govern your use of the workspace, including access to shared documents and collaboration tools.</p>
        <p>By continuing, you agree to keep your account credentials secure.</p>
      </div>
    </ShadcnCardContent>
    <ShadcnCardFooter styleProfile="rhea" :divider="true" class="justify-end gap-2">
      <ShadcnButton styleProfile="rhea" variant="outline" size="sm">Decline</ShadcnButton>
      <ShadcnButton styleProfile="rhea" size="sm">Accept</ShadcnButton>
    </ShadcnCardFooter>
  </ShadcnCardRoot>
</template>
    `),
    'demo-shadcn-card-image': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardFooter,
} from '@prototype-libs/shadcn';
</script>

<template>
  <ShadcnCardRoot styleProfile="rhea" class="w-full max-w-sm pt-0">
    <img src="/images/base-image/landscape.svg" alt="Design systems meetup cover" class="aspect-video w-full object-cover" />
    <ShadcnCardHeader styleProfile="rhea">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-base font-medium">Design systems meetup</h3>
        <span class="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">Featured</span>
      </div>
      <p class="text-sm text-muted-foreground">
        A practical talk on component APIs, accessibility, and shipping faster.
      </p>
    </ShadcnCardHeader>
    <ShadcnCardFooter styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" class="w-full">View Event</ShadcnButton>
    </ShadcnCardFooter>
  </ShadcnCardRoot>
</template>
    `),
    'demo-shadcn-card-density': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '@prototype-libs/shadcn';
</script>

<template>
  <div class="grid w-full max-w-2xl items-start gap-5 md:grid-cols-2">
    <ShadcnCardRoot styleProfile="rhea" size="default">
      <ShadcnCardHeader styleProfile="rhea" :divider="true">
        <h3 class="text-base font-medium">Default density</h3>
        <p class="text-sm text-muted-foreground">size="default" · 20px section inset &amp; gap</p>
      </ShadcnCardHeader>
      <ShadcnCardContent styleProfile="rhea">
        <p class="text-sm">Balanced rhythm for primary feature cards, forms, and editorial summaries.</p>
      </ShadcnCardContent>
      <ShadcnCardFooter styleProfile="rhea" :divider="true">
        <ShadcnButton styleProfile="rhea" variant="outline" size="sm">Open details</ShadcnButton>
      </ShadcnCardFooter>
    </ShadcnCardRoot>

    <ShadcnCardRoot styleProfile="rhea" size="sm">
      <ShadcnCardHeader styleProfile="rhea" :divider="true">
        <h3 class="text-base font-medium">Compact density</h3>
        <p class="text-sm text-muted-foreground">size="sm" · 16px section inset &amp; gap</p>
      </ShadcnCardHeader>
      <ShadcnCardContent styleProfile="rhea">
        <p class="text-sm">Tighter spacing for sidebar widgets, checklists, and high-density dashboards.</p>
      </ShadcnCardContent>
      <ShadcnCardFooter styleProfile="rhea" :divider="true">
        <ShadcnButton styleProfile="rhea" variant="outline" size="sm">Open details</ShadcnButton>
      </ShadcnCardFooter>
    </ShadcnCardRoot>
  </div>
</template>
    `),
    'demo-shadcn-card-rtl': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
  ShadcnInputRoot,
} from '@prototype-libs/shadcn';
</script>

<template>
  <div dir="rtl" class="w-full max-w-sm">
    <ShadcnCardRoot styleProfile="rhea" class="w-full">
      <ShadcnCardHeader styleProfile="rhea">
        <div class="flex items-start justify-between gap-2">
          <div class="grid gap-1">
            <h3 class="text-base font-medium">تسجيل الدخول إلى حسابك</h3>
            <p class="text-sm text-muted-foreground">أدخل بريدك الإلكتروني أدناه لتسجيل الدخول إلى حسابك</p>
          </div>
          <ShadcnButton styleProfile="rhea" variant="link" size="sm">إنشاء حساب</ShadcnButton>
        </div>
      </ShadcnCardHeader>
      <ShadcnCardContent styleProfile="rhea">
        <div class="grid gap-2">
          <label class="text-sm font-medium">البريد الإلكتروني</label>
          <ShadcnInputRoot styleProfile="rhea" placeholder="m@example.com" inputMode="email" />
        </div>
      </ShadcnCardContent>
      <ShadcnCardFooter styleProfile="rhea" class="flex-col gap-2">
        <ShadcnButton styleProfile="rhea" class="w-full">تسجيل الدخول</ShadcnButton>
        <ShadcnButton styleProfile="rhea" variant="outline" class="w-full">تسجيل الدخول باستخدام Google</ShadcnButton>
      </ShadcnCardFooter>
    </ShadcnCardRoot>
  </div>
</template>
    `),
    'demo-brutalist-card': formatCode(`
<script setup lang="ts">
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistCardRoot class="w-full max-w-sm">
    <BrutalistCardHeader>
      <div class="flex flex-col gap-1">
        <h3 class="font-heading text-base font-bold">Weekly deployment</h3>
        <p class="text-sm text-muted-foreground">Release v2.4 is ready to publish to production.</p>
      </div>
    </BrutalistCardHeader>
    <BrutalistCardContent>
      <p class="text-sm">12 automated checks passed across all edge regions with zero regressions.</p>
    </BrutalistCardContent>
    <BrutalistCardFooter class="flex-wrap">
      <span class="text-xs text-muted-foreground">Updated 2m ago</span>
      <BrutalistButton size="sm">Publish release</BrutalistButton>
    </BrutalistCardFooter>
  </BrutalistCardRoot>
</template>
    `),
    'demo-brutalist-card-login': formatCode(`
<script setup lang="ts">
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
  BrutalistInputRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistCardRoot class="w-full max-w-sm">
    <BrutalistCardHeader>
      <div class="flex flex-col gap-1">
        <h3 class="font-heading text-base font-bold">Login to your account</h3>
        <p class="text-sm text-muted-foreground">Enter your email below to login to your account</p>
      </div>
    </BrutalistCardHeader>
    <BrutalistCardContent>
      <div class="flex flex-col gap-5">
        <div class="grid gap-2">
          <label class="text-sm font-medium">Email</label>
          <BrutalistInputRoot placeholder="m@example.com" inputMode="email" required />
        </div>
        <div class="grid gap-2">
          <div class="flex items-center">
            <label class="text-sm font-medium">Password</label>
            <a href="#usage" class="ms-auto text-sm underline-offset-4 hover:underline">Forgot your password?</a>
          </div>
          <BrutalistInputRoot placeholder="Enter your password" required />
        </div>
      </div>
    </BrutalistCardContent>
    <BrutalistCardFooter class="flex-col items-stretch gap-2">
      <BrutalistButton variant="solid" class="w-full">Login</BrutalistButton>
      <BrutalistButton variant="surface" class="w-full">Login with Google</BrutalistButton>
    </BrutalistCardFooter>
  </BrutalistCardRoot>
</template>
    `),
    'demo-brutalist-card-small': formatCode(`
<script setup lang="ts">
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistCardRoot size="sm" class="w-full max-w-xs">
    <BrutalistCardHeader>
      <div class="flex flex-col gap-1">
        <h3 class="font-heading text-base font-bold">Scheduled reports</h3>
        <p class="text-sm text-muted-foreground">Weekly snapshots. No more manual exports.</p>
      </div>
    </BrutalistCardHeader>
    <BrutalistCardContent>
      <ul class="grid gap-2 py-1 text-sm">
        <li>Choose a schedule (daily, or weekly).</li>
        <li>Send to channels or specific teammates.</li>
        <li>Include charts, tables, and key metrics.</li>
      </ul>
    </BrutalistCardContent>
    <BrutalistCardFooter class="flex-col items-stretch gap-2">
      <BrutalistButton variant="solid" size="sm" class="w-full">Set up scheduled reports</BrutalistButton>
      <BrutalistButton variant="surface" size="sm" class="w-full">See what's new</BrutalistButton>
    </BrutalistCardFooter>
  </BrutalistCardRoot>
</template>
    `),
    'demo-brutalist-card-dividers': formatCode(`
<script setup lang="ts">
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistCardRoot class="w-full max-w-sm">
    <BrutalistCardHeader :divider="true">
      <div class="flex flex-col gap-1">
        <h3 class="font-heading text-base font-bold">Terms of Service</h3>
        <p class="text-sm text-muted-foreground">Review the terms before accepting the agreement.</p>
      </div>
    </BrutalistCardHeader>
    <BrutalistCardContent>
      <div class="max-h-40 space-y-3 overflow-y-auto text-sm leading-relaxed">
        <p>These terms govern your use of the workspace, including access to shared documents and collaboration tools.</p>
        <p>By continuing, you agree to keep your account credentials secure.</p>
      </div>
    </BrutalistCardContent>
    <BrutalistCardFooter :divider="true" class="justify-end gap-2">
      <BrutalistButton variant="surface" size="sm">Decline</BrutalistButton>
      <BrutalistButton variant="solid" size="sm">Accept</BrutalistButton>
    </BrutalistCardFooter>
  </BrutalistCardRoot>
</template>
    `),
    'demo-brutalist-card-image': formatCode(`
<script setup lang="ts">
import {
  BrutalistBadgeRoot,
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardFooter,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistCardRoot class="w-full max-w-sm overflow-hidden pt-0">
    <img src="/images/base-image/landscape.svg" alt="Design systems meetup cover" class="aspect-video w-full border-b-2 border-black object-cover" />
    <BrutalistCardHeader>
      <div class="flex flex-col gap-1">
        <h3 class="font-heading text-base font-bold">Design systems meetup</h3>
        <p class="text-sm text-muted-foreground">A practical talk on component APIs, accessibility, and shipping faster.</p>
      </div>
      <BrutalistBadgeRoot tone="accent">Featured</BrutalistBadgeRoot>
    </BrutalistCardHeader>
    <BrutalistCardFooter>
      <BrutalistButton variant="solid" class="w-full">View Event</BrutalistButton>
    </BrutalistCardFooter>
  </BrutalistCardRoot>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-card': formatCode(`
<template>
  <ShadcnCardRoot styleProfile="rhea" class="w-full max-w-sm">
    <ShadcnCardHeader styleProfile="rhea">
      <h3 class="text-base font-medium">Deployment summary</h3>
      <p class="text-sm text-muted-foreground">
        Production release v2.4 is live across all regions.
      </p>
    </ShadcnCardHeader>
    <ShadcnCardContent styleProfile="rhea">
      <p class="text-sm">
        All 12 edge workers passed health checks with 99.98% uptime over the last 24 hours.
      </p>
    </ShadcnCardContent>
    <ShadcnCardFooter styleProfile="rhea">
      <a href="#card-contract" class="text-sm font-medium underline underline-offset-4 hover:opacity-80">
        View usage guide
      </a>
    </ShadcnCardFooter>
  </ShadcnCardRoot>
</template>

<script>
import {
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCardRoot,
    ShadcnCardHeader,
    ShadcnCardContent,
    ShadcnCardFooter,
  },
};
</script>
    `),
    'demo-shadcn-card-login': formatCode(`
<template>
  <ShadcnCardRoot styleProfile="rhea" class="w-full max-w-sm">
    <ShadcnCardHeader styleProfile="rhea">
      <div class="flex items-start justify-between gap-2">
        <div class="grid gap-1">
          <h3 class="text-base font-medium">Login to your account</h3>
          <p class="text-sm text-muted-foreground">
            Enter your email below to login to your account
          </p>
        </div>
        <ShadcnButton styleProfile="rhea" variant="link" size="sm">Sign Up</ShadcnButton>
      </div>
    </ShadcnCardHeader>
    <ShadcnCardContent styleProfile="rhea">
      <div class="flex flex-col gap-5">
        <div class="grid gap-2">
          <label class="text-sm font-medium">Email</label>
          <ShadcnInputRoot styleProfile="rhea" placeholder="m@example.com" input-mode="email" required />
        </div>
        <div class="grid gap-2">
          <label class="text-sm font-medium">Password</label>
          <ShadcnInputRoot styleProfile="rhea" placeholder="Enter your password" required />
        </div>
      </div>
    </ShadcnCardContent>
    <ShadcnCardFooter styleProfile="rhea" class="flex-col gap-2">
      <ShadcnButton styleProfile="rhea" class="w-full">Login</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="outline" class="w-full">Login with Google</ShadcnButton>
    </ShadcnCardFooter>
  </ShadcnCardRoot>
</template>

<script>
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
  ShadcnInputRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnCardRoot,
    ShadcnCardHeader,
    ShadcnCardContent,
    ShadcnCardFooter,
    ShadcnInputRoot,
  },
};
</script>
    `),
    'demo-shadcn-card-small': formatCode(`
<template>
  <ShadcnCardRoot styleProfile="rhea" size="sm" class="w-full max-w-xs">
    <ShadcnCardHeader styleProfile="rhea">
      <h3 class="text-base font-medium">Scheduled reports</h3>
      <p class="text-sm text-muted-foreground">Weekly snapshots. No more manual exports.</p>
    </ShadcnCardHeader>
    <ShadcnCardContent styleProfile="rhea">
      <ul class="grid gap-2 py-1 text-sm">
        <li>Choose a schedule (daily, or weekly).</li>
        <li>Send to channels or specific teammates.</li>
        <li>Include charts, tables, and key metrics.</li>
      </ul>
    </ShadcnCardContent>
    <ShadcnCardFooter styleProfile="rhea" class="flex-col gap-2">
      <ShadcnButton styleProfile="rhea" size="sm" class="w-full">Set up scheduled reports</ShadcnButton>
      <ShadcnButton styleProfile="rhea" variant="outline" size="sm" class="w-full">See what's new</ShadcnButton>
    </ShadcnCardFooter>
  </ShadcnCardRoot>
</template>

<script>
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnCardRoot,
    ShadcnCardHeader,
    ShadcnCardContent,
    ShadcnCardFooter,
  },
};
</script>
    `),
    'demo-shadcn-card-dividers': formatCode(`
<template>
  <ShadcnCardRoot styleProfile="rhea" class="w-full max-w-sm">
    <ShadcnCardHeader styleProfile="rhea" :divider="true">
      <h3 class="text-base font-medium">Terms of Service</h3>
      <p class="text-sm text-muted-foreground">Review the terms before accepting the agreement.</p>
    </ShadcnCardHeader>
    <ShadcnCardContent styleProfile="rhea">
      <div class="max-h-40 space-y-3 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
        <p>These terms govern your use of the workspace, including access to shared documents and collaboration tools.</p>
        <p>By continuing, you agree to keep your account credentials secure.</p>
      </div>
    </ShadcnCardContent>
    <ShadcnCardFooter styleProfile="rhea" :divider="true" class="justify-end gap-2">
      <ShadcnButton styleProfile="rhea" variant="outline" size="sm">Decline</ShadcnButton>
      <ShadcnButton styleProfile="rhea" size="sm">Accept</ShadcnButton>
    </ShadcnCardFooter>
  </ShadcnCardRoot>
</template>

<script>
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnCardRoot,
    ShadcnCardHeader,
    ShadcnCardContent,
    ShadcnCardFooter,
  },
};
</script>
    `),
    'demo-shadcn-card-image': formatCode(`
<template>
  <ShadcnCardRoot styleProfile="rhea" class="w-full max-w-sm pt-0">
    <img src="/images/base-image/landscape.svg" alt="Design systems meetup cover" class="aspect-video w-full object-cover" />
    <ShadcnCardHeader styleProfile="rhea">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-base font-medium">Design systems meetup</h3>
        <span class="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">Featured</span>
      </div>
      <p class="text-sm text-muted-foreground">
        A practical talk on component APIs, accessibility, and shipping faster.
      </p>
    </ShadcnCardHeader>
    <ShadcnCardFooter styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" class="w-full">View Event</ShadcnButton>
    </ShadcnCardFooter>
  </ShadcnCardRoot>
</template>

<script>
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardFooter,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnCardRoot,
    ShadcnCardHeader,
    ShadcnCardFooter,
  },
};
</script>
    `),
    'demo-shadcn-card-density': formatCode(`
<template>
  <div class="grid w-full max-w-2xl items-start gap-5 md:grid-cols-2">
    <ShadcnCardRoot styleProfile="rhea" size="default">
      <ShadcnCardHeader styleProfile="rhea" :divider="true">
        <h3 class="text-base font-medium">Default density</h3>
        <p class="text-sm text-muted-foreground">size="default" · 20px section inset &amp; gap</p>
      </ShadcnCardHeader>
      <ShadcnCardContent styleProfile="rhea">
        <p class="text-sm">Balanced rhythm for primary feature cards, forms, and editorial summaries.</p>
      </ShadcnCardContent>
      <ShadcnCardFooter styleProfile="rhea" :divider="true">
        <ShadcnButton styleProfile="rhea" variant="outline" size="sm">Open details</ShadcnButton>
      </ShadcnCardFooter>
    </ShadcnCardRoot>

    <ShadcnCardRoot styleProfile="rhea" size="sm">
      <ShadcnCardHeader styleProfile="rhea" :divider="true">
        <h3 class="text-base font-medium">Compact density</h3>
        <p class="text-sm text-muted-foreground">size="sm" · 16px section inset &amp; gap</p>
      </ShadcnCardHeader>
      <ShadcnCardContent styleProfile="rhea">
        <p class="text-sm">Tighter spacing for sidebar widgets, checklists, and high-density dashboards.</p>
      </ShadcnCardContent>
      <ShadcnCardFooter styleProfile="rhea" :divider="true">
        <ShadcnButton styleProfile="rhea" variant="outline" size="sm">Open details</ShadcnButton>
      </ShadcnCardFooter>
    </ShadcnCardRoot>
  </div>
</template>

<script>
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnCardRoot,
    ShadcnCardHeader,
    ShadcnCardContent,
    ShadcnCardFooter,
  },
};
</script>
    `),
    'demo-shadcn-card-rtl': formatCode(`
<template>
  <div dir="rtl" class="w-full max-w-sm">
    <ShadcnCardRoot styleProfile="rhea" class="w-full">
      <ShadcnCardHeader styleProfile="rhea">
        <div class="flex items-start justify-between gap-2">
          <div class="grid gap-1">
            <h3 class="text-base font-medium">تسجيل الدخول إلى حسابك</h3>
            <p class="text-sm text-muted-foreground">أدخل بريدك الإلكتروني أدناه لتسجيل الدخول إلى حسابك</p>
          </div>
          <ShadcnButton styleProfile="rhea" variant="link" size="sm">إنشاء حساب</ShadcnButton>
        </div>
      </ShadcnCardHeader>
      <ShadcnCardContent styleProfile="rhea">
        <div class="grid gap-2">
          <label class="text-sm font-medium">البريد الإلكتروني</label>
          <ShadcnInputRoot styleProfile="rhea" placeholder="m@example.com" input-mode="email" />
        </div>
      </ShadcnCardContent>
      <ShadcnCardFooter styleProfile="rhea" class="flex-col gap-2">
        <ShadcnButton styleProfile="rhea" class="w-full">تسجيل الدخول</ShadcnButton>
        <ShadcnButton styleProfile="rhea" variant="outline" class="w-full">تسجيل الدخول باستخدام Google</ShadcnButton>
      </ShadcnCardFooter>
    </ShadcnCardRoot>
  </div>
</template>

<script>
import {
  ShadcnButton,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
  ShadcnInputRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnCardRoot,
    ShadcnCardHeader,
    ShadcnCardContent,
    ShadcnCardFooter,
    ShadcnInputRoot,
  },
};
</script>
    `),
    'demo-brutalist-card': formatCode(`
<template>
  <BrutalistCardRoot class="w-full max-w-sm">
    <BrutalistCardHeader>
      <div class="flex flex-col gap-1">
        <h3 class="font-heading text-base font-bold">Weekly deployment</h3>
        <p class="text-sm text-muted-foreground">Release v2.4 is ready to publish to production.</p>
      </div>
    </BrutalistCardHeader>
    <BrutalistCardContent>
      <p class="text-sm">12 automated checks passed across all edge regions with zero regressions.</p>
    </BrutalistCardContent>
    <BrutalistCardFooter class="flex-wrap">
      <span class="text-xs text-muted-foreground">Updated 2m ago</span>
      <BrutalistButton size="sm">Publish release</BrutalistButton>
    </BrutalistCardFooter>
  </BrutalistCardRoot>
</template>

<script>
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistButton,
    BrutalistCardRoot,
    BrutalistCardHeader,
    BrutalistCardContent,
    BrutalistCardFooter,
  },
};
</script>
    `),
    'demo-brutalist-card-login': formatCode(`
<template>
  <BrutalistCardRoot class="w-full max-w-sm">
    <BrutalistCardHeader>
      <div class="flex flex-col gap-1">
        <h3 class="font-heading text-base font-bold">Login to your account</h3>
        <p class="text-sm text-muted-foreground">Enter your email below to login to your account</p>
      </div>
    </BrutalistCardHeader>
    <BrutalistCardContent>
      <div class="flex flex-col gap-5">
        <div class="grid gap-2">
          <label class="text-sm font-medium">Email</label>
          <BrutalistInputRoot placeholder="m@example.com" input-mode="email" required />
        </div>
        <div class="grid gap-2">
          <label class="text-sm font-medium">Password</label>
          <BrutalistInputRoot placeholder="Enter your password" required />
        </div>
      </div>
    </BrutalistCardContent>
    <BrutalistCardFooter class="flex-col items-stretch gap-2">
      <BrutalistButton variant="solid" class="w-full">Login</BrutalistButton>
      <BrutalistButton variant="surface" class="w-full">Login with Google</BrutalistButton>
    </BrutalistCardFooter>
  </BrutalistCardRoot>
</template>

<script>
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
  BrutalistInputRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistButton,
    BrutalistCardRoot,
    BrutalistCardHeader,
    BrutalistCardContent,
    BrutalistCardFooter,
    BrutalistInputRoot,
  },
};
</script>
    `),
    'demo-brutalist-card-small': formatCode(`
<template>
  <BrutalistCardRoot size="sm" class="w-full max-w-xs">
    <BrutalistCardHeader>
      <div class="flex flex-col gap-1">
        <h3 class="font-heading text-base font-bold">Scheduled reports</h3>
        <p class="text-sm text-muted-foreground">Weekly snapshots. No more manual exports.</p>
      </div>
    </BrutalistCardHeader>
    <BrutalistCardContent>
      <ul class="grid gap-2 py-1 text-sm">
        <li>Choose a schedule (daily, or weekly).</li>
        <li>Send to channels or specific teammates.</li>
        <li>Include charts, tables, and key metrics.</li>
      </ul>
    </BrutalistCardContent>
    <BrutalistCardFooter class="flex-col items-stretch gap-2">
      <BrutalistButton variant="solid" size="sm" class="w-full">Set up scheduled reports</BrutalistButton>
      <BrutalistButton variant="surface" size="sm" class="w-full">See what's new</BrutalistButton>
    </BrutalistCardFooter>
  </BrutalistCardRoot>
</template>

<script>
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistButton,
    BrutalistCardRoot,
    BrutalistCardHeader,
    BrutalistCardContent,
    BrutalistCardFooter,
  },
};
</script>
    `),
    'demo-brutalist-card-dividers': formatCode(`
<template>
  <BrutalistCardRoot class="w-full max-w-sm">
    <BrutalistCardHeader :divider="true">
      <div class="flex flex-col gap-1">
        <h3 class="font-heading text-base font-bold">Terms of Service</h3>
        <p class="text-sm text-muted-foreground">Review the terms before accepting the agreement.</p>
      </div>
    </BrutalistCardHeader>
    <BrutalistCardContent>
      <div class="max-h-40 space-y-3 overflow-y-auto text-sm leading-relaxed">
        <p>These terms govern your use of the workspace, including access to shared documents and collaboration tools.</p>
        <p>By continuing, you agree to keep your account credentials secure.</p>
      </div>
    </BrutalistCardContent>
    <BrutalistCardFooter :divider="true" class="justify-end gap-2">
      <BrutalistButton variant="surface" size="sm">Decline</BrutalistButton>
      <BrutalistButton variant="solid" size="sm">Accept</BrutalistButton>
    </BrutalistCardFooter>
  </BrutalistCardRoot>
</template>

<script>
import {
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardContent,
  BrutalistCardFooter,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistButton,
    BrutalistCardRoot,
    BrutalistCardHeader,
    BrutalistCardContent,
    BrutalistCardFooter,
  },
};
</script>
    `),
    'demo-brutalist-card-image': formatCode(`
<template>
  <BrutalistCardRoot class="w-full max-w-sm overflow-hidden pt-0">
    <img src="/images/base-image/landscape.svg" alt="Design systems meetup cover" class="aspect-video w-full border-b-2 border-black object-cover" />
    <BrutalistCardHeader>
      <div class="flex flex-col gap-1">
        <h3 class="font-heading text-base font-bold">Design systems meetup</h3>
        <p class="text-sm text-muted-foreground">A practical talk on component APIs, accessibility, and shipping faster.</p>
      </div>
      <BrutalistBadgeRoot tone="accent">Featured</BrutalistBadgeRoot>
    </BrutalistCardHeader>
    <BrutalistCardFooter>
      <BrutalistButton variant="solid" class="w-full">View Event</BrutalistButton>
    </BrutalistCardFooter>
  </BrutalistCardRoot>
</template>

<script>
import {
  BrutalistBadgeRoot,
  BrutalistButton,
  BrutalistCardRoot,
  BrutalistCardHeader,
  BrutalistCardFooter,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistBadgeRoot,
    BrutalistButton,
    BrutalistCardRoot,
    BrutalistCardHeader,
    BrutalistCardFooter,
  },
};
</script>
    `),
  },
};
