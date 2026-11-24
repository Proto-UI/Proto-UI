import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '../../../../components/PrototypePreviewer/runtimes/ids';

const SHADCN_HERO_WC = formatCode(`
<wc-shadcn-select-root style-profile="rhea">
  <wc-shadcn-select-trigger style-profile="rhea" class="w-48" accessible-label="Fruit selector">
    <wc-shadcn-select-value style-profile="rhea" placeholder="Select a fruit"></wc-shadcn-select-value>
  </wc-shadcn-select-trigger>
  <wc-shadcn-select-content style-profile="rhea">
    <wc-shadcn-select-surface style-profile="rhea">
      <wc-shadcn-select-viewport style-profile="rhea">
        <wc-shadcn-select-group style-profile="rhea">
          <wc-shadcn-select-label style-profile="rhea">Fruits</wc-shadcn-select-label>
          <wc-shadcn-select-item style-profile="rhea" value="apple" text-value="Apple">
            <wc-shadcn-select-item-text style-profile="rhea">Apple</wc-shadcn-select-item-text>
          </wc-shadcn-select-item>
          <wc-shadcn-select-item style-profile="rhea" value="banana" text-value="Banana">
            <wc-shadcn-select-item-text style-profile="rhea">Banana</wc-shadcn-select-item-text>
          </wc-shadcn-select-item>
          <wc-shadcn-select-item style-profile="rhea" value="blueberry" text-value="Blueberry">
            <wc-shadcn-select-item-text style-profile="rhea">Blueberry</wc-shadcn-select-item-text>
          </wc-shadcn-select-item>
        </wc-shadcn-select-group>
        <wc-shadcn-select-separator style-profile="rhea"></wc-shadcn-select-separator>
        <wc-shadcn-select-group style-profile="rhea">
          <wc-shadcn-select-label style-profile="rhea">Vegetables</wc-shadcn-select-label>
          <wc-shadcn-select-item style-profile="rhea" value="carrot" text-value="Carrot">
            <wc-shadcn-select-item-text style-profile="rhea">Carrot</wc-shadcn-select-item-text>
          </wc-shadcn-select-item>
          <wc-shadcn-select-item style-profile="rhea" value="broccoli" text-value="Broccoli">
            <wc-shadcn-select-item-text style-profile="rhea">Broccoli</wc-shadcn-select-item-text>
          </wc-shadcn-select-item>
          <wc-shadcn-select-item style-profile="rhea" value="spinach" text-value="Spinach">
            <wc-shadcn-select-item-text style-profile="rhea">Spinach</wc-shadcn-select-item-text>
          </wc-shadcn-select-item>
        </wc-shadcn-select-group>
      </wc-shadcn-select-viewport>
    </wc-shadcn-select-surface>
  </wc-shadcn-select-content>
</wc-shadcn-select-root>
`);

const SHADCN_HERO_REACT = formatCode(`
import {
  ShadcnSelectContent,
  ShadcnSelectGroup,
  ShadcnSelectItem,
  ShadcnSelectItemText,
  ShadcnSelectLabel,
  ShadcnSelectRoot,
  ShadcnSelectSeparator,
  ShadcnSelectSurface,
  ShadcnSelectTrigger,
  ShadcnSelectValue,
  ShadcnSelectViewport,
} from '../proto-ui/components/react';

export function SelectDemo() {
  return (
    <ShadcnSelectRoot styleProfile="rhea">
      <ShadcnSelectTrigger styleProfile="rhea" className="w-48" accessibleLabel="Fruit selector">
        <ShadcnSelectValue styleProfile="rhea" placeholder="Select a fruit" />
      </ShadcnSelectTrigger>
      <ShadcnSelectContent styleProfile="rhea">
        <ShadcnSelectSurface styleProfile="rhea">
          <ShadcnSelectViewport styleProfile="rhea">
            <ShadcnSelectGroup styleProfile="rhea">
              <ShadcnSelectLabel styleProfile="rhea">Fruits</ShadcnSelectLabel>
              <ShadcnSelectItem styleProfile="rhea" value="apple" textValue="Apple">
                <ShadcnSelectItemText styleProfile="rhea">Apple</ShadcnSelectItemText>
              </ShadcnSelectItem>
              <ShadcnSelectItem styleProfile="rhea" value="banana" textValue="Banana">
                <ShadcnSelectItemText styleProfile="rhea">Banana</ShadcnSelectItemText>
              </ShadcnSelectItem>
              <ShadcnSelectItem styleProfile="rhea" value="blueberry" textValue="Blueberry">
                <ShadcnSelectItemText styleProfile="rhea">Blueberry</ShadcnSelectItemText>
              </ShadcnSelectItem>
            </ShadcnSelectGroup>
            <ShadcnSelectSeparator styleProfile="rhea" />
            <ShadcnSelectGroup styleProfile="rhea">
              <ShadcnSelectLabel styleProfile="rhea">Vegetables</ShadcnSelectLabel>
              <ShadcnSelectItem styleProfile="rhea" value="carrot" textValue="Carrot">
                <ShadcnSelectItemText styleProfile="rhea">Carrot</ShadcnSelectItemText>
              </ShadcnSelectItem>
              <ShadcnSelectItem styleProfile="rhea" value="broccoli" textValue="Broccoli">
                <ShadcnSelectItemText styleProfile="rhea">Broccoli</ShadcnSelectItemText>
              </ShadcnSelectItem>
              <ShadcnSelectItem styleProfile="rhea" value="spinach" textValue="Spinach">
                <ShadcnSelectItemText styleProfile="rhea">Spinach</ShadcnSelectItemText>
              </ShadcnSelectItem>
            </ShadcnSelectGroup>
          </ShadcnSelectViewport>
        </ShadcnSelectSurface>
      </ShadcnSelectContent>
    </ShadcnSelectRoot>
  );
}
`);

const SHADCN_HERO_VUE = formatCode(`
<script setup lang="ts">
import {
  ShadcnSelectContent,
  ShadcnSelectGroup,
  ShadcnSelectItem,
  ShadcnSelectItemText,
  ShadcnSelectLabel,
  ShadcnSelectRoot,
  ShadcnSelectSeparator,
  ShadcnSelectSurface,
  ShadcnSelectTrigger,
  ShadcnSelectValue,
  ShadcnSelectViewport,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnSelectRoot styleProfile="rhea">
    <ShadcnSelectTrigger styleProfile="rhea" class="w-48" accessibleLabel="Fruit selector">
      <ShadcnSelectValue styleProfile="rhea" placeholder="Select a fruit" />
    </ShadcnSelectTrigger>
    <ShadcnSelectContent styleProfile="rhea">
      <ShadcnSelectSurface styleProfile="rhea">
        <ShadcnSelectViewport styleProfile="rhea">
          <ShadcnSelectGroup styleProfile="rhea">
            <ShadcnSelectLabel styleProfile="rhea">Fruits</ShadcnSelectLabel>
            <ShadcnSelectItem styleProfile="rhea" value="apple" textValue="Apple">
              <ShadcnSelectItemText styleProfile="rhea">Apple</ShadcnSelectItemText>
            </ShadcnSelectItem>
            <ShadcnSelectItem styleProfile="rhea" value="banana" textValue="Banana">
              <ShadcnSelectItemText styleProfile="rhea">Banana</ShadcnSelectItemText>
            </ShadcnSelectItem>
          </ShadcnSelectGroup>
          <ShadcnSelectSeparator styleProfile="rhea" />
          <ShadcnSelectGroup styleProfile="rhea">
            <ShadcnSelectLabel styleProfile="rhea">Vegetables</ShadcnSelectLabel>
            <ShadcnSelectItem styleProfile="rhea" value="carrot" textValue="Carrot">
              <ShadcnSelectItemText styleProfile="rhea">Carrot</ShadcnSelectItemText>
            </ShadcnSelectItem>
            <ShadcnSelectItem styleProfile="rhea" value="broccoli" textValue="Broccoli">
              <ShadcnSelectItemText styleProfile="rhea">Broccoli</ShadcnSelectItemText>
            </ShadcnSelectItem>
          </ShadcnSelectGroup>
        </ShadcnSelectViewport>
      </ShadcnSelectSurface>
    </ShadcnSelectContent>
  </ShadcnSelectRoot>
</template>
`);

const SHADCN_HERO_VUE2 = formatCode(`
<template>
  <ShadcnSelectRoot styleProfile="rhea">
    <ShadcnSelectTrigger styleProfile="rhea" class="w-48" accessibleLabel="Fruit selector">
      <ShadcnSelectValue styleProfile="rhea" placeholder="Select a fruit" />
    </ShadcnSelectTrigger>
    <ShadcnSelectContent styleProfile="rhea">
      <ShadcnSelectSurface styleProfile="rhea">
        <ShadcnSelectViewport styleProfile="rhea">
          <ShadcnSelectGroup styleProfile="rhea">
            <ShadcnSelectLabel styleProfile="rhea">Fruits</ShadcnSelectLabel>
            <ShadcnSelectItem styleProfile="rhea" value="apple" textValue="Apple">
              <ShadcnSelectItemText styleProfile="rhea">Apple</ShadcnSelectItemText>
            </ShadcnSelectItem>
            <ShadcnSelectItem styleProfile="rhea" value="banana" textValue="Banana">
              <ShadcnSelectItemText styleProfile="rhea">Banana</ShadcnSelectItemText>
            </ShadcnSelectItem>
          </ShadcnSelectGroup>
          <ShadcnSelectSeparator styleProfile="rhea" />
          <ShadcnSelectGroup styleProfile="rhea">
            <ShadcnSelectLabel styleProfile="rhea">Vegetables</ShadcnSelectLabel>
            <ShadcnSelectItem styleProfile="rhea" value="carrot" textValue="Carrot">
              <ShadcnSelectItemText styleProfile="rhea">Carrot</ShadcnSelectItemText>
            </ShadcnSelectItem>
          </ShadcnSelectGroup>
        </ShadcnSelectViewport>
      </ShadcnSelectSurface>
    </ShadcnSelectContent>
  </ShadcnSelectRoot>
</template>

<script>
import {
  ShadcnSelectContent,
  ShadcnSelectGroup,
  ShadcnSelectItem,
  ShadcnSelectItemText,
  ShadcnSelectLabel,
  ShadcnSelectRoot,
  ShadcnSelectSeparator,
  ShadcnSelectSurface,
  ShadcnSelectTrigger,
  ShadcnSelectValue,
  ShadcnSelectViewport,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnSelectContent,
    ShadcnSelectGroup,
    ShadcnSelectItem,
    ShadcnSelectItemText,
    ShadcnSelectLabel,
    ShadcnSelectRoot,
    ShadcnSelectSeparator,
    ShadcnSelectSurface,
    ShadcnSelectTrigger,
    ShadcnSelectValue,
    ShadcnSelectViewport,
  },
};
</script>
`);

function shadcnSimple(options: {
  rootAttrs?: string;
  triggerAttrs?: string;
  contentAttrs?: string;
  placeholder: string;
  items: readonly (readonly [string, string, boolean?])[];
  dir?: 'rtl';
}): Record<RuntimeId, string> {
  const wrapOpen = options.dir ? `<div dir="rtl">\n` : '';
  const wrapClose = options.dir ? `\n</div>` : '';
  const rootWc = options.rootAttrs ? ` ${options.rootAttrs}` : '';
  const trigWc = options.triggerAttrs ? ` ${options.triggerAttrs}` : '';
  const contentWc = options.contentAttrs ? ` ${options.contentAttrs}` : '';
  const itemsWc = options.items
    .map(
      ([v, t, d]) =>
        `        <wc-shadcn-select-item style-profile="rhea" value="${v}" text-value="${t}"${d ? ' disabled' : ''}>\n          <wc-shadcn-select-item-text style-profile="rhea">${t}</wc-shadcn-select-item-text>\n        </wc-shadcn-select-item>`
    )
    .join('\n');
  const itemsJsx = options.items
    .map(
      ([v, t, d]) =>
        `          <ShadcnSelectItem styleProfile="rhea" value="${v}" textValue="${t}"${d ? ' disabled' : ''}>\n            <ShadcnSelectItemText styleProfile="rhea">${t}</ShadcnSelectItemText>\n          </ShadcnSelectItem>`
    )
    .join('\n');

  return {
    wc: formatCode(`${wrapOpen}<wc-shadcn-select-root style-profile="rhea"${rootWc}>
  <wc-shadcn-select-trigger style-profile="rhea"${trigWc}>
    <wc-shadcn-select-value style-profile="rhea" placeholder="${options.placeholder}"></wc-shadcn-select-value>
  </wc-shadcn-select-trigger>
  <wc-shadcn-select-content style-profile="rhea"${contentWc}>
    <wc-shadcn-select-surface style-profile="rhea">
      <wc-shadcn-select-viewport style-profile="rhea">
${itemsWc}
      </wc-shadcn-select-viewport>
    </wc-shadcn-select-surface>
  </wc-shadcn-select-content>
</wc-shadcn-select-root>${wrapClose}`),
    react: formatCode(`import {
  ShadcnSelectContent,
  ShadcnSelectItem,
  ShadcnSelectItemText,
  ShadcnSelectRoot,
  ShadcnSelectSurface,
  ShadcnSelectTrigger,
  ShadcnSelectValue,
  ShadcnSelectViewport,
} from '../proto-ui/components/react';

export function SelectExample() {
  return (
    ${wrapOpen}<ShadcnSelectRoot styleProfile="rhea"${rootWc}>
      <ShadcnSelectTrigger styleProfile="rhea"${trigWc}>
        <ShadcnSelectValue styleProfile="rhea" placeholder="${options.placeholder}" />
      </ShadcnSelectTrigger>
      <ShadcnSelectContent styleProfile="rhea"${contentWc}>
        <ShadcnSelectSurface styleProfile="rhea">
          <ShadcnSelectViewport styleProfile="rhea">
${itemsJsx}
          </ShadcnSelectViewport>
        </ShadcnSelectSurface>
      </ShadcnSelectContent>
    </ShadcnSelectRoot>${wrapClose}
  );
}`),
    vue: formatCode(`<script setup lang="ts">
import {
  ShadcnSelectContent,
  ShadcnSelectItem,
  ShadcnSelectItemText,
  ShadcnSelectRoot,
  ShadcnSelectSurface,
  ShadcnSelectTrigger,
  ShadcnSelectValue,
  ShadcnSelectViewport,
} from '../proto-ui/components/vue';
</script>

<template>
  ${wrapOpen}<ShadcnSelectRoot styleProfile="rhea"${rootWc}>
    <ShadcnSelectTrigger styleProfile="rhea"${trigWc}>
      <ShadcnSelectValue styleProfile="rhea" placeholder="${options.placeholder}" />
    </ShadcnSelectTrigger>
    <ShadcnSelectContent styleProfile="rhea"${contentWc}>
      <ShadcnSelectSurface styleProfile="rhea">
        <ShadcnSelectViewport styleProfile="rhea">
${itemsJsx}
        </ShadcnSelectViewport>
      </ShadcnSelectSurface>
    </ShadcnSelectContent>
  </ShadcnSelectRoot>${wrapClose}
</template>`),
    vue2: formatCode(`<template>
  ${wrapOpen}<ShadcnSelectRoot styleProfile="rhea"${rootWc}>
    <ShadcnSelectTrigger styleProfile="rhea"${trigWc}>
      <ShadcnSelectValue styleProfile="rhea" placeholder="${options.placeholder}" />
    </ShadcnSelectTrigger>
    <ShadcnSelectContent styleProfile="rhea"${contentWc}>
      <ShadcnSelectSurface styleProfile="rhea">
        <ShadcnSelectViewport styleProfile="rhea">
${itemsJsx}
        </ShadcnSelectViewport>
      </ShadcnSelectSurface>
    </ShadcnSelectContent>
  </ShadcnSelectRoot>${wrapClose}
</template>

<script>
import {
  ShadcnSelectContent,
  ShadcnSelectItem,
  ShadcnSelectItemText,
  ShadcnSelectRoot,
  ShadcnSelectSurface,
  ShadcnSelectTrigger,
  ShadcnSelectValue,
  ShadcnSelectViewport,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnSelectContent,
    ShadcnSelectItem,
    ShadcnSelectItemText,
    ShadcnSelectRoot,
    ShadcnSelectSurface,
    ShadcnSelectTrigger,
    ShadcnSelectValue,
    ShadcnSelectViewport,
  },
};
</script>`),
  };
}

function familySelect(
  prefix: 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass',
  pascal: 'Brutalist' | 'Bootstrap232' | 'LiquidGlass',
  options: {
    hasSurface?: boolean;
    rootAttrs?: string;
    triggerAttrs?: string;
    placeholder: string;
    items: readonly (readonly [string, string, boolean?])[];
    dir?: 'rtl';
  }
): Record<RuntimeId, string> {
  const wrapOpen = options.dir ? `<div dir="rtl">\n` : '';
  const wrapClose = options.dir ? `\n</div>` : '';
  const rAttr = options.rootAttrs ? ` ${options.rootAttrs}` : '';
  const tAttr = options.triggerAttrs ? ` ${options.triggerAttrs}` : '';
  const wcItems = options.items
    .map(([v, t, d]) =>
      options.hasSurface
        ? `        <wc-${prefix}-select-item value="${v}" text-value="${t}"${d ? ' disabled' : ''}>\n          <wc-${prefix}-select-item-text>${t}</wc-${prefix}-select-item-text>\n        </wc-${prefix}-select-item>`
        : `    <wc-${prefix}-select-item value="${v}" text-value="${t}"${d ? ' disabled' : ''}>${t}</wc-${prefix}-select-item>`
    )
    .join('\n');
  const jsxItems = options.items
    .map(([v, t, d]) =>
      options.hasSurface
        ? `          <${pascal}SelectItem value="${v}" textValue="${t}"${d ? ' disabled' : ''}>\n            <${pascal}SelectItemText>${t}</${pascal}SelectItemText>\n          </${pascal}SelectItem>`
        : `      <${pascal}SelectItem value="${v}" textValue="${t}"${d ? ' disabled' : ''}>${t}</${pascal}SelectItem>`
    )
    .join('\n');
  const wcBody = options.hasSurface
    ? `    <wc-${prefix}-select-surface>\n      <wc-${prefix}-select-viewport>\n${wcItems}\n      </wc-${prefix}-select-viewport>\n    </wc-${prefix}-select-surface>`
    : wcItems;
  const jsxBody = options.hasSurface
    ? `      <${pascal}SelectSurface>\n        <${pascal}SelectViewport>\n${jsxItems}\n        </${pascal}SelectViewport>\n      </${pascal}SelectSurface>`
    : jsxItems;
  const parts = options.hasSurface
    ? [
        `${pascal}SelectContent`,
        `${pascal}SelectItem`,
        `${pascal}SelectItemText`,
        `${pascal}SelectRoot`,
        `${pascal}SelectSurface`,
        `${pascal}SelectTrigger`,
        `${pascal}SelectValue`,
        `${pascal}SelectViewport`,
      ]
    : [
        `${pascal}SelectContent`,
        `${pascal}SelectItem`,
        `${pascal}SelectRoot`,
        `${pascal}SelectTrigger`,
        `${pascal}SelectValue`,
      ];
  const importList = parts.join(',\n  ');

  return {
    wc: formatCode(`${wrapOpen}<wc-${prefix}-select-root${rAttr}>
  <wc-${prefix}-select-trigger${tAttr}>
    <wc-${prefix}-select-value placeholder="${options.placeholder}"></wc-${prefix}-select-value>
  </wc-${prefix}-select-trigger>
  <wc-${prefix}-select-content>
${wcBody}
  </wc-${prefix}-select-content>
</wc-${prefix}-select-root>${wrapClose}`),
    react: formatCode(`import {
  ${importList},
} from '../proto-ui/components/react';

export function ${pascal}SelectExample() {
  return (
    ${wrapOpen}<${pascal}SelectRoot${rAttr}>
      <${pascal}SelectTrigger${tAttr}>
        <${pascal}SelectValue placeholder="${options.placeholder}" />
      </${pascal}SelectTrigger>
      <${pascal}SelectContent>
${jsxBody}
      </${pascal}SelectContent>
    </${pascal}SelectRoot>${wrapClose}
  );
}`),
    vue: formatCode(`<script setup lang="ts">
import {
  ${importList},
} from '../proto-ui/components/vue';
</script>

<template>
  ${wrapOpen}<${pascal}SelectRoot${rAttr}>
    <${pascal}SelectTrigger${tAttr}>
      <${pascal}SelectValue placeholder="${options.placeholder}" />
    </${pascal}SelectTrigger>
    <${pascal}SelectContent>
${jsxBody}
    </${pascal}SelectContent>
  </${pascal}SelectRoot>${wrapClose}
</template>`),
    vue2: formatCode(`<template>
  ${wrapOpen}<${pascal}SelectRoot${rAttr}>
    <${pascal}SelectTrigger${tAttr}>
      <${pascal}SelectValue placeholder="${options.placeholder}" />
    </${pascal}SelectTrigger>
    <${pascal}SelectContent>
${jsxBody}
    </${pascal}SelectContent>
  </${pascal}SelectRoot>${wrapClose}
</template>

<script>
import {
  ${importList},
} from '../proto-ui/components/vue2';

export default {
  components: {
    ${parts.join(',\n    ')},
  },
};
</script>`),
  };
}

const shadcnAlignItem = shadcnSimple({
  rootAttrs: 'default-value="banana"',
  contentAttrs: 'position="item-aligned"',
  placeholder: 'Select a fruit',
  items: [
    ['apple', 'Apple'],
    ['banana', 'Banana'],
    ['blueberry', 'Blueberry'],
    ['grapes', 'Grapes'],
    ['pineapple', 'Pineapple'],
  ],
});

const shadcnScrollable = shadcnSimple({
  contentAttrs: 'position="popper"',
  placeholder: 'Select a timezone',
  items: [
    ['est', 'Eastern Standard Time (EST)'],
    ['pst', 'Pacific Standard Time (PST)'],
    ['gmt', 'Greenwich Mean Time (GMT)'],
    ['cet', 'Central European Time (CET)'],
    ['cst_china', 'China Standard Time (CST)'],
    ['jst', 'Japan Standard Time (JST)'],
    ['aest', 'Australian Eastern Standard Time (AEST)'],
  ],
});

const shadcnDisabled = shadcnSimple({
  rootAttrs: 'disabled',
  placeholder: 'Disabled select',
  items: [
    ['apple', 'Apple'],
    ['grapes', 'Grapes (Sold out)', true],
    ['pineapple', 'Pineapple'],
  ],
});

const shadcnSizes = shadcnSimple({
  triggerAttrs: 'size="sm"',
  placeholder: 'Small (sm)',
  items: [
    ['light', 'Light'],
    ['dark', 'Dark'],
    ['system', 'System'],
  ],
});

const shadcnRtl = shadcnSimple({
  dir: 'rtl',
  rootAttrs: 'default-value="apple"',
  placeholder: 'اختر فاكهة',
  items: [
    ['apple', 'تفاح'],
    ['banana', 'موز'],
    ['carrot', 'جزر'],
  ],
});

const shadcnControlled = shadcnSimple({
  rootAttrs: 'value="system"',
  contentAttrs: 'position="popper"',
  placeholder: 'Select a theme',
  items: [
    ['system', 'System'],
    ['light', 'Light'],
    ['dark', 'Dark'],
    ['high-contrast', 'High Contrast (Coming soon)', true],
  ],
});

const brutalistHero = familySelect('brutalist', 'Brutalist', {
  placeholder: 'Select a fruit',
  items: [
    ['apple', 'Apple'],
    ['banana', 'Banana'],
    ['blueberry', 'Blueberry'],
    ['grapes', 'Grapes'],
    ['pineapple', 'Pineapple'],
  ],
});

const brutalistAppearance = familySelect('brutalist', 'Brutalist', {
  triggerAttrs: 'appearance="elevated" size="sm"',
  placeholder: 'Elevated sm',
  items: [
    ['wc', 'Web Components'],
    ['react', 'React'],
    ['vue', 'Vue'],
  ],
});

const brutalistDisabled = familySelect('brutalist', 'Brutalist', {
  rootAttrs: 'disabled',
  placeholder: 'Disabled select',
  items: [
    ['apple', 'Apple'],
    ['grapes', 'Grapes (Sold out)', true],
    ['pineapple', 'Pineapple'],
  ],
});

const brutalistScrollable = familySelect('brutalist', 'Brutalist', {
  rootAttrs: 'value="jst"',
  placeholder: 'Select a timezone',
  items: [
    ['est', 'Eastern Standard Time (EST)'],
    ['gmt', 'Greenwich Mean Time (GMT)'],
    ['jst', 'Japan Standard Time (JST)'],
    ['aest', 'Australian Eastern Standard Time (AEST)'],
  ],
});

const bootstrapHero = familySelect('bootstrap-2-3-2', 'Bootstrap232', {
  hasSurface: true,
  rootAttrs: 'value="apple"',
  placeholder: 'Select a fruit',
  items: [
    ['apple', 'Apple'],
    ['banana', 'Banana'],
    ['carrot', 'Carrot'],
  ],
});

const bootstrapScrollable = familySelect('bootstrap-2-3-2', 'Bootstrap232', {
  hasSurface: true,
  placeholder: 'Select a timezone',
  items: [
    ['est', 'Eastern Standard Time (EST)'],
    ['gmt', 'Greenwich Mean Time (GMT)'],
    ['cst_china', 'China Standard Time (CST)'],
    ['jst', 'Japan Standard Time (JST)'],
  ],
});

const bootstrapDisabled = familySelect('bootstrap-2-3-2', 'Bootstrap232', {
  hasSurface: true,
  rootAttrs: 'disabled',
  placeholder: 'Disabled select',
  items: [
    ['apple', 'Apple'],
    ['grapes', 'Grapes (Sold out)', true],
    ['pineapple', 'Pineapple'],
  ],
});

const bootstrapRtl = familySelect('bootstrap-2-3-2', 'Bootstrap232', {
  hasSurface: true,
  dir: 'rtl',
  rootAttrs: 'default-value="apple"',
  placeholder: 'اختر فاكهة',
  items: [
    ['apple', 'تفاح'],
    ['banana', 'موز'],
    ['carrot', 'جزر'],
  ],
});

const liquidGlassHero = familySelect('liquid-glass', 'LiquidGlass', {
  hasSurface: true,
  rootAttrs: 'value="apple"',
  placeholder: 'Select a fruit',
  items: [
    ['apple', 'Apple'],
    ['banana', 'Banana'],
    ['carrot', 'Carrot'],
  ],
});

const liquidGlassScrollable = familySelect('liquid-glass', 'LiquidGlass', {
  hasSurface: true,
  placeholder: 'Select a timezone',
  items: [
    ['est', 'Eastern Standard Time (EST)'],
    ['gmt', 'Greenwich Mean Time (GMT)'],
    ['cst_china', 'China Standard Time (CST)'],
    ['jst', 'Japan Standard Time (JST)'],
  ],
});

const liquidGlassDisabled = familySelect('liquid-glass', 'LiquidGlass', {
  hasSurface: true,
  rootAttrs: 'disabled',
  placeholder: 'Disabled select',
  items: [
    ['apple', 'Apple'],
    ['grapes', 'Grapes (Sold out)', true],
    ['pineapple', 'Pineapple'],
  ],
});

const liquidGlassRtl = familySelect('liquid-glass', 'LiquidGlass', {
  hasSurface: true,
  dir: 'rtl',
  rootAttrs: 'default-value="apple"',
  placeholder: 'اختر فاكهة',
  items: [
    ['apple', 'تفاح'],
    ['banana', 'موز'],
    ['carrot', 'جزر'],
  ],
});

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-select': SHADCN_HERO_WC,
    'demo-shadcn-select-align-item': shadcnAlignItem.wc,
    'demo-shadcn-select-scrollable': shadcnScrollable.wc,
    'demo-shadcn-select-disabled': shadcnDisabled.wc,
    'demo-shadcn-select-sizes': shadcnSizes.wc,
    'demo-shadcn-select-rtl': shadcnRtl.wc,
    'demo-shadcn-select-input': shadcnControlled.wc,
    'demo-brutalist-select': brutalistHero.wc,
    'demo-brutalist-select-appearance': brutalistAppearance.wc,
    'demo-brutalist-select-disabled': brutalistDisabled.wc,
    'demo-brutalist-select-input': brutalistScrollable.wc,
    'demo-bootstrap-2-3-2-select': bootstrapHero.wc,
    'demo-bootstrap-2-3-2-select-scrollable': bootstrapScrollable.wc,
    'demo-bootstrap-2-3-2-select-disabled': bootstrapDisabled.wc,
    'demo-bootstrap-2-3-2-select-rtl': bootstrapRtl.wc,
    'demo-liquid-glass-select': liquidGlassHero.wc,
    'demo-liquid-glass-select-scrollable': liquidGlassScrollable.wc,
    'demo-liquid-glass-select-disabled': liquidGlassDisabled.wc,
    'demo-liquid-glass-select-rtl': liquidGlassRtl.wc,
  },
  react: {
    'demo-shadcn-select': SHADCN_HERO_REACT,
    'demo-shadcn-select-align-item': shadcnAlignItem.react,
    'demo-shadcn-select-scrollable': shadcnScrollable.react,
    'demo-shadcn-select-disabled': shadcnDisabled.react,
    'demo-shadcn-select-sizes': shadcnSizes.react,
    'demo-shadcn-select-rtl': shadcnRtl.react,
    'demo-shadcn-select-input': shadcnControlled.react,
    'demo-brutalist-select': brutalistHero.react,
    'demo-brutalist-select-appearance': brutalistAppearance.react,
    'demo-brutalist-select-disabled': brutalistDisabled.react,
    'demo-brutalist-select-input': brutalistScrollable.react,
    'demo-bootstrap-2-3-2-select': bootstrapHero.react,
    'demo-bootstrap-2-3-2-select-scrollable': bootstrapScrollable.react,
    'demo-bootstrap-2-3-2-select-disabled': bootstrapDisabled.react,
    'demo-bootstrap-2-3-2-select-rtl': bootstrapRtl.react,
    'demo-liquid-glass-select': liquidGlassHero.react,
    'demo-liquid-glass-select-scrollable': liquidGlassScrollable.react,
    'demo-liquid-glass-select-disabled': liquidGlassDisabled.react,
    'demo-liquid-glass-select-rtl': liquidGlassRtl.react,
  },
  vue: {
    'demo-shadcn-select': SHADCN_HERO_VUE,
    'demo-shadcn-select-align-item': shadcnAlignItem.vue,
    'demo-shadcn-select-scrollable': shadcnScrollable.vue,
    'demo-shadcn-select-disabled': shadcnDisabled.vue,
    'demo-shadcn-select-sizes': shadcnSizes.vue,
    'demo-shadcn-select-rtl': shadcnRtl.vue,
    'demo-shadcn-select-input': shadcnControlled.vue,
    'demo-brutalist-select': brutalistHero.vue,
    'demo-brutalist-select-appearance': brutalistAppearance.vue,
    'demo-brutalist-select-disabled': brutalistDisabled.vue,
    'demo-brutalist-select-input': brutalistScrollable.vue,
    'demo-bootstrap-2-3-2-select': bootstrapHero.vue,
    'demo-bootstrap-2-3-2-select-scrollable': bootstrapScrollable.vue,
    'demo-bootstrap-2-3-2-select-disabled': bootstrapDisabled.vue,
    'demo-bootstrap-2-3-2-select-rtl': bootstrapRtl.vue,
    'demo-liquid-glass-select': liquidGlassHero.vue,
    'demo-liquid-glass-select-scrollable': liquidGlassScrollable.vue,
    'demo-liquid-glass-select-disabled': liquidGlassDisabled.vue,
    'demo-liquid-glass-select-rtl': liquidGlassRtl.vue,
  },
  vue2: {
    'demo-shadcn-select': SHADCN_HERO_VUE2,
    'demo-shadcn-select-align-item': shadcnAlignItem.vue2,
    'demo-shadcn-select-scrollable': shadcnScrollable.vue2,
    'demo-shadcn-select-disabled': shadcnDisabled.vue2,
    'demo-shadcn-select-sizes': shadcnSizes.vue2,
    'demo-shadcn-select-rtl': shadcnRtl.vue2,
    'demo-shadcn-select-input': shadcnControlled.vue2,
    'demo-brutalist-select': brutalistHero.vue2,
    'demo-brutalist-select-appearance': brutalistAppearance.vue2,
    'demo-brutalist-select-disabled': brutalistDisabled.vue2,
    'demo-brutalist-select-input': brutalistScrollable.vue2,
    'demo-bootstrap-2-3-2-select': bootstrapHero.vue2,
    'demo-bootstrap-2-3-2-select-scrollable': bootstrapScrollable.vue2,
    'demo-bootstrap-2-3-2-select-disabled': bootstrapDisabled.vue2,
    'demo-bootstrap-2-3-2-select-rtl': bootstrapRtl.vue2,
    'demo-liquid-glass-select': liquidGlassHero.vue2,
    'demo-liquid-glass-select-scrollable': liquidGlassScrollable.vue2,
    'demo-liquid-glass-select-disabled': liquidGlassDisabled.vue2,
    'demo-liquid-glass-select-rtl': liquidGlassRtl.vue2,
  },
};
