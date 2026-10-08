import { writeFile } from 'node:fs/promises';
import type {
  BrowserContext,
  Page,
} from '../../../apps/www/node_modules/playwright-core/types/types';

export interface SystemFontEvidence {
  faceCount: number;
  labels: { font: string; text: string; available: boolean }[];
  platformFonts: {
    familyName: string;
    postScriptName: string;
    isCustomFont: boolean;
    glyphCount: number;
  }[][];
}

/** This finite fixture uses system Arial/sans-serif only, never downloadable faces. */
export function assertSystemFontEvidence(evidence: SystemFontEvidence): void {
  if (evidence.faceCount !== 0)
    throw new Error('First-paint fixture unexpectedly declares web fonts');
  if (!evidence.labels.length || evidence.labels.length !== evidence.platformFonts.length)
    throw new Error('First-paint font evidence is incomplete');
  for (const [index, label] of evidence.labels.entries()) {
    if (!label.available || !label.text || !label.font)
      throw new Error('First-paint label font is unavailable');
    const fonts = evidence.platformFonts[index];
    if (
      !fonts.length ||
      fonts.some(
        (font) =>
          font.isCustomFont || !font.familyName || !font.postScriptName || font.glyphCount <= 0
      )
    )
      throw new Error('First-paint label has no verified system-font glyphs');
  }
}

/**
 * Capture while a deferred client request is held. Playwright's screenshot helper
 * awaits document.fonts.ready, whose document-load dependency includes that request.
 * CDP captures the actual viewport without releasing the gate or waiting for load.
 * Explicit face inventory, availability and actual glyph checks keep font failures
 * blocking; a future web-font fixture must supply its own font-loading evidence.
 */
export async function captureButtonFirstPaint(
  page: Page,
  context: BrowserContext,
  outputPath: string
): Promise<{
  png: Buffer;
  fonts: SystemFontEvidence;
  documentState: { readyState: string; clientLoaded: boolean };
}> {
  const observed = await page.evaluate(() => ({
    documentState: {
      readyState: document.readyState,
      clientLoaded: !!(window as Window & { ButtonSsrFixture?: unknown }).ButtonSsrFixture,
    },
    faceCount: document.fonts.size,
    labels: [...document.querySelectorAll('[data-slot-label]')].map((label) => {
      const font = getComputedStyle(label).font;
      const text = label.textContent ?? '';
      return { font, text, available: document.fonts.check(font, text) };
    }),
  }));
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const document = await cdp.send('DOM.getDocument');
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
      nodeId: document.root.nodeId,
      selector: '[data-slot-label]',
    });
    const platformFonts = [];
    for (const nodeId of nodeIds) {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      platformFonts.push(fonts);
    }
    const { documentState, ...fontObservation } = observed;
    const fonts = { ...fontObservation, platformFonts };
    await writeFile(
      outputPath.replace(/\.png$/, '-fonts.json'),
      JSON.stringify({ documentState, fonts }, null, 2)
    );
    assertSystemFontEvidence(fonts);
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    const png = Buffer.from(data, 'base64');
    await writeFile(outputPath, png);
    return { png, fonts, documentState };
  } finally {
    await cdp.detach();
  }
}
