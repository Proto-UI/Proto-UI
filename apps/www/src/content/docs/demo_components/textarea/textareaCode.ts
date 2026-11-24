import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-textarea': formatCode(`
<wc-shadcn-textarea-root
  style-profile="rhea"
  placeholder="Type your message here."
  aria-label="Message"
  rows="4"
></wc-shadcn-textarea-root>
    `),
    'demo-shadcn-textarea-field': formatCode(`
<wc-shadcn-field-root style-profile="rhea">
  <wc-shadcn-field-label style-profile="rhea">Message</wc-shadcn-field-label>
  <wc-shadcn-field-description style-profile="rhea">Enter your message below.</wc-shadcn-field-description>
  <wc-shadcn-field-textarea
    style-profile="rhea"
    placeholder="Type your message here."
    rows="4"
  ></wc-shadcn-field-textarea>
</wc-shadcn-field-root>
    `),
    'demo-shadcn-textarea-disabled': formatCode(`
<wc-shadcn-field-root style-profile="rhea" disabled>
  <wc-shadcn-field-label style-profile="rhea">Message</wc-shadcn-field-label>
  <wc-shadcn-field-textarea
    style-profile="rhea"
    placeholder="Type your message here."
    rows="3"
  ></wc-shadcn-field-textarea>
</wc-shadcn-field-root>
    `),
    'demo-shadcn-textarea-invalid': formatCode(`
<wc-shadcn-field-root style-profile="rhea" invalid>
  <wc-shadcn-field-label style-profile="rhea">Message</wc-shadcn-field-label>
  <wc-shadcn-field-textarea
    style-profile="rhea"
    placeholder="Type your message here."
    rows="3"
  ></wc-shadcn-field-textarea>
  <wc-shadcn-field-error style-profile="rhea"></wc-shadcn-field-error>
</wc-shadcn-field-root>
    `),
    'demo-shadcn-textarea-button': formatCode(`
<div class="grid w-full max-w-md gap-2">
  <wc-shadcn-textarea-root
    style-profile="rhea"
    placeholder="Type your message here."
    aria-label="Message"
    rows="3"
  ></wc-shadcn-textarea-root>
  <wc-shadcn-button style-profile="rhea">Send message</wc-shadcn-button>
</div>
    `),
    'demo-shadcn-textarea-rtl': formatCode(`
<div dir="rtl" class="w-full max-w-xs">
  <wc-shadcn-field-root style-profile="rhea">
    <wc-shadcn-field-label style-profile="rhea">التعليقات</wc-shadcn-field-label>
    <wc-shadcn-field-textarea
      style-profile="rhea"
      placeholder="تعليقاتك تساعدنا على التحسين..."
      rows="4"
    ></wc-shadcn-field-textarea>
    <wc-shadcn-field-description style-profile="rhea">شاركنا أفكارك حول خدمتنا.</wc-shadcn-field-description>
  </wc-shadcn-field-root>
</div>
    `),
    'demo-brutalist-textarea': formatCode(`
<wc-brutalist-textarea-root
  placeholder="Type your message here."
  aria-label="Message"
  rows="4"
></wc-brutalist-textarea-root>
    `),
    'demo-brutalist-textarea-field': formatCode(`
<wc-brutalist-field-root>
  <wc-brutalist-field-label>Message</wc-brutalist-field-label>
  <wc-brutalist-field-description>Enter your message below.</wc-brutalist-field-description>
  <wc-brutalist-field-textarea
    placeholder="Type your message here."
    rows="4"
  ></wc-brutalist-field-textarea>
</wc-brutalist-field-root>
    `),
    'demo-brutalist-textarea-disabled': formatCode(`
<wc-brutalist-field-root disabled>
  <wc-brutalist-field-label>Message</wc-brutalist-field-label>
  <wc-brutalist-field-textarea
    placeholder="Type your message here."
    rows="3"
  ></wc-brutalist-field-textarea>
</wc-brutalist-field-root>
    `),
    'demo-brutalist-textarea-invalid': formatCode(`
<wc-brutalist-field-root invalid>
  <wc-brutalist-field-label>Message</wc-brutalist-field-label>
  <wc-brutalist-field-textarea
    placeholder="Type your message here."
    rows="3"
  ></wc-brutalist-field-textarea>
  <wc-brutalist-field-error></wc-brutalist-field-error>
</wc-brutalist-field-root>
    `),
    'demo-brutalist-textarea-button': formatCode(`
<div class="grid w-full max-w-md gap-3">
  <wc-brutalist-textarea-root
    placeholder="Type your message here."
    aria-label="Message"
    rows="3"
  ></wc-brutalist-textarea-root>
  <wc-brutalist-button>Send message</wc-brutalist-button>
</div>
    `),
    'demo-bootstrap-2-3-2-textarea': formatCode(`
<wc-bootstrap-2-3-2-textarea-root
  placeholder="Type your message here."
  aria-label="Message"
  rows="4"
></wc-bootstrap-2-3-2-textarea-root>
    `),
    'demo-bootstrap-2-3-2-textarea-field': formatCode(`
<wc-bootstrap-2-3-2-field-root>
  <wc-bootstrap-2-3-2-field-label>Message</wc-bootstrap-2-3-2-field-label>
  <wc-bootstrap-2-3-2-field-textarea
    placeholder="Type your message here."
    rows="4"
  ></wc-bootstrap-2-3-2-field-textarea>
  <wc-bootstrap-2-3-2-field-description>Enter your message below.</wc-bootstrap-2-3-2-field-description>
</wc-bootstrap-2-3-2-field-root>
    `),
    'demo-bootstrap-2-3-2-textarea-disabled': formatCode(`
<wc-bootstrap-2-3-2-field-root disabled>
  <wc-bootstrap-2-3-2-field-label>Message</wc-bootstrap-2-3-2-field-label>
  <wc-bootstrap-2-3-2-field-textarea
    placeholder="Type your message here."
    rows="3"
  ></wc-bootstrap-2-3-2-field-textarea>
</wc-bootstrap-2-3-2-field-root>
    `),
    'demo-bootstrap-2-3-2-textarea-invalid': formatCode(`
<wc-bootstrap-2-3-2-field-root invalid>
  <wc-bootstrap-2-3-2-field-label>Message</wc-bootstrap-2-3-2-field-label>
  <wc-bootstrap-2-3-2-field-textarea
    placeholder="Type your message here."
    rows="3"
  ></wc-bootstrap-2-3-2-field-textarea>
  <wc-bootstrap-2-3-2-field-error></wc-bootstrap-2-3-2-field-error>
</wc-bootstrap-2-3-2-field-root>
    `),
    'demo-bootstrap-2-3-2-textarea-button': formatCode(`
<div class="flex flex-col items-start gap-2">
  <wc-bootstrap-2-3-2-textarea-root
    placeholder="Type your message here."
    aria-label="Message"
    rows="3"
  ></wc-bootstrap-2-3-2-textarea-root>
  <wc-bootstrap-2-3-2-button>Send message</wc-bootstrap-2-3-2-button>
</div>
    `),
    'demo-liquid-glass-textarea': formatCode(`
<div class="grid gap-3 rounded-3xl p-6">
  <wc-liquid-glass-label-root>Message</wc-liquid-glass-label-root>
  <wc-liquid-glass-textarea-root
    placeholder="Type your message here."
    rows="4"
  ></wc-liquid-glass-textarea-root>
</div>
    `),
    'demo-liquid-glass-textarea-field': formatCode(`
<wc-liquid-glass-field-root>
  <wc-liquid-glass-field-label>Message</wc-liquid-glass-field-label>
  <wc-liquid-glass-field-description>Enter your message below.</wc-liquid-glass-field-description>
  <wc-liquid-glass-field-textarea
    placeholder="Type your message here."
    rows="4"
  ></wc-liquid-glass-field-textarea>
</wc-liquid-glass-field-root>
    `),
    'demo-liquid-glass-textarea-disabled': formatCode(`
<wc-liquid-glass-field-root disabled>
  <wc-liquid-glass-field-label>Message</wc-liquid-glass-field-label>
  <wc-liquid-glass-field-textarea
    default-value="This message is archived and cannot be edited."
    rows="3"
  ></wc-liquid-glass-field-textarea>
</wc-liquid-glass-field-root>
    `),
    'demo-liquid-glass-textarea-invalid': formatCode(`
<wc-liquid-glass-field-root invalid>
  <wc-liquid-glass-field-label>Message</wc-liquid-glass-field-label>
  <wc-liquid-glass-field-textarea
    placeholder="Type your message here."
    rows="3"
  ></wc-liquid-glass-field-textarea>
  <wc-liquid-glass-field-error></wc-liquid-glass-field-error>
</wc-liquid-glass-field-root>
    `),
    'demo-liquid-glass-textarea-button': formatCode(`
<div class="grid gap-4 rounded-3xl p-6">
  <wc-liquid-glass-textarea-root
    placeholder="Type your message here."
    aria-label="Message"
    rows="3"
  ></wc-liquid-glass-textarea-root>
  <div class="flex justify-end gap-3">
    <wc-liquid-glass-button variant="regular">Cancel</wc-liquid-glass-button>
    <wc-liquid-glass-button variant="prominent">Send message</wc-liquid-glass-button>
  </div>
</div>
    `),
  },
  react: {
    'demo-shadcn-textarea': formatCode(`
import { ShadcnTextareaRoot } from '../proto-ui/components/react';

export function TextareaDemo() {
  return (
    <ShadcnTextareaRoot
      styleProfile="rhea"
      placeholder="Type your message here."
      ariaLabel="Message"
      rows={4}
    />
  );
}
    `),
    'demo-shadcn-textarea-field': formatCode(`
import {
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/react';

export function TextareaFieldDemo() {
  return (
    <ShadcnFieldRoot styleProfile="rhea">
      <ShadcnFieldLabel styleProfile="rhea">Message</ShadcnFieldLabel>
      <ShadcnFieldDescription styleProfile="rhea">Enter your message below.</ShadcnFieldDescription>
      <ShadcnFieldTextarea
        styleProfile="rhea"
        placeholder="Type your message here."
        rows={4}
      />
    </ShadcnFieldRoot>
  );
}
    `),
    'demo-shadcn-textarea-disabled': formatCode(`
import {
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/react';

export function TextareaDisabledDemo() {
  return (
    <ShadcnFieldRoot styleProfile="rhea" disabled>
      <ShadcnFieldLabel styleProfile="rhea">Message</ShadcnFieldLabel>
      <ShadcnFieldTextarea
        styleProfile="rhea"
        placeholder="Type your message here."
        rows={3}
      />
    </ShadcnFieldRoot>
  );
}
    `),
    'demo-shadcn-textarea-invalid': formatCode(`
import {
  ShadcnFieldError,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/react';

export function TextareaInvalidDemo() {
  return (
    <ShadcnFieldRoot
      styleProfile="rhea"
      invalid
      errors={['Please enter a valid message.']}
    >
      <ShadcnFieldLabel styleProfile="rhea">Message</ShadcnFieldLabel>
      <ShadcnFieldTextarea
        styleProfile="rhea"
        placeholder="Type your message here."
        rows={3}
      />
      <ShadcnFieldError styleProfile="rhea" />
    </ShadcnFieldRoot>
  );
}
    `),
    'demo-shadcn-textarea-button': formatCode(`
import { ShadcnButton, ShadcnTextareaRoot } from '../proto-ui/components/react';

export function TextareaButtonDemo() {
  return (
    <div className="grid w-full max-w-md gap-2">
      <ShadcnTextareaRoot
        styleProfile="rhea"
        placeholder="Type your message here."
        ariaLabel="Message"
        rows={3}
      />
      <ShadcnButton styleProfile="rhea">Send message</ShadcnButton>
    </div>
  );
}
    `),
    'demo-shadcn-textarea-rtl': formatCode(`
import {
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/react';

export function TextareaRtlDemo() {
  return (
    <div dir="rtl" className="w-full max-w-xs">
      <ShadcnFieldRoot styleProfile="rhea">
        <ShadcnFieldLabel styleProfile="rhea">التعليقات</ShadcnFieldLabel>
        <ShadcnFieldTextarea
          styleProfile="rhea"
          placeholder="تعليقاتك تساعدنا على التحسين..."
          rows={4}
        />
        <ShadcnFieldDescription styleProfile="rhea">
          شاركنا أفكارك حول خدمتنا.
        </ShadcnFieldDescription>
      </ShadcnFieldRoot>
    </div>
  );
}
    `),
    'demo-brutalist-textarea': formatCode(`
import { BrutalistTextareaRoot } from '../proto-ui/components/react';

export function BrutalistTextareaDemo() {
  return (
    <BrutalistTextareaRoot
      placeholder="Type your message here."
      ariaLabel="Message"
      rows={4}
    />
  );
}
    `),
    'demo-brutalist-textarea-field': formatCode(`
import {
  BrutalistFieldDescription,
  BrutalistFieldLabel,
  BrutalistFieldRoot,
  BrutalistFieldTextarea,
} from '../proto-ui/components/react';

export function BrutalistTextareaFieldDemo() {
  return (
    <BrutalistFieldRoot>
      <BrutalistFieldLabel>Message</BrutalistFieldLabel>
      <BrutalistFieldDescription>Enter your message below.</BrutalistFieldDescription>
      <BrutalistFieldTextarea placeholder="Type your message here." rows={4} />
    </BrutalistFieldRoot>
  );
}
    `),
    'demo-brutalist-textarea-disabled': formatCode(`
import {
  BrutalistFieldLabel,
  BrutalistFieldRoot,
  BrutalistFieldTextarea,
} from '../proto-ui/components/react';

export function BrutalistTextareaDisabledDemo() {
  return (
    <BrutalistFieldRoot disabled>
      <BrutalistFieldLabel>Message</BrutalistFieldLabel>
      <BrutalistFieldTextarea placeholder="Type your message here." rows={3} />
    </BrutalistFieldRoot>
  );
}
    `),
    'demo-brutalist-textarea-invalid': formatCode(`
import {
  BrutalistFieldError,
  BrutalistFieldLabel,
  BrutalistFieldRoot,
  BrutalistFieldTextarea,
} from '../proto-ui/components/react';

export function BrutalistTextareaInvalidDemo() {
  return (
    <BrutalistFieldRoot invalid errors={['Please enter a valid message.']}>
      <BrutalistFieldLabel>Message</BrutalistFieldLabel>
      <BrutalistFieldTextarea placeholder="Type your message here." rows={3} />
      <BrutalistFieldError />
    </BrutalistFieldRoot>
  );
}
    `),
    'demo-brutalist-textarea-button': formatCode(`
import { BrutalistButton, BrutalistTextareaRoot } from '../proto-ui/components/react';

export function BrutalistTextareaButtonDemo() {
  return (
    <div className="grid w-full max-w-md gap-3">
      <BrutalistTextareaRoot
        placeholder="Type your message here."
        ariaLabel="Message"
        rows={3}
      />
      <BrutalistButton>Send message</BrutalistButton>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-textarea': formatCode(`
import { Bootstrap232TextareaRoot } from '../proto-ui/components/react';

export function BootstrapTextareaDemo() {
  return (
    <Bootstrap232TextareaRoot
      placeholder="Type your message here."
      ariaLabel="Message"
      rows={4}
    />
  );
}
    `),
    'demo-bootstrap-2-3-2-textarea-field': formatCode(`
import {
  Bootstrap232FieldDescription,
  Bootstrap232FieldLabel,
  Bootstrap232FieldRoot,
  Bootstrap232FieldTextarea,
} from '../proto-ui/components/react';

export function BootstrapTextareaFieldDemo() {
  return (
    <Bootstrap232FieldRoot>
      <Bootstrap232FieldLabel>Message</Bootstrap232FieldLabel>
      <Bootstrap232FieldTextarea placeholder="Type your message here." rows={4} />
      <Bootstrap232FieldDescription>Enter your message below.</Bootstrap232FieldDescription>
    </Bootstrap232FieldRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-textarea-disabled': formatCode(`
import {
  Bootstrap232FieldLabel,
  Bootstrap232FieldRoot,
  Bootstrap232FieldTextarea,
} from '../proto-ui/components/react';

export function BootstrapTextareaDisabledDemo() {
  return (
    <Bootstrap232FieldRoot disabled>
      <Bootstrap232FieldLabel>Message</Bootstrap232FieldLabel>
      <Bootstrap232FieldTextarea placeholder="Type your message here." rows={3} />
    </Bootstrap232FieldRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-textarea-invalid': formatCode(`
import {
  Bootstrap232FieldError,
  Bootstrap232FieldLabel,
  Bootstrap232FieldRoot,
  Bootstrap232FieldTextarea,
} from '../proto-ui/components/react';

export function BootstrapTextareaInvalidDemo() {
  return (
    <Bootstrap232FieldRoot invalid errors={['Please enter a valid message.']}>
      <Bootstrap232FieldLabel>Message</Bootstrap232FieldLabel>
      <Bootstrap232FieldTextarea placeholder="Type your message here." rows={3} />
      <Bootstrap232FieldError />
    </Bootstrap232FieldRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-textarea-button': formatCode(`
import { Bootstrap232Button, Bootstrap232TextareaRoot } from '../proto-ui/components/react';

export function BootstrapTextareaButtonDemo() {
  return (
    <div className="flex flex-col items-start gap-2">
      <Bootstrap232TextareaRoot
        placeholder="Type your message here."
        ariaLabel="Message"
        rows={3}
      />
      <Bootstrap232Button>Send message</Bootstrap232Button>
    </div>
  );
}
    `),
    'demo-liquid-glass-textarea': formatCode(`
import { LiquidGlassLabelRoot, LiquidGlassTextareaRoot } from '../proto-ui/components/react';

export function LiquidGlassTextareaDemo() {
  return (
    <div className="grid gap-3 rounded-3xl p-6">
      <LiquidGlassLabelRoot>Message</LiquidGlassLabelRoot>
      <LiquidGlassTextareaRoot placeholder="Type your message here." rows={4} />
    </div>
  );
}
    `),
    'demo-liquid-glass-textarea-field': formatCode(`
import {
  LiquidGlassFieldDescription,
  LiquidGlassFieldLabel,
  LiquidGlassFieldRoot,
  LiquidGlassFieldTextarea,
} from '../proto-ui/components/react';

export function LiquidGlassTextareaFieldDemo() {
  return (
    <LiquidGlassFieldRoot>
      <LiquidGlassFieldLabel>Message</LiquidGlassFieldLabel>
      <LiquidGlassFieldDescription>Enter your message below.</LiquidGlassFieldDescription>
      <LiquidGlassFieldTextarea placeholder="Type your message here." rows={4} />
    </LiquidGlassFieldRoot>
  );
}
    `),
    'demo-liquid-glass-textarea-disabled': formatCode(`
import {
  LiquidGlassFieldLabel,
  LiquidGlassFieldRoot,
  LiquidGlassFieldTextarea,
} from '../proto-ui/components/react';

export function LiquidGlassTextareaDisabledDemo() {
  return (
    <LiquidGlassFieldRoot disabled>
      <LiquidGlassFieldLabel>Message</LiquidGlassFieldLabel>
      <LiquidGlassFieldTextarea
        defaultValue="This message is archived and cannot be edited."
        rows={3}
      />
    </LiquidGlassFieldRoot>
  );
}
    `),
    'demo-liquid-glass-textarea-invalid': formatCode(`
import {
  LiquidGlassFieldError,
  LiquidGlassFieldLabel,
  LiquidGlassFieldRoot,
  LiquidGlassFieldTextarea,
} from '../proto-ui/components/react';

export function LiquidGlassTextareaInvalidDemo() {
  return (
    <LiquidGlassFieldRoot invalid errors={['Please enter a valid message.']}>
      <LiquidGlassFieldLabel>Message</LiquidGlassFieldLabel>
      <LiquidGlassFieldTextarea placeholder="Type your message here." rows={3} />
      <LiquidGlassFieldError />
    </LiquidGlassFieldRoot>
  );
}
    `),
    'demo-liquid-glass-textarea-button': formatCode(`
import { LiquidGlassButton, LiquidGlassTextareaRoot } from '../proto-ui/components/react';

export function LiquidGlassTextareaButtonDemo() {
  return (
    <div className="grid gap-4 rounded-3xl p-6">
      <LiquidGlassTextareaRoot
        placeholder="Type your message here."
        ariaLabel="Message"
        rows={3}
      />
      <div className="flex justify-end gap-3">
        <LiquidGlassButton variant="regular">Cancel</LiquidGlassButton>
        <LiquidGlassButton variant="prominent">Send message</LiquidGlassButton>
      </div>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-textarea': formatCode(`
<script setup lang="ts">
import { ShadcnTextareaRoot } from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnTextareaRoot
    styleProfile="rhea"
    placeholder="Type your message here."
    ariaLabel="Message"
    :rows="4"
  />
</template>
    `),
    'demo-shadcn-textarea-field': formatCode(`
<script setup lang="ts">
import {
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnFieldRoot styleProfile="rhea">
    <ShadcnFieldLabel styleProfile="rhea">Message</ShadcnFieldLabel>
    <ShadcnFieldDescription styleProfile="rhea">Enter your message below.</ShadcnFieldDescription>
    <ShadcnFieldTextarea
      styleProfile="rhea"
      placeholder="Type your message here."
      :rows="4"
    />
  </ShadcnFieldRoot>
</template>
    `),
    'demo-shadcn-textarea-disabled': formatCode(`
<script setup lang="ts">
import {
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnFieldRoot styleProfile="rhea" disabled>
    <ShadcnFieldLabel styleProfile="rhea">Message</ShadcnFieldLabel>
    <ShadcnFieldTextarea
      styleProfile="rhea"
      placeholder="Type your message here."
      :rows="3"
    />
  </ShadcnFieldRoot>
</template>
    `),
    'demo-shadcn-textarea-invalid': formatCode(`
<script setup lang="ts">
import {
  ShadcnFieldError,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnFieldRoot
    styleProfile="rhea"
    invalid
    :errors="['Please enter a valid message.']"
  >
    <ShadcnFieldLabel styleProfile="rhea">Message</ShadcnFieldLabel>
    <ShadcnFieldTextarea
      styleProfile="rhea"
      placeholder="Type your message here."
      :rows="3"
    />
    <ShadcnFieldError styleProfile="rhea" />
  </ShadcnFieldRoot>
</template>
    `),
    'demo-shadcn-textarea-button': formatCode(`
<script setup lang="ts">
import { ShadcnButton, ShadcnTextareaRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid w-full max-w-md gap-2">
    <ShadcnTextareaRoot
      styleProfile="rhea"
      placeholder="Type your message here."
      ariaLabel="Message"
      :rows="3"
    />
    <ShadcnButton styleProfile="rhea">Send message</ShadcnButton>
  </div>
</template>
    `),
    'demo-shadcn-textarea-rtl': formatCode(`
<script setup lang="ts">
import {
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <div dir="rtl" class="w-full max-w-xs">
    <ShadcnFieldRoot styleProfile="rhea">
      <ShadcnFieldLabel styleProfile="rhea">التعليقات</ShadcnFieldLabel>
      <ShadcnFieldTextarea
        styleProfile="rhea"
        placeholder="تعليقاتك تساعدنا على التحسين..."
        :rows="4"
      />
      <ShadcnFieldDescription styleProfile="rhea">شاركنا أفكارك حول خدمتنا.</ShadcnFieldDescription>
    </ShadcnFieldRoot>
  </div>
</template>
    `),
    'demo-brutalist-textarea': formatCode(`
<script setup lang="ts">
import { BrutalistTextareaRoot } from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistTextareaRoot
    placeholder="Type your message here."
    ariaLabel="Message"
    :rows="4"
  />
</template>
    `),
    'demo-brutalist-textarea-field': formatCode(`
<script setup lang="ts">
import {
  BrutalistFieldDescription,
  BrutalistFieldLabel,
  BrutalistFieldRoot,
  BrutalistFieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistFieldRoot>
    <BrutalistFieldLabel>Message</BrutalistFieldLabel>
    <BrutalistFieldDescription>Enter your message below.</BrutalistFieldDescription>
    <BrutalistFieldTextarea placeholder="Type your message here." :rows="4" />
  </BrutalistFieldRoot>
</template>
    `),
    'demo-brutalist-textarea-disabled': formatCode(`
<script setup lang="ts">
import {
  BrutalistFieldLabel,
  BrutalistFieldRoot,
  BrutalistFieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistFieldRoot disabled>
    <BrutalistFieldLabel>Message</BrutalistFieldLabel>
    <BrutalistFieldTextarea placeholder="Type your message here." :rows="3" />
  </BrutalistFieldRoot>
</template>
    `),
    'demo-brutalist-textarea-invalid': formatCode(`
<script setup lang="ts">
import {
  BrutalistFieldError,
  BrutalistFieldLabel,
  BrutalistFieldRoot,
  BrutalistFieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistFieldRoot invalid :errors="['Please enter a valid message.']">
    <BrutalistFieldLabel>Message</BrutalistFieldLabel>
    <BrutalistFieldTextarea placeholder="Type your message here." :rows="3" />
    <BrutalistFieldError />
  </BrutalistFieldRoot>
</template>
    `),
    'demo-brutalist-textarea-button': formatCode(`
<script setup lang="ts">
import { BrutalistButton, BrutalistTextareaRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid w-full max-w-md gap-3">
    <BrutalistTextareaRoot
      placeholder="Type your message here."
      ariaLabel="Message"
      :rows="3"
    />
    <BrutalistButton>Send message</BrutalistButton>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-textarea': formatCode(`
<script setup lang="ts">
import { Bootstrap232TextareaRoot } from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232TextareaRoot
    placeholder="Type your message here."
    ariaLabel="Message"
    :rows="4"
  />
</template>
    `),
    'demo-bootstrap-2-3-2-textarea-field': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232FieldDescription,
  Bootstrap232FieldLabel,
  Bootstrap232FieldRoot,
  Bootstrap232FieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232FieldRoot>
    <Bootstrap232FieldLabel>Message</Bootstrap232FieldLabel>
    <Bootstrap232FieldTextarea placeholder="Type your message here." :rows="4" />
    <Bootstrap232FieldDescription>Enter your message below.</Bootstrap232FieldDescription>
  </Bootstrap232FieldRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-textarea-disabled': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232FieldLabel,
  Bootstrap232FieldRoot,
  Bootstrap232FieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232FieldRoot disabled>
    <Bootstrap232FieldLabel>Message</Bootstrap232FieldLabel>
    <Bootstrap232FieldTextarea placeholder="Type your message here." :rows="3" />
  </Bootstrap232FieldRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-textarea-invalid': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232FieldError,
  Bootstrap232FieldLabel,
  Bootstrap232FieldRoot,
  Bootstrap232FieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232FieldRoot invalid :errors="['Please enter a valid message.']">
    <Bootstrap232FieldLabel>Message</Bootstrap232FieldLabel>
    <Bootstrap232FieldTextarea placeholder="Type your message here." :rows="3" />
    <Bootstrap232FieldError />
  </Bootstrap232FieldRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-textarea-button': formatCode(`
<script setup lang="ts">
import { Bootstrap232Button, Bootstrap232TextareaRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-start gap-2">
    <Bootstrap232TextareaRoot
      placeholder="Type your message here."
      ariaLabel="Message"
      :rows="3"
    />
    <Bootstrap232Button>Send message</Bootstrap232Button>
  </div>
</template>
    `),
    'demo-liquid-glass-textarea': formatCode(`
<script setup lang="ts">
import { LiquidGlassLabelRoot, LiquidGlassTextareaRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid gap-3 rounded-3xl p-6">
    <LiquidGlassLabelRoot>Message</LiquidGlassLabelRoot>
    <LiquidGlassTextareaRoot placeholder="Type your message here." :rows="4" />
  </div>
</template>
    `),
    'demo-liquid-glass-textarea-field': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassFieldDescription,
  LiquidGlassFieldLabel,
  LiquidGlassFieldRoot,
  LiquidGlassFieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassFieldRoot>
    <LiquidGlassFieldLabel>Message</LiquidGlassFieldLabel>
    <LiquidGlassFieldDescription>Enter your message below.</LiquidGlassFieldDescription>
    <LiquidGlassFieldTextarea placeholder="Type your message here." :rows="4" />
  </LiquidGlassFieldRoot>
</template>
    `),
    'demo-liquid-glass-textarea-disabled': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassFieldLabel,
  LiquidGlassFieldRoot,
  LiquidGlassFieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassFieldRoot disabled>
    <LiquidGlassFieldLabel>Message</LiquidGlassFieldLabel>
    <LiquidGlassFieldTextarea
      defaultValue="This message is archived and cannot be edited."
      :rows="3"
    />
  </LiquidGlassFieldRoot>
</template>
    `),
    'demo-liquid-glass-textarea-invalid': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassFieldError,
  LiquidGlassFieldLabel,
  LiquidGlassFieldRoot,
  LiquidGlassFieldTextarea,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassFieldRoot invalid :errors="['Please enter a valid message.']">
    <LiquidGlassFieldLabel>Message</LiquidGlassFieldLabel>
    <LiquidGlassFieldTextarea placeholder="Type your message here." :rows="3" />
    <LiquidGlassFieldError />
  </LiquidGlassFieldRoot>
</template>
    `),
    'demo-liquid-glass-textarea-button': formatCode(`
<script setup lang="ts">
import { LiquidGlassButton, LiquidGlassTextareaRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid gap-4 rounded-3xl p-6">
    <LiquidGlassTextareaRoot
      placeholder="Type your message here."
      ariaLabel="Message"
      :rows="3"
    />
    <div class="flex justify-end gap-3">
      <LiquidGlassButton variant="regular">Cancel</LiquidGlassButton>
      <LiquidGlassButton variant="prominent">Send message</LiquidGlassButton>
    </div>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-textarea': formatCode(`
<template>
  <ShadcnTextareaRoot
    styleProfile="rhea"
    placeholder="Type your message here."
    ariaLabel="Message"
    :rows="4"
  />
</template>

<script>
import { ShadcnTextareaRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnTextareaRoot },
};
</script>
    `),
    'demo-shadcn-textarea-field': formatCode(`
<template>
  <ShadcnFieldRoot styleProfile="rhea">
    <ShadcnFieldLabel styleProfile="rhea">Message</ShadcnFieldLabel>
    <ShadcnFieldDescription styleProfile="rhea">Enter your message below.</ShadcnFieldDescription>
    <ShadcnFieldTextarea
      styleProfile="rhea"
      placeholder="Type your message here."
      :rows="4"
    />
  </ShadcnFieldRoot>
</template>

<script>
import {
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnFieldDescription,
    ShadcnFieldLabel,
    ShadcnFieldRoot,
    ShadcnFieldTextarea,
  },
};
</script>
    `),
    'demo-shadcn-textarea-disabled': formatCode(`
<template>
  <ShadcnFieldRoot styleProfile="rhea" disabled>
    <ShadcnFieldLabel styleProfile="rhea">Message</ShadcnFieldLabel>
    <ShadcnFieldTextarea
      styleProfile="rhea"
      placeholder="Type your message here."
      :rows="3"
    />
  </ShadcnFieldRoot>
</template>

<script>
import {
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnFieldLabel,
    ShadcnFieldRoot,
    ShadcnFieldTextarea,
  },
};
</script>
    `),
    'demo-shadcn-textarea-invalid': formatCode(`
<template>
  <ShadcnFieldRoot
    styleProfile="rhea"
    invalid
    :errors="['Please enter a valid message.']"
  >
    <ShadcnFieldLabel styleProfile="rhea">Message</ShadcnFieldLabel>
    <ShadcnFieldTextarea
      styleProfile="rhea"
      placeholder="Type your message here."
      :rows="3"
    />
    <ShadcnFieldError styleProfile="rhea" />
  </ShadcnFieldRoot>
</template>

<script>
import {
  ShadcnFieldError,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnFieldError,
    ShadcnFieldLabel,
    ShadcnFieldRoot,
    ShadcnFieldTextarea,
  },
};
</script>
    `),
    'demo-shadcn-textarea-button': formatCode(`
<template>
  <div class="grid w-full max-w-md gap-2">
    <ShadcnTextareaRoot
      styleProfile="rhea"
      placeholder="Type your message here."
      ariaLabel="Message"
      :rows="3"
    />
    <ShadcnButton styleProfile="rhea">Send message</ShadcnButton>
  </div>
</template>

<script>
import { ShadcnButton, ShadcnTextareaRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnButton, ShadcnTextareaRoot },
};
</script>
    `),
    'demo-shadcn-textarea-rtl': formatCode(`
<template>
  <div dir="rtl" class="w-full max-w-xs">
    <ShadcnFieldRoot styleProfile="rhea">
      <ShadcnFieldLabel styleProfile="rhea">التعليقات</ShadcnFieldLabel>
      <ShadcnFieldTextarea
        styleProfile="rhea"
        placeholder="تعليقاتك تساعدنا على التحسين..."
        :rows="4"
      />
      <ShadcnFieldDescription styleProfile="rhea">شاركنا أفكارك حول خدمتنا.</ShadcnFieldDescription>
    </ShadcnFieldRoot>
  </div>
</template>

<script>
import {
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnFieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnFieldDescription,
    ShadcnFieldLabel,
    ShadcnFieldRoot,
    ShadcnFieldTextarea,
  },
};
</script>
    `),
    'demo-brutalist-textarea': formatCode(`
<template>
  <BrutalistTextareaRoot
    placeholder="Type your message here."
    ariaLabel="Message"
    :rows="4"
  />
</template>

<script>
import { BrutalistTextareaRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistTextareaRoot },
};
</script>
    `),
    'demo-brutalist-textarea-field': formatCode(`
<template>
  <BrutalistFieldRoot>
    <BrutalistFieldLabel>Message</BrutalistFieldLabel>
    <BrutalistFieldDescription>Enter your message below.</BrutalistFieldDescription>
    <BrutalistFieldTextarea placeholder="Type your message here." :rows="4" />
  </BrutalistFieldRoot>
</template>

<script>
import {
  BrutalistFieldDescription,
  BrutalistFieldLabel,
  BrutalistFieldRoot,
  BrutalistFieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistFieldDescription,
    BrutalistFieldLabel,
    BrutalistFieldRoot,
    BrutalistFieldTextarea,
  },
};
</script>
    `),
    'demo-brutalist-textarea-disabled': formatCode(`
<template>
  <BrutalistFieldRoot disabled>
    <BrutalistFieldLabel>Message</BrutalistFieldLabel>
    <BrutalistFieldTextarea placeholder="Type your message here." :rows="3" />
  </BrutalistFieldRoot>
</template>

<script>
import {
  BrutalistFieldLabel,
  BrutalistFieldRoot,
  BrutalistFieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistFieldLabel,
    BrutalistFieldRoot,
    BrutalistFieldTextarea,
  },
};
</script>
    `),
    'demo-brutalist-textarea-invalid': formatCode(`
<template>
  <BrutalistFieldRoot invalid :errors="['Please enter a valid message.']">
    <BrutalistFieldLabel>Message</BrutalistFieldLabel>
    <BrutalistFieldTextarea placeholder="Type your message here." :rows="3" />
    <BrutalistFieldError />
  </BrutalistFieldRoot>
</template>

<script>
import {
  BrutalistFieldError,
  BrutalistFieldLabel,
  BrutalistFieldRoot,
  BrutalistFieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistFieldError,
    BrutalistFieldLabel,
    BrutalistFieldRoot,
    BrutalistFieldTextarea,
  },
};
</script>
    `),
    'demo-brutalist-textarea-button': formatCode(`
<template>
  <div class="grid w-full max-w-md gap-3">
    <BrutalistTextareaRoot
      placeholder="Type your message here."
      ariaLabel="Message"
      :rows="3"
    />
    <BrutalistButton>Send message</BrutalistButton>
  </div>
</template>

<script>
import { BrutalistButton, BrutalistTextareaRoot } from '../proto-ui/components/vue2';

export default {
  components: { BrutalistButton, BrutalistTextareaRoot },
};
</script>
    `),
    'demo-bootstrap-2-3-2-textarea': formatCode(`
<template>
  <Bootstrap232TextareaRoot
    placeholder="Type your message here."
    ariaLabel="Message"
    :rows="4"
  />
</template>

<script>
import { Bootstrap232TextareaRoot } from '../proto-ui/components/vue2';

export default {
  components: { Bootstrap232TextareaRoot },
};
</script>
    `),
    'demo-bootstrap-2-3-2-textarea-field': formatCode(`
<template>
  <Bootstrap232FieldRoot>
    <Bootstrap232FieldLabel>Message</Bootstrap232FieldLabel>
    <Bootstrap232FieldTextarea placeholder="Type your message here." :rows="4" />
    <Bootstrap232FieldDescription>Enter your message below.</Bootstrap232FieldDescription>
  </Bootstrap232FieldRoot>
</template>

<script>
import {
  Bootstrap232FieldDescription,
  Bootstrap232FieldLabel,
  Bootstrap232FieldRoot,
  Bootstrap232FieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232FieldDescription,
    Bootstrap232FieldLabel,
    Bootstrap232FieldRoot,
    Bootstrap232FieldTextarea,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-textarea-disabled': formatCode(`
<template>
  <Bootstrap232FieldRoot disabled>
    <Bootstrap232FieldLabel>Message</Bootstrap232FieldLabel>
    <Bootstrap232FieldTextarea placeholder="Type your message here." :rows="3" />
  </Bootstrap232FieldRoot>
</template>

<script>
import {
  Bootstrap232FieldLabel,
  Bootstrap232FieldRoot,
  Bootstrap232FieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232FieldLabel,
    Bootstrap232FieldRoot,
    Bootstrap232FieldTextarea,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-textarea-invalid': formatCode(`
<template>
  <Bootstrap232FieldRoot invalid :errors="['Please enter a valid message.']">
    <Bootstrap232FieldLabel>Message</Bootstrap232FieldLabel>
    <Bootstrap232FieldTextarea placeholder="Type your message here." :rows="3" />
    <Bootstrap232FieldError />
  </Bootstrap232FieldRoot>
</template>

<script>
import {
  Bootstrap232FieldError,
  Bootstrap232FieldLabel,
  Bootstrap232FieldRoot,
  Bootstrap232FieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232FieldError,
    Bootstrap232FieldLabel,
    Bootstrap232FieldRoot,
    Bootstrap232FieldTextarea,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-textarea-button': formatCode(`
<template>
  <div class="flex flex-col items-start gap-2">
    <Bootstrap232TextareaRoot
      placeholder="Type your message here."
      ariaLabel="Message"
      :rows="3"
    />
    <Bootstrap232Button>Send message</Bootstrap232Button>
  </div>
</template>

<script>
import { Bootstrap232Button, Bootstrap232TextareaRoot } from '../proto-ui/components/vue2';

export default {
  components: { Bootstrap232Button, Bootstrap232TextareaRoot },
};
</script>
    `),
    'demo-liquid-glass-textarea': formatCode(`
<template>
  <div class="grid gap-3 rounded-3xl p-6">
    <LiquidGlassLabelRoot>Message</LiquidGlassLabelRoot>
    <LiquidGlassTextareaRoot placeholder="Type your message here." :rows="4" />
  </div>
</template>

<script>
import { LiquidGlassLabelRoot, LiquidGlassTextareaRoot } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassLabelRoot, LiquidGlassTextareaRoot },
};
</script>
    `),
    'demo-liquid-glass-textarea-field': formatCode(`
<template>
  <LiquidGlassFieldRoot>
    <LiquidGlassFieldLabel>Message</LiquidGlassFieldLabel>
    <LiquidGlassFieldDescription>Enter your message below.</LiquidGlassFieldDescription>
    <LiquidGlassFieldTextarea placeholder="Type your message here." :rows="4" />
  </LiquidGlassFieldRoot>
</template>

<script>
import {
  LiquidGlassFieldDescription,
  LiquidGlassFieldLabel,
  LiquidGlassFieldRoot,
  LiquidGlassFieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassFieldDescription,
    LiquidGlassFieldLabel,
    LiquidGlassFieldRoot,
    LiquidGlassFieldTextarea,
  },
};
</script>
    `),
    'demo-liquid-glass-textarea-disabled': formatCode(`
<template>
  <LiquidGlassFieldRoot disabled>
    <LiquidGlassFieldLabel>Message</LiquidGlassFieldLabel>
    <LiquidGlassFieldTextarea
      defaultValue="This message is archived and cannot be edited."
      :rows="3"
    />
  </LiquidGlassFieldRoot>
</template>

<script>
import {
  LiquidGlassFieldLabel,
  LiquidGlassFieldRoot,
  LiquidGlassFieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassFieldLabel,
    LiquidGlassFieldRoot,
    LiquidGlassFieldTextarea,
  },
};
</script>
    `),
    'demo-liquid-glass-textarea-invalid': formatCode(`
<template>
  <LiquidGlassFieldRoot invalid :errors="['Please enter a valid message.']">
    <LiquidGlassFieldLabel>Message</LiquidGlassFieldLabel>
    <LiquidGlassFieldTextarea placeholder="Type your message here." :rows="3" />
    <LiquidGlassFieldError />
  </LiquidGlassFieldRoot>
</template>

<script>
import {
  LiquidGlassFieldError,
  LiquidGlassFieldLabel,
  LiquidGlassFieldRoot,
  LiquidGlassFieldTextarea,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassFieldError,
    LiquidGlassFieldLabel,
    LiquidGlassFieldRoot,
    LiquidGlassFieldTextarea,
  },
};
</script>
    `),
    'demo-liquid-glass-textarea-button': formatCode(`
<template>
  <div class="grid gap-4 rounded-3xl p-6">
    <LiquidGlassTextareaRoot
      placeholder="Type your message here."
      ariaLabel="Message"
      :rows="3"
    />
    <div class="flex justify-end gap-3">
      <LiquidGlassButton variant="regular">Cancel</LiquidGlassButton>
      <LiquidGlassButton variant="prominent">Send message</LiquidGlassButton>
    </div>
  </div>
</template>

<script>
import { LiquidGlassButton, LiquidGlassTextareaRoot } from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassButton, LiquidGlassTextareaRoot },
};
</script>
    `),
  },
};
