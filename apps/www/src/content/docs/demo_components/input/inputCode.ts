import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-input': formatCode(`
<div id="shadcn-input-demo" class="flex w-full max-w-sm flex-col gap-5">
  <div class="flex flex-col gap-2">
    <div class="text-sm font-medium">API Key</div>
    <proto-ui-shadcn-input-root></proto-ui-shadcn-input-root>
    <div class="text-xs text-muted-foreground">Your API key is encrypted and stored securely.</div>
  </div>
  <div class="flex flex-col gap-2">
    <div class="text-sm font-medium">Email</div>
    <proto-ui-shadcn-input-root></proto-ui-shadcn-input-root>
  </div>
  <div class="flex flex-col gap-2">
    <div class="text-sm font-medium">Workspace URL</div>
    <proto-ui-shadcn-input-root></proto-ui-shadcn-input-root>
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const props = [
    { styleProfile: 'rhea', defaultValue: 'sk-live-9f8e7d6c', placeholder: 'sk-...', ariaLabel: 'API Key', autoComplete: 'off' },
    { styleProfile: 'rhea', defaultValue: 'jordan@example.com', disabled: true, inputMode: 'email', ariaLabel: 'Email' },
    { styleProfile: 'rhea', defaultValue: 'https://app.example.com/acme', readOnly: true, inputMode: 'url', ariaLabel: 'Workspace URL' },
  ];
  document.querySelectorAll('#shadcn-input-demo proto-ui-shadcn-input-root').forEach((el, index) => {
    setElementProps(el, props[index]);
  });
</script>
    `),
    'demo-shadcn-input-basic': formatCode(`
<proto-ui-shadcn-input-root id="shadcn-input-basic"></proto-ui-shadcn-input-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#shadcn-input-basic'), {
    styleProfile: 'rhea',
    placeholder: 'Enter text',
    ariaLabel: 'Text input',
  });
</script>
    `),
    'demo-shadcn-input-field': formatCode(`
<proto-ui-shadcn-field-root id="shadcn-input-field">
  <proto-ui-shadcn-field-label>Username</proto-ui-shadcn-field-label>
  <proto-ui-shadcn-field-control></proto-ui-shadcn-field-control>
  <proto-ui-shadcn-field-description>Choose a unique username for your account.</proto-ui-shadcn-field-description>
</proto-ui-shadcn-field-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#shadcn-input-field proto-ui-shadcn-field-control'), {
    styleProfile: 'rhea',
    placeholder: 'Enter your username',
    autoComplete: 'username',
  });
</script>
    `),
    'demo-shadcn-input-disabled': formatCode(`
<proto-ui-shadcn-field-root id="shadcn-input-disabled">
  <proto-ui-shadcn-field-label>Email</proto-ui-shadcn-field-label>
  <proto-ui-shadcn-field-control></proto-ui-shadcn-field-control>
  <proto-ui-shadcn-field-description>This field is currently disabled.</proto-ui-shadcn-field-description>
</proto-ui-shadcn-field-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#shadcn-input-disabled');
  setElementProps(root, { disabled: true });
  setElementProps(root.querySelector('proto-ui-shadcn-field-control'), {
    styleProfile: 'rhea',
    placeholder: 'Email',
    inputMode: 'email',
    disabled: true,
  });
</script>
    `),
    'demo-shadcn-input-invalid': formatCode(`
<proto-ui-shadcn-field-root id="shadcn-input-invalid">
  <proto-ui-shadcn-field-label>Invalid Input</proto-ui-shadcn-field-label>
  <proto-ui-shadcn-field-control></proto-ui-shadcn-field-control>
  <proto-ui-shadcn-field-error>This field contains validation errors.</proto-ui-shadcn-field-error>
</proto-ui-shadcn-field-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#shadcn-input-invalid');
  setElementProps(root, { invalid: true, errors: ['This field contains validation errors.'] });
  setElementProps(root.querySelector('proto-ui-shadcn-field-control'), {
    styleProfile: 'rhea',
    defaultValue: 'sk-invalid',
    placeholder: 'Error',
  });
</script>
    `),
    'demo-shadcn-input-inline': formatCode(`
<div class="flex w-full max-w-sm items-center gap-2">
  <proto-ui-shadcn-input-root id="shadcn-input-search"></proto-ui-shadcn-input-root>
  <proto-ui-shadcn-button id="shadcn-input-search-btn">Search</proto-ui-shadcn-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#shadcn-input-search'), {
    styleProfile: 'rhea',
    placeholder: 'Search...',
    inputMode: 'search',
    enterKeyHint: 'search',
    ariaLabel: 'Search',
  });
  setElementProps(document.querySelector('#shadcn-input-search-btn'), { styleProfile: 'rhea' });
</script>
    `),
    'demo-shadcn-input-form': formatCode(`
<div class="flex w-full max-w-sm flex-col gap-4">
  <div class="grid grid-cols-2 gap-4">
    <div class="flex flex-col gap-2">
      <proto-ui-shadcn-label-root>First Name</proto-ui-shadcn-label-root>
      <proto-ui-shadcn-input-root id="form-first-name"></proto-ui-shadcn-input-root>
    </div>
    <div class="flex flex-col gap-2">
      <proto-ui-shadcn-label-root>Last Name</proto-ui-shadcn-label-root>
      <proto-ui-shadcn-input-root id="form-last-name"></proto-ui-shadcn-input-root>
    </div>
  </div>
  <proto-ui-shadcn-field-root id="form-email-field">
    <proto-ui-shadcn-field-label>Email</proto-ui-shadcn-field-label>
    <proto-ui-shadcn-field-control></proto-ui-shadcn-field-control>
    <proto-ui-shadcn-field-description>We will send updates to this address.</proto-ui-shadcn-field-description>
  </proto-ui-shadcn-field-root>
  <div class="flex items-center gap-2">
    <proto-ui-shadcn-button id="form-cancel">Cancel</proto-ui-shadcn-button>
    <proto-ui-shadcn-button id="form-submit">Submit</proto-ui-shadcn-button>
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#form-first-name'), { styleProfile: 'rhea', placeholder: 'Jordan', name: 'firstName', required: true });
  setElementProps(document.querySelector('#form-last-name'), { styleProfile: 'rhea', placeholder: 'Lee', name: 'lastName', required: true });
  setElementProps(document.querySelector('#form-email-field'), { required: true });
  setElementProps(document.querySelector('#form-email-field proto-ui-shadcn-field-control'), { styleProfile: 'rhea', placeholder: 'name@example.com', inputMode: 'email', required: true });
  setElementProps(document.querySelector('#form-cancel'), { styleProfile: 'rhea', variant: 'outline' });
  setElementProps(document.querySelector('#form-submit'), { styleProfile: 'rhea' });
</script>
    `),
    'demo-brutalist-input': formatCode(`
<div id="brutalist-input-demo" class="flex w-full max-w-sm flex-col gap-5">
  <div class="flex flex-col gap-2">
    <div class="text-sm font-medium">Email</div>
    <proto-ui-brutalist-input-root></proto-ui-brutalist-input-root>
    <div class="text-xs text-muted-foreground">We will send account notifications to this address.</div>
  </div>
  <div class="flex flex-col gap-2">
    <div class="text-sm font-medium">Disabled</div>
    <proto-ui-brutalist-input-root></proto-ui-brutalist-input-root>
  </div>
  <div class="flex flex-col gap-2">
    <div class="text-sm font-medium">Read only</div>
    <proto-ui-brutalist-input-root></proto-ui-brutalist-input-root>
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const props = [
    { defaultValue: 'alex@example.com', placeholder: 'Email', inputMode: 'email', ariaLabel: 'Email' },
    { defaultValue: 'Disabled field', disabled: true, ariaLabel: 'Disabled example' },
    { defaultValue: 'https://app.example.com/acme', readOnly: true, inputMode: 'url', ariaLabel: 'Read-only example' },
  ];
  document.querySelectorAll('#brutalist-input-demo proto-ui-brutalist-input-root').forEach((el, index) => {
    setElementProps(el, props[index]);
  });
</script>
    `),
    'demo-brutalist-input-basic': formatCode(`
<proto-ui-brutalist-input-root id="brutalist-input-basic"></proto-ui-brutalist-input-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-input-basic'), {
    placeholder: 'Email',
    inputMode: 'email',
    ariaLabel: 'Email',
  });
</script>
    `),
    'demo-brutalist-input-disabled': formatCode(`
<proto-ui-brutalist-input-root id="brutalist-input-disabled"></proto-ui-brutalist-input-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-input-disabled'), {
    placeholder: 'Email',
    inputMode: 'email',
    disabled: true,
    ariaLabel: 'Disabled email',
  });
</script>
    `),
    'demo-brutalist-input-with-label': formatCode(`
<div class="grid w-full max-w-sm items-center gap-2">
  <proto-ui-brutalist-label-root>Email</proto-ui-brutalist-label-root>
  <proto-ui-brutalist-input-root id="brutalist-input-email"></proto-ui-brutalist-input-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-input-email'), {
    placeholder: 'Email',
    inputMode: 'email',
    autoComplete: 'email',
  });
</script>
    `),
    'demo-brutalist-input-with-button': formatCode(`
<div class="flex w-full max-w-sm items-center gap-2">
  <proto-ui-brutalist-input-root id="brutalist-input-subscribe"></proto-ui-brutalist-input-root>
  <proto-ui-brutalist-button>Subscribe</proto-ui-brutalist-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-input-subscribe'), {
    placeholder: 'Email',
    inputMode: 'email',
    enterKeyHint: 'send',
    ariaLabel: 'Email',
  });
</script>
    `),
    'demo-bootstrap-2-3-2-input': formatCode(`
<div id="bs2-input-demo" class="flex w-full max-w-md flex-col gap-4">
  <div class="flex flex-col gap-1">
    <div class="text-sm font-medium">Project name</div>
    <proto-ui-bootstrap-2-3-2-input-root></proto-ui-bootstrap-2-3-2-input-root>
    <div class="text-xs text-muted-foreground">Shown in navigation headers and workspace links.</div>
  </div>
  <div class="flex flex-col gap-1">
    <div class="text-sm font-medium">Disabled</div>
    <proto-ui-bootstrap-2-3-2-input-root></proto-ui-bootstrap-2-3-2-input-root>
  </div>
  <div class="flex flex-col gap-1">
    <div class="text-sm font-medium">Read only</div>
    <proto-ui-bootstrap-2-3-2-input-root></proto-ui-bootstrap-2-3-2-input-root>
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const props = [
    { defaultValue: 'Proto UI', placeholder: 'Name this project', ariaLabel: 'Project name', name: 'project-name', maxLength: 80 },
    { defaultValue: 'Archived workspace', disabled: true, ariaLabel: 'Disabled project name' },
    { defaultValue: 'https://example.com/proto-ui', readOnly: true, inputMode: 'url', ariaLabel: 'Read-only workspace URL' },
  ];
  document.querySelectorAll('#bs2-input-demo proto-ui-bootstrap-2-3-2-input-root').forEach((el, index) => {
    setElementProps(el, props[index]);
  });
</script>
    `),
    'demo-bootstrap-2-3-2-input-basic': formatCode(`
<proto-ui-bootstrap-2-3-2-input-root id="bs2-input-basic"></proto-ui-bootstrap-2-3-2-input-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs2-input-basic'), {
    placeholder: 'Type something...',
    ariaLabel: 'Basic input',
  });
</script>
    `),
    'demo-bootstrap-2-3-2-input-field': formatCode(`
<proto-ui-bootstrap-2-3-2-field-root id="bs2-input-field">
  <proto-ui-bootstrap-2-3-2-field-label>Username</proto-ui-bootstrap-2-3-2-field-label>
  <proto-ui-bootstrap-2-3-2-field-control></proto-ui-bootstrap-2-3-2-field-control>
  <proto-ui-bootstrap-2-3-2-field-description>Choose a unique username for your account.</proto-ui-bootstrap-2-3-2-field-description>
</proto-ui-bootstrap-2-3-2-field-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs2-input-field proto-ui-bootstrap-2-3-2-field-control'), {
    placeholder: 'Enter your username',
    autoComplete: 'username',
  });
</script>
    `),
    'demo-bootstrap-2-3-2-input-invalid': formatCode(`
<proto-ui-bootstrap-2-3-2-field-root id="bs2-input-invalid">
  <proto-ui-bootstrap-2-3-2-field-label>Input with error</proto-ui-bootstrap-2-3-2-field-label>
  <proto-ui-bootstrap-2-3-2-field-control></proto-ui-bootstrap-2-3-2-field-control>
  <proto-ui-bootstrap-2-3-2-field-error>Please correct the error.</proto-ui-bootstrap-2-3-2-field-error>
</proto-ui-bootstrap-2-3-2-field-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#bs2-input-invalid');
  setElementProps(root, { invalid: true, errors: ['Please correct the error.'] });
  setElementProps(root.querySelector('proto-ui-bootstrap-2-3-2-field-control'), {
    defaultValue: 'invalid-handle',
    placeholder: 'Username',
  });
</script>
    `),
    'demo-bootstrap-2-3-2-input-inline': formatCode(`
<div class="flex w-full max-w-md items-start gap-2">
  <proto-ui-bootstrap-2-3-2-input-root id="bs2-input-search"></proto-ui-bootstrap-2-3-2-input-root>
  <proto-ui-bootstrap-2-3-2-button>Search</proto-ui-bootstrap-2-3-2-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs2-input-search'), {
    placeholder: 'Search...',
    inputMode: 'search',
    enterKeyHint: 'search',
    ariaLabel: 'Search',
  });
</script>
    `),
    'demo-liquid-glass-input': formatCode(`
<div id="lg-input-demo" class="grid w-full max-w-xl gap-4 rounded-2xl bg-background/95 p-5 shadow-sm">
  <div class="grid gap-2">
    <proto-ui-liquid-glass-label-root>Display name</proto-ui-liquid-glass-label-root>
    <proto-ui-liquid-glass-input-root></proto-ui-liquid-glass-input-root>
  </div>
  <div class="grid gap-2">
    <proto-ui-liquid-glass-label-root>Account email</proto-ui-liquid-glass-label-root>
    <proto-ui-liquid-glass-input-root></proto-ui-liquid-glass-input-root>
  </div>
  <div class="grid gap-2">
    <proto-ui-liquid-glass-label-root>Workspace URL</proto-ui-liquid-glass-label-root>
    <proto-ui-liquid-glass-input-root></proto-ui-liquid-glass-input-root>
  </div>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const props = [
    { defaultValue: 'Jordan Lee', placeholder: 'Enter your display name' },
    { defaultValue: 'jordan@example.com', inputMode: 'email', disabled: true },
    { defaultValue: 'https://app.example.com/acme', inputMode: 'url', readOnly: true },
  ];
  document.querySelectorAll('#lg-input-demo proto-ui-liquid-glass-input-root').forEach((el, index) => {
    setElementProps(el, props[index]);
  });
</script>
    `),
    'demo-liquid-glass-input-basic': formatCode(`
<proto-ui-liquid-glass-input-root id="lg-input-basic"></proto-ui-liquid-glass-input-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-input-basic'), {
    placeholder: 'Enter text',
    ariaLabel: 'Text input',
  });
</script>
    `),
    'demo-liquid-glass-input-field': formatCode(`
<proto-ui-liquid-glass-field-root id="lg-input-field">
  <proto-ui-liquid-glass-field-label>Username</proto-ui-liquid-glass-field-label>
  <proto-ui-liquid-glass-field-control></proto-ui-liquid-glass-field-control>
  <proto-ui-liquid-glass-field-description>Choose a unique username for your account.</proto-ui-liquid-glass-field-description>
</proto-ui-liquid-glass-field-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-input-field proto-ui-liquid-glass-field-control'), {
    placeholder: 'Enter your username',
    autoComplete: 'username',
  });
</script>
    `),
    'demo-liquid-glass-input-invalid': formatCode(`
<proto-ui-liquid-glass-field-root id="lg-input-invalid">
  <proto-ui-liquid-glass-field-label>Invalid Input</proto-ui-liquid-glass-field-label>
  <proto-ui-liquid-glass-field-control></proto-ui-liquid-glass-field-control>
  <proto-ui-liquid-glass-field-error>This field contains validation errors.</proto-ui-liquid-glass-field-error>
</proto-ui-liquid-glass-field-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#lg-input-invalid');
  setElementProps(root, { invalid: true, errors: ['This field contains validation errors.'] });
  setElementProps(root.querySelector('proto-ui-liquid-glass-field-control'), {
    defaultValue: 'invalid-value',
    placeholder: 'Error',
  });
</script>
    `),
    'demo-liquid-glass-input-inline': formatCode(`
<div class="flex items-center gap-3">
  <proto-ui-liquid-glass-input-root id="lg-input-search"></proto-ui-liquid-glass-input-root>
  <proto-ui-liquid-glass-button>Search</proto-ui-liquid-glass-button>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-input-search'), {
    placeholder: 'Search...',
    inputMode: 'search',
    enterKeyHint: 'search',
    ariaLabel: 'Search',
  });
</script>
    `),
  },
  react: {
    'demo-shadcn-input': formatCode(`
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';

export function InputDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">API Key</div>
        <ShadcnInputRoot
          styleProfile="rhea"
          defaultValue="sk-live-9f8e7d6c"
          placeholder="sk-..."
          ariaLabel="API Key"
          autoComplete="off"
        />
        <div className="text-xs text-muted-foreground">
          Your API key is encrypted and stored securely.
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Email</div>
        <ShadcnInputRoot
          styleProfile="rhea"
          defaultValue="jordan@example.com"
          inputMode="email"
          disabled
          ariaLabel="Email"
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Workspace URL</div>
        <ShadcnInputRoot
          styleProfile="rhea"
          defaultValue="https://app.example.com/acme"
          inputMode="url"
          readOnly
          ariaLabel="Workspace URL"
        />
      </div>
    </div>
  );
}
    `),
    'demo-shadcn-input-basic': formatCode(`
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';

export function InputBasic() {
  return <ShadcnInputRoot styleProfile="rhea" placeholder="Enter text" ariaLabel="Text input" />;
}
    `),
    'demo-shadcn-input-field': formatCode(`
import {
  ShadcnFieldControl,
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
} from '@/components/ui/shadcn-field';

export function InputField() {
  return (
    <ShadcnFieldRoot>
      <ShadcnFieldLabel>Username</ShadcnFieldLabel>
      <ShadcnFieldControl
        styleProfile="rhea"
        placeholder="Enter your username"
        autoComplete="username"
      />
      <ShadcnFieldDescription>
        Choose a unique username for your account.
      </ShadcnFieldDescription>
    </ShadcnFieldRoot>
  );
}
    `),
    'demo-shadcn-input-disabled': formatCode(`
import {
  ShadcnFieldControl,
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
} from '@/components/ui/shadcn-field';

export function InputDisabled() {
  return (
    <ShadcnFieldRoot disabled>
      <ShadcnFieldLabel>Email</ShadcnFieldLabel>
      <ShadcnFieldControl
        styleProfile="rhea"
        placeholder="Email"
        inputMode="email"
        disabled
      />
      <ShadcnFieldDescription>This field is currently disabled.</ShadcnFieldDescription>
    </ShadcnFieldRoot>
  );
}
    `),
    'demo-shadcn-input-invalid': formatCode(`
import {
  ShadcnFieldControl,
  ShadcnFieldError,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
} from '@/components/ui/shadcn-field';

export function InputInvalid() {
  return (
    <ShadcnFieldRoot invalid errors={['This field contains validation errors.']}>
      <ShadcnFieldLabel>Invalid Input</ShadcnFieldLabel>
      <ShadcnFieldControl styleProfile="rhea" defaultValue="sk-invalid" placeholder="Error" />
      <ShadcnFieldError>This field contains validation errors.</ShadcnFieldError>
    </ShadcnFieldRoot>
  );
}
    `),
    'demo-shadcn-input-inline': formatCode(`
import { ShadcnButton } from '@/components/ui/shadcn-button';
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';

export function InputInline() {
  return (
    <div className="flex w-full max-w-sm items-center gap-2">
      <ShadcnInputRoot
        styleProfile="rhea"
        placeholder="Search..."
        inputMode="search"
        enterKeyHint="search"
        ariaLabel="Search"
      />
      <ShadcnButton styleProfile="rhea">Search</ShadcnButton>
    </div>
  );
}
    `),
    'demo-shadcn-input-form': formatCode(`
import { ShadcnButton } from '@/components/ui/shadcn-button';
import {
  ShadcnFieldControl,
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
} from '@/components/ui/shadcn-field';
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';
import { ShadcnLabelRoot } from '@/components/ui/shadcn-label';

export function InputForm() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <ShadcnLabelRoot>First Name</ShadcnLabelRoot>
          <ShadcnInputRoot styleProfile="rhea" placeholder="Jordan" name="firstName" required />
        </div>
        <div className="flex flex-col gap-2">
          <ShadcnLabelRoot>Last Name</ShadcnLabelRoot>
          <ShadcnInputRoot styleProfile="rhea" placeholder="Lee" name="lastName" required />
        </div>
      </div>
      <ShadcnFieldRoot required>
        <ShadcnFieldLabel>Email</ShadcnFieldLabel>
        <ShadcnFieldControl
          styleProfile="rhea"
          placeholder="name@example.com"
          name="email"
          inputMode="email"
          required
        />
        <ShadcnFieldDescription>We will send updates to this address.</ShadcnFieldDescription>
      </ShadcnFieldRoot>
      <div className="flex items-center gap-2">
        <ShadcnButton styleProfile="rhea" variant="outline">Cancel</ShadcnButton>
        <ShadcnButton styleProfile="rhea">Submit</ShadcnButton>
      </div>
    </div>
  );
}
    `),
    'demo-brutalist-input': formatCode(`
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';

export function BrutalistInputDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Email</div>
        <BrutalistInputRoot defaultValue="alex@example.com" placeholder="Email" inputMode="email" ariaLabel="Email" />
        <div className="text-xs text-muted-foreground">We will send account notifications to this address.</div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Disabled</div>
        <BrutalistInputRoot defaultValue="Disabled field" disabled ariaLabel="Disabled example" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Read only</div>
        <BrutalistInputRoot defaultValue="https://app.example.com/acme" readOnly inputMode="url" ariaLabel="Read-only example" />
      </div>
    </div>
  );
}
    `),
    'demo-brutalist-input-basic': formatCode(`
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';

export function BrutalistInputBasic() {
  return <BrutalistInputRoot placeholder="Email" inputMode="email" ariaLabel="Email" />;
}
    `),
    'demo-brutalist-input-disabled': formatCode(`
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';

export function BrutalistInputDisabled() {
  return <BrutalistInputRoot placeholder="Email" inputMode="email" disabled ariaLabel="Disabled email" />;
}
    `),
    'demo-brutalist-input-with-label': formatCode(`
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';
import { BrutalistLabelRoot } from '@/components/ui/brutalist-label';

export function BrutalistInputWithLabel() {
  return (
    <div className="grid w-full max-w-sm items-center gap-2">
      <BrutalistLabelRoot>Email</BrutalistLabelRoot>
      <BrutalistInputRoot placeholder="Email" inputMode="email" autoComplete="email" />
    </div>
  );
}
    `),
    'demo-brutalist-input-with-button': formatCode(`
import { BrutalistButton } from '@/components/ui/brutalist-button';
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';

export function BrutalistInputWithButton() {
  return (
    <div className="flex w-full max-w-sm items-center gap-2">
      <BrutalistInputRoot placeholder="Email" inputMode="email" enterKeyHint="send" ariaLabel="Email" />
      <BrutalistButton>Subscribe</BrutalistButton>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-input': formatCode(`
import { Bootstrap232InputRoot } from '@/components/ui/bootstrap-2-3-2-input';

export function BootstrapInputDemo() {
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <Bootstrap232InputRoot defaultValue="Proto UI" placeholder="Name this project" ariaLabel="Project name" />
      <Bootstrap232InputRoot defaultValue="Archived workspace" disabled ariaLabel="Disabled project name" />
      <Bootstrap232InputRoot defaultValue="https://example.com/proto-ui" readOnly inputMode="url" ariaLabel="Read-only workspace URL" />
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-input-basic': formatCode(`
import { Bootstrap232InputRoot } from '@/components/ui/bootstrap-2-3-2-input';

export function BootstrapInputBasic() {
  return <Bootstrap232InputRoot placeholder="Type something..." ariaLabel="Basic input" />;
}
    `),
    'demo-bootstrap-2-3-2-input-field': formatCode(`
import {
  Bootstrap232FieldControl,
  Bootstrap232FieldDescription,
  Bootstrap232FieldLabel,
  Bootstrap232FieldRoot,
} from '@/components/ui/bootstrap-2-3-2-field';

export function BootstrapInputField() {
  return (
    <Bootstrap232FieldRoot>
      <Bootstrap232FieldLabel>Username</Bootstrap232FieldLabel>
      <Bootstrap232FieldControl placeholder="Enter your username" autoComplete="username" />
      <Bootstrap232FieldDescription>Choose a unique username for your account.</Bootstrap232FieldDescription>
    </Bootstrap232FieldRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-input-invalid': formatCode(`
import {
  Bootstrap232FieldControl,
  Bootstrap232FieldError,
  Bootstrap232FieldLabel,
  Bootstrap232FieldRoot,
} from '@/components/ui/bootstrap-2-3-2-field';

export function BootstrapInputInvalid() {
  return (
    <Bootstrap232FieldRoot invalid errors={['Please correct the error.']}>
      <Bootstrap232FieldLabel>Input with error</Bootstrap232FieldLabel>
      <Bootstrap232FieldControl defaultValue="invalid-handle" placeholder="Username" />
      <Bootstrap232FieldError>Please correct the error.</Bootstrap232FieldError>
    </Bootstrap232FieldRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-input-inline': formatCode(`
import { Bootstrap232Button } from '@/components/ui/bootstrap-2-3-2-button';
import { Bootstrap232InputRoot } from '@/components/ui/bootstrap-2-3-2-input';

export function BootstrapInputInline() {
  return (
    <div className="flex w-full max-w-md items-start gap-2">
      <Bootstrap232InputRoot placeholder="Search..." inputMode="search" enterKeyHint="search" ariaLabel="Search" />
      <Bootstrap232Button>Search</Bootstrap232Button>
    </div>
  );
}
    `),
    'demo-liquid-glass-input': formatCode(`
import { LiquidGlassInputRoot } from '@/components/ui/liquid-glass-input';
import { LiquidGlassLabelRoot } from '@/components/ui/liquid-glass-label';

export function LiquidGlassInputDemo() {
  return (
    <div className="grid w-full max-w-xl gap-4 rounded-2xl bg-background/95 p-5 shadow-sm">
      <div className="grid gap-2">
        <LiquidGlassLabelRoot>Display name</LiquidGlassLabelRoot>
        <LiquidGlassInputRoot defaultValue="Jordan Lee" placeholder="Enter your display name" />
      </div>
      <div className="grid gap-2">
        <LiquidGlassLabelRoot>Account email</LiquidGlassLabelRoot>
        <LiquidGlassInputRoot defaultValue="jordan@example.com" inputMode="email" disabled />
      </div>
      <div className="grid gap-2">
        <LiquidGlassLabelRoot>Workspace URL</LiquidGlassLabelRoot>
        <LiquidGlassInputRoot defaultValue="https://app.example.com/acme" inputMode="url" readOnly />
      </div>
    </div>
  );
}
    `),
    'demo-liquid-glass-input-basic': formatCode(`
import { LiquidGlassInputRoot } from '@/components/ui/liquid-glass-input';

export function LiquidGlassInputBasic() {
  return <LiquidGlassInputRoot placeholder="Enter text" ariaLabel="Text input" />;
}
    `),
    'demo-liquid-glass-input-field': formatCode(`
import {
  LiquidGlassFieldControl,
  LiquidGlassFieldDescription,
  LiquidGlassFieldLabel,
  LiquidGlassFieldRoot,
} from '@/components/ui/liquid-glass-field';

export function LiquidGlassInputField() {
  return (
    <LiquidGlassFieldRoot>
      <LiquidGlassFieldLabel>Username</LiquidGlassFieldLabel>
      <LiquidGlassFieldControl placeholder="Enter your username" autoComplete="username" />
      <LiquidGlassFieldDescription>Choose a unique username for your account.</LiquidGlassFieldDescription>
    </LiquidGlassFieldRoot>
  );
}
    `),
    'demo-liquid-glass-input-invalid': formatCode(`
import {
  LiquidGlassFieldControl,
  LiquidGlassFieldError,
  LiquidGlassFieldLabel,
  LiquidGlassFieldRoot,
} from '@/components/ui/liquid-glass-field';

export function LiquidGlassInputInvalid() {
  return (
    <LiquidGlassFieldRoot invalid errors={['This field contains validation errors.']}>
      <LiquidGlassFieldLabel>Invalid Input</LiquidGlassFieldLabel>
      <LiquidGlassFieldControl defaultValue="invalid-value" placeholder="Error" />
      <LiquidGlassFieldError>This field contains validation errors.</LiquidGlassFieldError>
    </LiquidGlassFieldRoot>
  );
}
    `),
    'demo-liquid-glass-input-inline': formatCode(`
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import { LiquidGlassInputRoot } from '@/components/ui/liquid-glass-input';

export function LiquidGlassInputInline() {
  return (
    <div className="flex items-center gap-3">
      <LiquidGlassInputRoot placeholder="Search..." inputMode="search" enterKeyHint="search" ariaLabel="Search" />
      <LiquidGlassButton>Search</LiquidGlassButton>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-input': formatCode(`
<script setup lang="ts">
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';
</script>

<template>
  <div class="flex w-full max-w-sm flex-col gap-5">
    <div class="flex flex-col gap-2">
      <div class="text-sm font-medium">API Key</div>
      <ShadcnInputRoot style-profile="rhea" default-value="sk-live-9f8e7d6c" placeholder="sk-..." aria-label="API Key" auto-complete="off" />
      <div class="text-xs text-muted-foreground">Your API key is encrypted and stored securely.</div>
    </div>
    <div class="flex flex-col gap-2">
      <div class="text-sm font-medium">Email</div>
      <ShadcnInputRoot style-profile="rhea" default-value="jordan@example.com" input-mode="email" :disabled="true" aria-label="Email" />
    </div>
    <div class="flex flex-col gap-2">
      <div class="text-sm font-medium">Workspace URL</div>
      <ShadcnInputRoot style-profile="rhea" default-value="https://app.example.com/acme" input-mode="url" :read-only="true" aria-label="Workspace URL" />
    </div>
  </div>
</template>
    `),
    'demo-shadcn-input-basic': formatCode(`
<script setup lang="ts">
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';
</script>

<template>
  <ShadcnInputRoot style-profile="rhea" placeholder="Enter text" aria-label="Text input" />
</template>
    `),
    'demo-shadcn-input-field': formatCode(`
<script setup lang="ts">
import { ShadcnFieldControl, ShadcnFieldDescription, ShadcnFieldLabel, ShadcnFieldRoot } from '@/components/ui/shadcn-field';
</script>

<template>
  <ShadcnFieldRoot>
    <ShadcnFieldLabel>Username</ShadcnFieldLabel>
    <ShadcnFieldControl style-profile="rhea" placeholder="Enter your username" auto-complete="username" />
    <ShadcnFieldDescription>Choose a unique username for your account.</ShadcnFieldDescription>
  </ShadcnFieldRoot>
</template>
    `),
    'demo-shadcn-input-disabled': formatCode(`
<script setup lang="ts">
import { ShadcnFieldControl, ShadcnFieldDescription, ShadcnFieldLabel, ShadcnFieldRoot } from '@/components/ui/shadcn-field';
</script>

<template>
  <ShadcnFieldRoot :disabled="true">
    <ShadcnFieldLabel>Email</ShadcnFieldLabel>
    <ShadcnFieldControl style-profile="rhea" placeholder="Email" input-mode="email" :disabled="true" />
    <ShadcnFieldDescription>This field is currently disabled.</ShadcnFieldDescription>
  </ShadcnFieldRoot>
</template>
    `),
    'demo-shadcn-input-invalid': formatCode(`
<script setup lang="ts">
import { ShadcnFieldControl, ShadcnFieldError, ShadcnFieldLabel, ShadcnFieldRoot } from '@/components/ui/shadcn-field';
</script>

<template>
  <ShadcnFieldRoot :invalid="true" :errors="['This field contains validation errors.']">
    <ShadcnFieldLabel>Invalid Input</ShadcnFieldLabel>
    <ShadcnFieldControl style-profile="rhea" default-value="sk-invalid" placeholder="Error" />
    <ShadcnFieldError>This field contains validation errors.</ShadcnFieldError>
  </ShadcnFieldRoot>
</template>
    `),
    'demo-shadcn-input-inline': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '@/components/ui/shadcn-button';
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';
</script>

<template>
  <div class="flex w-full max-w-sm items-center gap-2">
    <ShadcnInputRoot style-profile="rhea" placeholder="Search..." input-mode="search" enter-key-hint="search" aria-label="Search" />
    <ShadcnButton style-profile="rhea">Search</ShadcnButton>
  </div>
</template>
    `),
    'demo-shadcn-input-form': formatCode(`
<script setup lang="ts">
import { ShadcnButton } from '@/components/ui/shadcn-button';
import { ShadcnFieldControl, ShadcnFieldDescription, ShadcnFieldLabel, ShadcnFieldRoot } from '@/components/ui/shadcn-field';
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';
import { ShadcnLabelRoot } from '@/components/ui/shadcn-label';
</script>

<template>
  <div class="flex w-full max-w-sm flex-col gap-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <ShadcnLabelRoot>First Name</ShadcnLabelRoot>
        <ShadcnInputRoot style-profile="rhea" placeholder="Jordan" name="firstName" :required="true" />
      </div>
      <div class="flex flex-col gap-2">
        <ShadcnLabelRoot>Last Name</ShadcnLabelRoot>
        <ShadcnInputRoot style-profile="rhea" placeholder="Lee" name="lastName" :required="true" />
      </div>
    </div>
    <ShadcnFieldRoot :required="true">
      <ShadcnFieldLabel>Email</ShadcnFieldLabel>
      <ShadcnFieldControl style-profile="rhea" placeholder="name@example.com" name="email" input-mode="email" :required="true" />
      <ShadcnFieldDescription>We will send updates to this address.</ShadcnFieldDescription>
    </ShadcnFieldRoot>
    <div class="flex items-center gap-2">
      <ShadcnButton style-profile="rhea" variant="outline">Cancel</ShadcnButton>
      <ShadcnButton style-profile="rhea">Submit</ShadcnButton>
    </div>
  </div>
</template>
    `),
    'demo-brutalist-input': formatCode(`
<script setup lang="ts">
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';
</script>

<template>
  <div class="flex w-full max-w-sm flex-col gap-5">
    <BrutalistInputRoot default-value="alex@example.com" placeholder="Email" input-mode="email" aria-label="Email" />
    <BrutalistInputRoot default-value="Disabled field" :disabled="true" aria-label="Disabled example" />
    <BrutalistInputRoot default-value="https://app.example.com/acme" :read-only="true" input-mode="url" aria-label="Read-only example" />
  </div>
</template>
    `),
    'demo-brutalist-input-basic': formatCode(`
<script setup lang="ts">
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';
</script>

<template>
  <BrutalistInputRoot placeholder="Email" input-mode="email" aria-label="Email" />
</template>
    `),
    'demo-brutalist-input-disabled': formatCode(`
<script setup lang="ts">
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';
</script>

<template>
  <BrutalistInputRoot placeholder="Email" input-mode="email" :disabled="true" aria-label="Disabled email" />
</template>
    `),
    'demo-brutalist-input-with-label': formatCode(`
<script setup lang="ts">
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';
import { BrutalistLabelRoot } from '@/components/ui/brutalist-label';
</script>

<template>
  <div class="grid w-full max-w-sm items-center gap-2">
    <BrutalistLabelRoot>Email</BrutalistLabelRoot>
    <BrutalistInputRoot placeholder="Email" input-mode="email" auto-complete="email" />
  </div>
</template>
    `),
    'demo-brutalist-input-with-button': formatCode(`
<script setup lang="ts">
import { BrutalistButton } from '@/components/ui/brutalist-button';
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';
</script>

<template>
  <div class="flex w-full max-w-sm items-center gap-2">
    <BrutalistInputRoot placeholder="Email" input-mode="email" enter-key-hint="send" aria-label="Email" />
    <BrutalistButton>Subscribe</BrutalistButton>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-input': formatCode(`
<script setup lang="ts">
import { Bootstrap232InputRoot } from '@/components/ui/bootstrap-2-3-2-input';
</script>

<template>
  <div class="flex w-full max-w-md flex-col gap-4">
    <Bootstrap232InputRoot default-value="Proto UI" placeholder="Name this project" aria-label="Project name" />
    <Bootstrap232InputRoot default-value="Archived workspace" :disabled="true" aria-label="Disabled project name" />
    <Bootstrap232InputRoot default-value="https://example.com/proto-ui" :read-only="true" input-mode="url" aria-label="Read-only workspace URL" />
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-input-basic': formatCode(`
<script setup lang="ts">
import { Bootstrap232InputRoot } from '@/components/ui/bootstrap-2-3-2-input';
</script>

<template>
  <Bootstrap232InputRoot placeholder="Type something..." aria-label="Basic input" />
</template>
    `),
    'demo-bootstrap-2-3-2-input-field': formatCode(`
<script setup lang="ts">
import { Bootstrap232FieldControl, Bootstrap232FieldDescription, Bootstrap232FieldLabel, Bootstrap232FieldRoot } from '@/components/ui/bootstrap-2-3-2-field';
</script>

<template>
  <Bootstrap232FieldRoot>
    <Bootstrap232FieldLabel>Username</Bootstrap232FieldLabel>
    <Bootstrap232FieldControl placeholder="Enter your username" auto-complete="username" />
    <Bootstrap232FieldDescription>Choose a unique username for your account.</Bootstrap232FieldDescription>
  </Bootstrap232FieldRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-input-invalid': formatCode(`
<script setup lang="ts">
import { Bootstrap232FieldControl, Bootstrap232FieldError, Bootstrap232FieldLabel, Bootstrap232FieldRoot } from '@/components/ui/bootstrap-2-3-2-field';
</script>

<template>
  <Bootstrap232FieldRoot :invalid="true" :errors="['Please correct the error.']">
    <Bootstrap232FieldLabel>Input with error</Bootstrap232FieldLabel>
    <Bootstrap232FieldControl default-value="invalid-handle" placeholder="Username" />
    <Bootstrap232FieldError>Please correct the error.</Bootstrap232FieldError>
  </Bootstrap232FieldRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-input-inline': formatCode(`
<script setup lang="ts">
import { Bootstrap232Button } from '@/components/ui/bootstrap-2-3-2-button';
import { Bootstrap232InputRoot } from '@/components/ui/bootstrap-2-3-2-input';
</script>

<template>
  <div class="flex w-full max-w-md items-start gap-2">
    <Bootstrap232InputRoot placeholder="Search..." input-mode="search" enter-key-hint="search" aria-label="Search" />
    <Bootstrap232Button>Search</Bootstrap232Button>
  </div>
</template>
    `),
    'demo-liquid-glass-input': formatCode(`
<script setup lang="ts">
import { LiquidGlassInputRoot } from '@/components/ui/liquid-glass-input';
import { LiquidGlassLabelRoot } from '@/components/ui/liquid-glass-label';
</script>

<template>
  <div class="grid w-full max-w-xl gap-4 rounded-2xl bg-background/95 p-5 shadow-sm">
    <div class="grid gap-2">
      <LiquidGlassLabelRoot>Display name</LiquidGlassLabelRoot>
      <LiquidGlassInputRoot default-value="Jordan Lee" placeholder="Enter your display name" />
    </div>
    <div class="grid gap-2">
      <LiquidGlassLabelRoot>Account email</LiquidGlassLabelRoot>
      <LiquidGlassInputRoot default-value="jordan@example.com" input-mode="email" :disabled="true" />
    </div>
    <div class="grid gap-2">
      <LiquidGlassLabelRoot>Workspace URL</LiquidGlassLabelRoot>
      <LiquidGlassInputRoot default-value="https://app.example.com/acme" input-mode="url" :read-only="true" />
    </div>
  </div>
</template>
    `),
    'demo-liquid-glass-input-basic': formatCode(`
<script setup lang="ts">
import { LiquidGlassInputRoot } from '@/components/ui/liquid-glass-input';
</script>

<template>
  <LiquidGlassInputRoot placeholder="Enter text" aria-label="Text input" />
</template>
    `),
    'demo-liquid-glass-input-field': formatCode(`
<script setup lang="ts">
import { LiquidGlassFieldControl, LiquidGlassFieldDescription, LiquidGlassFieldLabel, LiquidGlassFieldRoot } from '@/components/ui/liquid-glass-field';
</script>

<template>
  <LiquidGlassFieldRoot>
    <LiquidGlassFieldLabel>Username</LiquidGlassFieldLabel>
    <LiquidGlassFieldControl placeholder="Enter your username" auto-complete="username" />
    <LiquidGlassFieldDescription>Choose a unique username for your account.</LiquidGlassFieldDescription>
  </LiquidGlassFieldRoot>
</template>
    `),
    'demo-liquid-glass-input-invalid': formatCode(`
<script setup lang="ts">
import { LiquidGlassFieldControl, LiquidGlassFieldError, LiquidGlassFieldLabel, LiquidGlassFieldRoot } from '@/components/ui/liquid-glass-field';
</script>

<template>
  <LiquidGlassFieldRoot :invalid="true" :errors="['This field contains validation errors.']">
    <LiquidGlassFieldLabel>Invalid Input</LiquidGlassFieldLabel>
    <LiquidGlassFieldControl default-value="invalid-value" placeholder="Error" />
    <LiquidGlassFieldError>This field contains validation errors.</LiquidGlassFieldError>
  </LiquidGlassFieldRoot>
</template>
    `),
    'demo-liquid-glass-input-inline': formatCode(`
<script setup lang="ts">
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import { LiquidGlassInputRoot } from '@/components/ui/liquid-glass-input';
</script>

<template>
  <div class="flex items-center gap-3">
    <LiquidGlassInputRoot placeholder="Search..." input-mode="search" enter-key-hint="search" aria-label="Search" />
    <LiquidGlassButton>Search</LiquidGlassButton>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-input': formatCode(`
<template>
  <div class="flex w-full max-w-sm flex-col gap-5">
    <ShadcnInputRoot style-profile="rhea" default-value="sk-live-9f8e7d6c" placeholder="sk-..." aria-label="API Key" />
    <ShadcnInputRoot style-profile="rhea" default-value="jordan@example.com" input-mode="email" :disabled="true" aria-label="Email" />
    <ShadcnInputRoot style-profile="rhea" default-value="https://app.example.com/acme" input-mode="url" :read-only="true" aria-label="Workspace URL" />
  </div>
</template>
<script>
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';
export default { components: { ShadcnInputRoot } };
</script>
    `),
    'demo-shadcn-input-basic': formatCode(`
<template>
  <ShadcnInputRoot style-profile="rhea" placeholder="Enter text" aria-label="Text input" />
</template>
<script>
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';
export default { components: { ShadcnInputRoot } };
</script>
    `),
    'demo-shadcn-input-field': formatCode(`
<template>
  <ShadcnFieldRoot>
    <ShadcnFieldLabel>Username</ShadcnFieldLabel>
    <ShadcnFieldControl style-profile="rhea" placeholder="Enter your username" auto-complete="username" />
    <ShadcnFieldDescription>Choose a unique username for your account.</ShadcnFieldDescription>
  </ShadcnFieldRoot>
</template>
<script>
import { ShadcnFieldControl, ShadcnFieldDescription, ShadcnFieldLabel, ShadcnFieldRoot } from '@/components/ui/shadcn-field';
export default { components: { ShadcnFieldRoot, ShadcnFieldLabel, ShadcnFieldControl, ShadcnFieldDescription } };
</script>
    `),
    'demo-shadcn-input-disabled': formatCode(`
<template>
  <ShadcnFieldRoot :disabled="true">
    <ShadcnFieldLabel>Email</ShadcnFieldLabel>
    <ShadcnFieldControl style-profile="rhea" placeholder="Email" input-mode="email" :disabled="true" />
    <ShadcnFieldDescription>This field is currently disabled.</ShadcnFieldDescription>
  </ShadcnFieldRoot>
</template>
<script>
import { ShadcnFieldControl, ShadcnFieldDescription, ShadcnFieldLabel, ShadcnFieldRoot } from '@/components/ui/shadcn-field';
export default { components: { ShadcnFieldRoot, ShadcnFieldLabel, ShadcnFieldControl, ShadcnFieldDescription } };
</script>
    `),
    'demo-shadcn-input-invalid': formatCode(`
<template>
  <ShadcnFieldRoot :invalid="true" :errors="['This field contains validation errors.']">
    <ShadcnFieldLabel>Invalid Input</ShadcnFieldLabel>
    <ShadcnFieldControl style-profile="rhea" default-value="sk-invalid" placeholder="Error" />
    <ShadcnFieldError>This field contains validation errors.</ShadcnFieldError>
  </ShadcnFieldRoot>
</template>
<script>
import { ShadcnFieldControl, ShadcnFieldError, ShadcnFieldLabel, ShadcnFieldRoot } from '@/components/ui/shadcn-field';
export default { components: { ShadcnFieldRoot, ShadcnFieldLabel, ShadcnFieldControl, ShadcnFieldError } };
</script>
    `),
    'demo-shadcn-input-inline': formatCode(`
<template>
  <div class="flex w-full max-w-sm items-center gap-2">
    <ShadcnInputRoot style-profile="rhea" placeholder="Search..." input-mode="search" enter-key-hint="search" aria-label="Search" />
    <ShadcnButton style-profile="rhea">Search</ShadcnButton>
  </div>
</template>
<script>
import { ShadcnButton } from '@/components/ui/shadcn-button';
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';
export default { components: { ShadcnInputRoot, ShadcnButton } };
</script>
    `),
    'demo-shadcn-input-form': formatCode(`
<template>
  <div class="flex w-full max-w-sm flex-col gap-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <ShadcnLabelRoot>First Name</ShadcnLabelRoot>
        <ShadcnInputRoot style-profile="rhea" placeholder="Jordan" name="firstName" :required="true" />
      </div>
      <div class="flex flex-col gap-2">
        <ShadcnLabelRoot>Last Name</ShadcnLabelRoot>
        <ShadcnInputRoot style-profile="rhea" placeholder="Lee" name="lastName" :required="true" />
      </div>
    </div>
    <ShadcnFieldRoot :required="true">
      <ShadcnFieldLabel>Email</ShadcnFieldLabel>
      <ShadcnFieldControl style-profile="rhea" placeholder="name@example.com" name="email" input-mode="email" :required="true" />
      <ShadcnFieldDescription>We will send updates to this address.</ShadcnFieldDescription>
    </ShadcnFieldRoot>
    <div class="flex items-center gap-2">
      <ShadcnButton style-profile="rhea" variant="outline">Cancel</ShadcnButton>
      <ShadcnButton style-profile="rhea">Submit</ShadcnButton>
    </div>
  </div>
</template>
<script>
import { ShadcnButton } from '@/components/ui/shadcn-button';
import { ShadcnFieldControl, ShadcnFieldDescription, ShadcnFieldLabel, ShadcnFieldRoot } from '@/components/ui/shadcn-field';
import { ShadcnInputRoot } from '@/components/ui/shadcn-input';
import { ShadcnLabelRoot } from '@/components/ui/shadcn-label';
export default { components: { ShadcnButton, ShadcnFieldRoot, ShadcnFieldLabel, ShadcnFieldControl, ShadcnFieldDescription, ShadcnInputRoot, ShadcnLabelRoot } };
</script>
    `),
    'demo-brutalist-input': formatCode(`
<template>
  <div class="flex w-full max-w-sm flex-col gap-5">
    <BrutalistInputRoot default-value="alex@example.com" placeholder="Email" input-mode="email" aria-label="Email" />
    <BrutalistInputRoot default-value="Disabled field" :disabled="true" aria-label="Disabled example" />
    <BrutalistInputRoot default-value="https://app.example.com/acme" :read-only="true" input-mode="url" aria-label="Read-only example" />
  </div>
</template>
<script>
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';
export default { components: { BrutalistInputRoot } };
</script>
    `),
    'demo-brutalist-input-basic': formatCode(`
<template>
  <BrutalistInputRoot placeholder="Email" input-mode="email" aria-label="Email" />
</template>
<script>
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';
export default { components: { BrutalistInputRoot } };
</script>
    `),
    'demo-brutalist-input-disabled': formatCode(`
<template>
  <BrutalistInputRoot placeholder="Email" input-mode="email" :disabled="true" aria-label="Disabled email" />
</template>
<script>
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';
export default { components: { BrutalistInputRoot } };
</script>
    `),
    'demo-brutalist-input-with-label': formatCode(`
<template>
  <div class="grid w-full max-w-sm items-center gap-2">
    <BrutalistLabelRoot>Email</BrutalistLabelRoot>
    <BrutalistInputRoot placeholder="Email" input-mode="email" auto-complete="email" />
  </div>
</template>
<script>
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';
import { BrutalistLabelRoot } from '@/components/ui/brutalist-label';
export default { components: { BrutalistInputRoot, BrutalistLabelRoot } };
</script>
    `),
    'demo-brutalist-input-with-button': formatCode(`
<template>
  <div class="flex w-full max-w-sm items-center gap-2">
    <BrutalistInputRoot placeholder="Email" input-mode="email" enter-key-hint="send" aria-label="Email" />
    <BrutalistButton>Subscribe</BrutalistButton>
  </div>
</template>
<script>
import { BrutalistButton } from '@/components/ui/brutalist-button';
import { BrutalistInputRoot } from '@/components/ui/brutalist-input';
export default { components: { BrutalistInputRoot, BrutalistButton } };
</script>
    `),
    'demo-bootstrap-2-3-2-input': formatCode(`
<template>
  <div class="flex w-full max-w-md flex-col gap-4">
    <Bootstrap232InputRoot default-value="Proto UI" placeholder="Name this project" aria-label="Project name" />
    <Bootstrap232InputRoot default-value="Archived workspace" :disabled="true" aria-label="Disabled project name" />
    <Bootstrap232InputRoot default-value="https://example.com/proto-ui" :read-only="true" input-mode="url" aria-label="Read-only workspace URL" />
  </div>
</template>
<script>
import { Bootstrap232InputRoot } from '@/components/ui/bootstrap-2-3-2-input';
export default { components: { Bootstrap232InputRoot } };
</script>
    `),
    'demo-bootstrap-2-3-2-input-basic': formatCode(`
<template>
  <Bootstrap232InputRoot placeholder="Type something..." aria-label="Basic input" />
</template>
<script>
import { Bootstrap232InputRoot } from '@/components/ui/bootstrap-2-3-2-input';
export default { components: { Bootstrap232InputRoot } };
</script>
    `),
    'demo-bootstrap-2-3-2-input-field': formatCode(`
<template>
  <Bootstrap232FieldRoot>
    <Bootstrap232FieldLabel>Username</Bootstrap232FieldLabel>
    <Bootstrap232FieldControl placeholder="Enter your username" auto-complete="username" />
    <Bootstrap232FieldDescription>Choose a unique username for your account.</Bootstrap232FieldDescription>
  </Bootstrap232FieldRoot>
</template>
<script>
import { Bootstrap232FieldControl, Bootstrap232FieldDescription, Bootstrap232FieldLabel, Bootstrap232FieldRoot } from '@/components/ui/bootstrap-2-3-2-field';
export default { components: { Bootstrap232FieldRoot, Bootstrap232FieldLabel, Bootstrap232FieldControl, Bootstrap232FieldDescription } };
</script>
    `),
    'demo-bootstrap-2-3-2-input-invalid': formatCode(`
<template>
  <Bootstrap232FieldRoot :invalid="true" :errors="['Please correct the error.']">
    <Bootstrap232FieldLabel>Input with error</Bootstrap232FieldLabel>
    <Bootstrap232FieldControl default-value="invalid-handle" placeholder="Username" />
    <Bootstrap232FieldError>Please correct the error.</Bootstrap232FieldError>
  </Bootstrap232FieldRoot>
</template>
<script>
import { Bootstrap232FieldControl, Bootstrap232FieldError, Bootstrap232FieldLabel, Bootstrap232FieldRoot } from '@/components/ui/bootstrap-2-3-2-field';
export default { components: { Bootstrap232FieldRoot, Bootstrap232FieldLabel, Bootstrap232FieldControl, Bootstrap232FieldError } };
</script>
    `),
    'demo-bootstrap-2-3-2-input-inline': formatCode(`
<template>
  <div class="flex w-full max-w-md items-start gap-2">
    <Bootstrap232InputRoot placeholder="Search..." input-mode="search" enter-key-hint="search" aria-label="Search" />
    <Bootstrap232Button>Search</Bootstrap232Button>
  </div>
</template>
<script>
import { Bootstrap232Button } from '@/components/ui/bootstrap-2-3-2-button';
import { Bootstrap232InputRoot } from '@/components/ui/bootstrap-2-3-2-input';
export default { components: { Bootstrap232InputRoot, Bootstrap232Button } };
</script>
    `),
    'demo-liquid-glass-input': formatCode(`
<template>
  <div class="grid w-full max-w-xl gap-4 rounded-2xl bg-background/95 p-5 shadow-sm">
    <LiquidGlassInputRoot default-value="Jordan Lee" placeholder="Enter your display name" />
    <LiquidGlassInputRoot default-value="jordan@example.com" input-mode="email" :disabled="true" />
    <LiquidGlassInputRoot default-value="https://app.example.com/acme" input-mode="url" :read-only="true" />
  </div>
</template>
<script>
import { LiquidGlassInputRoot } from '@/components/ui/liquid-glass-input';
export default { components: { LiquidGlassInputRoot } };
</script>
    `),
    'demo-liquid-glass-input-basic': formatCode(`
<template>
  <LiquidGlassInputRoot placeholder="Enter text" aria-label="Text input" />
</template>
<script>
import { LiquidGlassInputRoot } from '@/components/ui/liquid-glass-input';
export default { components: { LiquidGlassInputRoot } };
</script>
    `),
    'demo-liquid-glass-input-field': formatCode(`
<template>
  <LiquidGlassFieldRoot>
    <LiquidGlassFieldLabel>Username</LiquidGlassFieldLabel>
    <LiquidGlassFieldControl placeholder="Enter your username" auto-complete="username" />
    <LiquidGlassFieldDescription>Choose a unique username for your account.</LiquidGlassFieldDescription>
  </LiquidGlassFieldRoot>
</template>
<script>
import { LiquidGlassFieldControl, LiquidGlassFieldDescription, LiquidGlassFieldLabel, LiquidGlassFieldRoot } from '@/components/ui/liquid-glass-field';
export default { components: { LiquidGlassFieldRoot, LiquidGlassFieldLabel, LiquidGlassFieldControl, LiquidGlassFieldDescription } };
</script>
    `),
    'demo-liquid-glass-input-invalid': formatCode(`
<template>
  <LiquidGlassFieldRoot :invalid="true" :errors="['This field contains validation errors.']">
    <LiquidGlassFieldLabel>Invalid Input</LiquidGlassFieldLabel>
    <LiquidGlassFieldControl default-value="invalid-value" placeholder="Error" />
    <LiquidGlassFieldError>This field contains validation errors.</LiquidGlassFieldError>
  </LiquidGlassFieldRoot>
</template>
<script>
import { LiquidGlassFieldControl, LiquidGlassFieldError, LiquidGlassFieldLabel, LiquidGlassFieldRoot } from '@/components/ui/liquid-glass-field';
export default { components: { LiquidGlassFieldRoot, LiquidGlassFieldLabel, LiquidGlassFieldControl, LiquidGlassFieldError } };
</script>
    `),
    'demo-liquid-glass-input-inline': formatCode(`
<template>
  <div class="flex items-center gap-3">
    <LiquidGlassInputRoot placeholder="Search..." input-mode="search" enter-key-hint="search" aria-label="Search" />
    <LiquidGlassButton>Search</LiquidGlassButton>
  </div>
</template>
<script>
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import { LiquidGlassInputRoot } from '@/components/ui/liquid-glass-input';
export default { components: { LiquidGlassInputRoot, LiquidGlassButton } };
</script>
    `),
  },
};
