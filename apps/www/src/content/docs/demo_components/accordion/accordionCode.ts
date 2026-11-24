import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-accordion': formatCode(`
<wc-shadcn-accordion-root style-profile="rhea" default-open-items='["overview"]' class="max-w-2xl">
  <wc-shadcn-accordion-item style-profile="rhea" value="overview">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">What are your shipping options?</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      We offer standard (5–7 days), express (2–3 days), and overnight shipping.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
  <wc-shadcn-accordion-item style-profile="rhea" value="lifetime">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">What is your return policy?</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      Returns are accepted within 30 days for unused items in original packaging.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
  <wc-shadcn-accordion-item style-profile="rhea" value="disabled" disabled>
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">Enterprise SLA details (Unavailable)</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      Dedicated SLA terms are available on enterprise plans.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
</wc-shadcn-accordion-root>
    `),
    'demo-shadcn-accordion-basic': formatCode(`
<wc-shadcn-accordion-root style-profile="rhea" default-open-items='["item-1"]' class="max-w-lg">
  <wc-shadcn-accordion-item style-profile="rhea" value="item-1">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">How do I reset my password?</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      Click on 'Forgot Password' on the login page, enter your email address, and we'll send you a reset link.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
  <wc-shadcn-accordion-item style-profile="rhea" value="item-2">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">Can I change my subscription plan?</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      Yes, you can upgrade or downgrade your plan at any time from your account settings.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
  <wc-shadcn-accordion-item style-profile="rhea" value="item-3">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">What payment methods do you accept?</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      We accept all major credit cards, PayPal, and bank transfers.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
</wc-shadcn-accordion-root>
    `),
    'demo-shadcn-accordion-multiple': formatCode(`
<wc-shadcn-accordion-root style-profile="rhea" mode="multiple" default-open-items='["notifications"]' class="max-w-lg">
  <wc-shadcn-accordion-item style-profile="rhea" value="notifications">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">Notification Settings</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      Manage how you receive email alerts and mobile push notifications.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
  <wc-shadcn-accordion-item style-profile="rhea" value="privacy">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">Privacy &amp; Security</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      Enable two-factor authentication, manage connected devices, and review active sessions.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
  <wc-shadcn-accordion-item style-profile="rhea" value="billing">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">Billing &amp; Subscription</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      View your current plan, payment history, and upcoming invoices.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
</wc-shadcn-accordion-root>
    `),
    'demo-shadcn-accordion-disabled': formatCode(`
<wc-shadcn-accordion-root style-profile="rhea" class="max-w-lg">
  <wc-shadcn-accordion-item style-profile="rhea" value="item-1">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">Can I access my account history?</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      Yes, view all transactions, plan changes, and support tickets in your dashboard.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
  <wc-shadcn-accordion-item style-profile="rhea" value="item-2" disabled>
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">Premium feature information</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      Upgrade your plan to access this content.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
  <wc-shadcn-accordion-item style-profile="rhea" value="item-3">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">How do I update my email address?</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      Update your email in account settings and verify via the confirmation link.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
</wc-shadcn-accordion-root>
    `),
    'demo-shadcn-accordion-borders': formatCode(`
<wc-shadcn-accordion-root style-profile="rhea" default-open-items='["billing"]' class="max-w-lg rounded-lg border border-border">
  <wc-shadcn-accordion-item style-profile="rhea" value="billing">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">How does billing work?</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      We offer monthly and annual subscription plans with cancellation anytime.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
  <wc-shadcn-accordion-item style-profile="rhea" value="security">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">Is my data secure?</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      Yes. We use end-to-end encryption and SOC 2 Type II compliance.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
  <wc-shadcn-accordion-item style-profile="rhea" value="integration">
    <wc-shadcn-accordion-heading style-profile="rhea" level="3">
      <wc-shadcn-accordion-trigger style-profile="rhea">What integrations do you support?</wc-shadcn-accordion-trigger>
    </wc-shadcn-accordion-heading>
    <wc-shadcn-accordion-content style-profile="rhea">
      We integrate with 500+ popular tools plus webhooks and REST APIs.
    </wc-shadcn-accordion-content>
  </wc-shadcn-accordion-item>
</wc-shadcn-accordion-root>
    `),
    'demo-shadcn-accordion-card': formatCode(`
<wc-shadcn-card-root style-profile="rhea" class="w-full max-w-md">
  <wc-shadcn-card-header style-profile="rhea">
    <div class="text-base font-semibold">Subscription &amp; Billing</div>
    <div class="text-sm text-muted-foreground">Common questions about plans, payments, and cancellations.</div>
  </wc-shadcn-card-header>
  <wc-shadcn-card-content style-profile="rhea">
    <wc-shadcn-accordion-root style-profile="rhea" default-open-items='["plans"]'>
      <wc-shadcn-accordion-item style-profile="rhea" value="plans">
        <wc-shadcn-accordion-heading style-profile="rhea" level="3">
          <wc-shadcn-accordion-trigger style-profile="rhea">What subscription plans do you offer?</wc-shadcn-accordion-trigger>
        </wc-shadcn-accordion-heading>
        <wc-shadcn-accordion-content style-profile="rhea">
          Starter ($9/month), Professional ($29/month), and Enterprise ($99/month).
        </wc-shadcn-accordion-content>
      </wc-shadcn-accordion-item>
      <wc-shadcn-accordion-item style-profile="rhea" value="billing">
        <wc-shadcn-accordion-heading style-profile="rhea" level="3">
          <wc-shadcn-accordion-trigger style-profile="rhea">How does billing work?</wc-shadcn-accordion-trigger>
        </wc-shadcn-accordion-heading>
        <wc-shadcn-accordion-content style-profile="rhea">
          Billing occurs automatically at the start of each billing cycle.
        </wc-shadcn-accordion-content>
      </wc-shadcn-accordion-item>
    </wc-shadcn-accordion-root>
  </wc-shadcn-card-content>
</wc-shadcn-card-root>
    `),
    'demo-shadcn-accordion-rtl': formatCode(`
<div dir="rtl" class="max-w-md">
  <wc-shadcn-accordion-root style-profile="rhea" direction="rtl" default-open-items='["item-1"]'>
    <wc-shadcn-accordion-item style-profile="rhea" value="item-1">
      <wc-shadcn-accordion-heading style-profile="rhea" level="3">
        <wc-shadcn-accordion-trigger style-profile="rhea">كيف يمكنني إعادة تعيين كلمة المرور؟</wc-shadcn-accordion-trigger>
      </wc-shadcn-accordion-heading>
      <wc-shadcn-accordion-content style-profile="rhea">
        انقر على «نسيت كلمة المرور» في صفحة تسجيل الدخول وسنرسل لك رابطًا لإعادة التعيين.
      </wc-shadcn-accordion-content>
    </wc-shadcn-accordion-item>
    <wc-shadcn-accordion-item style-profile="rhea" value="item-2">
      <wc-shadcn-accordion-heading style-profile="rhea" level="3">
        <wc-shadcn-accordion-trigger style-profile="rhea">هل يمكنني تغيير خطة الاشتراك الخاصة بي؟</wc-shadcn-accordion-trigger>
      </wc-shadcn-accordion-heading>
      <wc-shadcn-accordion-content style-profile="rhea">
        نعم، يمكنك ترقية أو تخفيض خطتك في أي وقت من إعدادات حسابك.
      </wc-shadcn-accordion-content>
    </wc-shadcn-accordion-item>
  </wc-shadcn-accordion-root>
</div>
    `),
    'demo-brutalist-accordion': formatCode(`
<proto-ui-brutalist-accordion-root default-open-items='["overview"]'>
  <proto-ui-brutalist-accordion-item value="overview">
    <proto-ui-brutalist-accordion-heading level="3">
      <proto-ui-brutalist-accordion-trigger>What are your shipping options?</proto-ui-brutalist-accordion-trigger>
    </proto-ui-brutalist-accordion-heading>
    <proto-ui-brutalist-accordion-content>
      We offer standard (5–7 days), express (2–3 days), and overnight shipping.
    </proto-ui-brutalist-accordion-content>
  </proto-ui-brutalist-accordion-item>
  <proto-ui-brutalist-accordion-item value="lifetime">
    <proto-ui-brutalist-accordion-heading level="3">
      <proto-ui-brutalist-accordion-trigger>What is your return policy?</proto-ui-brutalist-accordion-trigger>
    </proto-ui-brutalist-accordion-heading>
    <proto-ui-brutalist-accordion-content>
      Returns are accepted within 30 days for unused items in original packaging.
    </proto-ui-brutalist-accordion-content>
  </proto-ui-brutalist-accordion-item>
</proto-ui-brutalist-accordion-root>
    `),
    'demo-brutalist-accordion-basic': formatCode(`
<proto-ui-brutalist-accordion-root default-open-items='["item-1"]'>
  <proto-ui-brutalist-accordion-item value="item-1">
    <proto-ui-brutalist-accordion-heading level="3">
      <proto-ui-brutalist-accordion-trigger>How do I reset my password?</proto-ui-brutalist-accordion-trigger>
    </proto-ui-brutalist-accordion-heading>
    <proto-ui-brutalist-accordion-content>
      Click on 'Forgot Password' on the login page to receive a 24-hour reset link.
    </proto-ui-brutalist-accordion-content>
  </proto-ui-brutalist-accordion-item>
  <proto-ui-brutalist-accordion-item value="item-2">
    <proto-ui-brutalist-accordion-heading level="3">
      <proto-ui-brutalist-accordion-trigger>Can I change my subscription plan?</proto-ui-brutalist-accordion-trigger>
    </proto-ui-brutalist-accordion-heading>
    <proto-ui-brutalist-accordion-content>
      Yes, upgrade or downgrade anytime from your account settings.
    </proto-ui-brutalist-accordion-content>
  </proto-ui-brutalist-accordion-item>
</proto-ui-brutalist-accordion-root>
    `),
    'demo-brutalist-accordion-multiple': formatCode(`
<proto-ui-brutalist-accordion-root mode="multiple" default-open-items='["notifications"]'>
  <proto-ui-brutalist-accordion-item value="notifications">
    <proto-ui-brutalist-accordion-heading level="3">
      <proto-ui-brutalist-accordion-trigger>Notification Settings</proto-ui-brutalist-accordion-trigger>
    </proto-ui-brutalist-accordion-heading>
    <proto-ui-brutalist-accordion-content>
      Manage email alerts and mobile push notifications.
    </proto-ui-brutalist-accordion-content>
  </proto-ui-brutalist-accordion-item>
  <proto-ui-brutalist-accordion-item value="privacy">
    <proto-ui-brutalist-accordion-heading level="3">
      <proto-ui-brutalist-accordion-trigger>Privacy &amp; Security</proto-ui-brutalist-accordion-trigger>
    </proto-ui-brutalist-accordion-heading>
    <proto-ui-brutalist-accordion-content>
      Control two-factor authentication and connected devices.
    </proto-ui-brutalist-accordion-content>
  </proto-ui-brutalist-accordion-item>
</proto-ui-brutalist-accordion-root>
    `),
    'demo-brutalist-accordion-disabled': formatCode(`
<proto-ui-brutalist-accordion-root>
  <proto-ui-brutalist-accordion-item value="item-1">
    <proto-ui-brutalist-accordion-heading level="3">
      <proto-ui-brutalist-accordion-trigger>Can I access my account history?</proto-ui-brutalist-accordion-trigger>
    </proto-ui-brutalist-accordion-heading>
    <proto-ui-brutalist-accordion-content>
      Yes, view transactions and plan changes from your dashboard.
    </proto-ui-brutalist-accordion-content>
  </proto-ui-brutalist-accordion-item>
  <proto-ui-brutalist-accordion-item value="item-2" disabled>
    <proto-ui-brutalist-accordion-heading level="3">
      <proto-ui-brutalist-accordion-trigger>Premium feature information</proto-ui-brutalist-accordion-trigger>
    </proto-ui-brutalist-accordion-heading>
    <proto-ui-brutalist-accordion-content>
      Upgrade your plan to unlock enterprise audit exports.
    </proto-ui-brutalist-accordion-content>
  </proto-ui-brutalist-accordion-item>
</proto-ui-brutalist-accordion-root>
    `),
    'demo-bootstrap-2-3-2-accordion': formatCode(`
<proto-ui-bootstrap-2-3-2-accordion-root default-open-items='["overview"]'>
  <proto-ui-bootstrap-2-3-2-accordion-item value="overview">
    <proto-ui-bootstrap-2-3-2-accordion-heading level="3">
      <proto-ui-bootstrap-2-3-2-accordion-trigger>What are your shipping options?</proto-ui-bootstrap-2-3-2-accordion-trigger>
    </proto-ui-bootstrap-2-3-2-accordion-heading>
    <proto-ui-bootstrap-2-3-2-accordion-content>
      We offer standard (5–7 days), express (2–3 days), and overnight shipping.
    </proto-ui-bootstrap-2-3-2-accordion-content>
  </proto-ui-bootstrap-2-3-2-accordion-item>
  <proto-ui-bootstrap-2-3-2-accordion-item value="lifetime">
    <proto-ui-bootstrap-2-3-2-accordion-heading level="3">
      <proto-ui-bootstrap-2-3-2-accordion-trigger>What is your return policy?</proto-ui-bootstrap-2-3-2-accordion-trigger>
    </proto-ui-bootstrap-2-3-2-accordion-heading>
    <proto-ui-bootstrap-2-3-2-accordion-content>
      Returns are accepted within 30 days for unused items in original packaging.
    </proto-ui-bootstrap-2-3-2-accordion-content>
  </proto-ui-bootstrap-2-3-2-accordion-item>
</proto-ui-bootstrap-2-3-2-accordion-root>
    `),
    'demo-bootstrap-2-3-2-accordion-basic': formatCode(`
<proto-ui-bootstrap-2-3-2-accordion-root default-open-items='["item-1"]'>
  <proto-ui-bootstrap-2-3-2-accordion-item value="item-1">
    <proto-ui-bootstrap-2-3-2-accordion-heading level="3">
      <proto-ui-bootstrap-2-3-2-accordion-trigger>Collapsible Group Item #1</proto-ui-bootstrap-2-3-2-accordion-trigger>
    </proto-ui-bootstrap-2-3-2-accordion-heading>
    <proto-ui-bootstrap-2-3-2-accordion-content>
      Classic Bootstrap 2.3.2 collapsible panel with 350ms height transitions.
    </proto-ui-bootstrap-2-3-2-accordion-content>
  </proto-ui-bootstrap-2-3-2-accordion-item>
  <proto-ui-bootstrap-2-3-2-accordion-item value="item-2">
    <proto-ui-bootstrap-2-3-2-accordion-heading level="3">
      <proto-ui-bootstrap-2-3-2-accordion-trigger>Collapsible Group Item #2</proto-ui-bootstrap-2-3-2-accordion-trigger>
    </proto-ui-bootstrap-2-3-2-accordion-heading>
    <proto-ui-bootstrap-2-3-2-accordion-content>
      Opening this group automatically collapses the previous section in single mode.
    </proto-ui-bootstrap-2-3-2-accordion-content>
  </proto-ui-bootstrap-2-3-2-accordion-item>
</proto-ui-bootstrap-2-3-2-accordion-root>
    `),
    'demo-bootstrap-2-3-2-accordion-multiple': formatCode(`
<proto-ui-bootstrap-2-3-2-accordion-root mode="multiple" default-open-items='["notifications"]'>
  <proto-ui-bootstrap-2-3-2-accordion-item value="notifications">
    <proto-ui-bootstrap-2-3-2-accordion-heading level="3">
      <proto-ui-bootstrap-2-3-2-accordion-trigger>Notification Settings</proto-ui-bootstrap-2-3-2-accordion-trigger>
    </proto-ui-bootstrap-2-3-2-accordion-heading>
    <proto-ui-bootstrap-2-3-2-accordion-content>
      Configure email digests, release announcements, and real-time webhook alerts.
    </proto-ui-bootstrap-2-3-2-accordion-content>
  </proto-ui-bootstrap-2-3-2-accordion-item>
  <proto-ui-bootstrap-2-3-2-accordion-item value="privacy">
    <proto-ui-bootstrap-2-3-2-accordion-heading level="3">
      <proto-ui-bootstrap-2-3-2-accordion-trigger>Privacy &amp; Security</proto-ui-bootstrap-2-3-2-accordion-trigger>
    </proto-ui-bootstrap-2-3-2-accordion-heading>
    <proto-ui-bootstrap-2-3-2-accordion-content>
      Review active API keys, session history, and two-factor authentication policies.
    </proto-ui-bootstrap-2-3-2-accordion-content>
  </proto-ui-bootstrap-2-3-2-accordion-item>
</proto-ui-bootstrap-2-3-2-accordion-root>
    `),
    'demo-bootstrap-2-3-2-accordion-disabled': formatCode(`
<proto-ui-bootstrap-2-3-2-accordion-root>
  <proto-ui-bootstrap-2-3-2-accordion-item value="item-1">
    <proto-ui-bootstrap-2-3-2-accordion-heading level="3">
      <proto-ui-bootstrap-2-3-2-accordion-trigger>Can I access my account history?</proto-ui-bootstrap-2-3-2-accordion-trigger>
    </proto-ui-bootstrap-2-3-2-accordion-heading>
    <proto-ui-bootstrap-2-3-2-accordion-content>
      Yes, all billing statements and activity logs remain accessible from your dashboard.
    </proto-ui-bootstrap-2-3-2-accordion-content>
  </proto-ui-bootstrap-2-3-2-accordion-item>
  <proto-ui-bootstrap-2-3-2-accordion-item value="item-2" disabled>
    <proto-ui-bootstrap-2-3-2-accordion-heading level="3">
      <proto-ui-bootstrap-2-3-2-accordion-trigger>Premium feature information</proto-ui-bootstrap-2-3-2-accordion-trigger>
    </proto-ui-bootstrap-2-3-2-accordion-heading>
    <proto-ui-bootstrap-2-3-2-accordion-content>
      Upgrade your plan to unlock enterprise reporting.
    </proto-ui-bootstrap-2-3-2-accordion-content>
  </proto-ui-bootstrap-2-3-2-accordion-item>
</proto-ui-bootstrap-2-3-2-accordion-root>
    `),
    'demo-bootstrap-2-3-2-accordion-rtl': formatCode(`
<div dir="rtl" class="max-w-md">
  <proto-ui-bootstrap-2-3-2-accordion-root direction="rtl" default-open-items='["item-1"]'>
    <proto-ui-bootstrap-2-3-2-accordion-item value="item-1">
      <proto-ui-bootstrap-2-3-2-accordion-heading level="3">
        <proto-ui-bootstrap-2-3-2-accordion-trigger>كيف يمكنني إعادة تعيين كلمة المرور؟</proto-ui-bootstrap-2-3-2-accordion-trigger>
      </proto-ui-bootstrap-2-3-2-accordion-heading>
      <proto-ui-bootstrap-2-3-2-accordion-content>
        انقر على «نسيت كلمة المرور» في صفحة تسجيل الدخول وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.
      </proto-ui-bootstrap-2-3-2-accordion-content>
    </proto-ui-bootstrap-2-3-2-accordion-item>
  </proto-ui-bootstrap-2-3-2-accordion-root>
</div>
    `),
    'demo-liquid-glass-accordion': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <proto-ui-liquid-glass-accordion-root default-open-items='["overview"]'>
    <proto-ui-liquid-glass-accordion-item value="overview">
      <proto-ui-liquid-glass-accordion-heading level="3">
        <proto-ui-liquid-glass-accordion-trigger>What are your shipping options?</proto-ui-liquid-glass-accordion-trigger>
      </proto-ui-liquid-glass-accordion-heading>
      <proto-ui-liquid-glass-accordion-content>
        We offer standard (5–7 days), express (2–3 days), and overnight shipping.
      </proto-ui-liquid-glass-accordion-content>
    </proto-ui-liquid-glass-accordion-item>
  </proto-ui-liquid-glass-accordion-root>
</div>
    `),
    'demo-liquid-glass-accordion-basic': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <proto-ui-liquid-glass-accordion-root default-open-items='["item-1"]'>
    <proto-ui-liquid-glass-accordion-item value="item-1">
      <proto-ui-liquid-glass-accordion-heading level="3">
        <proto-ui-liquid-glass-accordion-trigger>How do I reset my password?</proto-ui-liquid-glass-accordion-trigger>
      </proto-ui-liquid-glass-accordion-heading>
      <proto-ui-liquid-glass-accordion-content>
        Click on 'Forgot Password' on the login page to receive a 24-hour reset link.
      </proto-ui-liquid-glass-accordion-content>
    </proto-ui-liquid-glass-accordion-item>
    <proto-ui-liquid-glass-accordion-item value="item-2">
      <proto-ui-liquid-glass-accordion-heading level="3">
        <proto-ui-liquid-glass-accordion-trigger>Can I change my subscription plan?</proto-ui-liquid-glass-accordion-trigger>
      </proto-ui-liquid-glass-accordion-heading>
      <proto-ui-liquid-glass-accordion-content>
        Yes, upgrade or downgrade anytime from account settings.
      </proto-ui-liquid-glass-accordion-content>
    </proto-ui-liquid-glass-accordion-item>
  </proto-ui-liquid-glass-accordion-root>
</div>
    `),
    'demo-liquid-glass-accordion-multiple': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <proto-ui-liquid-glass-accordion-root mode="multiple" default-open-items='["notifications"]'>
    <proto-ui-liquid-glass-accordion-item value="notifications">
      <proto-ui-liquid-glass-accordion-heading level="3">
        <proto-ui-liquid-glass-accordion-trigger>Notification Settings</proto-ui-liquid-glass-accordion-trigger>
      </proto-ui-liquid-glass-accordion-heading>
      <proto-ui-liquid-glass-accordion-content>
        Enable email alerts for account updates or push notifications for mobile devices.
      </proto-ui-liquid-glass-accordion-content>
    </proto-ui-liquid-glass-accordion-item>
    <proto-ui-liquid-glass-accordion-item value="privacy">
      <proto-ui-liquid-glass-accordion-heading level="3">
        <proto-ui-liquid-glass-accordion-trigger>Privacy &amp; Security</proto-ui-liquid-glass-accordion-trigger>
      </proto-ui-liquid-glass-accordion-heading>
      <proto-ui-liquid-glass-accordion-content>
        Configure two-factor authentication and manage connected devices.
      </proto-ui-liquid-glass-accordion-content>
    </proto-ui-liquid-glass-accordion-item>
  </proto-ui-liquid-glass-accordion-root>
</div>
    `),
    'demo-liquid-glass-accordion-disabled': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <proto-ui-liquid-glass-accordion-root>
    <proto-ui-liquid-glass-accordion-item value="item-1">
      <proto-ui-liquid-glass-accordion-heading level="3">
        <proto-ui-liquid-glass-accordion-trigger>Can I access my account history?</proto-ui-liquid-glass-accordion-trigger>
      </proto-ui-liquid-glass-accordion-heading>
      <proto-ui-liquid-glass-accordion-content>
        Yes, your complete transaction and support history is available in the dashboard.
      </proto-ui-liquid-glass-accordion-content>
    </proto-ui-liquid-glass-accordion-item>
    <proto-ui-liquid-glass-accordion-item value="item-2" disabled>
      <proto-ui-liquid-glass-accordion-heading level="3">
        <proto-ui-liquid-glass-accordion-trigger>Premium feature information</proto-ui-liquid-glass-accordion-trigger>
      </proto-ui-liquid-glass-accordion-heading>
      <proto-ui-liquid-glass-accordion-content>
        Upgrade your plan to access premium controls.
      </proto-ui-liquid-glass-accordion-content>
    </proto-ui-liquid-glass-accordion-item>
  </proto-ui-liquid-glass-accordion-root>
</div>
    `),
    'demo-liquid-glass-accordion-prominence': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <proto-ui-liquid-glass-accordion-root mode="multiple" default-open-items='["prominent"]'>
    <proto-ui-liquid-glass-accordion-item value="regular">
      <proto-ui-liquid-glass-accordion-heading level="3">
        <proto-ui-liquid-glass-accordion-trigger prominence="regular" material="auto">Regular glass trigger</proto-ui-liquid-glass-accordion-trigger>
      </proto-ui-liquid-glass-accordion-heading>
      <proto-ui-liquid-glass-accordion-content>
        Standard Liquid Glass translucency over an opaque readable panel.
      </proto-ui-liquid-glass-accordion-content>
    </proto-ui-liquid-glass-accordion-item>
    <proto-ui-liquid-glass-accordion-item value="prominent">
      <proto-ui-liquid-glass-accordion-heading level="3">
        <proto-ui-liquid-glass-accordion-trigger prominence="prominent" material="auto">Prominent glass trigger</proto-ui-liquid-glass-accordion-trigger>
      </proto-ui-liquid-glass-accordion-heading>
      <proto-ui-liquid-glass-accordion-content>
        Primary tint prominence for high-emphasis collapsible sections.
      </proto-ui-liquid-glass-accordion-content>
    </proto-ui-liquid-glass-accordion-item>
    <proto-ui-liquid-glass-accordion-item value="opaque">
      <proto-ui-liquid-glass-accordion-heading level="3">
        <proto-ui-liquid-glass-accordion-trigger material="opaque">Opaque fallback opt-out</proto-ui-liquid-glass-accordion-trigger>
      </proto-ui-liquid-glass-accordion-heading>
      <proto-ui-liquid-glass-accordion-content>
        Withdraws optical candidates when a solid opaque surface is preferred.
      </proto-ui-liquid-glass-accordion-content>
    </proto-ui-liquid-glass-accordion-item>
  </proto-ui-liquid-glass-accordion-root>
</div>
    `),
  },
  react: {
    'demo-shadcn-accordion': formatCode(`
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/react';

export function AccordionDemo() {
  return (
    <ShadcnAccordionRoot styleProfile="rhea" defaultOpenItems={['overview']} className="max-w-2xl">
      <ShadcnAccordionItem styleProfile="rhea" value="overview">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">What are your shipping options?</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          We offer standard (5–7 days), express (2–3 days), and overnight shipping.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
      <ShadcnAccordionItem styleProfile="rhea" value="lifetime">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">What is your return policy?</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          Returns are accepted within 30 days for unused items in original packaging.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
      <ShadcnAccordionItem styleProfile="rhea" value="disabled" disabled>
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">Enterprise SLA details (Unavailable)</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          Dedicated SLA terms are available on enterprise plans.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
    </ShadcnAccordionRoot>
  );
}
    `),
    'demo-shadcn-accordion-basic': formatCode(`
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/react';

export function AccordionBasic() {
  return (
    <ShadcnAccordionRoot styleProfile="rhea" defaultOpenItems={['item-1']} className="max-w-lg">
      <ShadcnAccordionItem styleProfile="rhea" value="item-1">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">How do I reset my password?</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          Click on 'Forgot Password' on the login page, enter your email address, and we'll send you a reset link.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
      <ShadcnAccordionItem styleProfile="rhea" value="item-2">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">Can I change my subscription plan?</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          Yes, you can upgrade or downgrade your plan at any time from your account settings.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
      <ShadcnAccordionItem styleProfile="rhea" value="item-3">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">What payment methods do you accept?</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          We accept all major credit cards, PayPal, and bank transfers.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
    </ShadcnAccordionRoot>
  );
}
    `),
    'demo-shadcn-accordion-multiple': formatCode(`
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/react';

export function AccordionMultiple() {
  return (
    <ShadcnAccordionRoot styleProfile="rhea" mode="multiple" defaultOpenItems={['notifications']} className="max-w-lg">
      <ShadcnAccordionItem styleProfile="rhea" value="notifications">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">Notification Settings</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          Manage how you receive email alerts and mobile push notifications.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
      <ShadcnAccordionItem styleProfile="rhea" value="privacy">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">Privacy &amp; Security</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          Enable two-factor authentication, manage connected devices, and review active sessions.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
      <ShadcnAccordionItem styleProfile="rhea" value="billing">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">Billing &amp; Subscription</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          View your current plan, payment history, and upcoming invoices.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
    </ShadcnAccordionRoot>
  );
}
    `),
    'demo-shadcn-accordion-disabled': formatCode(`
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/react';

export function AccordionDisabled() {
  return (
    <ShadcnAccordionRoot styleProfile="rhea" className="max-w-lg">
      <ShadcnAccordionItem styleProfile="rhea" value="item-1">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">Can I access my account history?</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          Yes, view all transactions, plan changes, and support tickets in your dashboard.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
      <ShadcnAccordionItem styleProfile="rhea" value="item-2" disabled>
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">Premium feature information</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          Upgrade your plan to access this content.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
      <ShadcnAccordionItem styleProfile="rhea" value="item-3">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">How do I update my email address?</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          Update your email in account settings and verify via the confirmation link.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
    </ShadcnAccordionRoot>
  );
}
    `),
    'demo-shadcn-accordion-borders': formatCode(`
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/react';

export function AccordionBorders() {
  return (
    <ShadcnAccordionRoot styleProfile="rhea" defaultOpenItems={['billing']} className="max-w-lg rounded-lg border border-border">
      <ShadcnAccordionItem styleProfile="rhea" value="billing">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">How does billing work?</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          We offer monthly and annual subscription plans with cancellation anytime.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
      <ShadcnAccordionItem styleProfile="rhea" value="security">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">Is my data secure?</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          Yes. We use end-to-end encryption and SOC 2 Type II compliance.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
      <ShadcnAccordionItem styleProfile="rhea" value="integration">
        <ShadcnAccordionHeading styleProfile="rhea" level={3}>
          <ShadcnAccordionTrigger styleProfile="rhea">What integrations do you support?</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          We integrate with 500+ popular tools plus webhooks and REST APIs.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
    </ShadcnAccordionRoot>
  );
}
    `),
    'demo-shadcn-accordion-card': formatCode(`
import {
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/react';

export function AccordionCard() {
  return (
    <ShadcnCardRoot styleProfile="rhea" className="w-full max-w-md">
      <ShadcnCardHeader styleProfile="rhea">
        <div className="text-base font-semibold">Subscription &amp; Billing</div>
        <div className="text-sm text-muted-foreground">Common questions about plans, payments, and cancellations.</div>
      </ShadcnCardHeader>
      <ShadcnCardContent styleProfile="rhea">
        <ShadcnAccordionRoot styleProfile="rhea" defaultOpenItems={['plans']}>
          <ShadcnAccordionItem styleProfile="rhea" value="plans">
            <ShadcnAccordionHeading styleProfile="rhea" level={3}>
              <ShadcnAccordionTrigger styleProfile="rhea">What subscription plans do you offer?</ShadcnAccordionTrigger>
            </ShadcnAccordionHeading>
            <ShadcnAccordionContent styleProfile="rhea">
              Starter ($9/month), Professional ($29/month), and Enterprise ($99/month).
            </ShadcnAccordionContent>
          </ShadcnAccordionItem>
          <ShadcnAccordionItem styleProfile="rhea" value="billing">
            <ShadcnAccordionHeading styleProfile="rhea" level={3}>
              <ShadcnAccordionTrigger styleProfile="rhea">How does billing work?</ShadcnAccordionTrigger>
            </ShadcnAccordionHeading>
            <ShadcnAccordionContent styleProfile="rhea">
              Billing occurs automatically at the start of each billing cycle.
            </ShadcnAccordionContent>
          </ShadcnAccordionItem>
        </ShadcnAccordionRoot>
      </ShadcnCardContent>
    </ShadcnCardRoot>
  );
}
    `),
    'demo-shadcn-accordion-rtl': formatCode(`
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/react';

export function AccordionRtl() {
  return (
    <div dir="rtl" className="max-w-md">
      <ShadcnAccordionRoot styleProfile="rhea" direction="rtl" defaultOpenItems={['item-1']}>
        <ShadcnAccordionItem styleProfile="rhea" value="item-1">
          <ShadcnAccordionHeading styleProfile="rhea" level={3}>
            <ShadcnAccordionTrigger styleProfile="rhea">كيف يمكنني إعادة تعيين كلمة المرور؟</ShadcnAccordionTrigger>
          </ShadcnAccordionHeading>
          <ShadcnAccordionContent styleProfile="rhea">
            انقر على «نسيت كلمة المرور» في صفحة تسجيل الدخول وسنرسل لك رابطًا لإعادة التعيين.
          </ShadcnAccordionContent>
        </ShadcnAccordionItem>
        <ShadcnAccordionItem styleProfile="rhea" value="item-2">
          <ShadcnAccordionHeading styleProfile="rhea" level={3}>
            <ShadcnAccordionTrigger styleProfile="rhea">هل يمكنني تغيير خطة الاشتراك الخاصة بي؟</ShadcnAccordionTrigger>
          </ShadcnAccordionHeading>
          <ShadcnAccordionContent styleProfile="rhea">
            نعم، يمكنك ترقية أو تخفيض خطتك في أي وقت من إعدادات حسابك.
          </ShadcnAccordionContent>
        </ShadcnAccordionItem>
      </ShadcnAccordionRoot>
    </div>
  );
}
    `),
    'demo-brutalist-accordion': formatCode(`
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/react';

export function BrutalistAccordionDemo() {
  return (
    <BrutalistAccordionRoot defaultOpenItems={['overview']}>
      <BrutalistAccordionItem value="overview">
        <BrutalistAccordionHeading level={3}>
          <BrutalistAccordionTrigger>What are your shipping options?</BrutalistAccordionTrigger>
        </BrutalistAccordionHeading>
        <BrutalistAccordionContent>
          We offer standard (5–7 days), express (2–3 days), and overnight shipping.
        </BrutalistAccordionContent>
      </BrutalistAccordionItem>
      <BrutalistAccordionItem value="lifetime">
        <BrutalistAccordionHeading level={3}>
          <BrutalistAccordionTrigger>What is your return policy?</BrutalistAccordionTrigger>
        </BrutalistAccordionHeading>
        <BrutalistAccordionContent>
          Returns are accepted within 30 days for unused items in original packaging.
        </BrutalistAccordionContent>
      </BrutalistAccordionItem>
    </BrutalistAccordionRoot>
  );
}
    `),
    'demo-brutalist-accordion-basic': formatCode(`
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/react';

export function BrutalistAccordionBasic() {
  return (
    <BrutalistAccordionRoot defaultOpenItems={['item-1']} className="max-w-lg">
      <BrutalistAccordionItem value="item-1">
        <BrutalistAccordionHeading level={3}>
          <BrutalistAccordionTrigger>How do I reset my password?</BrutalistAccordionTrigger>
        </BrutalistAccordionHeading>
        <BrutalistAccordionContent>
          Click on 'Forgot Password' on the login page to receive a 24-hour reset link.
        </BrutalistAccordionContent>
      </BrutalistAccordionItem>
      <BrutalistAccordionItem value="item-2">
        <BrutalistAccordionHeading level={3}>
          <BrutalistAccordionTrigger>Can I change my subscription plan?</BrutalistAccordionTrigger>
        </BrutalistAccordionHeading>
        <BrutalistAccordionContent>
          Yes, upgrade or downgrade anytime from your account settings.
        </BrutalistAccordionContent>
      </BrutalistAccordionItem>
    </BrutalistAccordionRoot>
  );
}
    `),
    'demo-brutalist-accordion-multiple': formatCode(`
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/react';

export function BrutalistAccordionMultiple() {
  return (
    <BrutalistAccordionRoot mode="multiple" defaultOpenItems={['notifications']} className="max-w-lg">
      <BrutalistAccordionItem value="notifications">
        <BrutalistAccordionHeading level={3}>
          <BrutalistAccordionTrigger>Notification Settings</BrutalistAccordionTrigger>
        </BrutalistAccordionHeading>
        <BrutalistAccordionContent>
          Manage email alerts and mobile push notifications.
        </BrutalistAccordionContent>
      </BrutalistAccordionItem>
      <BrutalistAccordionItem value="privacy">
        <BrutalistAccordionHeading level={3}>
          <BrutalistAccordionTrigger>Privacy &amp; Security</BrutalistAccordionTrigger>
        </BrutalistAccordionHeading>
        <BrutalistAccordionContent>
          Control two-factor authentication and connected devices.
        </BrutalistAccordionContent>
      </BrutalistAccordionItem>
    </BrutalistAccordionRoot>
  );
}
    `),
    'demo-brutalist-accordion-disabled': formatCode(`
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/react';

export function BrutalistAccordionDisabled() {
  return (
    <BrutalistAccordionRoot className="max-w-lg">
      <BrutalistAccordionItem value="item-1">
        <BrutalistAccordionHeading level={3}>
          <BrutalistAccordionTrigger>Can I access my account history?</BrutalistAccordionTrigger>
        </BrutalistAccordionHeading>
        <BrutalistAccordionContent>
          Yes, view transactions and plan changes from your dashboard.
        </BrutalistAccordionContent>
      </BrutalistAccordionItem>
      <BrutalistAccordionItem value="item-2" disabled>
        <BrutalistAccordionHeading level={3}>
          <BrutalistAccordionTrigger>Premium feature information</BrutalistAccordionTrigger>
        </BrutalistAccordionHeading>
        <BrutalistAccordionContent>
          Upgrade your plan to unlock enterprise audit exports.
        </BrutalistAccordionContent>
      </BrutalistAccordionItem>
    </BrutalistAccordionRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-accordion': formatCode(`
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/react';

export function BootstrapAccordionDemo() {
  return (
    <Bootstrap232AccordionRoot defaultOpenItems={['overview']}>
      <Bootstrap232AccordionItem value="overview">
        <Bootstrap232AccordionHeading level={3}>
          <Bootstrap232AccordionTrigger>What are your shipping options?</Bootstrap232AccordionTrigger>
        </Bootstrap232AccordionHeading>
        <Bootstrap232AccordionContent>
          We offer standard (5–7 days), express (2–3 days), and overnight shipping.
        </Bootstrap232AccordionContent>
      </Bootstrap232AccordionItem>
      <Bootstrap232AccordionItem value="lifetime">
        <Bootstrap232AccordionHeading level={3}>
          <Bootstrap232AccordionTrigger>What is your return policy?</Bootstrap232AccordionTrigger>
        </Bootstrap232AccordionHeading>
        <Bootstrap232AccordionContent>
          Returns are accepted within 30 days for unused items in original packaging.
        </Bootstrap232AccordionContent>
      </Bootstrap232AccordionItem>
    </Bootstrap232AccordionRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-accordion-basic': formatCode(`
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/react';

export function BootstrapAccordionBasic() {
  return (
    <Bootstrap232AccordionRoot defaultOpenItems={['item-1']} className="max-w-lg">
      <Bootstrap232AccordionItem value="item-1">
        <Bootstrap232AccordionHeading level={3}>
          <Bootstrap232AccordionTrigger>Collapsible Group Item #1</Bootstrap232AccordionTrigger>
        </Bootstrap232AccordionHeading>
        <Bootstrap232AccordionContent>
          Classic Bootstrap 2.3.2 collapsible panel with smooth 350ms height transitions.
        </Bootstrap232AccordionContent>
      </Bootstrap232AccordionItem>
      <Bootstrap232AccordionItem value="item-2">
        <Bootstrap232AccordionHeading level={3}>
          <Bootstrap232AccordionTrigger>Collapsible Group Item #2</Bootstrap232AccordionTrigger>
        </Bootstrap232AccordionHeading>
        <Bootstrap232AccordionContent>
          Opening this group automatically collapses the previous section in single mode.
        </Bootstrap232AccordionContent>
      </Bootstrap232AccordionItem>
    </Bootstrap232AccordionRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-accordion-multiple': formatCode(`
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/react';

export function BootstrapAccordionMultiple() {
  return (
    <Bootstrap232AccordionRoot mode="multiple" defaultOpenItems={['notifications']} className="max-w-lg">
      <Bootstrap232AccordionItem value="notifications">
        <Bootstrap232AccordionHeading level={3}>
          <Bootstrap232AccordionTrigger>Notification Settings</Bootstrap232AccordionTrigger>
        </Bootstrap232AccordionHeading>
        <Bootstrap232AccordionContent>
          Configure email digests, release announcements, and real-time webhook alerts.
        </Bootstrap232AccordionContent>
      </Bootstrap232AccordionItem>
      <Bootstrap232AccordionItem value="privacy">
        <Bootstrap232AccordionHeading level={3}>
          <Bootstrap232AccordionTrigger>Privacy &amp; Security</Bootstrap232AccordionTrigger>
        </Bootstrap232AccordionHeading>
        <Bootstrap232AccordionContent>
          Review active API keys, session history, and two-factor authentication policies.
        </Bootstrap232AccordionContent>
      </Bootstrap232AccordionItem>
    </Bootstrap232AccordionRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-accordion-disabled': formatCode(`
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/react';

export function BootstrapAccordionDisabled() {
  return (
    <Bootstrap232AccordionRoot className="max-w-lg">
      <Bootstrap232AccordionItem value="item-1">
        <Bootstrap232AccordionHeading level={3}>
          <Bootstrap232AccordionTrigger>Can I access my account history?</Bootstrap232AccordionTrigger>
        </Bootstrap232AccordionHeading>
        <Bootstrap232AccordionContent>
          Yes, all billing statements and activity logs remain accessible from your dashboard.
        </Bootstrap232AccordionContent>
      </Bootstrap232AccordionItem>
      <Bootstrap232AccordionItem value="item-2" disabled>
        <Bootstrap232AccordionHeading level={3}>
          <Bootstrap232AccordionTrigger>Premium feature information</Bootstrap232AccordionTrigger>
        </Bootstrap232AccordionHeading>
        <Bootstrap232AccordionContent>
          Upgrade your plan to unlock enterprise reporting.
        </Bootstrap232AccordionContent>
      </Bootstrap232AccordionItem>
    </Bootstrap232AccordionRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-accordion-rtl': formatCode(`
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/react';

export function BootstrapAccordionRtl() {
  return (
    <div dir="rtl" className="max-w-md">
      <Bootstrap232AccordionRoot direction="rtl" defaultOpenItems={['item-1']}>
        <Bootstrap232AccordionItem value="item-1">
          <Bootstrap232AccordionHeading level={3}>
            <Bootstrap232AccordionTrigger>كيف يمكنني إعادة تعيين كلمة المرور؟</Bootstrap232AccordionTrigger>
          </Bootstrap232AccordionHeading>
          <Bootstrap232AccordionContent>
            انقر على «نسيت كلمة المرور» في صفحة تسجيل الدخول وسنرسل لك رابطًا لإعادة التعيين.
          </Bootstrap232AccordionContent>
        </Bootstrap232AccordionItem>
      </Bootstrap232AccordionRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-accordion': formatCode(`
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/react';

export function LiquidGlassAccordionDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassAccordionRoot defaultOpenItems={['overview']}>
        <LiquidGlassAccordionItem value="overview">
          <LiquidGlassAccordionHeading level={3}>
            <LiquidGlassAccordionTrigger>What are your shipping options?</LiquidGlassAccordionTrigger>
          </LiquidGlassAccordionHeading>
          <LiquidGlassAccordionContent>
            We offer standard (5–7 days), express (2–3 days), and overnight shipping.
          </LiquidGlassAccordionContent>
        </LiquidGlassAccordionItem>
      </LiquidGlassAccordionRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-accordion-basic': formatCode(`
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/react';

export function LiquidGlassAccordionBasic() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassAccordionRoot defaultOpenItems={['item-1']}>
        <LiquidGlassAccordionItem value="item-1">
          <LiquidGlassAccordionHeading level={3}>
            <LiquidGlassAccordionTrigger>How do I reset my password?</LiquidGlassAccordionTrigger>
          </LiquidGlassAccordionHeading>
          <LiquidGlassAccordionContent>
            Click on 'Forgot Password' on the login page to receive a 24-hour reset link.
          </LiquidGlassAccordionContent>
        </LiquidGlassAccordionItem>
        <LiquidGlassAccordionItem value="item-2">
          <LiquidGlassAccordionHeading level={3}>
            <LiquidGlassAccordionTrigger>Can I change my subscription plan?</LiquidGlassAccordionTrigger>
          </LiquidGlassAccordionHeading>
          <LiquidGlassAccordionContent>
            Yes, upgrade or downgrade anytime from account settings.
          </LiquidGlassAccordionContent>
        </LiquidGlassAccordionItem>
      </LiquidGlassAccordionRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-accordion-multiple': formatCode(`
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/react';

export function LiquidGlassAccordionMultiple() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassAccordionRoot mode="multiple" defaultOpenItems={['notifications']}>
        <LiquidGlassAccordionItem value="notifications">
          <LiquidGlassAccordionHeading level={3}>
            <LiquidGlassAccordionTrigger>Notification Settings</LiquidGlassAccordionTrigger>
          </LiquidGlassAccordionHeading>
          <LiquidGlassAccordionContent>
            Enable email alerts for account updates or push notifications for mobile devices.
          </LiquidGlassAccordionContent>
        </LiquidGlassAccordionItem>
        <LiquidGlassAccordionItem value="privacy">
          <LiquidGlassAccordionHeading level={3}>
            <LiquidGlassAccordionTrigger>Privacy &amp; Security</LiquidGlassAccordionTrigger>
          </LiquidGlassAccordionHeading>
          <LiquidGlassAccordionContent>
            Configure two-factor authentication and manage connected devices.
          </LiquidGlassAccordionContent>
        </LiquidGlassAccordionItem>
      </LiquidGlassAccordionRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-accordion-disabled': formatCode(`
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/react';

export function LiquidGlassAccordionDisabled() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassAccordionRoot>
        <LiquidGlassAccordionItem value="item-1">
          <LiquidGlassAccordionHeading level={3}>
            <LiquidGlassAccordionTrigger>Can I access my account history?</LiquidGlassAccordionTrigger>
          </LiquidGlassAccordionHeading>
          <LiquidGlassAccordionContent>
            Yes, your complete transaction and support history is available in the dashboard.
          </LiquidGlassAccordionContent>
        </LiquidGlassAccordionItem>
        <LiquidGlassAccordionItem value="item-2" disabled>
          <LiquidGlassAccordionHeading level={3}>
            <LiquidGlassAccordionTrigger>Premium feature information</LiquidGlassAccordionTrigger>
          </LiquidGlassAccordionHeading>
          <LiquidGlassAccordionContent>
            Upgrade your plan to access premium controls.
          </LiquidGlassAccordionContent>
        </LiquidGlassAccordionItem>
      </LiquidGlassAccordionRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-accordion-prominence': formatCode(`
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/react';

export function LiquidGlassAccordionProminence() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassAccordionRoot mode="multiple" defaultOpenItems={['prominent']}>
        <LiquidGlassAccordionItem value="regular">
          <LiquidGlassAccordionHeading level={3}>
            <LiquidGlassAccordionTrigger prominence="regular" material="auto">
              Regular glass trigger
            </LiquidGlassAccordionTrigger>
          </LiquidGlassAccordionHeading>
          <LiquidGlassAccordionContent>
            Standard Liquid Glass translucency over an opaque readable panel.
          </LiquidGlassAccordionContent>
        </LiquidGlassAccordionItem>
        <LiquidGlassAccordionItem value="prominent">
          <LiquidGlassAccordionHeading level={3}>
            <LiquidGlassAccordionTrigger prominence="prominent" material="auto">
              Prominent glass trigger
            </LiquidGlassAccordionTrigger>
          </LiquidGlassAccordionHeading>
          <LiquidGlassAccordionContent>
            Primary tint prominence for high-emphasis collapsible sections.
          </LiquidGlassAccordionContent>
        </LiquidGlassAccordionItem>
        <LiquidGlassAccordionItem value="opaque">
          <LiquidGlassAccordionHeading level={3}>
            <LiquidGlassAccordionTrigger material="opaque">
              Opaque fallback opt-out
            </LiquidGlassAccordionTrigger>
          </LiquidGlassAccordionHeading>
          <LiquidGlassAccordionContent>
            Withdraws optical candidates when a solid opaque surface is preferred.
          </LiquidGlassAccordionContent>
        </LiquidGlassAccordionItem>
      </LiquidGlassAccordionRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-accordion': formatCode(`
<script setup lang="ts">
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnAccordionRoot styleProfile="rhea" :defaultOpenItems="['overview']" class="max-w-2xl">
    <ShadcnAccordionItem styleProfile="rhea" value="overview">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">What are your shipping options?</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        We offer standard (5–7 days), express (2–3 days), and overnight shipping.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
    <ShadcnAccordionItem styleProfile="rhea" value="lifetime">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">What is your return policy?</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Returns are accepted within 30 days for unused items in original packaging.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
  </ShadcnAccordionRoot>
</template>
    `),
    'demo-shadcn-accordion-basic': formatCode(`
<script setup lang="ts">
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnAccordionRoot styleProfile="rhea" :defaultOpenItems="['item-1']" class="max-w-lg">
    <ShadcnAccordionItem styleProfile="rhea" value="item-1">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">How do I reset my password?</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Click on 'Forgot Password' on the login page to receive a 24-hour reset link.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
    <ShadcnAccordionItem styleProfile="rhea" value="item-2">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">Can I change my subscription plan?</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Yes, upgrade or downgrade anytime from your account settings.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
  </ShadcnAccordionRoot>
</template>
    `),
    'demo-shadcn-accordion-multiple': formatCode(`
<script setup lang="ts">
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnAccordionRoot styleProfile="rhea" mode="multiple" :defaultOpenItems="['notifications']" class="max-w-lg">
    <ShadcnAccordionItem styleProfile="rhea" value="notifications">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">Notification Settings</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Manage how you receive email alerts and mobile push notifications.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
    <ShadcnAccordionItem styleProfile="rhea" value="privacy">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">Privacy &amp; Security</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Enable two-factor authentication and manage connected devices.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
  </ShadcnAccordionRoot>
</template>
    `),
    'demo-shadcn-accordion-disabled': formatCode(`
<script setup lang="ts">
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnAccordionRoot styleProfile="rhea" class="max-w-lg">
    <ShadcnAccordionItem styleProfile="rhea" value="item-1">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">Can I access my account history?</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Yes, view all transactions and support tickets in your dashboard.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
    <ShadcnAccordionItem styleProfile="rhea" value="item-2" :disabled="true">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">Premium feature information</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Upgrade your plan to access this content.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
  </ShadcnAccordionRoot>
</template>
    `),
    'demo-shadcn-accordion-borders': formatCode(`
<script setup lang="ts">
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnAccordionRoot styleProfile="rhea" :defaultOpenItems="['billing']" class="max-w-lg rounded-lg border border-border">
    <ShadcnAccordionItem styleProfile="rhea" value="billing">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">How does billing work?</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        We offer monthly and annual subscription plans with cancellation anytime.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
    <ShadcnAccordionItem styleProfile="rhea" value="security">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">Is my data secure?</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Yes. We use end-to-end encryption and SOC 2 Type II compliance.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
  </ShadcnAccordionRoot>
</template>
    `),
    'demo-shadcn-accordion-card': formatCode(`
<script setup lang="ts">
import {
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnCardRoot styleProfile="rhea" class="w-full max-w-md">
    <ShadcnCardHeader styleProfile="rhea">
      <div class="text-base font-semibold">Subscription &amp; Billing</div>
      <div class="text-sm text-muted-foreground">Common questions about plans, payments, and cancellations.</div>
    </ShadcnCardHeader>
    <ShadcnCardContent styleProfile="rhea">
      <ShadcnAccordionRoot styleProfile="rhea" :defaultOpenItems="['plans']">
        <ShadcnAccordionItem styleProfile="rhea" value="plans">
          <ShadcnAccordionHeading styleProfile="rhea" :level="3">
            <ShadcnAccordionTrigger styleProfile="rhea">What subscription plans do you offer?</ShadcnAccordionTrigger>
          </ShadcnAccordionHeading>
          <ShadcnAccordionContent styleProfile="rhea">
            Starter ($9/month), Professional ($29/month), and Enterprise ($99/month).
          </ShadcnAccordionContent>
        </ShadcnAccordionItem>
      </ShadcnAccordionRoot>
    </ShadcnCardContent>
  </ShadcnCardRoot>
</template>
    `),
    'demo-shadcn-accordion-rtl': formatCode(`
<script setup lang="ts">
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div dir="rtl" class="max-w-md">
    <ShadcnAccordionRoot styleProfile="rhea" direction="rtl" :defaultOpenItems="['item-1']">
      <ShadcnAccordionItem styleProfile="rhea" value="item-1">
        <ShadcnAccordionHeading styleProfile="rhea" :level="3">
          <ShadcnAccordionTrigger styleProfile="rhea">كيف يمكنني إعادة تعيين كلمة المرور؟</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          انقر على «نسيت كلمة المرور» في صفحة تسجيل الدخول وسنرسل لك رابطًا لإعادة التعيين.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
    </ShadcnAccordionRoot>
  </div>
</template>
    `),
    'demo-brutalist-accordion': formatCode(`
<script setup lang="ts">
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistAccordionRoot :defaultOpenItems="['overview']">
    <BrutalistAccordionItem value="overview">
      <BrutalistAccordionHeading :level="3">
        <BrutalistAccordionTrigger>What are your shipping options?</BrutalistAccordionTrigger>
      </BrutalistAccordionHeading>
      <BrutalistAccordionContent>
        We offer standard (5–7 days), express (2–3 days), and overnight shipping.
      </BrutalistAccordionContent>
    </BrutalistAccordionItem>
  </BrutalistAccordionRoot>
</template>
    `),
    'demo-brutalist-accordion-basic': formatCode(`
<script setup lang="ts">
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistAccordionRoot :defaultOpenItems="['item-1']" class="max-w-lg">
    <BrutalistAccordionItem value="item-1">
      <BrutalistAccordionHeading :level="3">
        <BrutalistAccordionTrigger>How do I reset my password?</BrutalistAccordionTrigger>
      </BrutalistAccordionHeading>
      <BrutalistAccordionContent>
        Click on 'Forgot Password' on the login page to receive a 24-hour reset link.
      </BrutalistAccordionContent>
    </BrutalistAccordionItem>
  </BrutalistAccordionRoot>
</template>
    `),
    'demo-brutalist-accordion-multiple': formatCode(`
<script setup lang="ts">
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistAccordionRoot mode="multiple" :defaultOpenItems="['notifications']" class="max-w-lg">
    <BrutalistAccordionItem value="notifications">
      <BrutalistAccordionHeading :level="3">
        <BrutalistAccordionTrigger>Notification Settings</BrutalistAccordionTrigger>
      </BrutalistAccordionHeading>
      <BrutalistAccordionContent>
        Manage email alerts and mobile push notifications.
      </BrutalistAccordionContent>
    </BrutalistAccordionItem>
    <BrutalistAccordionItem value="privacy">
      <BrutalistAccordionHeading :level="3">
        <BrutalistAccordionTrigger>Privacy &amp; Security</BrutalistAccordionTrigger>
      </BrutalistAccordionHeading>
      <BrutalistAccordionContent>
        Control two-factor authentication and connected devices.
      </BrutalistAccordionContent>
    </BrutalistAccordionItem>
  </BrutalistAccordionRoot>
</template>
    `),
    'demo-brutalist-accordion-disabled': formatCode(`
<script setup lang="ts">
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistAccordionRoot class="max-w-lg">
    <BrutalistAccordionItem value="item-1">
      <BrutalistAccordionHeading :level="3">
        <BrutalistAccordionTrigger>Can I access my account history?</BrutalistAccordionTrigger>
      </BrutalistAccordionHeading>
      <BrutalistAccordionContent>
        Yes, view transactions and plan changes from your dashboard.
      </BrutalistAccordionContent>
    </BrutalistAccordionItem>
    <BrutalistAccordionItem value="item-2" :disabled="true">
      <BrutalistAccordionHeading :level="3">
        <BrutalistAccordionTrigger>Premium feature information</BrutalistAccordionTrigger>
      </BrutalistAccordionHeading>
      <BrutalistAccordionContent>
        Upgrade your plan to unlock enterprise audit exports.
      </BrutalistAccordionContent>
    </BrutalistAccordionItem>
  </BrutalistAccordionRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-accordion': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232AccordionRoot :defaultOpenItems="['overview']">
    <Bootstrap232AccordionItem value="overview">
      <Bootstrap232AccordionHeading :level="3">
        <Bootstrap232AccordionTrigger>What are your shipping options?</Bootstrap232AccordionTrigger>
      </Bootstrap232AccordionHeading>
      <Bootstrap232AccordionContent>
        We offer standard (5–7 days), express (2–3 days), and overnight shipping.
      </Bootstrap232AccordionContent>
    </Bootstrap232AccordionItem>
  </Bootstrap232AccordionRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-accordion-basic': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232AccordionRoot :defaultOpenItems="['item-1']" class="max-w-lg">
    <Bootstrap232AccordionItem value="item-1">
      <Bootstrap232AccordionHeading :level="3">
        <Bootstrap232AccordionTrigger>Collapsible Group Item #1</Bootstrap232AccordionTrigger>
      </Bootstrap232AccordionHeading>
      <Bootstrap232AccordionContent>
        Classic Bootstrap 2.3.2 collapsible panel with smooth 350ms height transitions.
      </Bootstrap232AccordionContent>
    </Bootstrap232AccordionItem>
  </Bootstrap232AccordionRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-accordion-multiple': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232AccordionRoot mode="multiple" :defaultOpenItems="['notifications']" class="max-w-lg">
    <Bootstrap232AccordionItem value="notifications">
      <Bootstrap232AccordionHeading :level="3">
        <Bootstrap232AccordionTrigger>Notification Settings</Bootstrap232AccordionTrigger>
      </Bootstrap232AccordionHeading>
      <Bootstrap232AccordionContent>
        Configure email digests, release announcements, and real-time webhook alerts.
      </Bootstrap232AccordionContent>
    </Bootstrap232AccordionItem>
  </Bootstrap232AccordionRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-accordion-disabled': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232AccordionRoot class="max-w-lg">
    <Bootstrap232AccordionItem value="item-1">
      <Bootstrap232AccordionHeading :level="3">
        <Bootstrap232AccordionTrigger>Can I access my account history?</Bootstrap232AccordionTrigger>
      </Bootstrap232AccordionHeading>
      <Bootstrap232AccordionContent>
        Yes, all billing statements and activity logs remain accessible from your dashboard.
      </Bootstrap232AccordionContent>
    </Bootstrap232AccordionItem>
    <Bootstrap232AccordionItem value="item-2" :disabled="true">
      <Bootstrap232AccordionHeading :level="3">
        <Bootstrap232AccordionTrigger>Premium feature information</Bootstrap232AccordionTrigger>
      </Bootstrap232AccordionHeading>
      <Bootstrap232AccordionContent>
        Upgrade your plan to unlock enterprise reporting.
      </Bootstrap232AccordionContent>
    </Bootstrap232AccordionItem>
  </Bootstrap232AccordionRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-accordion-rtl': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div dir="rtl" class="max-w-md">
    <Bootstrap232AccordionRoot direction="rtl" :defaultOpenItems="['item-1']">
      <Bootstrap232AccordionItem value="item-1">
        <Bootstrap232AccordionHeading :level="3">
          <Bootstrap232AccordionTrigger>كيف يمكنني إعادة تعيين كلمة المرور؟</Bootstrap232AccordionTrigger>
        </Bootstrap232AccordionHeading>
        <Bootstrap232AccordionContent>
          انقر على «نسيت كلمة المرور» في صفحة تسجيل الدخول وسنرسل لك رابطًا لإعادة التعيين.
        </Bootstrap232AccordionContent>
      </Bootstrap232AccordionItem>
    </Bootstrap232AccordionRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-accordion': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassAccordionRoot :defaultOpenItems="['overview']">
      <LiquidGlassAccordionItem value="overview">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger>What are your shipping options?</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          We offer standard (5–7 days), express (2–3 days), and overnight shipping.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
    </LiquidGlassAccordionRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-accordion-basic': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassAccordionRoot :defaultOpenItems="['item-1']">
      <LiquidGlassAccordionItem value="item-1">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger>How do I reset my password?</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Click on 'Forgot Password' on the login page to receive a 24-hour reset link.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
    </LiquidGlassAccordionRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-accordion-multiple': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassAccordionRoot mode="multiple" :defaultOpenItems="['notifications']">
      <LiquidGlassAccordionItem value="notifications">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger>Notification Settings</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Enable email alerts for account updates or push notifications for mobile devices.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
    </LiquidGlassAccordionRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-accordion-disabled': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassAccordionRoot>
      <LiquidGlassAccordionItem value="item-1">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger>Can I access my account history?</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Yes, your complete transaction and support history is available in the dashboard.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
      <LiquidGlassAccordionItem value="item-2" :disabled="true">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger>Premium feature information</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Upgrade your plan to access premium controls.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
    </LiquidGlassAccordionRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-accordion-prominence': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassAccordionRoot mode="multiple" :defaultOpenItems="['prominent']">
      <LiquidGlassAccordionItem value="regular">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger prominence="regular" material="auto">Regular glass trigger</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Standard Liquid Glass translucency over an opaque readable panel.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
      <LiquidGlassAccordionItem value="prominent">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger prominence="prominent" material="auto">Prominent glass trigger</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Primary tint prominence for high-emphasis collapsible sections.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
      <LiquidGlassAccordionItem value="opaque">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger material="opaque">Opaque fallback opt-out</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Withdraws optical candidates when a solid opaque surface is preferred.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
    </LiquidGlassAccordionRoot>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-accordion': formatCode(`
<template>
  <ShadcnAccordionRoot styleProfile="rhea" :defaultOpenItems="['overview']" class="max-w-2xl">
    <ShadcnAccordionItem styleProfile="rhea" value="overview">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">What are your shipping options?</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        We offer standard (5–7 days), express (2–3 days), and overnight shipping.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
  </ShadcnAccordionRoot>
</template>

<script>
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAccordionRoot,
    ShadcnAccordionItem,
    ShadcnAccordionHeading,
    ShadcnAccordionTrigger,
    ShadcnAccordionContent,
  },
};
</script>
    `),
    'demo-shadcn-accordion-basic': formatCode(`
<template>
  <ShadcnAccordionRoot styleProfile="rhea" :defaultOpenItems="['item-1']" class="max-w-lg">
    <ShadcnAccordionItem styleProfile="rhea" value="item-1">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">How do I reset my password?</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Click on 'Forgot Password' on the login page to receive a 24-hour reset link.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
  </ShadcnAccordionRoot>
</template>

<script>
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAccordionRoot,
    ShadcnAccordionItem,
    ShadcnAccordionHeading,
    ShadcnAccordionTrigger,
    ShadcnAccordionContent,
  },
};
</script>
    `),
    'demo-shadcn-accordion-multiple': formatCode(`
<template>
  <ShadcnAccordionRoot styleProfile="rhea" mode="multiple" :defaultOpenItems="['notifications']" class="max-w-lg">
    <ShadcnAccordionItem styleProfile="rhea" value="notifications">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">Notification Settings</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Manage how you receive email alerts and mobile push notifications.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
  </ShadcnAccordionRoot>
</template>

<script>
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAccordionRoot,
    ShadcnAccordionItem,
    ShadcnAccordionHeading,
    ShadcnAccordionTrigger,
    ShadcnAccordionContent,
  },
};
</script>
    `),
    'demo-shadcn-accordion-disabled': formatCode(`
<template>
  <ShadcnAccordionRoot styleProfile="rhea" class="max-w-lg">
    <ShadcnAccordionItem styleProfile="rhea" value="item-1">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">Can I access my account history?</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Yes, view all transactions and support tickets in your dashboard.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
    <ShadcnAccordionItem styleProfile="rhea" value="item-2" :disabled="true">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">Premium feature information</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        Upgrade your plan to access this content.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
  </ShadcnAccordionRoot>
</template>

<script>
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAccordionRoot,
    ShadcnAccordionItem,
    ShadcnAccordionHeading,
    ShadcnAccordionTrigger,
    ShadcnAccordionContent,
  },
};
</script>
    `),
    'demo-shadcn-accordion-borders': formatCode(`
<template>
  <ShadcnAccordionRoot styleProfile="rhea" :defaultOpenItems="['billing']" class="max-w-lg rounded-lg border border-border">
    <ShadcnAccordionItem styleProfile="rhea" value="billing">
      <ShadcnAccordionHeading styleProfile="rhea" :level="3">
        <ShadcnAccordionTrigger styleProfile="rhea">How does billing work?</ShadcnAccordionTrigger>
      </ShadcnAccordionHeading>
      <ShadcnAccordionContent styleProfile="rhea">
        We offer monthly and annual subscription plans with cancellation anytime.
      </ShadcnAccordionContent>
    </ShadcnAccordionItem>
  </ShadcnAccordionRoot>
</template>

<script>
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAccordionRoot,
    ShadcnAccordionItem,
    ShadcnAccordionHeading,
    ShadcnAccordionTrigger,
    ShadcnAccordionContent,
  },
};
</script>
    `),
    'demo-shadcn-accordion-card': formatCode(`
<template>
  <ShadcnCardRoot styleProfile="rhea" class="w-full max-w-md">
    <ShadcnCardHeader styleProfile="rhea">
      <div class="text-base font-semibold">Subscription &amp; Billing</div>
      <div class="text-sm text-muted-foreground">Common questions about plans, payments, and cancellations.</div>
    </ShadcnCardHeader>
    <ShadcnCardContent styleProfile="rhea">
      <ShadcnAccordionRoot styleProfile="rhea" :defaultOpenItems="['plans']">
        <ShadcnAccordionItem styleProfile="rhea" value="plans">
          <ShadcnAccordionHeading styleProfile="rhea" :level="3">
            <ShadcnAccordionTrigger styleProfile="rhea">What subscription plans do you offer?</ShadcnAccordionTrigger>
          </ShadcnAccordionHeading>
          <ShadcnAccordionContent styleProfile="rhea">
            Starter ($9/month), Professional ($29/month), and Enterprise ($99/month).
          </ShadcnAccordionContent>
        </ShadcnAccordionItem>
      </ShadcnAccordionRoot>
    </ShadcnCardContent>
  </ShadcnCardRoot>
</template>

<script>
import {
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnCardRoot,
    ShadcnCardHeader,
    ShadcnCardContent,
    ShadcnAccordionRoot,
    ShadcnAccordionItem,
    ShadcnAccordionHeading,
    ShadcnAccordionTrigger,
    ShadcnAccordionContent,
  },
};
</script>
    `),
    'demo-shadcn-accordion-rtl': formatCode(`
<template>
  <div dir="rtl" class="max-w-md">
    <ShadcnAccordionRoot styleProfile="rhea" direction="rtl" :defaultOpenItems="['item-1']">
      <ShadcnAccordionItem styleProfile="rhea" value="item-1">
        <ShadcnAccordionHeading styleProfile="rhea" :level="3">
          <ShadcnAccordionTrigger styleProfile="rhea">كيف يمكنني إعادة تعيين كلمة المرور؟</ShadcnAccordionTrigger>
        </ShadcnAccordionHeading>
        <ShadcnAccordionContent styleProfile="rhea">
          انقر على «نسيت كلمة المرور» في صفحة تسجيل الدخول وسنرسل لك رابطًا لإعادة التعيين.
        </ShadcnAccordionContent>
      </ShadcnAccordionItem>
    </ShadcnAccordionRoot>
  </div>
</template>

<script>
import {
  ShadcnAccordionRoot,
  ShadcnAccordionItem,
  ShadcnAccordionHeading,
  ShadcnAccordionTrigger,
  ShadcnAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAccordionRoot,
    ShadcnAccordionItem,
    ShadcnAccordionHeading,
    ShadcnAccordionTrigger,
    ShadcnAccordionContent,
  },
};
</script>
    `),
    'demo-brutalist-accordion': formatCode(`
<template>
  <BrutalistAccordionRoot :defaultOpenItems="['overview']">
    <BrutalistAccordionItem value="overview">
      <BrutalistAccordionHeading :level="3">
        <BrutalistAccordionTrigger>What are your shipping options?</BrutalistAccordionTrigger>
      </BrutalistAccordionHeading>
      <BrutalistAccordionContent>
        We offer standard (5–7 days), express (2–3 days), and overnight shipping.
      </BrutalistAccordionContent>
    </BrutalistAccordionItem>
  </BrutalistAccordionRoot>
</template>

<script>
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistAccordionRoot,
    BrutalistAccordionItem,
    BrutalistAccordionHeading,
    BrutalistAccordionTrigger,
    BrutalistAccordionContent,
  },
};
</script>
    `),
    'demo-brutalist-accordion-basic': formatCode(`
<template>
  <BrutalistAccordionRoot :defaultOpenItems="['item-1']" class="max-w-lg">
    <BrutalistAccordionItem value="item-1">
      <BrutalistAccordionHeading :level="3">
        <BrutalistAccordionTrigger>How do I reset my password?</BrutalistAccordionTrigger>
      </BrutalistAccordionHeading>
      <BrutalistAccordionContent>
        Click on 'Forgot Password' on the login page to receive a 24-hour reset link.
      </BrutalistAccordionContent>
    </BrutalistAccordionItem>
  </BrutalistAccordionRoot>
</template>

<script>
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistAccordionRoot,
    BrutalistAccordionItem,
    BrutalistAccordionHeading,
    BrutalistAccordionTrigger,
    BrutalistAccordionContent,
  },
};
</script>
    `),
    'demo-brutalist-accordion-multiple': formatCode(`
<template>
  <BrutalistAccordionRoot mode="multiple" :defaultOpenItems="['notifications']" class="max-w-lg">
    <BrutalistAccordionItem value="notifications">
      <BrutalistAccordionHeading :level="3">
        <BrutalistAccordionTrigger>Notification Settings</BrutalistAccordionTrigger>
      </BrutalistAccordionHeading>
      <BrutalistAccordionContent>
        Manage email alerts and mobile push notifications.
      </BrutalistAccordionContent>
    </BrutalistAccordionItem>
  </BrutalistAccordionRoot>
</template>

<script>
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistAccordionRoot,
    BrutalistAccordionItem,
    BrutalistAccordionHeading,
    BrutalistAccordionTrigger,
    BrutalistAccordionContent,
  },
};
</script>
    `),
    'demo-brutalist-accordion-disabled': formatCode(`
<template>
  <BrutalistAccordionRoot class="max-w-lg">
    <BrutalistAccordionItem value="item-1">
      <BrutalistAccordionHeading :level="3">
        <BrutalistAccordionTrigger>Can I access my account history?</BrutalistAccordionTrigger>
      </BrutalistAccordionHeading>
      <BrutalistAccordionContent>
        Yes, view transactions and plan changes from your dashboard.
      </BrutalistAccordionContent>
    </BrutalistAccordionItem>
    <BrutalistAccordionItem value="item-2" :disabled="true">
      <BrutalistAccordionHeading :level="3">
        <BrutalistAccordionTrigger>Premium feature information</BrutalistAccordionTrigger>
      </BrutalistAccordionHeading>
      <BrutalistAccordionContent>
        Upgrade your plan to unlock enterprise audit exports.
      </BrutalistAccordionContent>
    </BrutalistAccordionItem>
  </BrutalistAccordionRoot>
</template>

<script>
import {
  BrutalistAccordionRoot,
  BrutalistAccordionItem,
  BrutalistAccordionHeading,
  BrutalistAccordionTrigger,
  BrutalistAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistAccordionRoot,
    BrutalistAccordionItem,
    BrutalistAccordionHeading,
    BrutalistAccordionTrigger,
    BrutalistAccordionContent,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-accordion': formatCode(`
<template>
  <Bootstrap232AccordionRoot :defaultOpenItems="['overview']">
    <Bootstrap232AccordionItem value="overview">
      <Bootstrap232AccordionHeading :level="3">
        <Bootstrap232AccordionTrigger>What are your shipping options?</Bootstrap232AccordionTrigger>
      </Bootstrap232AccordionHeading>
      <Bootstrap232AccordionContent>
        We offer standard (5–7 days), express (2–3 days), and overnight shipping.
      </Bootstrap232AccordionContent>
    </Bootstrap232AccordionItem>
  </Bootstrap232AccordionRoot>
</template>

<script>
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232AccordionRoot,
    Bootstrap232AccordionItem,
    Bootstrap232AccordionHeading,
    Bootstrap232AccordionTrigger,
    Bootstrap232AccordionContent,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-accordion-basic': formatCode(`
<template>
  <Bootstrap232AccordionRoot :defaultOpenItems="['item-1']" class="max-w-lg">
    <Bootstrap232AccordionItem value="item-1">
      <Bootstrap232AccordionHeading :level="3">
        <Bootstrap232AccordionTrigger>Collapsible Group Item #1</Bootstrap232AccordionTrigger>
      </Bootstrap232AccordionHeading>
      <Bootstrap232AccordionContent>
        Classic Bootstrap 2.3.2 collapsible panel with smooth 350ms height transitions.
      </Bootstrap232AccordionContent>
    </Bootstrap232AccordionItem>
  </Bootstrap232AccordionRoot>
</template>

<script>
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232AccordionRoot,
    Bootstrap232AccordionItem,
    Bootstrap232AccordionHeading,
    Bootstrap232AccordionTrigger,
    Bootstrap232AccordionContent,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-accordion-multiple': formatCode(`
<template>
  <Bootstrap232AccordionRoot mode="multiple" :defaultOpenItems="['notifications']" class="max-w-lg">
    <Bootstrap232AccordionItem value="notifications">
      <Bootstrap232AccordionHeading :level="3">
        <Bootstrap232AccordionTrigger>Notification Settings</Bootstrap232AccordionTrigger>
      </Bootstrap232AccordionHeading>
      <Bootstrap232AccordionContent>
        Configure email digests, release announcements, and real-time webhook alerts.
      </Bootstrap232AccordionContent>
    </Bootstrap232AccordionItem>
  </Bootstrap232AccordionRoot>
</template>

<script>
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232AccordionRoot,
    Bootstrap232AccordionItem,
    Bootstrap232AccordionHeading,
    Bootstrap232AccordionTrigger,
    Bootstrap232AccordionContent,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-accordion-disabled': formatCode(`
<template>
  <Bootstrap232AccordionRoot class="max-w-lg">
    <Bootstrap232AccordionItem value="item-1">
      <Bootstrap232AccordionHeading :level="3">
        <Bootstrap232AccordionTrigger>Can I access my account history?</Bootstrap232AccordionTrigger>
      </Bootstrap232AccordionHeading>
      <Bootstrap232AccordionContent>
        Yes, all billing statements and activity logs remain accessible from your dashboard.
      </Bootstrap232AccordionContent>
    </Bootstrap232AccordionItem>
    <Bootstrap232AccordionItem value="item-2" :disabled="true">
      <Bootstrap232AccordionHeading :level="3">
        <Bootstrap232AccordionTrigger>Premium feature information</Bootstrap232AccordionTrigger>
      </Bootstrap232AccordionHeading>
      <Bootstrap232AccordionContent>
        Upgrade your plan to unlock enterprise reporting.
      </Bootstrap232AccordionContent>
    </Bootstrap232AccordionItem>
  </Bootstrap232AccordionRoot>
</template>

<script>
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232AccordionRoot,
    Bootstrap232AccordionItem,
    Bootstrap232AccordionHeading,
    Bootstrap232AccordionTrigger,
    Bootstrap232AccordionContent,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-accordion-rtl': formatCode(`
<template>
  <div dir="rtl" class="max-w-md">
    <Bootstrap232AccordionRoot direction="rtl" :defaultOpenItems="['item-1']">
      <Bootstrap232AccordionItem value="item-1">
        <Bootstrap232AccordionHeading :level="3">
          <Bootstrap232AccordionTrigger>كيف يمكنني إعادة تعيين كلمة المرور؟</Bootstrap232AccordionTrigger>
        </Bootstrap232AccordionHeading>
        <Bootstrap232AccordionContent>
          انقر على «نسيت كلمة المرور» في صفحة تسجيل الدخول وسنرسل لك رابطًا لإعادة التعيين.
        </Bootstrap232AccordionContent>
      </Bootstrap232AccordionItem>
    </Bootstrap232AccordionRoot>
  </div>
</template>

<script>
import {
  Bootstrap232AccordionRoot,
  Bootstrap232AccordionItem,
  Bootstrap232AccordionHeading,
  Bootstrap232AccordionTrigger,
  Bootstrap232AccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232AccordionRoot,
    Bootstrap232AccordionItem,
    Bootstrap232AccordionHeading,
    Bootstrap232AccordionTrigger,
    Bootstrap232AccordionContent,
  },
};
</script>
    `),
    'demo-liquid-glass-accordion': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassAccordionRoot :defaultOpenItems="['overview']">
      <LiquidGlassAccordionItem value="overview">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger>What are your shipping options?</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          We offer standard (5–7 days), express (2–3 days), and overnight shipping.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
    </LiquidGlassAccordionRoot>
  </div>
</template>

<script>
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassAccordionRoot,
    LiquidGlassAccordionItem,
    LiquidGlassAccordionHeading,
    LiquidGlassAccordionTrigger,
    LiquidGlassAccordionContent,
  },
};
</script>
    `),
    'demo-liquid-glass-accordion-basic': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassAccordionRoot :defaultOpenItems="['item-1']">
      <LiquidGlassAccordionItem value="item-1">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger>How do I reset my password?</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Click on 'Forgot Password' on the login page to receive a 24-hour reset link.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
    </LiquidGlassAccordionRoot>
  </div>
</template>

<script>
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassAccordionRoot,
    LiquidGlassAccordionItem,
    LiquidGlassAccordionHeading,
    LiquidGlassAccordionTrigger,
    LiquidGlassAccordionContent,
  },
};
</script>
    `),
    'demo-liquid-glass-accordion-multiple': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassAccordionRoot mode="multiple" :defaultOpenItems="['notifications']">
      <LiquidGlassAccordionItem value="notifications">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger>Notification Settings</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Enable email alerts for account updates or push notifications for mobile devices.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
    </LiquidGlassAccordionRoot>
  </div>
</template>

<script>
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassAccordionRoot,
    LiquidGlassAccordionItem,
    LiquidGlassAccordionHeading,
    LiquidGlassAccordionTrigger,
    LiquidGlassAccordionContent,
  },
};
</script>
    `),
    'demo-liquid-glass-accordion-disabled': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassAccordionRoot>
      <LiquidGlassAccordionItem value="item-1">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger>Can I access my account history?</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Yes, your complete transaction and support history is available in the dashboard.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
      <LiquidGlassAccordionItem value="item-2" :disabled="true">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger>Premium feature information</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Upgrade your plan to access premium controls.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
    </LiquidGlassAccordionRoot>
  </div>
</template>

<script>
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassAccordionRoot,
    LiquidGlassAccordionItem,
    LiquidGlassAccordionHeading,
    LiquidGlassAccordionTrigger,
    LiquidGlassAccordionContent,
  },
};
</script>
    `),
    'demo-liquid-glass-accordion-prominence': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassAccordionRoot mode="multiple" :defaultOpenItems="['prominent']">
      <LiquidGlassAccordionItem value="regular">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger prominence="regular" material="auto">Regular glass trigger</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Standard Liquid Glass translucency over an opaque readable panel.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
      <LiquidGlassAccordionItem value="prominent">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger prominence="prominent" material="auto">Prominent glass trigger</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Primary tint prominence for high-emphasis collapsible sections.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
      <LiquidGlassAccordionItem value="opaque">
        <LiquidGlassAccordionHeading :level="3">
          <LiquidGlassAccordionTrigger material="opaque">Opaque fallback opt-out</LiquidGlassAccordionTrigger>
        </LiquidGlassAccordionHeading>
        <LiquidGlassAccordionContent>
          Withdraws optical candidates when a solid opaque surface is preferred.
        </LiquidGlassAccordionContent>
      </LiquidGlassAccordionItem>
    </LiquidGlassAccordionRoot>
  </div>
</template>

<script>
import {
  LiquidGlassAccordionRoot,
  LiquidGlassAccordionItem,
  LiquidGlassAccordionHeading,
  LiquidGlassAccordionTrigger,
  LiquidGlassAccordionContent,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassAccordionRoot,
    LiquidGlassAccordionItem,
    LiquidGlassAccordionHeading,
    LiquidGlassAccordionTrigger,
    LiquidGlassAccordionContent,
  },
};
</script>
    `),
  },
};
