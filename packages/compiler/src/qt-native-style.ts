import { getSemanticGroupKeyV0 } from '../../core/src/spec/feedback/semantic-merge';
import type { StyleTokenHandle } from './style-plan';

const colors: Record<string, string> = {
  transparent: 'transparent', current: 'black', black: '#000000', white: '#ffffff',
  'red-500': '#ef4444', 'red-600': '#dc2626', 'green-500': '#22c55e', 'green-600': '#16a34a',
  'blue-500': '#3b82f6', 'blue-600': '#2563eb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db', 'gray-400': '#9ca3af', 'gray-500': '#6b7280', 'gray-600': '#4b5563',
  'gray-700': '#374151', 'gray-800': '#1f2937', 'gray-900': '#111827',
  'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0', 'slate-500': '#64748b', 'slate-900': '#0f172a',
  'yellow-500': '#eab308', 'purple-500': '#a855f7', 'pink-500': '#ec4899',
};
const sizes: Record<string, number> = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 };
const fixed: Record<string, Record<string, unknown>> = {
  flex: { layout: 'row' }, 'inline-flex': { layout: 'row' }, block: { layout: 'column' },
  'flex-row': { layout: 'row' }, 'flex-col': { layout: 'column' }, hidden: { shown: false },
  'overflow-hidden': { clipped: true }, 'overflow-visible': { clipped: false },
  'font-bold': { weight: 700 }, 'font-semibold': { weight: 600 }, 'font-medium': { weight: 500 },
  'font-normal': { weight: 400 }, italic: { italic: true }, 'not-italic': { italic: false },
  'text-left': { alignment: 'left' }, 'text-center': { alignment: 'center' }, 'text-right': { alignment: 'right' },
  'items-center': { cross: 'center' }, 'items-start': { cross: 'start' }, 'items-end': { cross: 'end' },
  'justify-center': { justify: 'center' }, 'justify-start': { justify: 'start' }, 'justify-end': { justify: 'end' },
  rounded: { radius: 4 }, 'rounded-none': { radius: 0 }, 'rounded-sm': { radius: 2 }, 'rounded-md': { radius: 6 },
  'rounded-lg': { radius: 8 }, 'rounded-xl': { radius: 12 }, 'rounded-full': { radius: 9999 },
  border: { borderWidth: 1 }, 'border-0': { borderWidth: 0 }, 'border-2': { borderWidth: 2 },
  'border-4': { borderWidth: 4 }, 'border-8': { borderWidth: 8 },
  'w-full': { fillWidth: true }, 'h-full': { fillHeight: true }, 'size-full': { fillWidth: true, fillHeight: true },
  'w-auto': { fixedWidth: -1 }, 'h-auto': { fixedHeight: -1 },
};

/** Resolve portable tokens once, at compile time; no host CSS parser or IR ships. */
export function qtStyleToken(token: string): Record<string, unknown> | undefined {
  if (fixed[token]) return fixed[token];
  const color = /^(bg|text|border)-(.+)$/.exec(token);
  if (color && colors[color[2]]) return { [color[1] === 'bg' ? 'background' : color[1] === 'text' ? 'foreground' : 'borderColor']: colors[color[2]] };
  if (token.startsWith('text-') && sizes[token.slice(5)]) return { fontSize: sizes[token.slice(5)] };
  const arbitraryColor = /^(bg|text|border)-\[(#[\da-fA-F]{3,8}|[a-zA-Z]+)\]$/.exec(token);
  if (arbitraryColor) return { [arbitraryColor[1] === 'bg' ? 'background' : arbitraryColor[1] === 'text' ? 'foreground' : 'borderColor']: arbitraryColor[2] };
  const scale = /^(w|h|min-w|min-h|max-w|max-h|size|p|px|py|pt|pr|pb|pl|gap|gap-x|gap-y|m|mx|my|mt|mr|mb|ml)-([0-9]+(?:\.[0-9]+)?|px|\[[0-9]+(?:\.[0-9]+)?px\])$/.exec(token);
  if (scale) {
    const n = scale[2] === 'px' ? 1 : scale[2].startsWith('[') ? Number(scale[2].slice(1, -3)) : Number(scale[2]) * 4;
    const keys: Record<string, readonly string[]> = { w: ['fixedWidth'], h: ['fixedHeight'], size: ['fixedWidth', 'fixedHeight'],
      'min-w': ['minWidth'], 'min-h': ['minHeight'], 'max-w': ['maxWidth'], 'max-h': ['maxHeight'],
      p: ['paddingTop','paddingRight','paddingBottom','paddingLeft'], px: ['paddingLeft','paddingRight'], py: ['paddingTop','paddingBottom'],
      pt: ['paddingTop'], pr: ['paddingRight'], pb: ['paddingBottom'], pl: ['paddingLeft'], gap: ['gap'], 'gap-x': ['gap'], 'gap-y': ['gap'],
      m: ['marginTop','marginRight','marginBottom','marginLeft'], mx: ['marginLeft','marginRight'], my: ['marginTop','marginBottom'],
      mt: ['marginTop'], mr: ['marginRight'], mb: ['marginBottom'], ml: ['marginLeft'] };
    return Object.fromEntries(keys[scale[1]].map((key) => [key, n]));
  }
  const opacity = /^opacity-(\d+)$/.exec(token);
  if (opacity) return { alpha: Number(opacity[1]) / 100 };
  const weight = /^font-\[(\d+)\]$/.exec(token);
  if (weight) return { weight: Number(weight[1]) };
  return undefined;
}

export function emitQtStyleHandle(handle: StyleTokenHandle): string {
  return JSON.stringify({ kind: 'tw', tokens: handle.tokens, groups: handle.tokens.map(getSemanticGroupKeyV0) });
}

export const qtStyleSource = `// Qt Quick style contributions, immediate projection only. No semantic render callback.
export function createStyle(options, table) {
  const chunks = [], rules = [], patches = new Map();
  let mounted = false, disposed = false, sequence = 0;
  function append(merged, handles) {
    for (const handle of handles) {
      if (!handle || handle.kind !== 'tw' || handle.tokens.length !== handle.groups.length) throw new TypeError('Invalid checked style handle');
      for (let i = 0; i < handle.tokens.length; ++i) merged.set(handle.groups[i], handle.tokens[i]);
    }
  }
  function tokens() {
    const merged = new Map();
    for (const chunk of chunks) if (chunk.active) append(merged, chunk.handles);
    if (mounted) for (const rule of rules) if (rule.active && rule.test()) append(merged, rule.handles);
    for (const group of patches.keys()) merged.delete(group);
    for (const [group, token] of patches) if (token !== null) merged.set(group, token);
    return Array.from(merged.values());
  }
  function properties(list) {
    const result = {};
    for (const token of list) {
      const entry = table[token];
      if (!entry) throw new Error('Unmapped Qt Quick token: ' + token);
      Object.assign(result, entry);
    }
    return result;
  }
  function refresh() { if (mounted && !disposed) options.project(properties(tokens())); }
  const api = {
    use() { options.setup(); const chunk = {handles: Array.from(arguments), active: true}; chunks.push(chunk); return () => { options.setup(); chunk.active = false; refresh(); }; },
    rule(test, handles) { options.setup(); const rule = {test, handles, active: true}; rules.push(rule); return {id: ++sequence, dispose() { options.setup(); rule.active = false; refresh(); }}; },
    patch() { options.runtime(); for (const h of arguments) for (let i=0;i<h.tokens.length;++i) patches.set(h.groups[i], h.tokens[i]); refresh(); },
    suppress() { options.runtime(); for (const h of arguments) for (const group of h.groups) patches.set(group, null); refresh(); },
    clearPatch() { options.runtime(); patches.clear(); refresh(); },
    mount() { mounted = true; refresh(); }, unmount() { mounted = false; }, refresh, properties,
    dispose() { disposed = true; mounted = false; chunks.length=0; rules.length=0; patches.clear(); }
  };
  return api;
}
`;
