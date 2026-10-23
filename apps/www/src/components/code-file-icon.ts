/** Decorative file kinds supplement, never replace, the authored filename. */
export type CodeFileIcon = 'file' | 'file-code' | 'file-braces' | 'file-cog' | 'file-text';
export function codeFileIcon(path: string): CodeFileIcon {
  const name = path.split('/').at(-1)?.toLowerCase() ?? '';
  if (/\.(?:json|jsonc|json5)$/.test(name)) return 'file-braces';
  if (/\.(?:ya?ml|toml|ini)$/.test(name) || /^\.env(?:\.|$)/.test(name)) return 'file-cog';
  if (
    /\.(?:[cm]?[jt]sx?|vue|svelte|astro|html?|css|s[ac]ss|less|sh|bash|py|rs|go|java|[ch](?:pp)?)$/.test(
      name
    )
  )
    return 'file-code';
  if (/\.(?:mdx?|txt|rst)$/.test(name) || /^(?:license|readme)$/.test(name)) return 'file-text';
  return 'file';
}
