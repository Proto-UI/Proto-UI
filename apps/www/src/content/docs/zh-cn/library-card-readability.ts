type MeasuredText = {
  width: number;
  overflow: number;
  fontSize: string;
  effectiveOpacity: number;
  visibility: string;
};
type ReadableCard = {
  family?: string;
  root: MeasuredText;
  title: MeasuredText;
  body: MeasuredText;
  action: MeasuredText;
  textLeaves: MeasuredText[];
};

/** Root scroll bounds alone miss text squeezed by a logo and enlarged gutters.
 * Three heading ems is the minimum useful line budget for these named entries;
 * it still allows wrapping without changing the family's actual font size. */
export function libraryCardReadabilityFailures(cards: ReadableCard[]): string[] {
  const failures: string[] = [];
  for (const card of cards) {
    for (const [name, text] of [
      ['root', card.root],
      ['title', card.title],
      ['body', card.body],
      ['action', card.action],
      ...card.textLeaves.map((text, index) => [`text[${index}]`, text] as const),
    ] as const) {
      if (!(text.width > 0) || text.overflow >= 2)
        failures.push(`${card.family}.${name}: width=${text.width}, overflow=${text.overflow}`);
      if (text.effectiveOpacity !== 1 || text.visibility !== 'visible')
        failures.push(`${card.family}.${name}: hidden text`);
    }
    if (!(card.title.width >= Number.parseFloat(card.title.fontSize) * 3))
      failures.push(`${card.family}.title: fewer than three ems of reading width`);
    card.textLeaves.forEach((text, index) => {
      if (!(text.width >= Number.parseFloat(text.fontSize) * 2))
        failures.push(`${card.family}.text[${index}]: fewer than two ems of reading width`);
    });
    if (!card.textLeaves.length) failures.push(`${card.family}: missing text leaves`);
  }
  return failures;
}

type PlatformFontRead = {
  error?: string;
  nodes: Array<{ name: string; missing?: boolean; fonts?: unknown }>;
};
/** The CSS alias is not evidence of which font actually drew the glyphs. */
export function libraryCardFontFailures(read: PlatformFontRead): string[] {
  const failures: string[] = [];
  if (read.error) failures.push(read.error);
  for (const name of ['caption', 'title', 'action']) {
    const node = read.nodes.find((node) => node.name === name);
    const fonts = (Array.isArray(node?.fonts) ? node.fonts : []) as Array<{
      familyName: string;
      glyphCount: number;
      isCustomFont: boolean;
    }>;
    if (
      !fonts.some(
        (font) =>
          /^DM Sans(?:\s|$)/.test(font.familyName) && font.isCustomFont && font.glyphCount > 0
      )
    )
      failures.push(`${name}: real DM Sans glyphs missing`);
    if (
      name === 'title' &&
      fonts.some((font) => font.glyphCount > 0 && !/^DM Sans(?:\s|$)/.test(font.familyName))
    )
      failures.push(`${name}: unexpected fallback glyphs`);
  }
  return failures;
}
